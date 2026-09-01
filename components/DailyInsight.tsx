"use client";

import { useMemo, useState } from "react";
import { RegionSelect } from "@/components/RegionSelect";

type DayInsight = {
  daysAgo: number;
  prices: number[];
  cheapStart: number;
  cheapEnd: number;
  peakStart: number;
  peakEnd: number;
  headline: string;
  detail: string;
};

const DAYS: DayInsight[] = [
  {
    daysAgo: 0,
    prices: [
      85, 82, 78, 75, 80, 95, 110, 125, 118, 105, 90, 70, 55, 42, 38, 45, 62,
      95, 145, 160, 140, 115, 98, 88,
    ],
    cheapStart: 13,
    cheapEnd: 16,
    peakStart: 19,
    peakEnd: 21,
    headline: "Oggi conviene tra le 13 e le 16.",
    detail: "Il solare tiene i prezzi bassi. Evita le 19–21, picco della sera.",
  },
  {
    daysAgo: 1,
    prices: [
      48, 45, 42, 40, 44, 58, 88, 120, 135, 142, 138, 130, 125, 128, 132, 140,
      148, 155, 138, 110, 85, 72, 62, 55,
    ],
    cheapStart: 2,
    cheapEnd: 5,
    peakStart: 15,
    peakEnd: 17,
    headline: "Ieri i prezzi più bassi erano tra le 2 e le 5.",
    detail: "Notte conveniente, pomeriggio caro. Il picco è stato verso le 17.",
  },
  {
    daysAgo: 2,
    prices: [
      62, 60, 58, 56, 58, 65, 72, 78, 75, 70, 68, 64, 60, 58, 55, 57, 68, 82,
      95, 88, 78, 72, 68, 64,
    ],
    cheapStart: 12,
    cheapEnd: 15,
    peakStart: 18,
    peakEnd: 20,
    headline: "Due giorni fa i prezzi sono restati bassi quasi tutto il giorno.",
    detail: "Giornata piatta, solo un rialzo lieve verso le 20.",
  },
];

const BANANA = "#F5D547";
const PEAK = "#EF4444";
const CHART_W = 640;
const CHART_H = 260;
const PAD = { t: 24, r: 16, b: 36, l: 52 };

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
    ticks.push(Math.round(value * 100) / 100);
  }
  return { min, max, ticks };
}

function formatEuro(value: number) {
  const formatted = Number.isInteger(value)
    ? String(value)
    : value.toLocaleString("it-IT", { maximumFractionDigits: 2 });
  return `€${formatted}`;
}

function formatHourSlot(hour: number) {
  const start = String(hour).padStart(2, "0");
  const end = String(hour + 1).padStart(2, "0");
  return `${start}–${end}`;
}

function dateFor(daysAgo: number) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - daysAgo);
  return d;
}

function formatDate(daysAgo: number) {
  const formatted = dateFor(daysAgo).toLocaleDateString("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  if (daysAgo === 0) return `Oggi · ${formatted}`;
  if (daysAgo === 1) return `Ieri · ${formatted}`;
  return formatted;
}

function toPoints(prices: number[], min: number, max: number) {
  const range = max - min || 1;
  const innerW = CHART_W - PAD.l - PAD.r;
  const innerH = CHART_H - PAD.t - PAD.b;

  return prices.map((price, i) => ({
    x: PAD.l + (i / (prices.length - 1)) * innerW,
    y: PAD.t + (1 - (price - min) / range) * innerH,
  }));
}

function toSmoothPath(points: { x: number; y: number }[]) {
  if (points.length < 2) return "";

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

function PriceChart({ day }: { day: DayInsight }) {
  const scale = useMemo(() => yScale(day.prices), [day.prices]);
  const points = useMemo(
    () => toPoints(day.prices, scale.min, scale.max),
    [day.prices, scale.min, scale.max],
  );
  const line = useMemo(() => toSmoothPath(points), [points]);
  const area = `${line} L ${points[points.length - 1].x} ${CHART_H - PAD.b} L ${points[0].x} ${CHART_H - PAD.b} Z`;

  const cheapestIndex = day.prices.indexOf(Math.min(...day.prices));
  const banana = points[cheapestIndex];
  const innerH = CHART_H - PAD.t - PAD.b;
  const cheapFrom = points[day.cheapStart];
  const cheapTo = points[day.cheapEnd];
  const peakFrom = points[day.peakStart];
  const peakTo = points[day.peakEnd];
  const range = scale.max - scale.min || 1;

  const hourTicks = [0, 6, 12, 18, 23];
  const font = "var(--font-geist-sans), system-ui, sans-serif";

  return (
    <svg
      viewBox={`0 0 ${CHART_W} ${CHART_H}`}
      className="h-auto w-full"
      role="img"
      aria-label={`Andamento del prezzo in euro nelle 24 ore. Minimo alle ${cheapestIndex}:00.`}
    >
      <rect width={CHART_W} height={CHART_H} fill="#111111" rx="8" />

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
              {formatEuro(tick)}
            </text>
          </g>
        );
      })}

      {hourTicks.map((hour) => {
        const x = points[hour].x;
        return (
          <g key={hour}>
            <line
              x1={x}
              x2={x}
              y1={PAD.t}
              y2={CHART_H - PAD.b}
              stroke="#1f1f1f"
              strokeWidth="1"
            />
            <text
              x={x}
              y={CHART_H - 12}
              textAnchor="middle"
              fill="#737373"
              fontSize="12"
              fontFamily={font}
            >
              {hour === 23 ? "24" : String(hour).padStart(2, "0")}
            </text>
          </g>
        );
      })}

      <rect
        x={cheapFrom.x}
        y={PAD.t}
        width={Math.max(cheapTo.x - cheapFrom.x, 8)}
        height={innerH}
        fill={BANANA}
        opacity="0.08"
      />
      <rect
        x={peakFrom.x}
        y={PAD.t}
        width={Math.max(peakTo.x - peakFrom.x, 8)}
        height={innerH}
        fill={PEAK}
        opacity="0.16"
      />

      <path d={area} fill={BANANA} opacity="0.12" />
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
    </svg>
  );
}

