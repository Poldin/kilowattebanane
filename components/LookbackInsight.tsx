"use client";

import { useEffect, useMemo, useState, type PointerEvent } from "react";
import { ChartLayerToggles } from "@/components/ChartLayerToggles";
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
  cheapPeakForTariff,
  fasciaAveragesFromDays,
  fasciaAveragesFromHourly,
  fasciaF23Bands,
  fasciaForHour,
  fasciaHourBands,
  FASCIA_COLOR,
  FASCIA_LEGEND_COLOR,
  layersForTariff,
  type ChartLayers,
  type FasciaAverages,
  type FasciaId,
  type FasciaStatId,
  type TariffPlanId,
} from "@/lib/fasce";
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
  nullableValuesToPoints,
  pickAxisTicks,
  pointerToIndex,
  sliceLookbackDates,
  sliceLookbackPoints,
  toBrokenLinearPath,
  valuesToPoints,
  type LookbackDayPoint,
  type LookbackRangeId,
} from "@/lib/lookback";
import { RegionZoneBar } from "@/components/RegionZoneBar";
import type { ItalianRegion } from "@/lib/market-zones";
import type { ZoneHourlyPayload } from "@/lib/zone-home-types";

const BANANA = "#F5D547";
const PEAK = "#EF4444";
const MID = "#A3A3A3";
const CHART_H_DESKTOP = 220;
const CHART_W_MOBILE = 400;
const CHART_H_MOBILE = 280;
const PAD_MOBILE = { t: 36, r: 16, b: 48, l: 42 };

const FASCIA_CURVES: {
  id: FasciaStatId;
  color: string;
  dash?: string;
  layer: keyof ChartLayers;
}[] = [
  {
    id: "Fmonoraria",
    color: FASCIA_LEGEND_COLOR.Fmonoraria,
    dash: "2 4",
    layer: "mono",
  },
  { id: "F23", color: FASCIA_LEGEND_COLOR.F23, dash: "6 4", layer: "f23" },
  { id: "F3", color: FASCIA_COLOR.F3, layer: "f3" },
  { id: "F2", color: FASCIA_COLOR.F2, layer: "f2" },
  { id: "F1", color: FASCIA_COLOR.F1, layer: "f1" },
];

const FASCIA_STATS: { id: FasciaStatId; label: string }[] = [
  { id: "F1", label: "F1" },
  { id: "F2", label: "F2" },
  { id: "F3", label: "F3" },
  { id: "F23", label: "F23" },
  { id: "Fmonoraria", label: "Fmonoraria" },
];

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

function priceToY(
  price: number,
  scale: { min: number; max: number },
  pad: { t: number; r: number; b: number; l: number },
  innerH: number,
) {
  const range = scale.max - scale.min || 1;
  const plotBottom = pad.t + innerH;
  return Math.min(
    plotBottom,
    Math.max(pad.t, pad.t + (1 - (price - scale.min) / range) * innerH),
  );
}

function formatFasciaValue(value: number | null) {
  return value == null ? "—" : formatEurocent(value);
}

function FasciaSwatch({ id }: { id: FasciaStatId }) {
  if (id === "F23") {
    return (
      <span
        className="inline-flex h-2.5 w-2.5 overflow-hidden rounded-[3px]"
        aria-hidden
      >
        <span className="h-full w-1/2" style={{ background: FASCIA_COLOR.F2 }} />
        <span className="h-full w-1/2" style={{ background: FASCIA_COLOR.F3 }} />
      </span>
    );
  }
  return (
    <span
      className="inline-block h-2.5 w-2.5 rounded-[3px]"
      style={{ background: FASCIA_LEGEND_COLOR[id] }}
      aria-hidden
    />
  );
}

function visibleFasciaIds(layers: ChartLayers): FasciaStatId[] {
  const ids: FasciaStatId[] = [];
  if (layers.f1) ids.push("F1");
  if (layers.f2) ids.push("F2");
  if (layers.f3) ids.push("F3");
  if (layers.f23) ids.push("F23");
  if (layers.mono) ids.push("Fmonoraria");
  return ids;
}

