import {
  addCalendarDays,
  deliveryDateInRome,
  fetchEnergyChartsPrices,
  fetchEntsoePrices,
  romeMidnightUtc,
  type PriceSlot,
  type ZonePullResult,
} from "@/lib/entsoe";
import { isCompleteDay } from "@/lib/insights";
import { MARKET_ZONES, type MarketZoneId } from "@/lib/market-zones";
import { createAdminClient } from "@/lib/supabase/admin";

const ZONES = Object.keys(MARKET_ZONES) as MarketZoneId[];
const UPSERT_CHUNK = 500;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type PullSummary = {
  from: string;
  to: string;
  upserted: number;
  incompleteDates: string[];
  zones: ZonePullResult[];
  errors: { zone: MarketZoneId; message: string }[];
};

function chunk<T>(items: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export function pullWindow(daysBack: number, aheadDays = 1) {
  const today = deliveryDateInRome(new Date());
  const from = addCalendarDays(today, -Math.max(0, daysBack));
  const to = addCalendarDays(today, Math.max(0, aheadDays));
  return rangeWindow(from, to);
}

export function rangeWindow(from: string, to: string) {
  if (from > to) {
    return rangeWindow(to, from);
  }
  return {
    from,
    to,
    periodStart: romeMidnightUtc(from),
    periodEnd: romeMidnightUtc(addCalendarDays(to, 1)),
  };
}

async function upsertSlots(slots: PriceSlot[]) {
  if (slots.length === 0) return 0;
  const supabase = createAdminClient();
  const fetchedAt = new Date().toISOString();
  let upserted = 0;

  for (const group of chunk(slots, UPSERT_CHUNK)) {
    const { error, data } = await supabase
      .from("day_ahead_prices")
      .upsert(
        group.map((slot) => ({
          zone: slot.zone,
          delivery_date: slot.deliveryDate,
          slot_start: slot.slotStart.toISOString(),
          price_eur_mwh: slot.priceEurMwh,
          fetched_at: fetchedAt,
        })),
        { onConflict: "zone,slot_start" },
      )
      .select("id");

    if (error) throw new Error(error.message);
    upserted += data?.length ?? group.length;
  }

  return upserted;
}

function datesInclusive(from: string, to: string) {
  const dates = [from];
  for (let cursor = from; cursor < to; ) {
    cursor = addCalendarDays(cursor, 1);
    dates.push(cursor);
  }
  return dates;
}

function isEntsoeUnavailable(error: unknown) {
  if (!(error instanceof Error)) return false;
  const haystack = `${error.name} ${error.message}`;
  return /HTTP (401|403|404)|TimeoutError|Timeout|aborted|fetch failed/i.test(haystack);
}

function slotKey(zone: MarketZoneId, date: string) {
  return `${zone}:${date}`;
}

function completeDatesInSlots(slots: PriceSlot[], from: string, to: string) {
  const requested = datesInclusive(from, to);
  const counts = new Map<string, number>();
  for (const slot of slots) {
    counts.set(slot.deliveryDate, (counts.get(slot.deliveryDate) ?? 0) + 1);
  }
  return requested.filter((date) => isCompleteDay(counts.get(date) ?? 0));
}

function windowIsComplete(slots: PriceSlot[], from: string, to: string) {
  return completeDatesInSlots(slots, from, to).length === datesInclusive(from, to).length;
}

async function existingCompleteKeys(
  from: string,
  to: string,
  zoneIds: MarketZoneId[],
) {
  const dates = datesInclusive(from, to);
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("day_ahead_day_stats")
    .select("zone, delivery_date, slot_count")
    .in("zone", zoneIds)
    .gte("delivery_date", from)
    .lte("delivery_date", to);
  if (error) throw new Error(error.message);

  const completeKeys = new Set<string>();
  for (const row of data ?? []) {
    if (isCompleteDay(Number(row.slot_count))) {
      completeKeys.add(slotKey(row.zone as MarketZoneId, String(row.delivery_date)));
    }
  }

  const completeZones = new Set<MarketZoneId>();
  for (const zone of zoneIds) {
    if (dates.every((date) => completeKeys.has(slotKey(zone, date)))) {
      completeZones.add(zone);
    }
  }
  return { dates, completeKeys, completeZones };
}

async function pullZone(options: {
  zone: MarketZoneId;
  from: string;
  to: string;
  periodStart: Date;
  periodEnd: Date;
  apiKey: string;
  skipEntsoe: boolean;
}): Promise<ZonePullResult & { slots: PriceSlot[]; disableEntsoe?: boolean }> {
  let disableEntsoe = false;
  let best: { source: "entsoe" | "energy-charts"; slots: PriceSlot[] } | undefined;

  if (!options.skipEntsoe) {
    try {
      const slots = await fetchEntsoePrices({
        zone: options.zone,
        periodStart: options.periodStart,
        periodEnd: options.periodEnd,
        apiKey: options.apiKey,
      });
      if (windowIsComplete(slots, options.from, options.to)) {
        return { zone: options.zone, source: "entsoe", slotCount: slots.length, slots };
      }
      if (slots.length > 0) best = { source: "entsoe", slots };
    } catch (error) {
      if (isEntsoeUnavailable(error)) disableEntsoe = true;
    }
  }

  let lastError: unknown;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const slots = await fetchEnergyChartsPrices({
        zone: options.zone,
        startDate: options.from,
        endDate: options.to,
      });
      if (
        windowIsComplete(slots, options.from, options.to) ||
        slots.length >= (best?.slots.length ?? 0)
      ) {
        return {
          zone: options.zone,
          source: "energy-charts",
          slotCount: slots.length,
          slots,
          disableEntsoe,
        };
      }
    } catch (error) {
      lastError = error;
      const retryable = error instanceof Error && /HTTP 429/.test(error.message);
      if (!retryable || attempt === 4) break;
      await sleep(2500 * 2 ** attempt);
    }
  }

  if (best) {
    return {
      zone: options.zone,
      source: best.source,
      slotCount: best.slots.length,
      slots: best.slots,
      disableEntsoe,
    };
  }
  throw lastError instanceof Error ? lastError : new Error("energy-charts failed");
}

