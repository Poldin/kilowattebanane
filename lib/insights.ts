import { hourRangeToQuarters, toHourlyAverages, QUARTERS_PER_HOUR } from "@/lib/prices";

export type PriceBand = {
  start: number;
  end: number;
  hour: number;
};

export type CurveSample = {
  x: number;
  y: number;
  hour: number;
  price: number;
};

export const CHART_W = 640;
export const CHART_H_DESKTOP = 260;
export const PAD = { t: 30, r: 18, b: 44, l: 56 };
export const MWH_TO_CENT_KWH = 10;

const TIP_DELTA = 0.05;
const MAX_TIPS = 3;
const MIN_TIP_SEPARATION_HOURS = 0.75;
const NEAR_ZERO_CENT = 1;
const TOP_TIP_WINDOW_HOURS = 1;

export function toEurocentPerKwh(euroPerMwh: number) {
  return euroPerMwh / MWH_TO_CENT_KWH;
}

export function formatEurocent(value: number, digits = 1) {
  return value.toLocaleString("it-IT", {
    minimumFractionDigits: Number.isInteger(value) ? 0 : digits,
    maximumFractionDigits: digits,
  });
}

export function dayHourlyCentStats(pricesEuroPerMwh: number[]) {
  const pricesCent = toHourlyAverages(pricesEuroPerMwh).map(toEurocentPerKwh);
  if (pricesCent.length === 0) {
    return { min: 0, avg: 0, max: 0 };
  }
  const min = Math.min(...pricesCent);
  const max = Math.max(...pricesCent);
  const avg = pricesCent.reduce((sum, value) => sum + value, 0) / pricesCent.length;
  return { min, avg, max };
}

function niceNum(range: number, round: boolean) {
  const exp = Math.floor(Math.log10(range));
  const frac = range / 10 ** exp;
  let niceFrac: number;
  if (round) {
    if (frac < 1.5) niceFrac = 1;
    else if (frac < 3) niceFrac = 2;
    else if (frac < 7) niceFrac = 5;
    else niceFrac = 10;
  } else if (frac <= 1) niceFrac = 1;
  else if (frac <= 2) niceFrac = 2;
  else if (frac <= 5) niceFrac = 5;
  else niceFrac = 10;
  return niceFrac * 10 ** exp;
}

export function yScale(prices: number[]) {
  const dataMin = Math.min(...prices);
  const dataMax = Math.max(...prices);
  const span = dataMax - dataMin || 1;
  const paddedMin = dataMin - span * 0.1;
  const paddedMax = dataMax + span * 0.12;
  const step = niceNum((paddedMax - paddedMin) / 4, true);
  const min = Math.max(0, Math.floor(paddedMin / step) * step);
  const max = Math.ceil(paddedMax / step) * step;
  const ticks: number[] = [];
  for (let value = min; value <= max + step / 2; value += step) {
    ticks.push(Number((Math.round(value / step) * step).toPrecision(10)));
  }
  const tickDigits = step >= 1 ? 0 : 1;
  return { min, max, ticks, tickDigits };
}

export function hourToX(
  hour: number,
  chartW = CHART_W,
  pad: { t: number; r: number; b: number; l: number } = PAD,
) {
  const innerW = chartW - pad.l - pad.r;
  return pad.l + (hour / 24) * innerW;
}

export function toPoints(
  prices: number[],
  min: number,
  max: number,
  chartH: number,
  chartW = CHART_W,
  pad: { t: number; r: number; b: number; l: number } = PAD,
) {
  const range = max - min || 1;
  const innerH = chartH - pad.t - pad.b;

  return prices.map((price, i) => ({
    x: hourToX(i + 0.5, chartW, pad),
    y: pad.t + (1 - (price - min) / range) * innerH,
  }));
}

export function smoothPathSegmentControls(
  points: { x: number; y: number }[],
  i: number,
) {
  const p0 = points[i - 1] ?? points[i];
  const p1 = points[i];
  const p2 = points[i + 1];
  const p3 = points[i + 2] ?? p2;
  return {
    p1,
    c1: { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 },
    c2: { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 },
    p2,
  };
}

