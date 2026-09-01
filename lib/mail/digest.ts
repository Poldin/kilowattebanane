import { addCalendarDays } from "@/lib/entsoe";
import { romeToday } from "@/lib/day-ahead-query";
import { createSecretClient } from "@/lib/supabase/secret";
import { buildZoneMailContent } from "@/lib/mail/content";
import { sendZoneDigest } from "@/lib/mail/send";
import {
  listActiveSubscribers,
  sentSubscriberIds,
  type Subscriber,
} from "@/lib/subscribers";
import type { MarketZoneId } from "@/lib/market-zones";

function groupByZone(subscribers: Subscriber[]) {
  const groups = new Map<MarketZoneId, Subscriber[]>();
  for (const subscriber of subscribers) {
    const list = groups.get(subscriber.zone) ?? [];
    list.push(subscriber);
    groups.set(subscriber.zone, list);
  }
  return groups;
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
    let sent = 0;

    for (const [zone, recipients] of groupByZone(pending)) {
      const content = await buildZoneMailContent(zone, date);
      if (!content) continue;

      const ids = await sendZoneDigest(date, zone, recipients, content);
      zonesComplete.push(zone);
      sent += recipients.length;

      const deliveries = recipients.map((subscriber, index) => ({
        delivery_date: date,
        subscriber_id: subscriber.id,
        zone: subscriber.zone,
        resend_id: ids[index] ?? null,
        status: ids[index] ? "sent" : "failed",
      }));

      const { error: insertError } = await supabase
        .from("digest_deliveries")
        .upsert(deliveries, { onConflict: "delivery_date,subscriber_id" });
      if (insertError) throw new Error(insertError.message);
    }

    const remaining = pending.length - sent;
    if (sent === 0) {
      await supabase
        .from("digest_runs")
        .update({
          status: "partial",
          finished_at: new Date().toISOString(),
          zones_complete: zonesComplete,
          last_error: "Nessuna zona pronta per gli iscritti",
        })
        .eq("delivery_date", date);
      return {
        date,
        skipped: false as const,
        sent: 0,
        pending: pending.length,
        zonesComplete: zonesComplete,
      };
    }

    const status = remaining > 0 ? "partial" : "sent";
    await supabase
      .from("digest_runs")
      .update({
        status,
        finished_at: new Date().toISOString(),
        zones_complete: zonesComplete,
        last_error: remaining > 0 ? "Alcune zone non erano ancora complete" : null,
      })
      .eq("delivery_date", date);

    return {
      date,
      skipped: false as const,
      sent,
      pending: remaining,
      zonesComplete,
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
