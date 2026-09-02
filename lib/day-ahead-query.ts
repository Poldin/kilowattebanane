import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import type { DayAheadRow } from "@/lib/day-ahead-core";
import { MARKET_ZONE_IDS, type MarketZoneId } from "@/lib/market-zones";
import { MIN_COMPLETE_SLOTS } from "@/lib/insights";

export type {
  DayAheadRow,
  RomeNow,
  ZoneDay,
} from "@/lib/day-ahead-core";
export {
  groupZoneDays,
  pickDefaultDeliveryDate,
  romeNow,
  romeNowHour,
  romeToday,
} from "@/lib/day-ahead-core";

const PAGE_SIZE = 1000;

export async function fetchZoneDayPrices(
  zone: MarketZoneId,
  deliveryDate: string,
): Promise<DayAheadRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("day_ahead_prices")
    .select("delivery_date, slot_start, price_eur_mwh")
    .eq("zone", zone)
    .eq("delivery_date", deliveryDate)
    .order("slot_start", { ascending: true });

  if (error) throw new Error(error.message);
  if (!data?.length) return [];

  return data.map((row) => ({
    delivery_date: row.delivery_date as string,
    slot_start: row.slot_start as string,
    price_eur_mwh: Number(row.price_eur_mwh),
  }));
}

export async function countZoneDaySlots(zone: MarketZoneId, deliveryDate: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("day_ahead_day_stats")
    .select("slot_count")
    .eq("zone", zone)
    .eq("delivery_date", deliveryDate)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data?.slot_count ?? 0;
}

export type ZonedDayAheadRow = DayAheadRow & { zone: MarketZoneId };

function asZone(value: string): MarketZoneId | null {
  return MARKET_ZONE_IDS.includes(value as MarketZoneId)
    ? (value as MarketZoneId)
    : null;
}

export async function fetchDayPrices(
  deliveryDate: string,
): Promise<ZonedDayAheadRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("day_ahead_prices")
    .select("delivery_date, slot_start, price_eur_mwh, zone")
    .eq("delivery_date", deliveryDate)
    .order("slot_start", { ascending: true });

  if (error) throw new Error(error.message);
  if (!data?.length) return [];

  const rows: ZonedDayAheadRow[] = [];
  for (const row of data) {
    const zone = asZone(row.zone as string);
    if (!zone) continue;
    rows.push({
      delivery_date: row.delivery_date as string,
      slot_start: row.slot_start as string,
      price_eur_mwh: Number(row.price_eur_mwh),
      zone,
    });
  }
  return rows;
}

export type DayAheadDayStat = {
  zone: MarketZoneId;
  deliveryDate: string;
  slotCount: number;
  minEurMwh: number;
  avgEurMwh: number;
  maxEurMwh: number;
};

function mapDayStat(row: {
  zone: unknown;
  delivery_date: unknown;
  slot_count: unknown;
  min_eur_mwh: unknown;
  avg_eur_mwh: unknown;
  max_eur_mwh: unknown;
}): DayAheadDayStat | null {
  const zone = asZone(row.zone as string);
  if (!zone) return null;
  return {
    zone,
    deliveryDate: row.delivery_date as string,
    slotCount: Number(row.slot_count),
    minEurMwh: Number(row.min_eur_mwh),
    avgEurMwh: Number(row.avg_eur_mwh),
    maxEurMwh: Number(row.max_eur_mwh),
  };
}

async function listCompleteDeliveryDatesUncached(): Promise<string[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("list_complete_delivery_dates", {
    min_slots: MIN_COMPLETE_SLOTS,
  });

  if (error) throw new Error(error.message);
  if (!data?.length) return [];

  return (data as string[]).map(String).sort((a, b) => b.localeCompare(a));
}

export const listCompleteDeliveryDates = unstable_cache(
  listCompleteDeliveryDatesUncached,
  ["complete-delivery-dates"],
  { revalidate: 3600, tags: ["prices"] },
);

export async function fetchDayStatsForDates(
  dates: string[],
): Promise<DayAheadDayStat[]> {
  if (dates.length === 0) return [];

  const supabase = createAdminClient();
  const rows: DayAheadDayStat[] = [];

  for (let i = 0; i < dates.length; i += PAGE_SIZE) {
    const chunk = dates.slice(i, i + PAGE_SIZE);
    const { data, error } = await supabase
      .from("day_ahead_day_stats")
      .select("zone, delivery_date, slot_count, min_eur_mwh, avg_eur_mwh, max_eur_mwh")
      .in("delivery_date", chunk)
      .gte("slot_count", MIN_COMPLETE_SLOTS);

    if (error) throw new Error(error.message);
    if (!data?.length) continue;

    for (const row of data) {
      const mapped = mapDayStat(row);
      if (mapped) rows.push(mapped);
    }
  }

  return rows;
}

export async function fetchZoneDayStats(zone: MarketZoneId): Promise<DayAheadDayStat[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("day_ahead_day_stats")
    .select("zone, delivery_date, slot_count, min_eur_mwh, avg_eur_mwh, max_eur_mwh")
    .eq("zone", zone)
    .gte("slot_count", MIN_COMPLETE_SLOTS)
    .order("delivery_date", { ascending: false });

  if (error) throw new Error(error.message);
  if (!data?.length) return [];

  const rows: DayAheadDayStat[] = [];
  for (const row of data) {
    const mapped = mapDayStat(row);
    if (mapped) rows.push(mapped);
  }
  return rows;
}

export type ZoneHourlyRow = {
  deliveryDate: string;
  hours: (number | null)[];
};

function mapHourlyArray(value: unknown): (number | null)[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) =>
    item == null || item === "" ? null : Number(item),
  );
}

export async function fetchZoneHourlyStats(zone: MarketZoneId): Promise<ZoneHourlyRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("day_ahead_hourly_stats")
    .select("delivery_date, avg_eur_mwh")
    .eq("zone", zone)
    .order("delivery_date", { ascending: true });

  if (error) throw new Error(error.message);
  if (!data?.length) return [];

  return data.map((row) => ({
    deliveryDate: row.delivery_date as string,
    hours: mapHourlyArray(row.avg_eur_mwh),
  }));
}

export async function fetchZonePriceRange(
  zone: MarketZoneId,
  fromDate: string,
  toDate: string,
): Promise<DayAheadRow[]> {
  const supabase = createAdminClient();
  const rows: DayAheadRow[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("day_ahead_prices")
      .select("delivery_date, slot_start, price_eur_mwh")
      .eq("zone", zone)
      .gte("delivery_date", fromDate)
      .lte("delivery_date", toDate)
      .order("slot_start", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw new Error(error.message);
    if (!data?.length) break;

    rows.push(
      ...data.map((row) => ({
        delivery_date: row.delivery_date as string,
        slot_start: row.slot_start as string,
        price_eur_mwh: Number(row.price_eur_mwh),
      })),
    );

    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return rows;
}
