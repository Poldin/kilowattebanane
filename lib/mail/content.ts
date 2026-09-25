import { addCalendarDays } from "@/lib/entsoe";
import {
  fetchZoneDayPrices,
  fetchZoneHourlyStatsSince,
  groupZoneDays,
  romeToday,
} from "@/lib/day-ahead-query";
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
import {
  mailChartUrl,
  mailLearnUrl,
  mailMixChartUrl,
  mailOfferCompareUrl,
  mailOfferStatsUrl,
  mailOutlookChartUrl,
  mailShareUrl,
  publicSiteUrl,
} from "@/lib/app-url";
import { formatGwh, formatShare } from "@/lib/generation/format";
import { loadMailItalyMix } from "@/lib/generation/load";
import { mixSummaryKpis, mixSummaryLead, summarizeMixDay } from "@/lib/generation/summary";
import { formatMixDate } from "@/lib/generation/time";
import type { ItalyMixPayload } from "@/lib/generation/types";
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
import {
  deltaPercentTone,
  formatDeltaPercent,
  formatYearPercentile,
  priceDeltaComparisonsForTariff,
  YEAR_LOOKBACK_DAYS,
  yearWindowPercentileForTariff,
  type YearPercentileCopy,
} from "@/lib/lookback";
import type { ZoneHourlyPayload } from "@/lib/zone-home-types";

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

export type MailKpiColumn = {
  key: string;
  label: string;
  value: string;
  hint: string | null;
  color?: string;
};

export type MailPriceDeltaColumn = {
  key: string;
  label: string;
  value: string;
  tone: "expensive" | "cheap" | "mid";
};

export type MailMixBlock = {
  chartUrl: string;
  dateLabel: string;
  lead: string;
  renewable: string;
  fossil: string;
  energy: string;
  kpis: MailKpiColumn[];
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
  kpiColumns: MailKpiColumn[];
  hourly: { hour: number; label: string; priceLabel: string }[];
  chartUrl: string;
  outlookChartUrl: string;
  mix: MailMixBlock | null;
  yearPercentile: YearPercentileCopy | null;
  priceDeltas: MailPriceDeltaColumn[];
};

