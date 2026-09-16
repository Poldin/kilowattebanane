import { calendarMonthStarts } from "@/lib/offerte/dates";
import { offerteReadClient } from "@/lib/offerte/db";
import {
  CME_FORWARD_SOURCE,
  GME_FORWARD_SOURCE,
  MIXED_FORWARD_SOURCE,
} from "@/lib/offerte/forward-source";

export {
  CME_FORWARD_SOURCE,
  GME_FORWARD_SOURCE,
  MIXED_FORWARD_SOURCE,
  forwardSourceShortLabel,
} from "@/lib/offerte/forward-source";

export const FORWARD_MONTH_HORIZON = 24;

export type ForwardTenor = "month" | "quarter" | "year";
export type ForwardProduct = "baseload" | "peakload";

export type ForwardPoint = {
  asOf: string;
  product: ForwardProduct;
  tenor: ForwardTenor;
  periodStart: string;
  periodEnd: string;
  priceEurMwh: number;
  source: string;
};

export type QuarterForward = {
  quarter: number;
  year: number;
  start: string;
  end: string;
  baseloadEurMwh: number | null;
};

export type PunMonthPoint = {
  start: string;
  punEurMwh: number | null;
  punEurKwh: number | null;
};

export type PunForwardBlend = {
  asOf: string | null;
  source: string | null;
  punEurMwh: number | null;
  punEurKwh: number | null;
  quarters: QuarterForward[];
  months: PunMonthPoint[];
};

