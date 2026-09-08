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

function isEntsoeUnauthorized(error: unknown) {
  return error instanceof Error && /HTTP 401/.test(error.message);
}

async function zonesCompleteForWindow(
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

  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    counts.set(`${row.zone}:${row.delivery_date}`, Number(row.slot_count));
  }

  const complete = new Set<MarketZoneId>();
  for (const zone of zoneIds) {
    if (dates.every((date) => isCompleteDay(counts.get(`${zone}:${date}`) ?? 0))) {
      complete.add(zone);
    }
  }
  return complete;
}

async function pullZone(options: {
  zone: MarketZoneId;
  from: string;
  to: string;
  periodStart: Date;
  periodEnd: Date;
  apiKey: string;
  skipEntsoe: boolean;
}): Promise<ZonePullResult & { slots: PriceSlot[] }> {
  if (!options.skipEntsoe) {
    try {
      const slots = await fetchEntsoePrices({
        zone: options.zone,
        periodStart: options.periodStart,
        periodEnd: options.periodEnd,
        apiKey: options.apiKey,
      });
      if (slots.length > 0) {
        return { zone: options.zone, source: "entsoe", slotCount: slots.length, slots };
      }
    } catch (error) {
      if (isEntsoeUnauthorized(error)) throw error;
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
      return { zone: options.zone, source: "energy-charts", slotCount: slots.length, slots };
    } catch (error) {
      lastError = error;
      const retryable = error instanceof Error && /HTTP 429/.test(error.message);
      if (!retryable || attempt === 4) break;
      await sleep(2500 * 2 ** attempt);
    }
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
  const alreadyComplete = await zonesCompleteForWindow(window.from, window.to, zoneIds);
  let skipEntsoe = false;

  for (const zone of zoneIds) {
    if (alreadyComplete.has(zone)) {
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
      zones.push({
        zone: result.zone,
        source: result.source,
        slotCount: result.slotCount,
      });
      allSlots.push(...result.slots);
      await sleep(400);
    } catch (error) {
      if (isEntsoeUnauthorized(error)) skipEntsoe = true;
      errors.push({
        zone,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const upserted = await upsertSlots(allSlots);
  return {
    from: window.from,
    to: window.to,
    upserted,
    zones,
    errors,
  };
}
