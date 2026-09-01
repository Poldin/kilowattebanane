import { addCalendarDays } from "@/lib/entsoe";
import { fetchZoneDayPrices, groupZoneDays, romeToday } from "@/lib/day-ahead-query";
import {
  computeRecommendations,
  dayHourlyCentStats,
  formatEurocent,
  isCompleteDay,
  toEurocentPerKwh,
} from "@/lib/insights";
import {
  MARKET_ZONES,
  pricesShareUrl,
  type ItalianRegion,
  type MarketZoneId,
} from "@/lib/market-zones";
import { toHourlyAverages } from "@/lib/prices";
import { mailChartUrl, publicSiteUrl } from "@/lib/app-url";

export type ZoneMailContent = {
  deliveryDate: string;
  dateLabel: string;
  zone: MarketZoneId;
  zoneName: string;
  bestTip: string;
  worstTip: string;
  minLabel: string;
  avgLabel: string;
  maxLabel: string;
  hourly: { hour: number; label: string; priceLabel: string }[];
  chartUrl: string;
};

export type PriceMailModel = ZoneMailContent & {
  region: ItalianRegion;
  ctaUrl: string;
};

export function formatMailDate(ymd: string, today = romeToday()) {
  const [year, month, day] = ymd.split("-").map(Number);
  const formatted = new Date(Date.UTC(year, month - 1, day, 12)).toLocaleDateString(
    "it-IT",
    { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" },
  );
  if (ymd === today) return `oggi · ${formatted}`;
  if (ymd === addCalendarDays(today, 1)) return `domani · ${formatted}`;
  return formatted;
}

export async function buildZoneMailContent(
  zone: MarketZoneId,
  deliveryDate: string,
): Promise<ZoneMailContent | null> {
  const rows = await fetchZoneDayPrices(zone, deliveryDate);
  if (!isCompleteDay(rows.length)) return null;

  const day = groupZoneDays(rows)[0];
  if (!day) return null;

  const recommendations = computeRecommendations(day.prices);
  const hourly = toHourlyAverages(day.prices);
  const pricesCent = hourly.map(toEurocentPerKwh);
  const { min, avg, max } = dayHourlyCentStats(day.prices);

  return {
    deliveryDate,
    dateLabel: formatMailDate(deliveryDate),
    zone,
    zoneName: MARKET_ZONES[zone].name,
    bestTip: recommendations.bestTip,
    worstTip: recommendations.worstTip,
    minLabel: formatEurocent(min),
    avgLabel: formatEurocent(avg),
    maxLabel: formatEurocent(max),
    hourly: pricesCent.map((price, hour) => ({
      hour,
      label: `${String(hour).padStart(2, "0")}:00`,
      priceLabel: formatEurocent(price),
    })),
    chartUrl: mailChartUrl(zone, deliveryDate),
  };
}

export function priceMailModelForRegion(
  content: ZoneMailContent,
  region: ItalianRegion,
): PriceMailModel {
  return {
    ...content,
    region,
    ctaUrl: pricesShareUrl(publicSiteUrl(), region, content.deliveryDate),
  };
}

export async function buildPriceMailModel(
  region: ItalianRegion,
  zone: MarketZoneId,
  deliveryDate: string,
): Promise<PriceMailModel | null> {
  const content = await buildZoneMailContent(zone, deliveryDate);
  if (!content) return null;
  return priceMailModelForRegion(content, region);
}

export function digestSubjectLine(model: PriceMailModel) {
  return `Prezzi di ${model.dateLabel} · zona ${model.zoneName}`;
}
