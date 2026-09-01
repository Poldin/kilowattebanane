import { createAdminClient } from "@/lib/supabase/admin";
import type { MarketZoneId } from "@/lib/market-zones";

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

export function romeToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function romeNowHour() {
  return Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Europe/Rome",
      hour: "numeric",
      hourCycle: "h23",
    }).format(new Date()),
  );
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
