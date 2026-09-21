import {
  addIsoMonths,
  formatMonthShortIt,
  monthStart,
  romeToday,
} from "@/lib/offerte/dates";
import type { PunMonthPoint } from "@/lib/offerte/forward";
import { lookbackDayValueForTariff } from "@/lib/lookback";
import { toEurocentPerKwh } from "@/lib/insights";
import type { TariffPlanId } from "@/lib/fasce";
import type { ZoneHourlyPayload } from "@/lib/zone-home-types";

export const MONTH_OUTLOOK_COUNT = 13;
export const MONTH_OUTLOOK_RADIUS = 6;
export const MONTH_OUTLOOK_PAST_MONTHS = 12;
export const MONTH_OUTLOOK_FUTURE_MONTHS = 6;

export type MonthOutlookKind = "realized" | "partial" | "forward";

export type MonthOutlookPoint = {
  start: string;
  label: string;
  valueCents: number | null;
  kind: MonthOutlookKind | null;
  dayCount: number | null;
  isAnchor: boolean;
};

export type MonthOutlookSeries = {
  anchorDate: string;
  forwardAsOf: string | null;
  forwardSource: string | null;
  months: MonthOutlookPoint[];
  splitIndex: number | null;
};

export function monthOutlookStarts(anchorDate: string): string[] {
  const center = monthStart(anchorDate);
  return Array.from({ length: MONTH_OUTLOOK_COUNT }, (_, index) =>
    addIsoMonths(center, index - MONTH_OUTLOOK_RADIUS),
  );
}

export function monthOutlookPastStarts(anchorDate: string): string[] {
  const center = monthStart(anchorDate);
  return Array.from({ length: MONTH_OUTLOOK_RADIUS + 1 }, (_, index) =>
    addIsoMonths(center, index - MONTH_OUTLOOK_RADIUS),
  );
}

function earliestMonthWithHourly(
  hourly: ZoneHourlyPayload[],
  anchorDate: string,
): string | null {
  const anchorMonth = monthStart(anchorDate);
  let earliest: string | null = null;
  for (const day of hourly) {
    const month = monthStart(day.date);
    if (month > anchorMonth) continue;
    if (earliest == null || month < earliest) earliest = month;
  }
  return earliest;
}

function monthRangeInclusive(from: string, to: string): string[] {
  if (from > to) return [];
  const months: string[] = [];
  for (let cursor = from; cursor <= to; cursor = addIsoMonths(cursor, 1)) {
    months.push(cursor);
  }
  return months;
}

export function monthOutlookDefaultStarts(
  anchorDate: string,
  hourly: ZoneHourlyPayload[],
): string[] {
  const center = monthStart(anchorDate);
  const targetPastStart = addIsoMonths(center, -MONTH_OUTLOOK_PAST_MONTHS);
  const earliest = earliestMonthWithHourly(hourly, anchorDate);
  const pastStart =
    earliest == null
      ? targetPastStart
      : earliest > targetPastStart
        ? earliest
        : targetPastStart;

  return [
    ...monthRangeInclusive(pastStart, center),
    ...Array.from({ length: MONTH_OUTLOOK_FUTURE_MONTHS }, (_, index) =>
      addIsoMonths(center, index + 1),
    ),
  ];
}

export function monthOutlookStartsExpanded(
  anchorDate: string,
  hourly: ZoneHourlyPayload[],
  forwardMonths: PunMonthPoint[],
): string[] {
  const center = monthStart(anchorDate);
  const earliest = earliestMonthWithHourly(hourly, anchorDate);
  const past = earliest
    ? monthRangeInclusive(earliest, center)
    : monthOutlookPastStarts(anchorDate);
  const future = forwardMonths
    .map((month) => month.start)
    .filter((start) => start > center)
    .sort((a, b) => a.localeCompare(b));
  return [...past, ...future];
}

export function expandableForwardMonthCount(
  anchorDate: string,
  forwardMonths: PunMonthPoint[],
): number {
  const center = monthStart(anchorDate);
  return forwardMonths.filter(
    (month) => month.start > center && month.punEurMwh != null,
  ).length;
}

export function canExpandMonthOutlook(
  anchorDate: string,
  hourly: ZoneHourlyPayload[],
  forwardMonths: PunMonthPoint[],
): boolean {
  const defaultStarts = monthOutlookDefaultStarts(anchorDate, hourly);
  const expandedStarts = monthOutlookStartsExpanded(
    anchorDate,
    hourly,
    forwardMonths,
  );
  return expandedStarts.length > defaultStarts.length;
}

function zoneMonthAverage(
  hourly: ZoneHourlyPayload[],
  monthStartIso: string,
  tariff: TariffPlanId,
): { avg: number; dayCount: number } | null {
  const prefix = monthStartIso.slice(0, 7);
  const values: number[] = [];
  for (const day of hourly) {
    if (!day.date.startsWith(prefix)) continue;
    const value = lookbackDayValueForTariff(day.date, day.hours, tariff);
    if (value != null && Number.isFinite(value)) values.push(value);
  }
  if (values.length === 0) return null;
  return {
    avg: values.reduce((sum, value) => sum + value, 0) / values.length,
    dayCount: values.length,
  };
}

function forwardMonthMap(months: PunMonthPoint[]) {
  return new Map(months.map((month) => [month.start, month]));
}

export function buildMonthOutlook({
  anchorDate,
  hourly,
  tariff,
  forwardMonths,
  forwardAsOf,
  forwardSource,
  expanded = false,
  today = romeToday(),
}: {
  anchorDate: string;
  hourly: ZoneHourlyPayload[];
  tariff: TariffPlanId;
  forwardMonths: PunMonthPoint[];
  forwardAsOf: string | null;
  forwardSource: string | null;
  expanded?: boolean;
  today?: string;
}): MonthOutlookSeries {
  const anchorMonth = monthStart(anchorDate);
  const todayMonth = monthStart(today);
  const forwards = forwardMonthMap(forwardMonths);
  const starts = expanded
    ? monthOutlookStartsExpanded(anchorDate, hourly, forwardMonths)
    : monthOutlookDefaultStarts(anchorDate, hourly);

  const months = starts.map((start, index) => {
    const realized = zoneMonthAverage(hourly, start, tariff);
    const isAnchor = start === anchorMonth;

    if (realized && start <= todayMonth) {
      return {
        start,
        label: formatMonthShortIt(start),
        valueCents: realized.avg,
        kind: start === todayMonth ? ("partial" as const) : ("realized" as const),
        dayCount: realized.dayCount,
        isAnchor,
      };
    }

    const forward = forwards.get(start);
    if (forward?.punEurMwh != null) {
      return {
        start,
        label: formatMonthShortIt(start),
        valueCents: toEurocentPerKwh(forward.punEurMwh),
        kind: "forward" as const,
        dayCount: null,
        isAnchor,
      };
    }

    if (realized) {
      return {
        start,
        label: formatMonthShortIt(start),
        valueCents: realized.avg,
        kind: "realized" as const,
        dayCount: realized.dayCount,
        isAnchor,
      };
    }

    return {
      start,
      label: formatMonthShortIt(start),
      valueCents: null,
      kind: null,
      dayCount: null,
      isAnchor,
    };
  });

  const splitIndex = months.findIndex((month) => month.kind === "forward");

  return {
    anchorDate,
    forwardAsOf,
    forwardSource,
    months,
    splitIndex: splitIndex >= 0 ? splitIndex : null,
  };
}