function n(value: number | string | null | undefined) {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function quarterStart(year: number, quarter: number) {
  const month = (quarter - 1) * 3 + 1;
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

export function quarterEnd(year: number, quarter: number) {
  const month = quarter * 3;
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${String(month).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
}

export function quarterOf(isoDate: string) {
  const year = Number(isoDate.slice(0, 4));
  const month = Number(isoDate.slice(5, 7));
  return { year, quarter: Math.ceil(month / 3) };
}

export function nextFourQuarters(fromIso: string) {
  const { year, quarter } = quarterOf(fromIso);
  const out: { year: number; quarter: number; start: string; end: string }[] = [];
  let y = year;
  let q = quarter;
  for (let i = 0; i < 4; i++) {
    out.push({ year: y, quarter: q, start: quarterStart(y, q), end: quarterEnd(y, q) });
    q += 1;
    if (q > 4) {
      q = 1;
      y += 1;
    }
  }
  return out;
}

function overlapDays(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  const start = aStart > bStart ? aStart : bStart;
  const end = aEnd < bEnd ? aEnd : bEnd;
  if (end < start) return 0;
  const [sy, sm, sd] = start.split("-").map(Number);
  const [ey, em, ed] = end.split("-").map(Number);
  return (
    (Date.UTC(ey, em - 1, ed) - Date.UTC(sy, sm - 1, sd)) / 86_400_000 + 1
  );
}

function priceForQuarter(points: ForwardPoint[], start: string, end: string) {
  const baseload = points.filter((row) => row.product === "baseload");
  const exact = baseload.find(
    (row) => row.tenor === "quarter" && row.periodStart === start && row.periodEnd === end,
  );
  if (exact) return exact.priceEurMwh;

  const months = baseload.filter((row) => row.tenor === "month");
  let monthWeight = 0;
  let monthSum = 0;
  for (const row of months) {
    const days = overlapDays(row.periodStart, row.periodEnd, start, end);
    if (days <= 0) continue;
    monthWeight += days;
    monthSum += row.priceEurMwh * days;
  }
  if (monthWeight > 0) return monthSum / monthWeight;

  const years = baseload.filter((row) => row.tenor === "year");
  let yearWeight = 0;
  let yearSum = 0;
  for (const row of years) {
    const days = overlapDays(row.periodStart, row.periodEnd, start, end);
    if (days <= 0) continue;
    yearWeight += days;
    yearSum += row.priceEurMwh * days;
  }
  if (yearWeight > 0) return yearSum / yearWeight;
  return null;
}

export function monthlyPunFromPoints(
  points: ForwardPoint[],
  fromIso: string,
  count: number,
  fallbackEurMwh: number | null,
): PunMonthPoint[] {
  const byStart = new Map<string, number>();
  for (const row of points) {
    if (row.product !== "baseload" || row.tenor !== "month") continue;
    byStart.set(row.periodStart, row.priceEurMwh);
  }
  let last: number | null = null;
  return calendarMonthStarts(fromIso, count).map((start) => {
    const found = byStart.get(start);
    if (found != null) last = found;
    const punEurMwh = found ?? last ?? fallbackEurMwh;
    return {
      start,
      punEurMwh,
      punEurKwh: punEurMwh == null ? null : punEurMwh / 1000,
    };
  });
}

export function forwardPointKey(point: ForwardPoint) {
  return `${point.product}|${point.tenor}|${point.periodStart}`;
}

export function mergeForwardPointsPreferGme(
  cme: ForwardPoint[],
  gme: ForwardPoint[],
): ForwardPoint[] {
  const byKey = new Map<string, ForwardPoint>();
  for (const point of cme) byKey.set(forwardPointKey(point), point);
  for (const point of gme) byKey.set(forwardPointKey(point), point);
  return [...byKey.values()];
}

function blendSource(points: ForwardPoint[]) {
  const sources = new Set(points.map((point) => point.source));
  const hasGme = sources.has(GME_FORWARD_SOURCE);
  const hasCme = sources.has(CME_FORWARD_SOURCE);
  if (hasGme && hasCme) return MIXED_FORWARD_SOURCE;
  if (hasGme) return GME_FORWARD_SOURCE;
  if (hasCme) return CME_FORWARD_SOURCE;
  return points[0]?.source ?? null;
}

function blendAsOf(points: ForwardPoint[]) {
  const gme = points.filter((point) => point.source === GME_FORWARD_SOURCE);
  const preferred = gme.length > 0 ? gme : points;
  return preferred.reduce(
    (best, row) => (row.asOf > best ? row.asOf : best),
    preferred[0]?.asOf ?? "",
  ) || null;
}

export function blendPunFromPoints(points: ForwardPoint[], asOf: string): PunForwardBlend {
  const snapshot = points;
  const quarters = nextFourQuarters(asOf).map((q) => ({
    quarter: q.quarter,
    year: q.year,
    start: q.start,
    end: q.end,
    baseloadEurMwh: snapshot.length > 0 ? priceForQuarter(snapshot, q.start, q.end) : null,
  }));
  const priced = quarters.map((q) => q.baseloadEurMwh).filter((v): v is number => v != null);
  const punEurMwh = priced.length > 0 ? priced.reduce((a, b) => a + b, 0) / priced.length : null;
  return {
    asOf: blendAsOf(snapshot),
    source: blendSource(snapshot),
    punEurMwh,
    punEurKwh: punEurMwh == null ? null : punEurMwh / 1000,
    quarters,
    months: monthlyPunFromPoints(snapshot, asOf, FORWARD_MONTH_HORIZON, punEurMwh),
  };
}

export async function loadLatestForwardPoints(): Promise<ForwardPoint[]> {
  const [cme, gme] = await Promise.all([
    loadLatestTablePoints("po_forward_curve"),
    loadLatestGmeMonthlyPoints(),
  ]);
  return mergeForwardPointsPreferGme(cme, gme);
}

async function loadLatestTablePoints(table: "po_forward_curve"): Promise<ForwardPoint[]> {
  const client = offerteReadClient();
  const { data: latest, error: latestError } = await client
    .from(table)
    .select("as_of")
    .order("as_of", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestError) throw new Error(latestError.message);
  const asOf = latest?.as_of as string | undefined;
  if (!asOf) return [];

  const { data, error } = await client
    .from(table)
    .select("as_of, product, tenor, period_start, period_end, price_eur_mwh, source")
    .eq("as_of", asOf);
  if (error) throw new Error(error.message);

  return (data ?? []).flatMap((row) => {
    const product =
      row.product === "peakload" ? "peakload" : row.product === "baseload" ? "baseload" : null;
    const tenor =
      row.tenor === "month" || row.tenor === "quarter" || row.tenor === "year" ? row.tenor : null;
    const price = n(row.price_eur_mwh as number | string | null);
    if (!product || !tenor || price == null) return [];
    return [
      {
        asOf: String(row.as_of),
        product,
        tenor,
        periodStart: String(row.period_start),
        periodEnd: String(row.period_end),
        priceEurMwh: price,
        source: String(row.source ?? CME_FORWARD_SOURCE),
      },
    ];
  });
}

async function loadLatestGmeMonthlyPoints(): Promise<ForwardPoint[]> {
  const client = offerteReadClient();
  const { data: latest, error: latestError } = await client
    .from("po_gme_mte_monthly")
    .select("as_of")
    .order("as_of", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestError) throw new Error(latestError.message);
  const asOf = latest?.as_of as string | undefined;
  if (!asOf) return [];

  const { data, error } = await client
    .from("po_gme_mte_monthly")
    .select("as_of, period_start, period_end, price_eur_mwh, source")
    .eq("as_of", asOf);
  if (error) throw new Error(error.message);

  return (data ?? []).flatMap((row) => {
    const price = n(row.price_eur_mwh as number | string | null);
    if (price == null) return [];
    return [
      {
        asOf: String(row.as_of),
        product: "baseload" as const,
        tenor: "month" as const,
        periodStart: String(row.period_start),
        periodEnd: String(row.period_end),
        priceEurMwh: price,
        source: String(row.source ?? GME_FORWARD_SOURCE),
      },
    ];
  });
}

export async function loadPunForwardBlend(asOf: string) {
  const points = await loadLatestForwardPoints();
  return blendPunFromPoints(points, asOf);
}
