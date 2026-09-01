"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type PointerEvent,
} from "react";
import { RegionSelect } from "@/components/RegionSelect";
import {
  fetchZonePrices,
  groupZoneDays,
  romeNow,
  romeNowHour,
  romeToday,
  type DayAheadRow,
  type RomeNow,
  type ZoneDay,
} from "@/lib/day-ahead-query";
import { ShareButton } from "@/components/ShareButton";
import {
  DATE_QUERY_PARAM,
  DEFAULT_REGION,
  PRICES_SECTION_ID,
  REGION_QUERY_PARAM,
  SHOW_TODAY_PRICES_EVENT,
  pricesShareUrl,
  regionFromParam,
  zoneForRegion,
  zoneNameForRegion,
  type ItalianRegion,
  type MarketZoneId,
} from "@/lib/market-zones";
import { persistRegionPref, readRegionPref } from "@/lib/region-pref";
import {
  QUARTERS_PER_HOUR,
  formatQuarterSlot,
  formatQuarterSlotFull,
  hourRangeToQuarters,
  toHourlyAverages,
} from "@/lib/prices";

type PriceBand = {
  start: number;
  end: number;
  hour: number;
};

type DayInsight = {
  deliveryDate: string;
  prices: number[];
  noonIndex: number;
  cheapBands: PriceBand[];
  peakBands: PriceBand[];
  bestTip: string;
  worstTip: string;
};

function pickDefaultDate(days: ZoneDay[]) {
  const today = romeToday();
  const tomorrow = addCalendarDays(today, 1);

  if (romeNowHour() >= 22 && days.some((day) => day.deliveryDate === tomorrow)) {
    return tomorrow;
  }
  if (days.some((day) => day.deliveryDate === today)) return today;
  return days[0]?.deliveryDate ?? null;
}

function buildDayInsight(day: ZoneDay): DayInsight {
  const recommendations = computeRecommendations(day.prices);
  return {
    deliveryDate: day.deliveryDate,
    prices: day.prices,
    noonIndex: day.noonIndex,
    cheapBands: recommendations.cheapBands,
    peakBands: recommendations.peakBands,
    bestTip: recommendations.bestTip,
    worstTip: recommendations.worstTip,
  };
}

const BANANA = "#F5D547";
const PEAK = "#EF4444";
const NOW = "#EF4444";
const MID = "#A3A3A3";
const MARKER_FONT_SIZE = 20;
const CHART_W = 640;
const CHART_W_MOBILE = 400;
const CHART_H_DESKTOP = 260;
const CHART_H_MOBILE = 360;
const PAD = { t: 30, r: 18, b: 44, l: 56 };
const PAD_MOBILE = { t: 40, r: 16, b: 56, l: 68 };
const MWH_TO_CENT_KWH = 10;

function toEurocentPerKwh(euroPerMwh: number) {
  return euroPerMwh / MWH_TO_CENT_KWH;
}

function formatEurocent(value: number, digits = 1) {
  return value.toLocaleString("it-IT", {
    minimumFractionDigits: Number.isInteger(value) ? 0 : digits,
    maximumFractionDigits: digits,
  });
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

function yScale(prices: number[]) {
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

function addCalendarDays(ymd: string, delta: number) {
  const [year, month, day] = ymd.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + delta)).toISOString().slice(0, 10);
}

