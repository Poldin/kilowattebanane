import { addCalendarDays } from "@/lib/entsoe";
import type { ZoneDay } from "@/lib/day-ahead-query";
import { isCompleteDay, toEurocentPerKwh } from "@/lib/insights";
import { toHourlyAverages } from "@/lib/prices";

export const LOOKBACK_RANGES = [
  { id: "1", label: "1", days: 1 },
  { id: "10", label: "10", days: 10 },
  { id: "30", label: "30", days: 30 },
  { id: "60", label: "60", days: 60 },
  { id: "90", label: "90", days: 90 },
  { id: "1y", label: "1A", days: 365 },
  { id: "max", label: "Max", days: null },
] as const;

export type LookbackRangeId = (typeof LOOKBACK_RANGES)[number]["id"];
export const DEFAULT_LOOKBACK_RANGE: LookbackRangeId = "30";

export type LookbackDayPoint = {
  date: string;
  min: number;
  avg: number;
  max: number;
};

export type LookbackWindowStats = {
  min: number;
  avg: number;
  max: number;
};

export function completeLookbackDays(days: ZoneDay[]) {
  return [...days]
    .filter((day) => isCompleteDay(day.prices.length))
    .sort((a, b) => a.deliveryDate.localeCompare(b.deliveryDate));
}

export function sliceLookbackDays(
  days: ZoneDay[],
  rangeDays: number | null,
  endDate: string,
) {
  const complete = completeLookbackDays(days);
  if (rangeDays == null) {
    return complete.filter((day) => day.deliveryDate <= endDate);
  }
  const start = addCalendarDays(endDate, -(rangeDays - 1));
  return complete.filter(
    (day) => day.deliveryDate >= start && day.deliveryDate <= endDate,
  );
}

export function lookbackEndDate(days: ZoneDay[]) {
  const complete = completeLookbackDays(days);
  return complete[complete.length - 1]?.deliveryDate ?? null;
}

export function toLookbackDayPoints(days: ZoneDay[]): LookbackDayPoint[] {
  return days.map((day) => {
    const hourly = toHourlyAverages(day.prices).map(toEurocentPerKwh);
    const min = Math.min(...hourly);
    const max = Math.max(...hourly);
    const avg = hourly.reduce((sum, value) => sum + value, 0) / hourly.length;
    return { date: day.deliveryDate, min, avg, max };
  });
}

export function lookbackWindowStats(days: ZoneDay[]): LookbackWindowStats | null {
  const hourly: number[] = [];
  for (const day of days) {
    hourly.push(...toHourlyAverages(day.prices).map(toEurocentPerKwh));
  }
  if (hourly.length === 0) return null;
  const min = Math.min(...hourly);
  const max = Math.max(...hourly);
  const avg = hourly.reduce((sum, value) => sum + value, 0) / hourly.length;
  return { min, avg, max };
}

export function dayHourlyCentSeries(day: ZoneDay) {
  return toHourlyAverages(day.prices).map(toEurocentPerKwh);
}

export function valuesToPoints(
  values: number[],
  min: number,
  max: number,
  chartH: number,
  chartW: number,
  pad: { t: number; r: number; b: number; l: number },
) {
  const range = max - min || 1;
  const innerH = chartH - pad.t - pad.b;
  const innerW = chartW - pad.l - pad.r;
  const n = values.length;
  return values.map((price, i) => ({
    x: n <= 1 ? pad.l + innerW / 2 : pad.l + (i / (n - 1)) * innerW,
    y: pad.t + (1 - (price - min) / range) * innerH,
  }));
}

export function bandPath(
  maxPoints: { x: number; y: number }[],
  minPoints: { x: number; y: number }[],
) {
  if (maxPoints.length === 0 || minPoints.length === 0) return "";
  let d = `M ${maxPoints[0].x} ${maxPoints[0].y}`;
  for (let i = 1; i < maxPoints.length; i++) {
    d += ` L ${maxPoints[i].x} ${maxPoints[i].y}`;
  }
  for (let i = minPoints.length - 1; i >= 0; i--) {
    d += ` L ${minPoints[i].x} ${minPoints[i].y}`;
  }
  return `${d} Z`;
}

export function pointerToIndex(
  clientX: number,
  rect: DOMRect,
  n: number,
  chartW: number,
  pad: { t: number; r: number; b: number; l: number },
) {
  if (n <= 0 || rect.width <= 0) return 0;
  const x = ((clientX - rect.left) / rect.width) * chartW;
  const innerW = chartW - pad.l - pad.r;
  if (n === 1) return 0;
  const t = (x - pad.l) / innerW;
  return Math.min(n - 1, Math.max(0, Math.round(t * (n - 1))));
}

