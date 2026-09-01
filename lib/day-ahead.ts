import {
  addCalendarDays,
  deliveryDateInRome,
  fetchEnergyChartsPrices,
  fetchEntsoePrices,
  romeMidnightUtc,
  type PriceSlot,
  type ZonePullResult,
} from "@/lib/entsoe";
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
      if (error instanceof Error && /HTTP 401/.test(error.message)) throw error;
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
      await sleep(1000 * 2 ** attempt);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("energy-charts failed");
}

export async function pullDayAheadPrices(
  daysBack = 0,
  aheadDays = 1,
  zoneIds: MarketZoneId[] = ZONES,
): Promise<PullSummary> {
  const apiKey = process.env.ENTSOE_API_KEY;
  if (!apiKey) throw new Error("Missing ENTSOE_API_KEY");

  const window = pullWindow(daysBack, aheadDays);
  const zones: ZonePullResult[] = [];
  const errors: PullSummary["errors"] = [];
  const allSlots: PriceSlot[] = [];
  let skipEntsoe = false;

  for (const zone of zoneIds) {
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
      if (result.source !== "entsoe") skipEntsoe = true;
      zones.push({
        zone: result.zone,
        source: result.source,
        slotCount: result.slotCount,
      });
      allSlots.push(...result.slots);
      await sleep(400);
    } catch (error) {
      skipEntsoe = true;
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