export function toSmoothPath(points: { x: number; y: number }[]) {
  if (points.length < 2) return "";

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const { c1, c2, p2 } = smoothPathSegmentControls(points, i);
    d += ` C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

function cubicBezierPoint(
  p1: { x: number; y: number },
  c1: { x: number; y: number },
  c2: { x: number; y: number },
  p2: { x: number; y: number },
  t: number,
) {
  const u = 1 - t;
  const tt = t * t;
  const uu = u * u;
  const uuu = uu * u;
  const ttt = tt * t;
  return {
    x: uuu * p1.x + 3 * uu * t * c1.x + 3 * u * tt * c2.x + ttt * p2.x,
    y: uuu * p1.y + 3 * uu * t * c1.y + 3 * u * tt * c2.y + ttt * p2.y,
  };
}

function yToPrice(
  y: number,
  scaleMin: number,
  scaleMax: number,
  chartH: number = CHART_H_DESKTOP,
  pad: { t: number; r: number; b: number; l: number } = PAD,
) {
  const innerH = chartH - pad.t - pad.b;
  const range = scaleMax - scaleMin || 1;
  return scaleMin + (1 - (y - pad.t) / innerH) * range;
}

export function sampleSmoothCurve(
  points: { x: number; y: number }[],
  scaleMin: number,
  scaleMax: number,
  chartW = CHART_W,
  pad: { t: number; r: number; b: number; l: number } = PAD,
  chartH = CHART_H_DESKTOP,
): CurveSample[] {
  const innerW = chartW - pad.l - pad.r;
  const samples: CurveSample[] = [];

  for (let i = 0; i < points.length - 1; i++) {
    const { p1, c1, c2, p2 } = smoothPathSegmentControls(points, i);
    for (let step = 0; step <= 40; step++) {
      const p = cubicBezierPoint(p1, c1, c2, p2, step / 40);
      samples.push({
        x: p.x,
        y: p.y,
        hour: ((p.x - pad.l) / innerW) * 24,
        price: yToPrice(p.y, scaleMin, scaleMax, chartH, pad),
      });
    }
  }

  return samples;
}

function findLocalExtrema(samples: CurveSample[]) {
  const minima: CurveSample[] = [];
  const maxima: CurveSample[] = [];

  for (let i = 1; i < samples.length - 1; i++) {
    const prevDy = samples[i].y - samples[i - 1].y;
    const nextDy = samples[i + 1].y - samples[i].y;
    if (prevDy > 0 && nextDy < 0) minima.push(samples[i]);
    if (prevDy < 0 && nextDy > 0) maxima.push(samples[i]);
  }

  return { minima, maxima };
}

function isNearZeroOrNegative(price: number) {
  return price <= 0 || Math.abs(price) < NEAR_ZERO_CENT;
}

function withinTipDelta(
  price: number,
  extreme: number,
  dayMin: number,
  dayMax: number,
) {
  const delta = Math.abs(price - extreme);
  if (isNearZeroOrNegative(extreme)) {
    const span = dayMax - dayMin || 1;
    return delta / span <= TIP_DELTA;
  }
  return delta / Math.abs(extreme) <= TIP_DELTA;
}

function pickSimilarTips(
  extrema: CurveSample[],
  allSamples: CurveSample[],
  mode: "min" | "max",
  dayMin: number,
  dayMax: number,
): CurveSample[] {
  if (allSamples.length === 0) return [];

  const global = allSamples.reduce((best, sample) => {
    if (mode === "min") return sample.price < best.price ? sample : best;
    return sample.price > best.price ? sample : best;
  });

  const candidates = [global, ...extrema].sort((a, b) =>
    mode === "min" ? a.price - b.price : b.price - a.price,
  );
  const extremePrice = candidates[0].price;
  const picked: CurveSample[] = [];

  for (const sample of candidates) {
    if (!withinTipDelta(sample.price, extremePrice, dayMin, dayMax)) break;
    if (
      picked.some(
        (p) => Math.abs(p.hour - sample.hour) < MIN_TIP_SEPARATION_HOURS,
      )
    ) {
      continue;
    }
    picked.push(sample);
    if (picked.length === MAX_TIPS) break;
  }

  return picked;
}

export function sampleNearestHour(samples: CurveSample[], hour: number) {
  if (samples.length === 0) return null;
  return samples.reduce((best, sample) =>
    Math.abs(sample.hour - hour) < Math.abs(best.hour - hour) ? sample : best,
  );
}

export function formatTipHour(hour: number) {
  const totalMinutes = Math.round(hour * 60);
  const h = Math.floor(totalMinutes / 60) % 24;
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function roundToQuarterHour(hour: number) {
  return Math.round(hour * 4) / 4;
}

export function tipRangeBounds(hour: number) {
  const from = roundToQuarterHour(Math.max(0, hour - TOP_TIP_WINDOW_HOURS));
  const to = roundToQuarterHour(Math.min(24, hour + TOP_TIP_WINDOW_HOURS));
  return { from, to };
}

function hoursToQuarterRange(fromHour: number, toHour: number) {
  return hourRangeToQuarters(Math.floor(fromHour), Math.floor(toHour));
}

export function joinItalian(parts: string[]) {
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]} e ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")} e ${parts[parts.length - 1]}`;
}

