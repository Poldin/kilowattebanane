"use client";

import { useEffect, useMemo, useState } from "react";
import { RegionSelect } from "@/components/RegionSelect";
import { zoneForRegion, zoneNameForRegion, type MarketZoneId } from "@/lib/market-zones";
import {
  QUARTERS_PER_HOUR,
  formatQuarterSlot,
  formatQuarterSlotFull,
  hourRangeToQuarters,
  toHourlyAverages,
} from "@/lib/prices";

type DayInsight = {
  daysAgo: number;
  prices: number[];
  cheapStart: number;
  cheapEnd: number;
  peakStart: number;
  peakEnd: number;
  bestTip: string;
  worstTip: string;
};

const ZONE_PRICE_SHIFT: Record<MarketZoneId, number> = {
  "IT-North": 0,
  "IT-Centre-North": 3,
  "IT-Centre-South": 5,
  "IT-South": 8,
  "IT-Calabria": 12,
  "IT-Sicily": 18,
  "IT-Sardinia": 6,
};

function shiftPrices(prices: number[], zone: MarketZoneId | undefined) {
  const shift = zone ? ZONE_PRICE_SHIFT[zone] : 0;
  return prices.map((price) => Math.round((price + shift) * 100) / 100);
}

type DaySeed = {
  daysAgo: number;
  hourly: number[];
};

function expandToQuarters(hourly: number[]) {
  return hourly.flatMap((price, hour) => {
    const next = hourly[hour + 1] ?? price;
    const step = (next - price) / QUARTERS_PER_HOUR;
    return [0, 1, 2, 3].map(
      (quarter) => Math.round((price + step * quarter) * 100) / 100,
    );
  });
}

function buildDayInsight(seed: DaySeed, zone: MarketZoneId | undefined): DayInsight {
  const prices = shiftPrices(expandToQuarters(seed.hourly), zone);
  const recommendations = computeRecommendations(prices);

  return {
    daysAgo: seed.daysAgo,
    prices,
    cheapStart: recommendations.cheapStart,
    cheapEnd: recommendations.cheapEnd,
    peakStart: recommendations.peakStart,
    peakEnd: recommendations.peakEnd,
    bestTip: recommendations.bestTip,
    worstTip: recommendations.worstTip,
  };
}

const DAY_SEEDS: DaySeed[] = [
  {
    daysAgo: 0,
    hourly: [
      85, 82, 78, 75, 80, 95, 110, 125, 118, 105, 90, 70, 55, 42, 38, 45, 62,
      95, 145, 160, 140, 115, 98, 88,
    ],
  },
  {
    daysAgo: 1,
    hourly: [
      48, 45, 42, 40, 44, 58, 88, 120, 135, 142, 138, 130, 125, 128, 132, 140,
      148, 155, 138, 110, 85, 72, 62, 55,
    ],
  },
  {
    daysAgo: 2,
    hourly: [
      62, 60, 58, 56, 58, 65, 72, 78, 75, 70, 68, 64, 60, 58, 55, 57, 68, 82,
      95, 88, 78, 72, 68, 64,
    ],
  },
];

const BANANA = "#F5D547";
const PEAK = "#EF4444";
const CHART_W = 640;
const CHART_H_DESKTOP = 260;
const CHART_H_MOBILE = 360;
const PAD = { t: 28, r: 16, b: 36, l: 48 };
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

function formatDate(daysAgo: number, now: Date) {
  const d = new Date(now);
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - daysAgo);
  const formatted = d.toLocaleDateString("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  if (daysAgo === 0) return `Oggi · ${formatted}`;
  if (daysAgo === 1) return `Ieri · ${formatted}`;
  return formatted;
}

function hourToX(hour: number) {
  const innerW = CHART_W - PAD.l - PAD.r;
  return PAD.l + (hour / 24) * innerW;
}

function toPoints(
  prices: number[],
  min: number,
  max: number,
  chartH: number,
) {
  const range = max - min || 1;
  const innerH = chartH - PAD.t - PAD.b;

  return prices.map((price, i) => ({
    x: hourToX(i + 0.5),
    y: PAD.t + (1 - (price - min) / range) * innerH,
  }));
}

