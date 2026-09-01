import { addCalendarDays } from "@/lib/entsoe";
import { countZoneDaySlots, romeToday } from "@/lib/day-ahead-query";
import { isCompleteDay } from "@/lib/insights";
import { createSecretClient } from "@/lib/supabase/secret";
import { buildZoneMailContent } from "@/lib/mail/content";
import { sendZoneDigest } from "@/lib/mail/send";
import {
  listActiveSubscribers,
  sentSubscriberIds,
  type Subscriber,
} from "@/lib/subscribers";
import type { MarketZoneId } from "@/lib/market-zones";

type DigestRunRow = {
  status: string;
  started_at: string | null;
  attempt_count: number | null;
};

function groupByZone(subscribers: Subscriber[]) {
  const groups = new Map<MarketZoneId, Subscriber[]>();
  for (const subscriber of subscribers) {
    const list = groups.get(subscriber.zone) ?? [];
    list.push(subscriber);
    groups.set(subscriber.zone, list);
  }
  return groups;
}

function isInProgress(run: DigestRunRow | null) {
  if (!run || run.status !== "sending" || !run.started_at) return false;
  return Date.now() - new Date(run.started_at).getTime() < 10 * 60 * 1000;
}

async function loadRun(
  supabase: ReturnType<typeof createSecretClient>,
  date: string,
) {
  const { data, error } = await supabase
    .from("digest_runs")
    .select("status, started_at, attempt_count")
    .eq("delivery_date", date)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as DigestRunRow | null;
}

async function anyZoneComplete(zones: MarketZoneId[], date: string) {
  for (const zone of zones) {
    if (isCompleteDay(await countZoneDaySlots(zone, date))) return true;
  }
  return false;
}

async function resolveDigestDate(
  supabase: ReturnType<typeof createSecretClient>,
  zones: MarketZoneId[],
) {
  const today = romeToday();
  const tomorrow = addCalendarDays(today, 1);
  const tomorrowRun = await loadRun(supabase, tomorrow);

  if (tomorrowRun?.status !== "sent" && !isInProgress(tomorrowRun)) {
    if (await anyZoneComplete(zones, tomorrow)) {
      return { date: tomorrow, picked: "tomorrow" as const };
    }
  }

  if (isInProgress(tomorrowRun) || tomorrowRun?.status === "sent") {
    return null;
  }

  const todayRun = await loadRun(supabase, today);
  if (todayRun?.status === "sent" || isInProgress(todayRun)) {
    return null;
  }
  if (await anyZoneComplete(zones, today)) {
    return { date: today, picked: "today" as const };
  }

  return null;
}

export async function sendDailyDigest(deliveryDate?: string) {
  const supabase = createSecretClient();
  const subscribers = await listActiveSubscribers();
  const zones = [...new Set(subscribers.map((row) => row.zone))];

  let date: string;
  let picked: "explicit" | "tomorrow" | "today";

  if (deliveryDate) {
    date = deliveryDate;
    picked = "explicit";
  } else {
    const resolved = await resolveDigestDate(supabase, zones);
    if (!resolved) {
      return {
        date: addCalendarDays(romeToday(), 1),
        skipped: true as const,
        reason: "nothing-to-send" as const,
      };
    }
    date = resolved.date;
    picked = resolved.picked;
  }

  const existing = await loadRun(supabase, date);

  if (existing?.status === "sent") {
    return { date, skipped: true as const, reason: "already-sent" as const, picked };
  }

  if (isInProgress(existing)) {
    return { date, skipped: true as const, reason: "in-progress" as const, picked };
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
    if (subscribers.length === 0) {
      await supabase
        .from("digest_runs")
        .update({
          status: "skipped",
          finished_at: new Date().toISOString(),
          zones_complete: [],
        })
        .eq("delivery_date", date);
      return { date, skipped: true as const, reason: "no-subscribers" as const, picked };
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
        zonesComplete,
        picked,
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
      picked,
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
