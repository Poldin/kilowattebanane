"use client";

import { useEffect, useMemo, useState, type PointerEvent } from "react";
import { romeToday } from "@/lib/day-ahead-core";
import {
  CHART_W,
  PAD,
  formatEurocent,
  hourToX,
  toPoints,
  toSmoothPath,
  yScale,
} from "@/lib/insights";
import {
  DEFAULT_LOOKBACK_RANGE,
  LOOKBACK_RANGES,
  bandPath,
  dayHourlyCentSeriesFromHours,
  formatLatestDayRank,
  formatLookbackCaptionFromDates,
  formatLookbackDate,
  latestDayWindowRankFromPoints,
  lookbackEndDateFromDates,
  lookbackRangeById,
  lookbackWindowStatsFromHourly,
  pickAxisTicks,
  pointerToIndex,
  sliceLookbackDates,
  sliceLookbackPoints,
  valuesToPoints,
  type LookbackDayPoint,
  type LookbackRangeId,
} from "@/lib/lookback";
import type { ZoneHourlyPayload } from "@/lib/zone-home-types";

const BANANA = "#F5D547";
const PEAK = "#EF4444";
const MID = "#A3A3A3";
const CHART_H_DESKTOP = 220;
const CHART_W_MOBILE = 400;
const CHART_H_MOBILE = 280;
const PAD_MOBILE = { t: 36, r: 16, b: 48, l: 42 };

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
      axisFontSize: 13,
      unitFontSize: 11,
    };
  }

  return {
    chartW: CHART_W,
    chartH: CHART_H_DESKTOP,
    pad: PAD,
    axisFontSize: 14,
    unitFontSize: 12,
  };
}

type PickedPoint = {
  label: string;
  avgLabel: string;
  minLabel?: string;
  maxLabel?: string;
  x: number;
  y: number;
};

