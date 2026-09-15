import { addCalendarDays } from "@/lib/entsoe";
import { formatEurocent } from "@/lib/insights";
import {
  buildMonthOutlook,
  type MonthOutlookPoint,
} from "@/lib/monthly-outlook";
import type { TariffPlanId } from "@/lib/fasce";
import type { PunMonthPoint } from "@/lib/offerte/forward";
import type { ZoneHourlyPayload } from "@/lib/zone-home-types";

export const MAIL_OUTLOOK_W = 1120;
export const MAIL_OUTLOOK_H = 448;
export const MAIL_OUTLOOK_DISPLAY_W = 512;
export const MAIL_OUTLOOK_DISPLAY_H = Math.round(
  (MAIL_OUTLOOK_DISPLAY_W * MAIL_OUTLOOK_H) / MAIL_OUTLOOK_W,
);

const BANANA = "#F5D547";
const PAST = "#F5F5F5";
const FORWARD = "#E5E5E5";
const CHART_BG = "#111111";
const PAD = { t: 28, r: 28, b: 106, l: 28 };
const VALUE_BAND = 40;

export type MailOutlookBar = {
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
  fillOpacity: number;
  isForward: boolean;
  isAnchor: boolean;
  valueLabel: string | null;
  monthLabel: string;
};

export type MailOutlookChartLayout = {
  width: number;
  height: number;
  bars: MailOutlookBar[];
  monthLabels: {
    x: number;
    y: number;
    label: string;
    isAnchor: boolean;
  }[];
  forwardAsOfLabel: string | null;
};

function formatMonthAxisLabel(isoDate: string) {
  const [year, month] = isoDate.split("-").map(Number);
  const monthShort = new Intl.DateTimeFormat("it-IT", {
    month: "short",
    timeZone: "UTC",
  })
    .format(new Date(Date.UTC(year, month - 1, 1)))
    .replace(".", "")
    .trim();
  return `${monthShort} '${String(year).slice(-2)}`;
}

function formatForwardAsOf(ymd: string) {
  const [year, month, day] = ymd.split("-").map(Number);
  return new Intl.DateTimeFormat("it-IT", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

export function buildMailOutlookChartLayout({
  anchorDate,
  hourly,
  tariff,
  forwardMonths,
  forwardAsOf,
}: {
  anchorDate: string;
  hourly: ZoneHourlyPayload[];
  tariff: TariffPlanId;
  forwardMonths: PunMonthPoint[];
  forwardAsOf: string | null;
}): MailOutlookChartLayout | null {
  const series = buildMonthOutlook({
    anchorDate,
    hourly,
    tariff,
    forwardMonths,
    forwardAsOf,
    forwardSource: null,
    expanded: false,
  });

  const priced = series.months.filter(
    (month): month is MonthOutlookPoint & { valueCents: number } =>
      month.valueCents != null && Number.isFinite(month.valueCents),
  );
  if (priced.length < 2) return null;

  const values = priced.map((month) => month.valueCents);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const innerW = MAIL_OUTLOOK_W - PAD.l - PAD.r;
  const innerH = MAIL_OUTLOOK_H - PAD.t - PAD.b;
  const barGap = 8;
  const barW = (innerW - barGap * (priced.length - 1)) / priced.length;
  const plotTop = PAD.t + VALUE_BAND;
  const plotBottom = PAD.t + innerH;
  const plotH = plotBottom - plotTop;
  const minBarH = plotH * 0.14;
  const labelPivotY = plotBottom + 34;
  const showValues = barW >= 28;

  const yFor = (value: number) =>
    plotTop + plotH - minBarH - ((value - min) / span) * (plotH - minBarH);

  const bars: MailOutlookBar[] = [];
  const monthLabels: MailOutlookChartLayout["monthLabels"] = [];
  let barIndex = 0;

  for (const month of series.months) {
    if (month.valueCents == null) continue;
    const x = PAD.l + barIndex * (barW + barGap);
    const y = yFor(month.valueCents);
    const isForward = month.kind === "forward";
    const isAnchor = month.isAnchor;
    const cx = x + barW / 2;

    bars.push({
      x,
      y,
      width: barW,
      height: Math.max(plotBottom - y, 4),
      fill: isAnchor ? BANANA : isForward ? FORWARD : PAST,
      fillOpacity: isAnchor ? 1 : isForward ? 1 : month.kind === "partial" ? 0.82 : 1,
      isForward,
      isAnchor,
      valueLabel: showValues ? formatEurocent(month.valueCents, 1) : null,
      monthLabel: formatMonthAxisLabel(month.start),
    });

    monthLabels.push({
      x: cx,
      y: labelPivotY,
      label: formatMonthAxisLabel(month.start),
      isAnchor,
    });

    barIndex += 1;
  }

  return {
    width: MAIL_OUTLOOK_W,
    height: MAIL_OUTLOOK_H,
    bars,
    monthLabels,
    forwardAsOfLabel: forwardAsOf ? formatForwardAsOf(forwardAsOf) : null,
  };
}

export function mailOutlookHistoryFrom(aroundDate: string) {
  return addCalendarDays(aroundDate, -240);
}