export type PriceMailModel = ZoneMailContent & {
  region: ItalianRegion;
  ctaUrl: string;
  learnUrl: string;
  offerCompareUrl: string;
  offerStatsUrl: string;
  shareUrl: string;
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

function mailKpiColumns(
  ymd: string,
  prices: number[],
  tariff: TariffPlanId,
): MailKpiColumn[] {
  if (tariff === "dinamica") {
    const { min, avg, max, minHours, maxHours } = dayHourlyCentStats(prices);
    return [
      { key: "min", label: "min", value: formatEurocent(min), hint: minHours },
      { key: "medio", label: "medio", value: formatEurocent(avg), hint: "0–24" },
      { key: "max", label: "max", value: formatEurocent(max), hint: maxHours },
    ];
  }

  return fasciaStatsForMail(ymd, prices, tariff).map((stat) => ({
    key: stat.id,
    label: `${stat.mark === "cheap" ? "🍌 " : stat.mark === "peak" ? "🐵 " : ""}${stat.label}`,
    value: stat.priceLabel,
    hint: stat.rangeLabel,
    color: stat.color,
  }));
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

function mergeMailDayHourly(
  hourly: ZoneHourlyPayload[],
  day: ZoneMailDay,
): ZoneHourlyPayload[] {
  const hours = toHourlyAverages(day.prices);
  return [
    ...hourly.filter((row) => row.date !== day.deliveryDate),
    { date: day.deliveryDate, hours },
  ];
}

function mergedMailHistory(day: ZoneMailDay, history: ZoneHourlyPayload[]) {
  return mergeMailDayHourly(history, day);
}

function yearPercentileForMail(
  day: ZoneMailDay,
  tariff: TariffPlanId,
  history: ZoneHourlyPayload[],
) {
  const context = yearWindowPercentileForTariff(
    mergedMailHistory(day, history),
    day.deliveryDate,
    tariff,
  );
  return context ? formatYearPercentile(context, romeToday()) : null;
}

function mailPriceDeltaColumns(
  day: ZoneMailDay,
  tariff: TariffPlanId,
  history: ZoneHourlyPayload[],
): MailPriceDeltaColumn[] {
  return priceDeltaComparisonsForTariff(
    mergedMailHistory(day, history),
    day.deliveryDate,
    tariff,
  ).map((delta) => ({
    key: delta.kind === "period" ? String(delta.days) : delta.kind,
    label: delta.label,
    value: formatDeltaPercent(delta.changePercent),
    tone: deltaPercentTone(delta.changePercent),
  }));
}

function mailMixBlock(mix: ItalyMixPayload | null): MailMixBlock | null {
  if (!mix) return null;
  const summary = summarizeMixDay(mix);
  if (!summary) return null;
  const dateLabel = formatMixDate(mix.date);
  return {
    chartUrl: mailMixChartUrl(mix.date),
    dateLabel,
    lead: mixSummaryLead(dateLabel, summary),
    renewable: formatShare(summary.renewableShare),
    fossil: formatShare(summary.fossilShare),
    energy: formatGwh(summary.energyMwh),
    kpis: mixSummaryKpis(summary),
  };
}

export function zoneMailContentFromDay(
  day: ZoneMailDay,
  tariff: TariffPlanId = MAIL_DEFAULT_TARIFF_PLAN,
  history: ZoneHourlyPayload[] = [],
  mix: ItalyMixPayload | null = null,
): ZoneMailContent {
  const resolved = resolveMailTariff(tariff);
  const tips = computeTariffTips(day.prices, day.deliveryDate, resolved);
  const hourly = toHourlyAverages(day.prices);
  const pricesCent = hourly.map(toEurocentPerKwh);
  return {
    deliveryDate: day.deliveryDate,
    dateLabel: day.dateLabel,
    zone: day.zone,
    zoneName: day.zoneName,
    tariff: resolved,
    tariffLabel: tariffPlanLabel(resolved),
    bestTip: tips.bestTip,
    worstTip: tips.worstTip,
    kpiColumns: mailKpiColumns(day.deliveryDate, day.prices, resolved),
    hourly: pricesCent.map((price, hour) => ({
      hour,
      label: `${String(hour).padStart(2, "0")}:00`,
      priceLabel: formatEurocent(price),
    })),
    chartUrl: mailChartUrl(day.zone, day.deliveryDate, resolved),
    outlookChartUrl: mailOutlookChartUrl(day.zone, day.deliveryDate, resolved),
    mix: mailMixBlock(mix),
    yearPercentile: yearPercentileForMail(day, resolved, history),
    priceDeltas: mailPriceDeltaColumns(day, resolved, history),
  };
}

export async function loadZoneMailHistory(
  zone: MarketZoneId,
  aroundDate: string,
): Promise<ZoneHourlyPayload[]> {
  const from = addCalendarDays(aroundDate, -(YEAR_LOOKBACK_DAYS + 7));
  const rows = await fetchZoneHourlyStatsSince(zone, from);
  return rows
    .filter((row) => row.hours.length === 24)
    .map((row) => ({ date: row.deliveryDate, hours: row.hours }));
}

export async function buildZoneMailContent(
  zone: MarketZoneId,
  deliveryDate: string,
  tariff: TariffPlanId = MAIL_DEFAULT_TARIFF_PLAN,
): Promise<ZoneMailContent | null> {
  const [day, history, mix] = await Promise.all([
    loadZoneMailDay(zone, deliveryDate),
    loadZoneMailHistory(zone, deliveryDate),
    loadMailItalyMix(),
  ]);
  if (!day) return null;
  return zoneMailContentFromDay(day, tariff, history, mix);
}

export function priceMailModelForRegion(
  content: ZoneMailContent,
  region: ItalianRegion,
): PriceMailModel {
  return {
    ...content,
    region,
    ctaUrl: pricesShareUrl(publicSiteUrl(), region, content.deliveryDate),
    learnUrl: mailLearnUrl(),
    offerCompareUrl: mailOfferCompareUrl(),
    offerStatsUrl: mailOfferStatsUrl(),
    shareUrl: mailShareUrl(),
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