function LookbackChart({
  windowPoints,
  windowHourly,
  rangeId,
}: {
  windowPoints: LookbackDayPoint[];
  windowHourly: ZoneHourlyPayload[];
  rangeId: LookbackRangeId;
}) {
  const { chartW, chartH, pad, axisFontSize, unitFontSize } = useChartLayout();
  const [pickedIndex, setPickedIndex] = useState<number | null>(null);
  const hourly = rangeId === "1";
  const single = hourly ? windowHourly[windowHourly.length - 1] : null;
  const hourlyCent = useMemo(
    () => (single ? dayHourlyCentSeriesFromHours(single.hours) : []),
    [single],
  );
  const dailyPoints = hourly ? [] : windowPoints;

  const series = hourly ? hourlyCent : dailyPoints.map((point) => point.avg);
  const bandMins = hourly ? [] : dailyPoints.map((point) => point.min);
  const bandMaxs = hourly ? [] : dailyPoints.map((point) => point.max);
  const scaleValues = hourly ? hourlyCent : [...bandMins, ...series, ...bandMaxs];
  const scale = yScale(scaleValues.length > 0 ? scaleValues : [0]);
  const avgPoints = hourly
    ? toPoints(hourlyCent, scale.min, scale.max, chartH, chartW, pad)
    : valuesToPoints(series, scale.min, scale.max, chartH, chartW, pad);
  const minPoints = valuesToPoints(
    bandMins,
    scale.min,
    scale.max,
    chartH,
    chartW,
    pad,
  );
  const maxPoints = valuesToPoints(
    bandMaxs,
    scale.min,
    scale.max,
    chartH,
    chartW,
    pad,
  );
  const line = toSmoothPath(avgPoints);
  const area = hourly ? "" : bandPath(maxPoints, minPoints);
  const innerH = chartH - pad.t - pad.b;
  const range = scale.max - scale.min || 1;
  const font = "var(--font-geist-sans), system-ui, sans-serif";
  const xTicks = hourly
    ? [0, 6, 12, 18, 24].map((hour) => ({
        x: hourToX(hour, chartW, pad),
        label: String(hour).padStart(2, "0"),
      }))
    : pickAxisTicks(dailyPoints.length).map((index) => ({
        x: avgPoints[index]?.x ?? pad.l,
        label: dailyPoints[index]
          ? formatLookbackDate(dailyPoints[index].date)
          : "",
      }));

  const picked: PickedPoint | null = (() => {
    if (pickedIndex == null) return null;
    if (hourly) {
      const point = avgPoints[pickedIndex];
      const price = hourlyCent[pickedIndex];
      if (!point || price == null) return null;
      return {
        label: `${String(pickedIndex).padStart(2, "0")}:00`,
        avgLabel: formatEurocent(price),
        x: point.x,
        y: point.y,
      };
    }
    const day = dailyPoints[pickedIndex];
    const point = avgPoints[pickedIndex];
    if (!day || !point) return null;
    return {
      label: formatLookbackDate(day.date, true),
      avgLabel: formatEurocent(day.avg),
      minLabel: formatEurocent(day.min),
      maxLabel: formatEurocent(day.max),
      x: point.x,
      y: point.y,
    };
  })();

  function pickFromPointer(event: PointerEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    if (hourly) {
      if (hourlyCent.length === 0 || rect.width <= 0) return;
      const x = ((event.clientX - rect.left) / rect.width) * chartW;
      const innerW = chartW - pad.l - pad.r;
      const hour = ((x - pad.l) / innerW) * 24;
      setPickedIndex(
        Math.min(
          hourlyCent.length - 1,
          Math.max(0, Math.round(hour - 0.5)),
        ),
      );
      return;
    }
    setPickedIndex(
      pointerToIndex(event.clientX, rect, dailyPoints.length, chartW, pad),
    );
  }

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${chartW} ${chartH}`}
        className="h-auto w-full cursor-crosshair touch-manipulation"
        role="img"
        aria-label={
          hourly
            ? "Andamento orario del prezzo medio nell'ultimo giorno, in centesimi di euro per kilowattora."
            : "Andamento del prezzo medio giornaliero nel periodo scelto, con banda tra minimo e massimo di ogni giorno."
        }
        onPointerDown={(event) => {
          if (event.pointerType === "mouse" && event.button !== 0) return;
          pickFromPointer(event);
        }}
        onPointerMove={(event) => {
          if (event.buttons > 0) pickFromPointer(event);
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

        {xTicks.map((tick) => (
          <g key={`${tick.x}-${tick.label}`}>
            <line
              x1={tick.x}
              x2={tick.x}
              y1={pad.t}
              y2={chartH - pad.b}
              stroke="#1f1f1f"
              strokeWidth="1"
            />
            <text
              x={tick.x}
              y={chartH - 16}
              textAnchor="middle"
              fill="#f5f5f5"
              fontSize={axisFontSize}
              fontFamily={font}
              fontWeight="600"
            >
              {tick.label}
            </text>
          </g>
        ))}

        {area ? (
          <path d={area} fill={BANANA} opacity="0.16" />
        ) : null}

        <path
          d={line}
          fill="none"
          stroke={BANANA}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

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

      {picked ? (
        <button
          type="button"
          className="absolute top-2.5 right-2.5 z-10 flex items-start gap-2 rounded-md border border-white/15 bg-black/80 px-2.5 py-1.5 text-left text-white shadow-sm"
          aria-label={`Chiudi lettura del ${picked.label}, ${picked.avgLabel}`}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => setPickedIndex(null)}
        >
          <span>
            <span className="block text-xs font-semibold tabular-nums sm:text-sm">
              {picked.label} · {picked.avgLabel}
            </span>
            {picked.minLabel && picked.maxLabel ? (
              <span className="block text-[11px] tabular-nums text-white/70">
                min {picked.minLabel} · max {picked.maxLabel}
              </span>
            ) : null}
          </span>
          <span aria-hidden className="text-sm leading-none text-white/70">
            ×
          </span>
        </button>
      ) : null}
    </div>
  );
}

export function LookbackInsight({
  points,
  hourly,
}: {
  points: LookbackDayPoint[];
  hourly: ZoneHourlyPayload[];
}) {
  const [rangeId, setRangeId] = useState<LookbackRangeId>(DEFAULT_LOOKBACK_RANGE);
  const endDate = lookbackEndDateFromDates(points.map((point) => point.date));
  const range = lookbackRangeById(rangeId);
  const windowDates = useMemo(() => {
    if (!endDate) return [];
    return sliceLookbackDates(
      points.map((point) => point.date),
      range.days,
      endDate,
    );
  }, [points, endDate, range.days]);
  const windowPoints = useMemo(() => {
    if (!endDate) return [];
    return sliceLookbackPoints(points, range.days, endDate);
  }, [points, endDate, range.days]);
  const windowHourly = useMemo(() => {
    const allowed = new Set(windowDates);
    return hourly.filter((day) => allowed.has(day.date));
  }, [hourly, windowDates]);
  const stats = lookbackWindowStatsFromHourly(windowHourly);
  const caption = formatLookbackCaptionFromDates(windowDates);
  const latestRank = latestDayWindowRankFromPoints(windowPoints);
  const latestCopy = latestRank
    ? formatLatestDayRank(latestRank, romeToday())
    : null;

  if (!endDate || windowPoints.length === 0 || !stats) return null;

  return (
    <section
      aria-labelledby="lookback-heading"
      className="mt-10 scroll-mt-20 border-t border-neutral-200 pt-8 dark:border-neutral-800"
    >
      <h3
        id="lookback-heading"
        className="text-lg font-medium tracking-tight text-foreground sm:text-xl"
      >
        Amplia lo sguardo
      </h3>
      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
        Il medio all&apos;ingrosso nella tua zona, da un giorno a tutto lo
        storico.
      </p>

      <div
        role="tablist"
        aria-label="Periodo del grafico"
        className="mt-4 flex gap-1 overflow-x-auto pb-1"
      >
        {LOOKBACK_RANGES.map((item) => {
          const active = item.id === rangeId;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setRangeId(item.id)}
              className={
                active
                  ? "shrink-0 rounded-md bg-[#F5D547] px-2.5 py-1.5 text-xs font-semibold text-[#111111]"
                  : "shrink-0 rounded-md px-2.5 py-1.5 text-xs font-medium text-neutral-600 transition-colors hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-900"
              }
            >
              {item.label}
            </button>
          );
        })}
      </div>

      <div className="mt-3 overflow-hidden rounded-lg border border-neutral-800 bg-[#111111]">
        <LookbackChart
          key={rangeId}
          windowPoints={windowPoints}
          windowHourly={windowHourly}
          rangeId={rangeId}
        />
      </div>

      <div className="mt-5" aria-label="Minimo, medio e massimo del periodo">
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              { label: "min", value: formatEurocent(stats.min) },
              { label: "medio", value: formatEurocent(stats.avg) },
              { label: "max", value: formatEurocent(stats.max) },
            ] as const
          ).map((stat) => (
            <div key={stat.label}>
              <p className="text-[11px] font-medium tracking-wider text-neutral-500 uppercase">
                {stat.label}
              </p>
              <p className="text-xl font-semibold tabular-nums tracking-tight text-foreground">
                {stat.value}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">
          c€/kWh all&apos;ingrosso · {caption}
        </p>
        {latestCopy ? (
          <p className="mt-3 text-sm font-medium text-foreground">
            {latestCopy.before}
            <span
              className="underline decoration-2 underline-offset-2"
              style={{
                textDecorationColor:
                  latestCopy.tone === "expensive"
                    ? PEAK
                    : latestCopy.tone === "cheap"
                      ? BANANA
                      : MID,
              }}
            >
              {latestCopy.mark}
            </span>
            {latestCopy.after}
          </p>
        ) : null}
      </div>
    </section>
  );
}