export function pickAxisTicks(count: number) {
  if (count <= 1) return [0];
  if (count <= 8) return Array.from({ length: count }, (_, i) => i);
  const target = count <= 30 ? 6 : 5;
  const ticks = new Set<number>([0, count - 1]);
  for (let i = 1; i < target - 1; i++) {
    ticks.add(Math.round((i / (target - 1)) * (count - 1)));
  }
  return [...ticks].sort((a, b) => a - b);
}

export function formatLookbackDate(ymd: string, withYear = false) {
  const [year, month, day] = ymd.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12)).toLocaleDateString(
    "it-IT",
    {
      day: "numeric",
      month: "short",
      ...(withYear ? { year: "numeric" as const } : {}),
      timeZone: "UTC",
    },
  );
}

export function formatLookbackCaption(days: ZoneDay[]) {
  if (days.length === 0) return "";
  const first = days[0].deliveryDate;
  const last = days[days.length - 1].deliveryDate;
  const countLabel =
    days.length === 1 ? "1 giorno" : `${days.length} giorni`;
  if (first === last) {
    return `${formatLookbackDate(first, true)} · ${countLabel}`;
  }
  const spanYears = first.slice(0, 4) !== last.slice(0, 4);
  return `${formatLookbackDate(first, spanYears)} – ${formatLookbackDate(last, spanYears)} · ${countLabel}`;
}

export function lookbackRangeById(id: LookbackRangeId) {
  return LOOKBACK_RANGES.find((range) => range.id === id) ?? LOOKBACK_RANGES[2];
}

const AVG_TIE_EPS = 0.005;

export type LatestDayRank = {
  date: string;
  count: number;
  expensiveRank: number;
  cheapRank: number;
  ties: number;
};

export type LatestDayRankCopy = {
  before: string;
  mark: string;
  after: string;
  tone: "expensive" | "cheap" | "mid";
};

export function latestDayWindowRank(days: ZoneDay[]): LatestDayRank | null {
  const points = toLookbackDayPoints(days);
  if (points.length < 2) return null;
  const latest = points[points.length - 1];
  const higher = points.filter((point) => point.avg > latest.avg + AVG_TIE_EPS).length;
  const lower = points.filter((point) => point.avg < latest.avg - AVG_TIE_EPS).length;
  const ties = points.filter(
    (point) => Math.abs(point.avg - latest.avg) <= AVG_TIE_EPS,
  ).length;
  return {
    date: latest.date,
    count: points.length,
    expensiveRank: higher + 1,
    cheapRank: lower + 1,
    ties,
  };
}

function periodDaysLabel(count: number) {
  return count === 1 ? "1 giorno" : `${count} giorni`;
}

function latestDaySubject(ymd: string, today: string) {
  if (ymd === today) return "Oggi";
  if (ymd === addCalendarDays(today, 1)) return "Domani";
  if (ymd === addCalendarDays(today, -1)) return "Ieri";
  return `Il ${formatLookbackDate(ymd)}`;
}

export function formatLatestDayRank(
  rank: LatestDayRank,
  today: string,
): LatestDayRankCopy {
  const subject = latestDaySubject(rank.date, today);
  const after = ` di questi ${periodDaysLabel(rank.count)}.`;
  const before = `${subject} è `;
  const tied = rank.ties > 1;
  const share = (place: number) => (place - 1) / (rank.count - 1);

  if (rank.expensiveRank === 1) {
    return {
      before,
      mark: tied ? "tra i più cari" : "il più caro",
      after,
      tone: "expensive",
    };
  }
  if (rank.cheapRank === 1) {
    return {
      before,
      mark: tied ? "tra i più convenienti" : "il più conveniente",
      after,
      tone: "cheap",
    };
  }
  if (rank.expensiveRank === 2) {
    return { before, mark: "il secondo più caro", after, tone: "expensive" };
  }
  if (rank.cheapRank === 2) {
    return {
      before,
      mark: "il secondo più conveniente",
      after,
      tone: "cheap",
    };
  }
  if (rank.expensiveRank === 3 && rank.count >= 8) {
    return { before, mark: "il terzo più caro", after, tone: "expensive" };
  }
  if (rank.cheapRank === 3 && rank.count >= 8) {
    return {
      before,
      mark: "il terzo più conveniente",
      after,
      tone: "cheap",
    };
  }
  if (share(rank.expensiveRank) <= 0.2) {
    return { before, mark: "tra i più cari", after, tone: "expensive" };
  }
  if (share(rank.cheapRank) <= 0.2) {
    return { before, mark: "tra i più convenienti", after, tone: "cheap" };
  }
  return { before, mark: "nella media", after, tone: "mid" };
}
