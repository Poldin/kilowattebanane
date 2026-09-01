import { createAdminClient } from "@/lib/supabase/admin";
import { MARKET_ZONE_IDS, type MarketZoneId } from "@/lib/market-zones";
import { isCompleteDay } from "@/lib/insights";

export type DayAheadRow = {
  delivery_date: string;
  slot_start: string;
  price_eur_mwh: number;
};

export type ZoneDay = {
  deliveryDate: string;
  prices: number[];
  noonIndex: number;
};

const PAGE_SIZE = 1000;

export type RomeNow = {
  date: string;
  hour: number;
  minute: number;
};

export function romeNow(): RomeNow {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());

  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return {
    date: `${value("year")}-${value("month")}-${value("day")}`,
    hour: Number(value("hour")),
    minute: Number(value("minute")),
  };
}

export function romeToday() {
  return romeNow().date;
}

export function romeNowHour() {
  return romeNow().hour;
}

function romeHour(iso: string) {
  return Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Europe/Rome",
      hour: "numeric",
      hourCycle: "h23",
    }).format(new Date(iso)),
  );
}

export function groupZoneDays(rows: DayAheadRow[]): ZoneDay[] {
  const byDate = new Map<string, DayAheadRow[]>();

  for (const row of rows) {
    const date = row.delivery_date;
    const list = byDate.get(date) ?? [];
    list.push(row);
    byDate.set(date, list);
  }

  return [...byDate.entries()]
    .map(([deliveryDate, slots]) => {
      const sorted = [...slots].sort((a, b) =>
        a.slot_start.localeCompare(b.slot_start),
      );
      const noonIndex = sorted.findIndex((slot) => romeHour(slot.slot_start) >= 12);
      return {
        deliveryDate,
        prices: sorted.map((slot) => Number(slot.price_eur_mwh)),
        noonIndex: noonIndex >= 0 ? noonIndex : Math.floor(sorted.length / 2),
      };
    })
    .sort((a, b) => b.deliveryDate.localeCompare(a.deliveryDate));
}

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
  const { count, error } = await supabase
    .from("day_ahead_prices")
    .select("*", { count: "exact", head: true })
    .eq("zone", zone)
    .eq("delivery_date", deliveryDate);

  if (error) throw new Error(error.message);
  return count ?? 0;
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

export async function listCompleteDeliveryDates(): Promise<string[]> {
  const supabase = createAdminClient();
  const counts = new Map<string, Map<string, number>>();
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("day_ahead_prices")
      .select("delivery_date, zone")
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw new Error(error.message);
    if (!data?.length) break;

    for (const row of data) {
      const date = row.delivery_date as string;
      const zone = row.zone as string;
      const byZone = counts.get(date) ?? new Map<string, number>();
      byZone.set(zone, (byZone.get(zone) ?? 0) + 1);
      counts.set(date, byZone);
    }

    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return [...counts.entries()]
    .filter(([, byZone]) =>
      [...byZone.values()].some((count) => isCompleteDay(count)),
    )
    .map(([date]) => date)
    .sort((a, b) => b.localeCompare(a));
}

export async function fetchPriceRowsSince(
  minDate: string,
): Promise<ZonedDayAheadRow[]> {
  const supabase = createAdminClient();
  const rows: ZonedDayAheadRow[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("day_ahead_prices")
      .select("delivery_date, slot_start, price_eur_mwh, zone")
      .gte("delivery_date", minDate)
      .order("slot_start", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw new Error(error.message);
    if (!data?.length) break;

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

    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return rows;
}

export async function fetchZonePrices(zone: MarketZoneId): Promise<DayAheadRow[]> {
  const supabase = createAdminClient();
  const rows: DayAheadRow[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("day_ahead_prices")
      .select("delivery_date, slot_start, price_eur_mwh")
      .eq("zone", zone)
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
