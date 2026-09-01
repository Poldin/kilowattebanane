import { addCalendarDays } from "@/lib/entsoe";
import { romeToday } from "@/lib/day-ahead-query";
import { createSecretClient } from "@/lib/supabase/secret";
import { buildPriceMailModel, type PriceMailModel } from "@/lib/mail/content";
import { sendDigestBatch } from "@/lib/mail/send";
import {
  listActiveSubscribers,
  sentSubscriberIds,
  type Subscriber,
} from "@/lib/subscribers";
import type { ItalianRegion, MarketZoneId } from "@/lib/market-zones";

function modelKey(zone: MarketZoneId, region: ItalianRegion) {
  return `${zone}:${region}`;
}

export async function sendDailyDigest(deliveryDate?: string) {
  const date = deliveryDate ?? addCalendarDays(romeToday(), 1);
  const supabase = createSecretClient();

  const { data: existing, error: lookupError } = await supabase
    .from("digest_runs")
    .select("status, started_at, attempt_count")
    .eq("delivery_date", date)
    .maybeSingle();

  if (lookupError) throw new Error(lookupError.message);

  if (existing?.status === "sent") {
    return { date, skipped: true as const, reason: "already-sent" };
  }

  if (existing?.status === "sending" && existing.started_at) {
    const started = new Date(existing.started_at).getTime();
    if (Date.now() - started < 10 * 60 * 1000) {
      return { date, skipped: true as const, reason: "in-progress" };
    }
  }

  const { error: claimError } = await supabase.from("digest_runs").upsert({
    delivery_date: date,
    status: "sending",
    started_at: new Date().toISOString(),
    attempt_count: (existing?.attempt_count ?? 0) + 1,
    queued_at: new Date().toISOString(),
    last_error: null,
  });
  if (claimError) throw new Error(claimError.message);

  try {
    const subscribers = await listActiveSubscribers();
    if (subscribers.length === 0) {
      await supabase
        .from("digest_runs")
        .update({
          status: "skipped",
          finished_at: new Date().toISOString(),
          zones_complete: [],
        })
        .eq("delivery_date", date);
      return { date, skipped: true as const, reason: "no-subscribers" };
    }

    const alreadySent = await sentSubscriberIds(date);
    const pending = subscribers.filter((row) => !alreadySent.has(row.id));
    const zonesComplete: MarketZoneId[] = [];
    const modelByKey = new Map<string, PriceMailModel>();
    const ready: Subscriber[] = [];

    const pairs = new Map<string, { zone: MarketZoneId; region: ItalianRegion }>();
    for (const subscriber of pending) {
      pairs.set(modelKey(subscriber.zone, subscriber.region), {
        zone: subscriber.zone,
        region: subscriber.region,
      });
    }

    for (const { zone, region } of pairs.values()) {
      const model = await buildPriceMailModel(region, zone, date);
      if (!model) continue;
      zonesComplete.push(zone);
      modelByKey.set(modelKey(zone, region), model);
    }

    const uniqueComplete = [...new Set(zonesComplete)];

    for (const subscriber of pending) {
      if (modelByKey.has(modelKey(subscriber.zone, subscriber.region))) {
        ready.push(subscriber);
      }
    }

    if (ready.length === 0) {
      await supabase
        .from("digest_runs")
        .update({
          status: "partial",
          finished_at: new Date().toISOString(),
          zones_complete: uniqueComplete,
          last_error: "Nessuna zona pronta per gli iscritti",
        })
        .eq("delivery_date", date);
      return {
        date,
        skipped: false as const,
        sent: 0,
        pending: pending.length,
        zonesComplete: uniqueComplete,
      };
    }

    const ids = await sendDigestBatch(date, ready, modelByKey);

    const deliveries = ready.map((subscriber, index) => ({
      delivery_date: date,
      subscriber_id: subscriber.id,
      zone: subscriber.zone,
      resend_id: ids[index] ?? null,
      status: ids[index] ? "sent" : "failed",
    }));

    if (deliveries.length > 0) {
      const { error: insertError } = await supabase
        .from("digest_deliveries")
        .upsert(deliveries, { onConflict: "delivery_date,subscriber_id" });
      if (insertError) throw new Error(insertError.message);
    }

    const remaining = pending.length - ready.length;
    const status = remaining > 0 ? "partial" : "sent";
    await supabase
      .from("digest_runs")
      .update({
        status,
        finished_at: new Date().toISOString(),
        zones_complete: uniqueComplete,
        last_error: remaining > 0 ? "Alcune zone non erano ancora complete" : null,
      })
      .eq("delivery_date", date);

    return {
      date,
      skipped: false as const,
      sent: ready.length,
      pending: remaining,
      zonesComplete: uniqueComplete,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Digest failed";
    await supabase
      .from("digest_runs")
      .update({
        status: "failed",
        finished_at: new Date().toISOString(),
        last_error: message,
      })
      .eq("delivery_date", date);
    throw error;
  }
}