export async function pullDayAheadRange(
  from: string,
  to: string,
  zoneIds: MarketZoneId[] = ZONES,
): Promise<PullSummary> {
  return pullDayAheadForWindow(rangeWindow(from, to), zoneIds);
}

export async function pullDayAheadPrices(
  daysBack = 0,
  aheadDays = 1,
  zoneIds: MarketZoneId[] = ZONES,
): Promise<PullSummary> {
  return pullDayAheadForWindow(pullWindow(daysBack, aheadDays), zoneIds);
}

async function pullDayAheadForWindow(
  window: ReturnType<typeof rangeWindow>,
  zoneIds: MarketZoneId[],
): Promise<PullSummary> {
  const apiKey = process.env.ENTSOE_API_KEY;
  if (!apiKey) throw new Error("Missing ENTSOE_API_KEY");

  const zones: ZonePullResult[] = [];
  const errors: PullSummary["errors"] = [];
  const allSlots: PriceSlot[] = [];
  const { dates, completeKeys, completeZones } = await existingCompleteKeys(
    window.from,
    window.to,
    zoneIds,
  );
  let skipEntsoe = false;

  for (const zone of zoneIds) {
    if (completeZones.has(zone)) {
      zones.push({ zone, source: "skipped", slotCount: 0 });
      continue;
    }
    try {
      const result = await pullZone({
        zone,
        from: window.from,
        to: window.to,
        periodStart: window.periodStart,
        periodEnd: window.periodEnd,
        apiKey,
        skipEntsoe,
      });
      if (result.disableEntsoe) skipEntsoe = true;
      zones.push({
        zone: result.zone,
        source: result.source,
        slotCount: result.slotCount,
      });
      allSlots.push(...result.slots);
      await sleep(400);
    } catch (error) {
      if (isEntsoeUnavailable(error)) skipEntsoe = true;
      errors.push({
        zone,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const fetchedCounts = new Map<string, number>();
  for (const slot of allSlots) {
    const key = slotKey(slot.zone, slot.deliveryDate);
    fetchedCounts.set(key, (fetchedCounts.get(key) ?? 0) + 1);
  }

  const incompleteDates = [
    ...new Set(
      zoneIds.flatMap((zone) =>
        dates.filter((date) => {
          const key = slotKey(zone, date);
          if (completeKeys.has(key)) return false;
          return !isCompleteDay(fetchedCounts.get(key) ?? 0);
        }),
      ),
    ),
  ].sort();

  const slotsToUpsert = allSlots.filter(
    (slot) => !completeKeys.has(slotKey(slot.zone, slot.deliveryDate)),
  );
  const upserted = await upsertSlots(slotsToUpsert);
  return {
    from: window.from,
    to: window.to,
    upserted,
    incompleteDates,
    zones,
    errors,
  };
}
