import { unstable_cache } from "next/cache";
import {
  fetchZoneDayPrices,
  fetchZoneDayStats,
  fetchZoneHourlyStats,
  fetchZonePriceRange,
} from "@/lib/day-ahead-query";
import { pickDefaultDeliveryDate } from "@/lib/day-ahead-core";
import { MIN_COMPLETE_SLOTS } from "@/lib/insights";
import { lookbackPointFromHours } from "@/lib/lookback";
import type { MarketZoneId } from "@/lib/market-zones";
import type { ZoneHomePayload } from "@/lib/zone-home-types";

export type { ZoneHomePayload, ZoneHourlyPayload } from "@/lib/zone-home-types";

const CACHE: { revalidate: number; tags: string[] } = {
  revalidate: 3600,
  tags: ["prices"],
};

async function loadZoneSeriesUncached(zone: MarketZoneId) {
  const [stats, hourlyRows] = await Promise.all([
    fetchZoneDayStats(zone),
    fetchZoneHourlyStats(zone),
  ]);
  const complete = new Set(
    stats
      .filter((row) => row.slotCount >= MIN_COMPLETE_SLOTS)
      .map((row) => row.deliveryDate),
  );
  const dates = [...complete].sort((a, b) => b.localeCompare(a));
  const hourly = hourlyRows
    .filter((row) => complete.has(row.deliveryDate) && row.hours.length === 24)
    .map((row) => ({ date: row.deliveryDate, hours: row.hours }));
  const points = hourly.flatMap((row) => {
    const point = lookbackPointFromHours(row.date, row.hours);
    return point ? [point] : [];
  });

  return { dates, points, hourly };
}

export const loadZoneSeries = unstable_cache(
  loadZoneSeriesUncached,
  ["zone-series"],
  CACHE,
);

export const loadZoneDaySlots = unstable_cache(
  async (zone: MarketZoneId, date: string) => fetchZoneDayPrices(zone, date),
  ["zone-day-slots"],
  CACHE,
);

export const loadZoneSlots = unstable_cache(
  async (zone: MarketZoneId, fromDate: string, toDate: string) =>
    fetchZonePriceRange(zone, fromDate, toDate),
  ["zone-slots"],
  CACHE,
);

export async function loadZoneHome(
  zone: MarketZoneId,
  requestedDate?: string,
): Promise<ZoneHomePayload> {
  const series = await loadZoneSeries(zone);
  const date =
    (requestedDate && series.dates.includes(requestedDate)
      ? requestedDate
      : null) ?? pickDefaultDeliveryDate(series.dates);
  const slots = date ? await loadZoneDaySlots(zone, date) : [];
  return { zone, date, slots, ...series };
}