function useChartHeight() {
  const [chartH, setChartH] = useState(CHART_H_DESKTOP);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 639px)");
    const update = () => {
      setChartH(media.matches ? CHART_H_MOBILE : CHART_H_DESKTOP);
    };

    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return chartH;
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

function smoothPathExtrema(points: { x: number; y: number }[]) {
  if (points.length === 0) {
    return { min: { x: 0, y: 0 }, max: { x: 0, y: 0 } };
  }

  let min = { ...points[0] };
  let max = { ...points[0] };

  for (let i = 0; i < points.length - 1; i++) {
    const { p1, c1, c2, p2 } = smoothPathSegmentControls(points, i);
    for (let step = 0; step <= 40; step++) {
      const p = cubicBezierPoint(p1, c1, c2, p2, step / 40);
      if (p.y < min.y) min = p;
      if (p.y > max.y) max = p;
    }
  }

  return { min, max };
}

function yToPrice(
  y: number,
  scaleMin: number,
  scaleMax: number,
  chartH: number = CHART_H_DESKTOP,
) {
  const innerH = chartH - PAD.t - PAD.b;
  const range = scaleMax - scaleMin || 1;
  return scaleMin + (1 - (y - PAD.t) / innerH) * range;
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
): CurveSample[] {
  const innerW = CHART_W - PAD.l - PAD.r;
  const samples: CurveSample[] = [];

  for (let i = 0; i < points.length - 1; i++) {
    const { p1, c1, c2, p2 } = smoothPathSegmentControls(points, i);
    for (let step = 0; step <= 40; step++) {
      const p = cubicBezierPoint(p1, c1, c2, p2, step / 40);
      samples.push({
        x: p.x,
        y: p.y,
        hour: ((p.x - PAD.l) / innerW) * 24,
        price: yToPrice(p.y, scaleMin, scaleMax),
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

function pickDistinctTips(
  extrema: CurveSample[],
  allSamples: CurveSample[],
  mode: "min" | "max",
  count: number,
) {
  const sorted = [...extrema].sort((a, b) =>
    mode === "min" ? a.price - b.price : b.price - a.price,
  );
  const picked: CurveSample[] = [];

  for (const sample of sorted) {
    if (picked.some((p) => Math.abs(p.hour - sample.hour) < 0.75)) continue;
    picked.push(sample);
    if (picked.length === count) return picked;
  }

  const fallback = [...allSamples].sort((a, b) =>
    mode === "min" ? a.price - b.price : b.price - a.price,
  );
  for (const sample of fallback) {
    if (picked.some((p) => Math.abs(p.hour - sample.hour) < 0.75)) continue;
    picked.push(sample);
    if (picked.length === count) break;
  }

  return picked;
}

const TOP_TIP_WINDOW_HOURS = 1;

function formatTipHour(hour: number) {
  const totalMinutes = Math.round(hour * 60);
  const h = Math.floor(totalMinutes / 60) % 24;
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
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

function computeRecommendations(prices: number[]) {
  const hourly = toHourlyAverages(prices);
  const pricesCent = hourly.map(toEurocentPerKwh);
  const scale = yScale(pricesCent);
  const points = toPoints(pricesCent, scale.min, scale.max, CHART_H_DESKTOP);
  const samples = sampleSmoothCurve(points, scale.min, scale.max);
  const { minima, maxima } = findLocalExtrema(samples);
  const bestSample = pickDistinctTips(minima, samples, "min", 1)[0];
  const worstSample = pickDistinctTips(maxima, samples, "max", 1)[0];
  const bestBounds = tipRangeBounds(bestSample.hour);
  const worstBounds = tipRangeBounds(worstSample.hour);
  const bestQuarters = hoursToQuarterRange(bestBounds.from, bestBounds.to);
  const worstQuarters = hoursToQuarterRange(worstBounds.from, worstBounds.to);

  return {
    cheapStart: bestQuarters.start,
    cheapEnd: bestQuarters.end,
    peakStart: worstQuarters.start,
    peakEnd: worstQuarters.end,
    bestTip: `🍌 Top risparmio dalle ${formatTipHour(bestBounds.from)} alle ${formatTipHour(bestBounds.to)}`,
    worstTip: `🐵 Evita consumi dalle ${formatTipHour(worstBounds.from)} alle ${formatTipHour(worstBounds.to)}`,
  };
}

function PriceTips({ best, worst }: { best: string; worst: string }) {
  return (
    <div
      className="mt-4 space-y-1 text-left text-sm sm:text-base"
      aria-live="polite"
      aria-label="Consigli su quando consumare o evitare"
    >
      <p className="font-medium text-foreground">{best}</p>
      <p className="text-neutral-600 dark:text-neutral-400">{worst}</p>
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

function PriceChart({ day }: { day: DayInsight }) {
  const chartH = useChartHeight();
  const hourly = useMemo(() => toHourlyAverages(day.prices), [day.prices]);
  const pricesCent = useMemo(
    () => hourly.map(toEurocentPerKwh),
    [hourly],
  );
  const scale = useMemo(() => yScale(pricesCent), [pricesCent]);
  const points = useMemo(
    () => toPoints(pricesCent, scale.min, scale.max, chartH),
    [pricesCent, scale.min, scale.max, chartH],
  );
  const line = useMemo(() => toSmoothPath(points), [points]);
  const { min: monkey, max: banana } = useMemo(
    () => smoothPathExtrema(points),
    [points],
  );

  const cheapestIndex = pricesCent.indexOf(Math.min(...pricesCent));
  const peakIndex = pricesCent.indexOf(Math.max(...pricesCent));
  const innerH = chartH - PAD.t - PAD.b;
  const cheapFromX = hourToX(day.cheapStart / QUARTERS_PER_HOUR);
  const cheapToX = hourToX((day.cheapEnd + 1) / QUARTERS_PER_HOUR);
  const peakFromX = hourToX(day.peakStart / QUARTERS_PER_HOUR);
  const peakToX = hourToX((day.peakEnd + 1) / QUARTERS_PER_HOUR);
  const range = scale.max - scale.min || 1;

  const hourTicks = [0, 6, 12, 18, 24];
  const font = "var(--font-geist-sans), system-ui, sans-serif";

  return (
    <svg
      viewBox={`0 0 ${CHART_W} ${chartH}`}
      className="h-auto w-full"
      role="img"
      aria-label={`Andamento orario del prezzo in centesimi di euro per kilowattora. Minimo alle ${cheapestIndex}:00, massimo alle ${peakIndex}:00.`}
    >
      <rect width={CHART_W} height={chartH} fill="#111111" rx="8" />

      <text
        x={PAD.l}
        y={16}
        fill="#a3a3a3"
        fontSize="10"
        fontFamily={font}
      >
        c€/kWh
      </text>

      {scale.ticks.map((tick) => {
        const y = PAD.t + (1 - (tick - scale.min) / range) * innerH;
        return (
          <g key={tick}>
            <line
              x1={PAD.l}
              x2={CHART_W - PAD.r}
              y1={y}
              y2={y}
              stroke="#262626"
              strokeWidth="1"
            />
            <text
              x={PAD.l - 8}
              y={y + 4}
              textAnchor="end"
              fill="#a3a3a3"
              fontSize="11"
              fontFamily={font}
            >
              {formatEurocent(tick, scale.tickDigits)}
            </text>
          </g>
        );
      })}

      {hourTicks.map((hour) => {
        const x = hourToX(hour);
        return (
          <g key={hour}>
            <line
              x1={x}
              x2={x}
              y1={PAD.t}
              y2={chartH - PAD.b}
              stroke="#1f1f1f"
              strokeWidth="1"
            />
            <text
              x={x}
              y={chartH - 12}
              textAnchor="middle"
              fill="#737373"
              fontSize="12"
              fontFamily={font}
            >
              {String(hour).padStart(2, "0")}
            </text>
          </g>
        );
      })}

      <rect
        x={cheapFromX}
        y={PAD.t}
        width={Math.max(cheapToX - cheapFromX, 8)}
        height={innerH}
        fill={BANANA}
        opacity="0.08"
      />
      <rect
        x={peakFromX}
        y={PAD.t}
        width={Math.max(peakToX - peakFromX, 8)}
        height={innerH}
        fill={PEAK}
        opacity="0.16"
      />

      <path
        d={line}
        fill="none"
        stroke={BANANA}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <text
        x={banana.x}
        y={banana.y - 10}
        textAnchor="middle"
        fontSize="18"
      >
        🍌
      </text>

      <text
        x={monkey.x}
        y={monkey.y - 10}
        textAnchor="middle"
        fontSize="18"
      >
        🐵
      </text>
    </svg>
  );
}

function QuarterColumn({
  prices,
  offset,
  minPrice,
  cheapStart,
  cheapEnd,
  peakStart,
  peakEnd,
}: {
  prices: number[];
  offset: number;
  minPrice: number;
  cheapStart: number;
  cheapEnd: number;
  peakStart: number;
  peakEnd: number;
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
          const cheap = slot >= cheapStart && slot <= cheapEnd;
          const peak = slot >= peakStart && slot <= peakEnd;
          const cheapest = price === minPrice;
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
                {peak ? <span className="sr-only">picco </span> : null}
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
  const minPrice = Math.min(...day.prices);
  const columns = [
    { start: 0, end: 48, label: "00–12" },
    { start: 48, end: 96, label: "12–24" },
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
                minPrice={minPrice}
                cheapStart={day.cheapStart}
                cheapEnd={day.cheapEnd}
                peakStart={day.peakStart}
                peakEnd={day.peakEnd}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function DailyInsight() {
  const [index, setIndex] = useState(0);
  const [region, setRegion] = useState("Lombardia");
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
  }, []);
  const zone = zoneForRegion(region);
  const zoneName = zoneNameForRegion(region);
  const seed = DAY_SEEDS[index];
  const day = useMemo(() => buildDayInsight(seed, zone), [seed, zone]);
  const isOldest = index === DAY_SEEDS.length - 1;
  const isToday = index === 0;

  return (
    <section aria-labelledby="daily-insight-heading" className="w-full">
      <h2
        id="daily-insight-heading"
        className="text-lg font-medium tracking-tight text-foreground sm:text-xl"
      >
        I prezzi nella tua zona
      </h2>
      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
        Scegli il giorno e la regione: grafico e tabella ti dicono quando
        conviene consumare.
      </p>

      <div className="mt-5 flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={() => setIndex((i) => Math.min(i + 1, DAY_SEEDS.length - 1))}
            disabled={isOldest}
            aria-label="Giorno precedente"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-neutral-200 text-lg leading-none text-neutral-700 transition-colors hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-30 dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-900"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => setIndex((i) => Math.max(i - 1, 0))}
            disabled={isToday}
            aria-label="Giorno successivo"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-neutral-200 text-lg leading-none text-neutral-700 transition-colors hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-30 dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-900"
          >
            ›
          </button>
          <p
            className="min-w-0 truncate text-sm font-medium capitalize tracking-tight text-foreground sm:text-base"
            aria-live="polite"
          >
            {now ? formatDate(day.daysAgo, now) : "Oggi"}
          </p>
        </div>

        <div className="shrink-0">
          <RegionSelect
            value={region}
            onChange={setRegion}
            variant="banana"
            compact
            hideLabel
            align="right"
          />
        </div>
      </div>

      {zoneName ? (
        <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
          Zona di mercato: {zoneName}
        </p>
      ) : null}

      <div className="mt-3 overflow-hidden rounded-lg border border-neutral-800 bg-[#111111]">
        <PriceChart day={day} />
      </div>

      <PriceTips best={day.bestTip} worst={day.worstTip} />

      <QuarterPriceTable day={day} />
    </section>
  );
}