function HourColumn({
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
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
          <th scope="col" className="px-3 py-2 font-medium">
            Ora
          </th>
          <th scope="col" className="px-3 py-2 text-right font-medium">
            Prezzo
          </th>
        </tr>
      </thead>
      <tbody>
        {prices.map((price, i) => {
          const hour = offset + i;
          const cheap = hour >= cheapStart && hour <= cheapEnd;
          const peak = hour >= peakStart && hour <= peakEnd;
          const cheapest = price === minPrice;
          return (
            <tr
              key={hour}
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
                className={`px-3 py-1.5 text-left font-normal tabular-nums ${
                  peak
                    ? "text-red-700 dark:text-red-400"
                    : "text-neutral-600 dark:text-neutral-400"
                }`}
              >
                {formatHourSlot(hour)}
              </th>
              <td
                className={`px-3 py-1.5 text-right tabular-nums ${
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
                    <span className="mr-1" aria-hidden>
                      🍌
                    </span>
                  </>
                ) : null}
                {peak ? <span className="sr-only">picco </span> : null}
                {formatEuro(price)}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function HourlyPriceTable({ day }: { day: DayInsight }) {
  const minPrice = Math.min(...day.prices);

  return (
    <div className="mt-6">
      <h3 className="text-sm font-medium tracking-tight text-foreground">
        Prezzi orari
      </h3>
      <div className="mt-2 overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-800">
        <div className="grid grid-cols-2">
          <HourColumn
            prices={day.prices.slice(0, 12)}
            offset={0}
            minPrice={minPrice}
            cheapStart={day.cheapStart}
            cheapEnd={day.cheapEnd}
            peakStart={day.peakStart}
            peakEnd={day.peakEnd}
          />
          <div className="border-l border-neutral-200 dark:border-neutral-800">
            <HourColumn
              prices={day.prices.slice(12)}
              offset={12}
              minPrice={minPrice}
              cheapStart={day.cheapStart}
              cheapEnd={day.cheapEnd}
              peakStart={day.peakStart}
              peakEnd={day.peakEnd}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export function DailyInsight() {
  const [index, setIndex] = useState(0);
  const [region, setRegion] = useState("Lombardia");
  const day = DAYS[index];
  const isOldest = index === DAYS.length - 1;
  const isToday = index === 0;

  return (
    <section aria-labelledby="daily-insight-heading" className="w-full">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={() => setIndex((i) => Math.min(i + 1, DAYS.length - 1))}
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
          <h2
            id="daily-insight-heading"
            className="min-w-0 truncate text-sm font-medium capitalize tracking-tight text-foreground sm:text-base"
          >
            {formatDate(day.daysAgo)}
          </h2>
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

      <div className="mt-3 overflow-hidden rounded-lg border border-neutral-800 bg-[#111111]">
        <PriceChart day={day} />
      </div>

      <div className="mt-4 text-center" aria-live="polite">
        <p className="text-sm font-medium text-foreground sm:text-base">
          {day.headline}
        </p>
        <p className="mt-1 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
          {day.detail}
        </p>
      </div>

      <HourlyPriceTable day={day} />
    </section>
  );
}
