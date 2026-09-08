import { addCalendarDays } from "@/lib/entsoe";
import { fetchZoneDayPrices, groupZoneDays, romeToday } from "@/lib/day-ahead-query";
import {
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
import {
  cheapPeakForTariff,
  fasciaAveragesFromQuarters,
  fasciaBadgesForPlan,
  fasciaBadgeLabel,
  fasciaRangeLabel,
  FASCIA_LEGEND_COLOR,
  MAIL_DEFAULT_TARIFF_PLAN,
  tariffPlanLabel,
  type FasciaStatId,
  type TariffPlanId,
} from "@/lib/fasce";
import { computeTariffTips } from "@/lib/tariff-tips";
import { resolveMailTariff } from "@/lib/tariff-pref";

export type ZoneMailDay = {
  deliveryDate: string;
  dateLabel: string;
  zone: MarketZoneId;
  zoneName: string;
  prices: number[];
};

export type MailFasciaStat = {
  id: FasciaStatId;
  label: string;
  priceLabel: string;
  rangeLabel: string | null;
  mark: "cheap" | "peak" | null;
  color: string;
};

export type ZoneMailContent = {
  deliveryDate: string;
  dateLabel: string;
  zone: MarketZoneId;
  zoneName: string;
  tariff: TariffPlanId;
  tariffLabel: string;
  bestTip: string;
  worstTip: string;
  minLabel: string;
  avgLabel: string;
  maxLabel: string;
  fasciaStats: MailFasciaStat[];
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

function fasciaStatsForMail(
  ymd: string,
  prices: number[],
  tariff: TariffPlanId,
): MailFasciaStat[] {
  const ids = fasciaBadgesForPlan(tariff);
  if (ids.length === 0) return [];

  const avgs = fasciaAveragesFromQuarters(ymd, prices);
  const { cheap, peak } = cheapPeakForTariff(tariff, avgs, ids);

  return ids.map((id) => {
    const value = avgs[id];
    return {
      id,
      label: fasciaBadgeLabel(id),
      priceLabel:
        value != null && Number.isFinite(value) ? formatEurocent(value) : "—",
      rangeLabel: fasciaRangeLabel(ymd, id),
      mark: cheap === id ? "cheap" : peak === id ? "peak" : null,
      color: FASCIA_LEGEND_COLOR[id],
    };
  });
}

export async function loadZoneMailDay(
  zone: MarketZoneId,
  deliveryDate: string,
): Promise<ZoneMailDay | null> {
  const rows = await fetchZoneDayPrices(zone, deliveryDate);
  if (!isCompleteDay(rows.length)) return null;

  const day = groupZoneDays(rows)[0];
  if (!day) return null;

  return {
    deliveryDate,
    dateLabel: formatMailDate(deliveryDate),
    zone,
    zoneName: MARKET_ZONES[zone].name,
    prices: day.prices,
  };
}

export function zoneMailContentFromDay(
  day: ZoneMailDay,
  tariff: TariffPlanId = MAIL_DEFAULT_TARIFF_PLAN,
): ZoneMailContent {
  const resolved = resolveMailTariff(tariff);
  const tips = computeTariffTips(day.prices, day.deliveryDate, resolved);
  const hourly = toHourlyAverages(day.prices);
  const pricesCent = hourly.map(toEurocentPerKwh);
  const { min, avg, max } = dayHourlyCentStats(day.prices);

  return {
    deliveryDate: day.deliveryDate,
    dateLabel: day.dateLabel,
    zone: day.zone,
    zoneName: day.zoneName,
    tariff: resolved,
    tariffLabel: tariffPlanLabel(resolved),
    bestTip: tips.bestTip,
    worstTip: tips.worstTip,
    minLabel: formatEurocent(min),
    avgLabel: formatEurocent(avg),
    maxLabel: formatEurocent(max),
    fasciaStats: fasciaStatsForMail(day.deliveryDate, day.prices, resolved),
    hourly: pricesCent.map((price, hour) => ({
      hour,
      label: `${String(hour).padStart(2, "0")}:00`,
      priceLabel: formatEurocent(price),
    })),
    chartUrl: mailChartUrl(day.zone, day.deliveryDate, resolved),
  };
}

export async function buildZoneMailContent(
  zone: MarketZoneId,
  deliveryDate: string,
  tariff: TariffPlanId = MAIL_DEFAULT_TARIFF_PLAN,
): Promise<ZoneMailContent | null> {
  const day = await loadZoneMailDay(zone, deliveryDate);
  if (!day) return null;
  return zoneMailContentFromDay(day, tariff);
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
  tariff: TariffPlanId = MAIL_DEFAULT_TARIFF_PLAN,
): Promise<PriceMailModel | null> {
  const content = await buildZoneMailContent(zone, deliveryDate, tariff);
  if (!content) return null;
  return priceMailModelForRegion(content, region);
}

export function digestSubjectLine(model: PriceMailModel) {
  return `Prezzi di ${model.dateLabel} · zona ${model.zoneName}`;
}