function bandsFromTips(tips: CurveSample[]): PriceBand[] {
  return [...tips]
    .sort((a, b) => a.hour - b.hour)
    .map((tip) => {
      const bounds = tipRangeBounds(tip.hour);
      const quarters = hoursToQuarterRange(bounds.from, bounds.to);
      return { start: quarters.start, end: quarters.end, hour: tip.hour };
    });
}

export function mergeQuarterBands(bands: PriceBand[]) {
  if (bands.length === 0) return [];
  const sorted = [...bands].sort((a, b) => a.start - b.start);
  const merged: { start: number; end: number }[] = [
    { start: sorted[0].start, end: sorted[0].end },
  ];
  for (const band of sorted.slice(1)) {
    const last = merged[merged.length - 1];
    if (band.start <= last.end + 1) {
      last.end = Math.max(last.end, band.end);
    } else {
      merged.push({ start: band.start, end: band.end });
    }
  }
  return merged;
}

export function slotInBands(slot: number, bands: PriceBand[]) {
  return bands.some((band) => slot >= band.start && slot <= band.end);
}

export function cheapestSlotsInBands(prices: number[], bands: PriceBand[]) {
  const slots = new Set<number>();
  for (const band of bands) {
    let bestSlot = -1;
    let bestPrice = Infinity;
    const end = Math.min(band.end, prices.length - 1);
    for (let slot = band.start; slot <= end; slot++) {
      if (prices[slot] < bestPrice) {
        bestPrice = prices[slot];
        bestSlot = slot;
      }
    }
    if (bestSlot >= 0) slots.add(bestSlot);
  }
  return slots;
}

export function priciestSlotsInBands(prices: number[], bands: PriceBand[]) {
  const slots = new Set<number>();
  for (const band of bands) {
    let worstSlot = -1;
    let worstPrice = -Infinity;
    const end = Math.min(band.end, prices.length - 1);
    for (let slot = band.start; slot <= end; slot++) {
      if (prices[slot] > worstPrice) {
        worstPrice = prices[slot];
        worstSlot = slot;
      }
    }
    if (worstSlot >= 0) slots.add(worstSlot);
  }
  return slots;
}

export function formatTipRanges(bands: PriceBand[]) {
  return joinItalian(
    bands.map((band) => {
      const bounds = tipRangeBounds(band.hour);
      return `dalle ${formatTipHour(bounds.from)} alle ${formatTipHour(bounds.to)}`;
    }),
  );
}

export type DayRecommendations = {
  cheapBands: PriceBand[];
  peakBands: PriceBand[];
  bestTip: string;
  worstTip: string;
};

function emptyRecommendations(): DayRecommendations {
  return {
    cheapBands: [],
    peakBands: [],
    bestTip: "Prezzi in aggiornamento.",
    worstTip: "",
  };
}

export function computeRecommendations(prices: number[]): DayRecommendations {
  if (prices.length < QUARTERS_PER_HOUR) return emptyRecommendations();

  const hourly = toHourlyAverages(prices);
  const pricesCent = hourly.map(toEurocentPerKwh);
  const dayMin = Math.min(...pricesCent);
  const dayMax = Math.max(...pricesCent);
  const scale = yScale(pricesCent);
  const points = toPoints(pricesCent, scale.min, scale.max, CHART_H_DESKTOP);
  const samples = sampleSmoothCurve(points, scale.min, scale.max);
  const { minima, maxima } = findLocalExtrema(samples);
  const bestTips = pickSimilarTips(minima, samples, "min", dayMin, dayMax);
  const worstTips = pickSimilarTips(maxima, samples, "max", dayMin, dayMax);
  if (bestTips.length === 0) return emptyRecommendations();

  const cheapBands = bandsFromTips(bestTips);
  const peakBands = bandsFromTips(worstTips);

  return {
    cheapBands,
    peakBands,
    bestTip: `🍌 Top risparmio ${formatTipRanges(cheapBands)}`,
    worstTip:
      peakBands.length > 0
        ? `🐵 Evita consumi ${formatTipRanges(peakBands)}`
        : "",
  };
}

export const MIN_COMPLETE_SLOTS = 92;

export function isCompleteDay(slotCount: number) {
  return slotCount >= MIN_COMPLETE_SLOTS;
}