function formatDeliveryDate(ymd: string, today: string) {
  const [year, month, day] = ymd.split("-").map(Number);
  const formatted = new Date(Date.UTC(year, month - 1, day, 12)).toLocaleDateString(
    "it-IT",
    { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" },
  );
  if (ymd === today) return `Oggi · ${formatted}`;
  if (ymd === addCalendarDays(today, -1)) return `Ieri · ${formatted}`;
  if (ymd === addCalendarDays(today, 1)) return `Domani · ${formatted}`;
  return formatted;
}

function hourToX(
  hour: number,
  chartW = CHART_W,
  pad: { t: number; r: number; b: number; l: number } = PAD,
) {
  const innerW = chartW - pad.l - pad.r;
  return pad.l + (hour / 24) * innerW;
}

function toPoints(
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

function useChartLayout() {
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 639px)");
    const update = () => setMobile(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  if (mobile) {
    return {
      chartW: CHART_W_MOBILE,
      chartH: CHART_H_MOBILE,
      pad: PAD_MOBILE,
      axisFontSize: 22,
      unitFontSize: 16,
    };
  }

  return {
    chartW: CHART_W,
    chartH: CHART_H_DESKTOP,
    pad: PAD,
    axisFontSize: 15,
    unitFontSize: 13,
  };
}

function smoothPathSegmentControls(
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

type CurveSample = {
  x: number;
  y: number;
  hour: number;
  price: number;
};

function sampleSmoothCurve(
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

const TIP_DELTA = 0.05;
const MAX_TIPS = 3;
const MIN_TIP_SEPARATION_HOURS = 0.75;
const NEAR_ZERO_CENT = 1;
const TOP_TIP_WINDOW_HOURS = 1;

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

function sampleNearestHour(samples: CurveSample[], hour: number) {
  if (samples.length === 0) return null;
  return samples.reduce((best, sample) =>
    Math.abs(sample.hour - hour) < Math.abs(best.hour - hour) ? sample : best,
  );
}

function formatTipHour(hour: number) {
  const totalMinutes = Math.round(hour * 60);
  const h = Math.floor(totalMinutes / 60) % 24;
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function formatClock(hour: number, minute: number) {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function useRomeNow() {
  const [now, setNow] = useState<RomeNow | null>(null);

  useEffect(() => {
    const tick = () => setNow(romeNow());
    tick();

    let intervalId: number | undefined;
    const msUntilNextMinute = 60_000 - (Date.now() % 60_000) + 50;
    const timeoutId = window.setTimeout(() => {
      tick();
      intervalId = window.setInterval(tick, 60_000);
    }, msUntilNextMinute);

    return () => {
      window.clearTimeout(timeoutId);
      if (intervalId !== undefined) window.clearInterval(intervalId);
    };
  }, []);

  return now;
}

function currentSlotIndex(hour: number, minute: number, slotCount: number) {
  if (slotCount <= 0) return 0;
  const slot = Math.floor((hour * 60 + minute) / 15);
  return Math.max(0, Math.min(slotCount - 1, slot));
}

function expensivePercentile(prices: number[], current: number) {
  if (prices.length === 0) return 0.5;
  const cheaper = prices.filter((price) => price < current).length;
  const ties = prices.filter((price) => price === current).length;
  return (cheaper + ties * 0.5) / prices.length;
}

function nowMomentComment(percentile: number) {
  if (percentile >= 0.95) {
    return {
      before: "tra i ",
      mark: "5% più cari",
      after: ": se puoi, non consumare",
      color: PEAK,
    };
  }
  if (percentile >= 0.9) {
    return {
      before: "tra i ",
      mark: "10% più cari",
      after: ": meglio evitare i consumi",
      color: PEAK,
    };
  }
  if (percentile >= 0.65) {
    return {
      before: "",
      mark: "non è il momento più idilliaco",
      after: " per consumare",
      color: PEAK,
    };
  }
  if (percentile >= 0.35) {
    return {
      before: "prezzi nella media, ",
      mark: "il medione",
      after: "",
      color: MID,
    };
  }
  if (percentile >= 0.1) {
    return {
      before: "",
      mark: "momento discreto",
      after: " per consumare",
      color: BANANA,
    };
  }
  if (percentile >= 0.05) {
    return {
      before: "tra i ",
      mark: "10% più convenienti",
      after: ": buon momento",
      color: BANANA,
    };
  }
  return {
    before: "tra i ",
    mark: "5% più convenienti",
    after: ": se puoi, consuma ora",
    color: BANANA,
  };
}

type NowLine = {
  hour: number;
  time: string;
  comment: ReturnType<typeof nowMomentComment>;
};

function nowLineForDay(day: DayInsight, now: RomeNow | null): NowLine | null {
  if (!now || now.date !== day.deliveryDate || day.prices.length === 0) {
    return null;
  }

  const slot = currentSlotIndex(now.hour, now.minute, day.prices.length);
  const percentile = expensivePercentile(day.prices, day.prices[slot]);
  return {
    hour: now.hour + now.minute / 60,
    time: formatClock(now.hour, now.minute),
    comment: nowMomentComment(percentile),
  };
}

function roundToQuarterHour(hour: number) {
  return Math.round(hour * 4) / 4;
}

function tipRangeBounds(hour: number) {
  const from = roundToQuarterHour(Math.max(0, hour - TOP_TIP_WINDOW_HOURS));
  const to = roundToQuarterHour(Math.min(24, hour + TOP_TIP_WINDOW_HOURS));
  return { from, to };
}

function hoursToQuarterRange(fromHour: number, toHour: number) {
  return hourRangeToQuarters(Math.floor(fromHour), Math.floor(toHour));
}

function joinItalian(parts: string[]) {
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

function mergeQuarterBands(bands: PriceBand[]) {
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

function slotInBands(slot: number, bands: PriceBand[]) {
  return bands.some((band) => slot >= band.start && slot <= band.end);
}

function cheapestSlotsInBands(prices: number[], bands: PriceBand[]) {
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

function priciestSlotsInBands(prices: number[], bands: PriceBand[]) {
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

function formatTipRanges(bands: PriceBand[]) {
  return joinItalian(
    bands.map((band) => {
      const bounds = tipRangeBounds(band.hour);
      return `dalle ${formatTipHour(bounds.from)} alle ${formatTipHour(bounds.to)}`;
    }),
  );
}

function emptyRecommendations() {
  return {
    cheapBands: [] as PriceBand[],
    peakBands: [] as PriceBand[],
    bestTip: "Prezzi in aggiornamento.",
    worstTip: "",
  };
}

function computeRecommendations(prices: number[]) {
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

function PriceTips({
  best,
  worst,
  nowLine,
}: {
  best: string;
  worst: string;
  nowLine: NowLine | null;
}) {
  return (
    <div
      className="mt-4 space-y-1 text-left text-sm sm:text-base"
      aria-live="polite"
      aria-label="Consigli su quando consumare o evitare"
    >
      {nowLine ? (
        <p className="font-medium text-foreground">
          <span
            aria-hidden
            className="mr-2 inline-block h-[1em] w-[2px] translate-y-[0.12em] align-middle"
            style={{ backgroundColor: NOW }}
          />
          Sono le{" "}
          <span className="mx-0.5 inline-flex translate-y-px items-center rounded-full bg-neutral-100 px-2 py-0.5 font-medium tabular-nums text-[#111111]">
            {nowLine.time}
          </span>{" "}
          {nowLine.comment.before}
          {nowLine.comment.mark ? (
            <span
              className="underline decoration-2 underline-offset-2"
              style={{ textDecorationColor: nowLine.comment.color ?? undefined }}
            >
              {nowLine.comment.mark}
            </span>
          ) : null}
          {nowLine.comment.after}
        </p>
      ) : null}
      <p className="font-medium text-foreground">{best}</p>
      {worst ? (
        <p className="text-neutral-600 dark:text-neutral-400">{worst}</p>
      ) : null}
    </div>
  );
}

function toSmoothPath(points: { x: number; y: number }[]) {
  if (points.length < 2) return "";

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const { c1, c2, p2 } = smoothPathSegmentControls(points, i);
    d += ` C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

function bananaToMonkeyPercent(price: number, min: number, max: number) {
  const span = max - min;
  if (span <= 0) return 50;
  return Math.round(Math.min(100, Math.max(0, ((price - min) / span) * 100)));
}

function pointerToHour(
  event: PointerEvent<SVGSVGElement>,
  chartW: number,
  pad: { t: number; r: number; b: number; l: number },
) {
  const rect = event.currentTarget.getBoundingClientRect();
  if (rect.width <= 0) return 0;
  const x = ((event.clientX - rect.left) / rect.width) * chartW;
  const innerW = chartW - pad.l - pad.r;
  return Math.min(24, Math.max(0, ((x - pad.l) / innerW) * 24));
}

function PriceChart({
  day,
  nowHour,
}: {
  day: DayInsight;
  nowHour?: number;
}) {
  const { chartW, chartH, pad, axisFontSize, unitFontSize } = useChartLayout();
  const [pickedHour, setPickedHour] = useState<number | null>(null);
  const hourly = useMemo(() => toHourlyAverages(day.prices), [day.prices]);
  const pricesCent = useMemo(
    () => hourly.map(toEurocentPerKwh),
    [hourly],
  );
  const scale = useMemo(() => yScale(pricesCent), [pricesCent]);
  const points = useMemo(
    () => toPoints(pricesCent, scale.min, scale.max, chartH, chartW, pad),
    [pricesCent, scale.min, scale.max, chartH, chartW, pad],
  );
  const line = useMemo(() => toSmoothPath(points), [points]);
  const samples = useMemo(
    () =>
      sampleSmoothCurve(points, scale.min, scale.max, chartW, pad, chartH),
    [points, scale.min, scale.max, chartW, pad, chartH],
  );
  const bananaMarks = useMemo(
    () =>
      day.cheapBands
        .map((band) => sampleNearestHour(samples, band.hour))
        .filter((mark): mark is CurveSample => mark !== null),
    [day.cheapBands, samples],
  );
  const monkeyMarks = useMemo(
    () =>
      day.peakBands
        .map((band) => sampleNearestHour(samples, band.hour))
        .filter((mark): mark is CurveSample => mark !== null),
    [day.peakBands, samples],
  );

  const innerH = chartH - pad.t - pad.b;
  const cheapFills = mergeQuarterBands(day.cheapBands);
  const peakFills = mergeQuarterBands(day.peakBands);
  const range = scale.max - scale.min || 1;
  const bananaHours = joinItalian(
    day.cheapBands.map((band) => formatTipHour(band.hour)),
  );
  const monkeyHours = joinItalian(
    day.peakBands.map((band) => formatTipHour(band.hour)),
  );

  const hourTicks = [0, 6, 12, 18, 24];
  const font = "var(--font-geist-sans), system-ui, sans-serif";
  const picked =
    pickedHour != null ? sampleNearestHour(samples, pickedHour) : null;
  const dayMinCent = Math.min(...pricesCent);
  const dayMaxCent = Math.max(...pricesCent);
  const pickedRank =
    picked != null
      ? bananaToMonkeyPercent(picked.price, dayMinCent, dayMaxCent)
      : null;

  return (
    <div className="relative" data-price-chart>
    <svg
      viewBox={`0 0 ${chartW} ${chartH}`}
      className="h-auto w-full cursor-crosshair touch-manipulation"
      role="img"
      aria-label={`Andamento orario del prezzo in centesimi di euro per kilowattora. Tocca o clicca un punto per vedere ora e prezzo.${
        nowHour != null
          ? ` L'ora attuale è alle ${formatTipHour(nowHour)}.`
          : ""
      } Momenti più convenienti alle ${bananaHours || "n.d."}, picchi da evitare alle ${monkeyHours || "n.d."}.`}
      onPointerDown={(event) => {
        if (event.pointerType === "mouse" && event.button !== 0) return;
        setPickedHour(pointerToHour(event, chartW, pad));
      }}
    >
      <rect width={chartW} height={chartH} fill="#111111" rx="8" />

      <text
        x={pad.l}
        y={Math.round(unitFontSize + 8)}
        fill="#e5e5e5"
        fontSize={unitFontSize}
        fontFamily={font}
        fontWeight="500"
      >
        c€/kWh
      </text>

      {scale.ticks.map((tick) => {
        const y = pad.t + (1 - (tick - scale.min) / range) * innerH;
        return (
          <g key={tick}>
            <line
              x1={pad.l}
              x2={chartW - pad.r}
              y1={y}
              y2={y}
              stroke="#262626"
              strokeWidth="1"
            />
            <text
              x={pad.l - 10}
              y={y + axisFontSize / 3}
              textAnchor="end"
              fill="#f5f5f5"
              fontSize={axisFontSize}
              fontFamily={font}
              fontWeight="600"
            >
              {formatEurocent(tick, scale.tickDigits)}
            </text>
          </g>
        );
      })}

      {hourTicks.map((hour) => {
        const x = hourToX(hour, chartW, pad);
        return (
          <g key={hour}>
            <line
              x1={x}
              x2={x}
              y1={pad.t}
              y2={chartH - pad.b}
              stroke="#1f1f1f"
              strokeWidth="1"
            />
            <text
              x={x}
              y={chartH - 18}
              textAnchor="middle"
              fill="#f5f5f5"
              fontSize={axisFontSize}
              fontFamily={font}
              fontWeight="600"
            >
              {String(hour).padStart(2, "0")}
            </text>
          </g>
        );
      })}

      {cheapFills.map((band) => {
        const fromX = hourToX(band.start / QUARTERS_PER_HOUR, chartW, pad);
        const toX = hourToX((band.end + 1) / QUARTERS_PER_HOUR, chartW, pad);
        return (
          <rect
            key={`cheap-${band.start}-${band.end}`}
            x={fromX}
            y={pad.t}
            width={Math.max(toX - fromX, 8)}
            height={innerH}
            fill={BANANA}
            opacity="0.08"
          />
        );
      })}
      {peakFills.map((band) => {
        const fromX = hourToX(band.start / QUARTERS_PER_HOUR, chartW, pad);
        const toX = hourToX((band.end + 1) / QUARTERS_PER_HOUR, chartW, pad);
        return (
          <rect
            key={`peak-${band.start}-${band.end}`}
            x={fromX}
            y={pad.t}
            width={Math.max(toX - fromX, 8)}
            height={innerH}
            fill={PEAK}
            opacity="0.16"
          />
        );
      })}

      <path
        d={line}
        fill="none"
        stroke={BANANA}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {bananaMarks.map((mark) => (
        <text
          key={`banana-${mark.hour}`}
          x={mark.x}
          y={mark.y - 11}
          textAnchor="middle"
          fontSize={MARKER_FONT_SIZE}
        >
          🍌
        </text>
      ))}

      {monkeyMarks.map((mark) => (
        <text
          key={`monkey-${mark.hour}`}
          x={mark.x}
          y={mark.y - 11}
          textAnchor="middle"
          fontSize={MARKER_FONT_SIZE}
        >
          🐵
        </text>
      ))}

      {nowHour != null ? (
        <line
          x1={hourToX(nowHour, chartW, pad)}
          x2={hourToX(nowHour, chartW, pad)}
          y1={pad.t}
          y2={chartH - pad.b}
          stroke={NOW}
          strokeWidth="2"
          strokeLinecap="round"
        />
      ) : null}

      {picked ? (
        <g pointerEvents="none">
          <line
            x1={picked.x}
            x2={picked.x}
            y1={pad.t}
            y2={chartH - pad.b}
            stroke="#f5f5f5"
            strokeWidth="1.5"
            strokeDasharray="4 4"
            opacity="0.8"
          />
          <line
            x1={pad.l}
            x2={chartW - pad.r}
            y1={picked.y}
            y2={picked.y}
            stroke="#f5f5f5"
            strokeWidth="1.5"
            strokeDasharray="4 4"
            opacity="0.8"
          />
          <circle
            cx={picked.x}
            cy={picked.y}
            r="5"
            fill={BANANA}
            stroke="#111111"
            strokeWidth="2"
          />
        </g>
      ) : null}
    </svg>
      {picked && pickedRank != null ? (
        <button
          type="button"
          className="absolute top-2.5 right-2.5 z-10 flex items-center gap-2 rounded-md border border-white/15 bg-black/80 px-2.5 py-1.5 text-white shadow-sm"
          aria-label={`Chiudi lettura delle ${formatTipHour(picked.hour)}, ${formatEurocent(picked.price)}, ${pickedRank}%`}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => setPickedHour(null)}
        >
          <span className="text-xs font-semibold tabular-nums sm:text-sm">
            {formatTipHour(picked.hour)} · {formatEurocent(picked.price)} ·{" "}
            {pickedRank}% {pickedRank < 50 ? "🍌" : "🐵"}
          </span>
          <span aria-hidden className="text-sm leading-none text-white/70">
            ×
          </span>
        </button>
      ) : null}
    </div>
  );
}

function QuarterColumn({
  prices,
  offset,
  bananaSlots,
  monkeySlots,
  cheapBands,
  peakBands,
}: {
  prices: number[];
  offset: number;
  bananaSlots: Set<number>;
  monkeySlots: Set<number>;
  cheapBands: PriceBand[];
  peakBands: PriceBand[];
}) {
  return (
    <table className="w-full table-fixed border-collapse text-xs leading-tight sm:text-sm">
      <colgroup>
        <col className="w-[58%]" />
        <col className="w-[42%]" />
      </colgroup>
      <thead>
        <tr className="border-b border-neutral-200 text-left text-[11px] text-neutral-500 sm:text-xs dark:border-neutral-800 dark:text-neutral-400">
          <th scope="col" className="px-1.5 py-1.5 font-medium sm:px-2">
            Quarto
          </th>
          <th scope="col" className="px-1.5 py-1.5 text-right font-medium sm:px-2">
            c€/kWh
          </th>
        </tr>
      </thead>
      <tbody>
        {prices.map((price, i) => {
          const slot = offset + i;
          const cheap = slotInBands(slot, cheapBands);
          const peak = slotInBands(slot, peakBands);
          const cheapest = bananaSlots.has(slot);
          const peakiest = monkeySlots.has(slot);
          return (
            <tr
              key={slot}
              className={
                peak
                  ? "bg-red-500/15 dark:bg-red-500/20"
                  : cheap
                    ? "bg-[#F5D547]/20 dark:bg-[#F5D547]/15"
                    : "odd:bg-neutral-50 dark:odd:bg-neutral-950"
              }
            >
              <th
                scope="row"
                className={`truncate px-1.5 py-1 text-left font-normal tabular-nums sm:px-2 ${
                  peak
                    ? "text-red-700 dark:text-red-400"
                    : "text-neutral-600 dark:text-neutral-400"
                }`}
              >
                <span className="sr-only">{formatQuarterSlotFull(slot)}</span>
                <span aria-hidden>{formatQuarterSlot(slot)}</span>
              </th>
              <td
                className={`truncate px-1.5 py-1 text-right tabular-nums sm:px-2 ${
                  peak
                    ? "font-medium text-red-700 dark:text-red-400"
                    : cheapest
                      ? "font-medium text-foreground"
                      : "text-foreground"
                }`}
              >
                {cheapest ? (
                  <>
                    <span className="sr-only">minimo </span>
                    <span className="mr-0.5" aria-hidden>
                      🍌
                    </span>
                  </>
                ) : null}
                {peakiest ? (
                  <>
                    <span className="sr-only">picco </span>
                    <span className="mr-0.5" aria-hidden>
                      🐵
                    </span>
                  </>
                ) : peak ? (
                  <span className="sr-only">picco </span>
                ) : null}
                {formatEurocent(toEurocentPerKwh(price))}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function QuarterPriceTable({ day }: { day: DayInsight }) {
  const bananaSlots = cheapestSlotsInBands(day.prices, day.cheapBands);
  const monkeySlots = priciestSlotsInBands(day.prices, day.peakBands);
  const split = day.noonIndex > 0 && day.noonIndex < day.prices.length
    ? day.noonIndex
    : Math.floor(day.prices.length / 2);
  const columns = [
    { start: 0, end: split, label: "00–12" },
    { start: split, end: day.prices.length, label: "12–24" },
  ];

  return (
    <div className="mt-6">
      <h3 className="text-sm font-medium tracking-tight text-foreground">
        Prezzi ogni quarto d&apos;ora
      </h3>
      <div className="mt-2 min-w-0 overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-800">
        <div className="grid min-w-0 grid-cols-2">
          {columns.map((column, i) => (
            <div
              key={column.start}
              className={`min-w-0 overflow-hidden ${
                i === 1 ? "border-l border-neutral-200 dark:border-neutral-800" : ""
              }`}
            >
              <p className="border-b border-neutral-200 bg-neutral-50 px-2 py-1.5 text-center text-[11px] font-medium tabular-nums text-neutral-500 sm:text-xs dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
                {column.label}
              </p>
              <QuarterColumn
                prices={day.prices.slice(column.start, column.end)}
                offset={column.start}
                bananaSlots={bananaSlots}
                monkeySlots={monkeySlots}
                cheapBands={day.cheapBands}
                peakBands={day.peakBands}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SkeletonBone({
  className,
  chart = false,
}: {
  className: string;
  chart?: boolean;
}) {
  return (
    <div
      aria-hidden
      className={`insight-skeleton rounded-md ${chart ? "insight-skeleton-chart" : ""} ${className}`}
    />
  );
}

function InsightSkeleton() {
  const tableRows = Array.from({ length: 12 }, (_, i) => i);

  return (
    <div className="mt-3" aria-hidden>
      <div className="overflow-hidden rounded-lg border border-neutral-800 bg-[#111111]">
        <div className="relative h-90 w-full sm:h-65">
          <SkeletonBone chart className="absolute inset-0 rounded-none" />
          <div className="absolute inset-x-10 bottom-10 top-12 flex flex-col justify-between">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="h-px w-full bg-white/6" />
            ))}
          </div>
          <div className="absolute inset-x-[12%] top-[30%] h-[32%] overflow-hidden rounded-full opacity-40">
            <SkeletonBone chart className="h-full w-full rounded-full" />
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <SkeletonBone className="h-4 w-[min(100%,20rem)]" />
        <SkeletonBone className="h-4 w-[min(88%,16rem)]" />
      </div>

      <div className="mt-6">
        <SkeletonBone className="h-4 w-44" />
        <div className="mt-2 overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-800">
          <div className="grid grid-cols-2">
            {["00–12", "12–24"].map((label, column) => (
              <div
                key={label}
                className={
                  column === 1
                    ? "border-l border-neutral-200 dark:border-neutral-800"
                    : undefined
                }
              >
                <p className="border-b border-neutral-200 bg-neutral-50 px-2 py-1.5 text-center text-[11px] font-medium tabular-nums text-neutral-400 sm:text-xs dark:border-neutral-800 dark:bg-neutral-900">
                  {label}
                </p>
                <div className="space-y-2 px-2 py-2">
                  {tableRows.map((row) => (
                    <div key={row} className="flex items-center justify-between gap-3">
                      <SkeletonBone className="h-3 w-16" />
                      <SkeletonBone className="h-3 w-10" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function DailyInsight({
  initialRegion = DEFAULT_REGION,
  initialZone = "IT-North",
  initialDate,
  initialRows,
}: {
  initialRegion?: ItalianRegion;
  initialZone?: MarketZoneId;
  initialDate?: string;
  initialRows?: DayAheadRow[];
} = {}) {
  const [region, setRegion] = useState(initialRegion);
  const [selectedDate, setSelectedDate] = useState<string | null>(() => {
    const days = initialRows?.length ? groupZoneDays(initialRows) : [];
    if (
      initialDate &&
      (days.length === 0 ||
        days.some((day) => day.deliveryDate === initialDate))
    ) {
      return initialDate;
    }
    return pickDefaultDate(days);
  });
  const [rowsByZone, setRowsByZone] = useState<
    Partial<Record<MarketZoneId, DayAheadRow[]>>
  >(() => (initialRows?.length ? { [initialZone]: initialRows } : {}));
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [, startTransition] = useTransition();

  const zone = zoneForRegion(region);
  const zoneName = zoneNameForRegion(region);
  const cached = zone ? rowsByZone[zone] : undefined;
  const fetching = Boolean(zone) && cached === undefined && !error;

  useEffect(() => {
    if (!zone || cached) return;

    let cancelled = false;
    setError(null);

    fetchZonePrices(zone)
      .then((rows) => {
        if (cancelled) return;
        setRowsByZone((prev) => ({ ...prev, [zone]: rows }));
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Caricamento fallito");
      });

    return () => {
      cancelled = true;
    };
  }, [zone, cached]);

  useEffect(() => {
    if (!isRefreshing) return;
    if (fetching) return;
    const id = window.setTimeout(() => setIsRefreshing(false), 180);
    return () => window.clearTimeout(id);
  }, [isRefreshing, fetching, selectedDate, region]);

  const days = useMemo(() => groupZoneDays(cached ?? []), [cached]);

  useEffect(() => {
    if (days.length === 0) return;
    setSelectedDate((current) => {
      if (current && days.some((day) => day.deliveryDate === current)) {
        return current;
      }
      return pickDefaultDate(days);
    });
  }, [days]);

  const selected = days.find((day) => day.deliveryDate === selectedDate) ?? days[0];
  const day = useMemo(
    () => (selected ? buildDayInsight(selected) : null),
    [selected],
  );
  const dateIndex = selectedDate
    ? days.findIndex((item) => item.deliveryDate === selectedDate)
    : 0;
  const isOldest = dateIndex < 0 || dateIndex === days.length - 1;
  const isNewest = dateIndex <= 0;
  const today = romeToday();
  const now = useRomeNow();
  const nowLine = day ? nowLineForDay(day, now) : null;
  const showSkeleton = fetching || isRefreshing;
  const dateLabel = day
    ? formatDeliveryDate(day.deliveryDate, today)
    : selectedDate
      ? formatDeliveryDate(selectedDate, today)
      : "Prezzi";

  function goToDate(date: string) {
    setIsRefreshing(true);
    startTransition(() => setSelectedDate(date));
  }

  function handleRegionChange(next: string) {
    if (next === region) return;
    if (zoneForRegion(next) !== zone) setIsRefreshing(true);
    startTransition(() => setRegion(next as ItalianRegion));
    persistRegionPref(next);
  }

  const selectedDateRef = useRef(selectedDate);
  selectedDateRef.current = selectedDate;

  useEffect(() => {
    function onShowTodayPrices() {
      const today = romeToday();
      if (selectedDateRef.current === today) return;
      setIsRefreshing(true);
      startTransition(() => setSelectedDate(today));
    }

    window.addEventListener(SHOW_TODAY_PRICES_EVENT, onShowTodayPrices);
    return () => {
      window.removeEventListener(SHOW_TODAY_PRICES_EVENT, onShowTodayPrices);
    };
  }, []);

  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    const fromUrl = regionFromParam(search.get(REGION_QUERY_PARAM) ?? undefined);
    if (fromUrl) {
      persistRegionPref(fromUrl);
    } else {
      const stored = readRegionPref();
      if (stored && stored !== initialRegion) {
        if (zoneForRegion(stored) !== initialZone) setIsRefreshing(true);
        startTransition(() => setRegion(stored));
        persistRegionPref(stored);
      }
    }

    const hash = window.location.hash.replace(/^#/, "");
    const hasDeepLink =
      hash === PRICES_SECTION_ID ||
      search.has(REGION_QUERY_PARAM) ||
      search.has(DATE_QUERY_PARAM);
    if (!hasDeepLink) return;
    document.getElementById(PRICES_SECTION_ID)?.scrollIntoView();
  }, [initialRegion, initialZone]);

  return (
    <section
      id={PRICES_SECTION_ID}
      aria-labelledby="daily-insight-heading"
      aria-busy={showSkeleton}
      className="w-full scroll-mt-20"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2
          id="daily-insight-heading"
          className="text-lg font-medium tracking-tight text-foreground sm:text-xl"
        >
          I prezzi all&apos;ingrosso nella tua zona
        </h2>
        <ShareButton
          getUrl={() => pricesShareUrl(window.location.origin, region)}
          title={`kilowatt e banane🍌🍌🍌 — prezzi in ${region}`}
          text={`I prezzi dell'energia all'ingrosso in ${region}. Guarda quando conviene consumare.`}
          ariaLabel={`Condividi i prezzi in ${region}`}
        />
      </div>
      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
        Scegli il giorno e la regione: grafico e tabella ti dicono quando
        conviene consumare.
      </p>

      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <div className="flex min-w-0 items-center gap-1.5 sm:flex-1 sm:gap-2">
          <button
            type="button"
            onClick={() => {
              const next = days[dateIndex + 1];
              if (next) goToDate(next.deliveryDate);
            }}
            disabled={isOldest || days.length === 0 || fetching}
            aria-label="Giorno precedente"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-neutral-200 text-2xl leading-none text-neutral-700 transition-colors hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-30 sm:h-8 sm:w-8 sm:text-lg dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-900"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => {
              const next = days[dateIndex - 1];
              if (next) goToDate(next.deliveryDate);
            }}
            disabled={isNewest || days.length === 0 || fetching}
            aria-label="Giorno successivo"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-neutral-200 text-2xl leading-none text-neutral-700 transition-colors hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-30 sm:h-8 sm:w-8 sm:text-lg dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-900"
          >
            ›
          </button>
          <p
            className="min-w-0 truncate text-sm font-medium capitalize tracking-tight text-foreground sm:text-base"
            aria-live="polite"
          >
            {dateLabel}
          </p>
        </div>

        <div className="w-full sm:w-auto sm:shrink-0">
          <RegionSelect
            value={region}
            onChange={handleRegionChange}
            variant="banana"
            compact
            hideLabel
            align="right"
          />
        </div>
      </div>

      {zoneName ? (
        <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
          Zona di mercato:
          <span className="inline-flex items-center rounded-full bg-[#F5D547] px-2 py-0.5 font-medium text-[#111111]">
            {zoneName}
          </span>
        </p>
      ) : null}

      {error ? (
        <p className="mt-4 text-sm text-red-600 dark:text-red-400">
          Non riesco a caricare i prezzi. Riprova tra poco.
        </p>
      ) : showSkeleton ? (
        <>
          <span className="sr-only">Carico i prezzi della zona…</span>
          <InsightSkeleton />
        </>
      ) : !day || day.prices.length === 0 ? (
        <p className="mt-4 text-sm text-neutral-500 dark:text-neutral-400">
          Ancora nessun prezzo per questa zona.
        </p>
      ) : (
        <div
          key={`${zone}-${day.deliveryDate}`}
          className="insight-content-in"
        >
          <div className="mt-3 overflow-hidden rounded-lg border border-neutral-800 bg-[#111111]">
            <PriceChart day={day} nowHour={nowLine?.hour} />
          </div>
          <PriceTips best={day.bestTip} worst={day.worstTip} nowLine={nowLine} />
          <QuarterPriceTable day={day} />
        </div>
      )}
    </section>
  );
}