type PickedRow = { label: string; value: string; color: string };
type PickedDot = { y: number; color: string };
type PickedPoint = {
  label: string;
  rows: PickedRow[];
  x: number;
  dots: PickedDot[];
};

function LookbackChart({
  windowPoints,
  windowHourly,
  rangeId,
  layers,
}: {
  windowPoints: LookbackDayPoint[];
  windowHourly: ZoneHourlyPayload[];
  rangeId: LookbackRangeId;
  layers: ChartLayers;
}) {
  const { chartW, chartH, pad, axisFontSize, unitFontSize } = useChartLayout();
  const [pickedIndex, setPickedIndex] = useState<number | null>(null);
  const hourly = rangeId === "1";
  const showLine = layers.line;
  const showMono = layers.mono;
  const showF23 = layers.f23;
  const showAnyFascia = layers.f1 || layers.f2 || layers.f3;
  const fasciaOn: Record<FasciaId, boolean> = {
    F1: layers.f1,
    F2: layers.f2,
    F3: layers.f3,
  };
  const single = hourly ? windowHourly[windowHourly.length - 1] : null;
  const hourlyCent = useMemo(
    () => (single ? dayHourlyCentSeriesFromHours(single.hours) : []),
    [single],
  );
  const dailyPoints = hourly ? [] : windowPoints;
  const fasciaByDate = useMemo(() => {
    const map = new Map<string, FasciaAverages>();
    for (const day of windowHourly) {
      map.set(day.date, fasciaAveragesFromHourly(day.date, day.hours));
    }
    return map;
  }, [windowHourly]);
  const singleAvgs = useMemo(
    () =>
      single ? fasciaAveragesFromHourly(single.date, single.hours) : null,
    [single],
  );
  const fasciaBands = useMemo(
    () => (single ? fasciaHourBands(single.date) : []),
    [single],
  );
  const f23Bands = useMemo(
    () => (single ? fasciaF23Bands(single.date) : []),
    [single],
  );

  const series = hourly ? hourlyCent : dailyPoints.map((point) => point.avg);
  const bandMins = hourly ? [] : dailyPoints.map((point) => point.min);
  const bandMaxs = hourly ? [] : dailyPoints.map((point) => point.max);
  const scaleValues: number[] = [];
  if (hourly) {
    if (showLine) scaleValues.push(...hourlyCent);
    if (singleAvgs) {
      for (const id of visibleFasciaIds(layers)) {
        const value = singleAvgs[id];
        if (value != null) scaleValues.push(value);
      }
    }
  } else {
    if (showLine) scaleValues.push(...bandMins, ...series, ...bandMaxs);
    for (const curve of FASCIA_CURVES) {
      if (!layers[curve.layer]) continue;
      for (const point of dailyPoints) {
        const value = fasciaByDate.get(point.date)?.[curve.id];
        if (value != null) scaleValues.push(value);
      }
    }
  }
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
  const area = hourly || !showLine ? "" : bandPath(maxPoints, minPoints);
  const innerH = chartH - pad.t - pad.b;
  const range = scale.max - scale.min || 1;
  const plotBottom = pad.t + innerH;
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

  const fasciaPaths = hourly
    ? []
    : FASCIA_CURVES.filter((curve) => layers[curve.layer]).map((curve) => {
        const values = dailyPoints.map(
          (point) => fasciaByDate.get(point.date)?.[curve.id] ?? null,
        );
        const points = nullableValuesToPoints(
          values,
          scale.min,
          scale.max,
          chartH,
          chartW,
          pad,
        );
        return { curve, points, d: toBrokenLinearPath(points) };
      });

  const picked: PickedPoint | null = (() => {
    if (pickedIndex == null) return null;
    if (hourly) {
      const point = avgPoints[pickedIndex];
      const price = hourlyCent[pickedIndex];
      if (!point && price == null) return null;
      const x =
        point?.x ?? hourToX(pickedIndex + 0.5, chartW, pad);
      const rows: PickedRow[] = [];
      const dots: PickedDot[] = [];
      if (showLine && price != null && point) {
        rows.push({
          label: "prezzo",
          value: formatEurocent(price),
          color: BANANA,
        });
        dots.push({ y: point.y, color: BANANA });
      }
      if (single && singleAvgs) {
        const hourFascia = fasciaForHour(single.date, pickedIndex);
        for (const id of visibleFasciaIds(layers)) {
          const value = singleAvgs[id];
          rows.push({
            label: id === "Fmonoraria" ? "Fmono" : id,
            value: formatFasciaValue(value),
            color: FASCIA_LEGEND_COLOR[id],
          });
          const coversHour =
            id === "Fmonoraria" ||
            (id === "F23" && hourFascia !== "F1") ||
            id === hourFascia;
          if (value != null && coversHour) {
            dots.push({
              y: priceToY(value, scale, pad, innerH),
              color: FASCIA_LEGEND_COLOR[id],
            });
          }
        }
      }
      if (rows.length === 0) return null;
      return {
        label: `${String(pickedIndex).padStart(2, "0")}:00`,
        rows,
        x,
        dots,
      };
    }
    const day = dailyPoints[pickedIndex];
    const point = avgPoints[pickedIndex];
    if (!day) return null;
    const x = point?.x ?? pad.l;
    const rows: PickedRow[] = [];
    const dots: PickedDot[] = [];
    if (showLine && point) {
      rows.push({
        label: "medio",
        value: formatEurocent(day.avg),
        color: BANANA,
      });
      rows.push({
        label: "min–max",
        value: `${formatEurocent(day.min)} · ${formatEurocent(day.max)}`,
        color: "#d4d4d4",
      });
      dots.push({ y: point.y, color: BANANA });
    }
    const fasce = fasciaByDate.get(day.date);
    for (const curve of FASCIA_CURVES) {
      if (!layers[curve.layer]) continue;
      const value = fasce?.[curve.id] ?? null;
      rows.push({
        label: curve.id === "Fmonoraria" ? "Fmono" : curve.id,
        value: formatFasciaValue(value),
        color: curve.color,
      });
      const curvePoint = fasciaPaths
        .find((item) => item.curve.id === curve.id)
        ?.points[pickedIndex];
      if (curvePoint) dots.push({ y: curvePoint.y, color: curve.color });
    }
    if (rows.length === 0) return null;
    return {
      label: formatLookbackDate(day.date, true),
      rows,
      x,
      dots,
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

  const monoY =
    hourly && showMono && singleAvgs?.Fmonoraria != null
      ? priceToY(singleAvgs.Fmonoraria, scale, pad, innerH)
      : null;
  const monoFromX = hourToX(0, chartW, pad);
  const monoToX = hourToX(24, chartW, pad);

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${chartW} ${chartH}`}
        className="h-auto w-full cursor-crosshair touch-manipulation"
        role="img"
        aria-label={
          hourly
            ? `Andamento orario del prezzo medio nell'ultimo giorno, in centesimi di euro per kilowattora.${
                showAnyFascia ? " Fasce F1, F2 e F3 visibili." : ""
              }${showF23 ? " F23 visibile." : ""}${showMono ? " Fmonoraria visibile." : ""}`
            : `Andamento del prezzo medio giornaliero nel periodo scelto, con banda tra minimo e massimo di ogni giorno.${
                showAnyFascia ? " Medie giornaliere F1, F2 e F3 visibili." : ""
              }${showF23 ? " Media F23 visibile." : ""}${showMono ? " Fmonoraria visibile." : ""}`
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

        {hourly
          ? fasciaBands.map((band) => {
              if (!fasciaOn[band.id] || !singleAvgs) return null;
              const price = singleAvgs[band.id];
              if (price == null || !Number.isFinite(price)) return null;
              const fromX = hourToX(band.start, chartW, pad);
              const toX = hourToX(band.end, chartW, pad);
              const width = Math.max(toX - fromX, 0);
              const yTop = priceToY(price, scale, pad, innerH);
              const height = plotBottom - yTop;
              if (width <= 0 || height <= 0) return null;
              const color = FASCIA_COLOR[band.id];
              const labelY = yTop - 6 < pad.t + 10 ? yTop + 14 : yTop - 5;
              return (
                <g key={`fascia-${band.id}-${band.start}`} pointerEvents="none">
                  <rect
                    x={fromX}
                    y={yTop}
                    width={width}
                    height={height}
                    fill={color}
                    fillOpacity="0.28"
                    stroke={color}
                    strokeWidth="2"
                    shapeRendering="crispEdges"
                  />
                  <text
                    x={(fromX + toX) / 2}
                    y={labelY}
                    textAnchor="middle"
                    fill={color}
                    fontSize={11}
                    fontFamily={font}
                    fontWeight="700"
                  >
                    {band.id}
                  </text>
                </g>
              );
            })
          : null}

        {hourly && showF23 && singleAvgs?.F23 != null
          ? f23Bands.map((band) => {
              const price = singleAvgs.F23;
              if (price == null) return null;
              const fromX = hourToX(band.start, chartW, pad);
              const toX = hourToX(band.end, chartW, pad);
              const width = Math.max(toX - fromX, 0);
              const yTop = priceToY(price, scale, pad, innerH);
              const height = plotBottom - yTop;
              if (width <= 0 || height <= 0) return null;
              const color = FASCIA_LEGEND_COLOR.F23;
              const labelY = yTop - 6 < pad.t + 10 ? yTop + 14 : yTop - 5;
              return (
                <g key={`f23-${band.start}`} pointerEvents="none">
                  <rect
                    x={fromX}
                    y={yTop}
                    width={width}
                    height={height}
                    fill={color}
                    fillOpacity={layers.f2 || layers.f3 ? 0.16 : 0.28}
                    stroke={color}
                    strokeWidth="2"
                    shapeRendering="crispEdges"
                  />
                  <text
                    x={(fromX + toX) / 2}
                    y={labelY}
                    textAnchor="middle"
                    fill={color}
                    fontSize={11}
                    fontFamily={font}
                    fontWeight="700"
                  >
                    F23
                  </text>
                </g>
              );
            })
          : null}

        {hourly && showMono && monoY != null ? (
          <g pointerEvents="none">
            <rect
              x={monoFromX}
              y={monoY}
              width={monoToX - monoFromX}
              height={plotBottom - monoY}
              fill={FASCIA_LEGEND_COLOR.Fmonoraria}
              fillOpacity={showAnyFascia || showF23 ? 0.1 : 0.28}
            />
            <line
              x1={monoFromX}
              x2={monoToX}
              y1={monoY}
              y2={monoY}
              stroke={FASCIA_LEGEND_COLOR.Fmonoraria}
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <text
              x={monoFromX + 6}
              y={monoY - 6 < pad.t + 10 ? monoY + 14 : monoY - 5}
              fill={FASCIA_LEGEND_COLOR.Fmonoraria}
              fontSize={11}
              fontFamily={font}
              fontWeight="700"
            >
              Fmono
            </text>
          </g>
        ) : null}

        {area ? (
          <path d={area} fill={BANANA} opacity="0.16" />
        ) : null}

        {fasciaPaths.map((item) =>
          item.d ? (
            <path
              key={item.curve.id}
              d={item.d}
              fill="none"
              stroke={item.curve.color}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={item.curve.dash}
            />
          ) : null,
        )}

        {showLine ? (
          <path
            d={line}
            fill="none"
            stroke={BANANA}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
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
            {picked.dots.map((dot, index) => (
              <circle
                key={`${dot.color}-${index}`}
                cx={picked.x}
                cy={dot.y}
                r="5"
                fill={dot.color}
                stroke="#111111"
                strokeWidth="2"
              />
            ))}
          </g>
        ) : null}
      </svg>

      {picked ? (
        <button
          type="button"
          className="absolute top-2.5 right-2.5 z-10 flex items-start gap-2 rounded-md border border-white/15 bg-black/80 px-2.5 py-1.5 text-left text-white shadow-sm"
          aria-label={`Chiudi lettura del ${picked.label}`}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => setPickedIndex(null)}
        >
          <span>
            <span className="block text-xs font-semibold tabular-nums sm:text-sm">
              {picked.label}
            </span>
            {picked.rows.map((row) => (
              <span
                key={row.label}
                className="block text-[11px] tabular-nums"
                style={{ color: row.color }}
              >
                {row.label} {row.value}
              </span>
            ))}
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
  region,
  onRegionChange,
  tariff,
}: {
  points: LookbackDayPoint[];
  hourly: ZoneHourlyPayload[];
  region: ItalianRegion;
  onRegionChange: (value: string) => void;
  tariff: TariffPlanId;
}) {
  const [rangeId, setRangeId] = useState<LookbackRangeId>(DEFAULT_LOOKBACK_RANGE);
  const [layers, setLayers] = useState<ChartLayers>(() =>
    layersForTariff(tariff),
  );
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
  const fasciaAvgs = useMemo(
    () => fasciaAveragesFromDays(windowHourly),
    [windowHourly],
  );
  const visibleIds = visibleFasciaIds(layers);
  const fasciaMarks = cheapPeakForTariff(tariff, fasciaAvgs, visibleIds);
  const caption = formatLookbackCaptionFromDates(windowDates);
  const latestRank = latestDayWindowRankFromPoints(windowPoints);
  const latestCopy = latestRank
    ? formatLatestDayRank(latestRank, romeToday())
    : null;

  useEffect(() => {
    setLayers(layersForTariff(tariff));
  }, [tariff]);

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
        storico. Accendi le fasce per vedere come F1, F2, F3 e F23 si sono
        mosse nel tempo.
      </p>

      <RegionZoneBar region={region} onRegionChange={onRegionChange}>
        <div
          role="tablist"
          aria-label="Periodo del grafico"
          className="flex min-w-0 flex-1 gap-1 overflow-x-auto pb-1"
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
      </RegionZoneBar>

      <div className="mt-3">
        <ChartLayerToggles layers={layers} onChange={setLayers} />
        <div className="overflow-hidden rounded-lg border border-neutral-800 bg-[#111111]">
          <LookbackChart
            key={rangeId}
            windowPoints={windowPoints}
            windowHourly={windowHourly}
            rangeId={rangeId}
            layers={layers}
          />
        </div>
      </div>

      <div className="mt-5" aria-label="Minimo, medio, massimo e medie di fascia del periodo">
        {visibleIds.length > 0 ? (
          <div className="mb-4 grid grid-cols-3 gap-2 sm:grid-cols-5">
            {FASCIA_STATS.filter((stat) => visibleIds.includes(stat.id)).map(
              (stat) => {
                const color = FASCIA_LEGEND_COLOR[stat.id];
                return (
                  <div key={stat.id}>
                    <p
                      className="flex items-center gap-1.5 text-[11px] font-medium tracking-wide uppercase"
                      style={{ color }}
                    >
                      <FasciaSwatch id={stat.id} />
                      {stat.id === fasciaMarks.cheap ? (
                        <span aria-hidden>🍌 </span>
                      ) : stat.id === fasciaMarks.peak ? (
                        <span aria-hidden>🐵 </span>
                      ) : null}
                      {stat.label}
                    </p>
                    <p
                      className="text-xl font-semibold tabular-nums tracking-tight"
                      style={{ color }}
                    >
                      {formatFasciaValue(fasciaAvgs[stat.id])}
                    </p>
                  </div>
                );
              },
            )}
          </div>
        ) : null}
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
          {visibleIds.length > 0 ? " · medie di fascia nel periodo" : ""}
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
