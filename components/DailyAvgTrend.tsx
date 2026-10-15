"use client";

import {
  memo,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type PointerEvent,
} from "react";
import { addCalendarDays } from "@/lib/entsoe";
import { formatEurocent, yScale } from "@/lib/insights";
import {
  YEAR_LOOKBACK_DAYS,
  formatLookbackDate,
  nullableValuesToPoints,
  toBrokenLinearPath,
} from "@/lib/lookback";
import { MARKET_ZONES, type MarketZoneId } from "@/lib/market-zones";
import type { ZoneAvgSeries } from "@/lib/zone-home-types";

const MONTHS = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"] as const;
const FAST_MS = 100;
const SLOW_MS = 320;
const CHART_W = 400;
const CHART_H = 210;
const PAD = { t: 14, r: 0, b: 22, l: 0 };
const FONT = "var(--font-geist-sans), system-ui, sans-serif";
const GRID_LABELED = "#333333";
const GRID_FAINT = "#222222";
const ZONE_COLOR: Record<MarketZoneId, string> = {
  "IT-North": "#F5D547",
  "IT-Centre-North": "#60A5FA",
  "IT-Centre-South": "#2DD4BF",
  "IT-South": "#FB923C",
  "IT-Calabria": "#C084FC",
  "IT-Sicily": "#FB7185",
  "IT-Sardinia": "#38BDF8",
};
const ICON_BUTTON_CLASS =
  "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-neutral-100 text-neutral-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-neutral-900 disabled:cursor-not-allowed disabled:opacity-40";
const SPEED_IDLE_CLASS =
  "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-neutral-800 text-neutral-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-neutral-300 disabled:cursor-not-allowed disabled:opacity-40";

type Plotted = { x: number; y: number; avg: number } | null;

type ZoneGeom = {
  zone: MarketZoneId;
  name: string;
  color: string;
  line: string;
  points: Plotted[];
};

function subscribeReducedMotion(onChange: () => void) {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function reducedMotionSnapshot() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function subscribeTabVisible(onChange: () => void) {
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
}

function tabVisibleSnapshot() {
  return document.visibilityState === "visible";
}

function monthTicks(dates: string[], xs: number[]) {
  const ticks: { x: number; label: string; anchor: "start" | "middle" | "end" }[] = [];
  let lastMonth = "";
  for (let i = 0; i < dates.length; i++) {
    const month = dates[i].slice(5, 7);
    if (month === lastMonth) continue;
    lastMonth = month;
    const x = xs[i];
    if (x == null) continue;
    const prev = ticks[ticks.length - 1];
    if (prev && x - prev.x < 28) continue;
    const label = MONTHS[Number(month) - 1];
    if (!label) continue;
    ticks.push({ x, label, anchor: "middle" });
  }
  if (ticks.length > 0) {
    if (ticks[0].x < PAD.l + 14) ticks[0] = { ...ticks[0], anchor: "start" };
    const last = ticks[ticks.length - 1];
    if (last.x > CHART_W - PAD.r - 16) {
      ticks[ticks.length - 1] = { ...last, anchor: "end" };
    }
  }
  return ticks;
}

function formatLegendPrice(value: number) {
  return value.toLocaleString("it-IT", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

function alignSeries(series: ZoneAvgSeries[]) {
  let end = "";
  for (const row of series) {
    for (const point of row.points) {
      if (point.date > end) end = point.date;
    }
  }
  if (!end) return { dates: [] as string[], byZone: new Map<MarketZoneId, Map<string, number>>() };
  const start = addCalendarDays(end, -(YEAR_LOOKBACK_DAYS - 1));
  const dates = new Set<string>();
  const byZone = new Map<MarketZoneId, Map<string, number>>();
  for (const row of series) {
    const map = new Map<string, number>();
    for (const point of row.points) {
      if (point.date < start || point.date > end || !Number.isFinite(point.avg)) continue;
      map.set(point.date, point.avg);
      dates.add(point.date);
    }
    byZone.set(row.zone, map);
  }
  return { dates: [...dates].sort((a, b) => a.localeCompare(b)), byZone };
}

function PlayIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d="M5 3.2v9.6l8-4.8-8-4.8z" fill="currentColor" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <rect x="3.25" y="3" width="3.1" height="10" rx="0.7" fill="currentColor" />
      <rect x="9.65" y="3" width="3.1" height="10" rx="0.7" fill="currentColor" />
    </svg>
  );
}

function SlowIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path
        d="M6.2 3.4 10.6 8 6.2 12.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FastIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path
        d="M2.6 3.4 7 8 2.6 12.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8.2 3.4 12.6 8 8.2 12.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DailyAvgTrendInner({
  series,
  activeZone,
}: {
  series: ZoneAvgSeries[];
  activeZone: MarketZoneId;
}) {
  const labelId = useId();
  const clipId = `price-clip-${useId().replace(/:/g, "")}`;
  const aligned = useMemo(() => alignSeries(series), [series]);
  const chart = useMemo(() => {
    const { dates, byZone } = aligned;
    if (dates.length < 2) return null;
    const values: number[] = [];
    for (const map of byZone.values()) values.push(...map.values());
    if (values.length < 2) return null;
    const scale = yScale(values, { allowNegative: Math.min(...values) < 0 });
    const range = scale.max - scale.min || 1;
    const innerH = CHART_H - PAD.t - PAD.b;
    const zones: ZoneGeom[] = [];
    let xs: number[] = [];
    for (const zone of Object.keys(ZONE_COLOR) as MarketZoneId[]) {
      const map = byZone.get(zone);
      if (!map) continue;
      const seriesValues = dates.map((date) => map.get(date) ?? null);
      const plotted = nullableValuesToPoints(seriesValues, scale.min, scale.max, CHART_H, CHART_W, PAD);
      const points: Plotted[] = plotted.map((point) =>
        point ? { x: point.x, y: point.y, avg: point.value } : null,
      );
      if (xs.length === 0) xs = points.map((point, index) => point?.x ?? xsAt(index, dates.length));
      zones.push({
        zone,
        name: MARKET_ZONES[zone].name,
        color: ZONE_COLOR[zone],
        line: toBrokenLinearPath(points),
        points,
      });
    }
    if (zones.length === 0) return null;
    const midTick = scale.ticks[Math.floor((scale.ticks.length - 1) / 2)];
    const labeledTicks = new Set<number>(
      scale.ticks.length <= 3 ? scale.ticks : [scale.ticks[0], midTick, scale.ticks[scale.ticks.length - 1]],
    );
    return {
      dates,
      xs,
      scale,
      zones,
      ticks: monthTicks(dates, xs),
      grid: scale.ticks.map((tick) => ({
        tick,
        y: PAD.t + (1 - (tick - scale.min) / range) * innerH,
        labeled: labeledTicks.has(tick),
      })),
    };
  }, [aligned]);

  const reduced = useSyncExternalStore(subscribeReducedMotion, reducedMotionSnapshot, () => false);
  const tabVisible = useSyncExternalStore(subscribeTabVisible, tabVisibleSnapshot, () => true);
  const rootRef = useRef<HTMLElement>(null);
  const progressRef = useRef(0);
  const chartRef = useRef(chart);
  const activeRef = useRef(activeZone);
  const seriesKeyRef = useRef("");
  const wasReducedRef = useRef(false);
  const userPausedRef = useRef(false);
  const speedRef = useRef(FAST_MS);
  const paintRef = useRef<(time: number) => void>(() => {});
  const [inView, setInView] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  const [speed, setSpeed] = useState<"fast" | "slow">("fast");

  const count = chart?.dates.length ?? 0;
  const seriesKey = `${chart?.dates[0] ?? ""}:${chart?.dates.at(-1) ?? ""}:${count}`;
  const playing = count > 1 && inView && tabVisible && !reduced && !userPaused;

  const paint = (time: number) => {
    const root = rootRef.current;
    const geometry = chartRef.current;
    if (!root || !geometry || geometry.dates.length < 2) return;
    const total = geometry.dates.length;
    const wrapped = ((time % total) + total) % total;
    const index = Math.min(total - 1, Math.floor(wrapped));
    const x = geometry.xs[index];
    const day = geometry.dates[index];
    const dateLabel = formatLookbackDate(day, true);
    const active = geometry.zones.find((zone) => zone.zone === activeRef.current) ?? geometry.zones[0];
    const activePoint = active?.points[index] ?? null;

    const dateEl = root.querySelector<HTMLElement>("[data-price-date]");
    if (dateEl) dateEl.textContent = dateLabel;

    const clip = root.querySelector<SVGRectElement>("[data-price-clip]");
    if (clip && x != null) clip.setAttribute("width", x.toFixed(2));
    const cursor = root.querySelector<SVGLineElement>("[data-price-cursor]");
    if (cursor && x != null) {
      cursor.setAttribute("x1", x.toFixed(2));
      cursor.setAttribute("x2", x.toFixed(2));
    }

    for (const zone of geometry.zones) {
      const point = zone.points[index];
      const valueEl = root.querySelector<HTMLElement>(`[data-zone-avg="${zone.zone}"]`);
      if (valueEl) valueEl.textContent = point ? formatLegendPrice(point.avg) : "—";
      const dot = root.querySelector<SVGCircleElement>(`[data-zone-dot="${zone.zone}"]`);
      if (!dot) continue;
      if (!point) {
        dot.setAttribute("visibility", "hidden");
        continue;
      }
      dot.setAttribute("visibility", "visible");
      dot.setAttribute("cx", point.x.toFixed(2));
      dot.setAttribute("cy", point.y.toFixed(2));
    }

    const slider = root.querySelector<SVGSVGElement>("[data-price-slider]");
    if (slider) {
      slider.setAttribute("aria-valuenow", String(index));
      const activeText = activePoint ? formatEurocent(activePoint.avg) : "non disponibile";
      slider.setAttribute(
        "aria-valuetext",
        `${dateLabel}, ${active?.name ?? "zona"} ${activeText} centesimi per kilowattora`,
      );
    }
  };

  const pause = () => {
    userPausedRef.current = true;
    setUserPaused(true);
  };

  const seekTo = (time: number) => {
    const total = chartRef.current?.dates.length ?? 0;
    if (total < 2) return;
    progressRef.current = Math.min(total - 1, Math.max(0, time));
    paintRef.current(progressRef.current);
  };

  const seekFromPointer = (event: PointerEvent<SVGSVGElement>) => {
    const total = chartRef.current?.dates.length ?? 0;
    if (total < 2) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return;
    const x = ((event.clientX - rect.left) / rect.width) * CHART_W;
    const innerW = CHART_W - PAD.l - PAD.r;
    seekTo(((x - PAD.l) / innerW) * (total - 1));
  };

  useLayoutEffect(() => {
    chartRef.current = chart;
    activeRef.current = activeZone;
    paintRef.current = paint;
    if (seriesKeyRef.current !== seriesKey) {
      seriesKeyRef.current = seriesKey;
      progressRef.current = reduced && count > 0 ? count - 1 : 0;
    }
    if (reduced && !wasReducedRef.current && count > 0) progressRef.current = count - 1;
    wasReducedRef.current = reduced;
    paint(progressRef.current);
  });

  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0.15 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [count]);

  useEffect(() => {
    if (!playing) return;
    let frameId = 0;
    let last = performance.now();
    const tick = (now: number) => {
      if (userPausedRef.current) return;
      const dt = Math.min(100, now - last);
      last = now;
      const total = chartRef.current?.dates.length ?? 0;
      progressRef.current += dt / speedRef.current;
      if (total > 0 && progressRef.current >= total) progressRef.current = 0;
      paintRef.current(progressRef.current);
      frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [playing]);

  if (!chart) return null;

  const firstLabel = formatLookbackDate(chart.dates[0], true);
  const lastLabel = formatLookbackDate(chart.dates[chart.dates.length - 1], true);
  const startX = chart.xs[0] ?? PAD.l;
  const plotBottom = CHART_H - PAD.b;
  const active = chart.zones.find((zone) => zone.zone === activeZone) ?? chart.zones[0];
  const drawn = [...chart.zones].sort((a, b) => Number(a.zone === activeZone) - Number(b.zone === activeZone));
  const controlsDisabled = reduced || chart.dates.length < 2;

  return (
    <section ref={rootRef} className="mt-6" aria-labelledby={labelId}>
      <h2 id={labelId} className="text-lg font-medium tracking-tight text-foreground">
        Prezzo medio giornaliero 12 mesi
      </h2>
      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
        Prezzo medio all&apos;ingrosso nelle zone italiane, giorno per giorno. La tua zona, {active.name}, è in evidenza.
      </p>
      <div className="mt-3 overflow-hidden rounded-lg border border-neutral-800 bg-[#111111]">
        <div className="flex items-baseline justify-between gap-3 px-3 pt-3">
          <p data-price-date className="text-sm font-medium tabular-nums text-neutral-100">
            {firstLabel}
          </p>
          <p className="text-[11px] text-neutral-500">
            {firstLabel} – {lastLabel}
          </p>
        </div>
        <div className="px-3">
        <svg
          data-price-slider=""
          viewBox={`0 0 ${CHART_W} ${CHART_H}`}
          className="block h-auto w-full cursor-ew-resize touch-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-neutral-400"
          role="slider"
          tabIndex={0}
          aria-label={`Prezzo medio giornaliero delle zone italiane dal ${firstLabel} al ${lastLabel}. ${active.name} è in evidenza. Le linee piene seguono il giorno in corso, quelle tenui i dodici mesi.`}
          aria-valuemin={0}
          aria-valuemax={chart.dates.length - 1}
          aria-valuenow={0}
          aria-valuetext={firstLabel}
          onKeyDown={(event) => {
            const key = event.key;
            if (key !== "ArrowLeft" && key !== "ArrowRight" && key !== "Home" && key !== "End") return;
            event.preventDefault();
            const total = chartRef.current?.dates.length ?? 0;
            if (total < 2) return;
            pause();
            const current = Math.round(progressRef.current);
            const next =
              key === "Home" ? 0 : key === "End" ? total - 1 : key === "ArrowRight" ? Math.min(total - 1, current + 1) : Math.max(0, current - 1);
            seekTo(next);
          }}
          onPointerDown={(event) => {
            if (event.pointerType === "mouse" && event.button !== 0) return;
            event.currentTarget.setPointerCapture(event.pointerId);
            pause();
            seekFromPointer(event);
          }}
          onPointerMove={(event) => {
            if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
            seekFromPointer(event);
          }}
        >
          <defs>
            <clipPath id={clipId} clipPathUnits="userSpaceOnUse">
              <rect data-price-clip="" x="0" y="0" width={startX} height={CHART_H} />
            </clipPath>
          </defs>
          {chart.grid.map((row) => (
            <line
              key={row.tick}
              x1={0}
              x2={CHART_W}
              y1={row.y}
              y2={row.y}
              stroke={row.labeled ? GRID_LABELED : GRID_FAINT}
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {chart.ticks.map((tick) => (
            <text
              key={`${tick.x}-${tick.label}`}
              x={tick.x}
              y={CHART_H - 6}
              textAnchor={tick.anchor}
              fill="#737373"
              fontSize={10}
              fontFamily={FONT}
            >
              {tick.label}
            </text>
          ))}
          <g opacity="0.28">
            {drawn.map((zone) =>
              zone.line ? (
                <path
                  key={`ghost-${zone.zone}`}
                  d={zone.line}
                  fill="none"
                  stroke={zone.color}
                  strokeWidth={1.5}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              ) : null,
            )}
          </g>
          <g clipPath={`url(#${clipId})`}>
            {drawn.map((zone) =>
              zone.line ? (
                <path
                  key={zone.zone}
                  d={zone.line}
                  fill="none"
                  stroke={zone.color}
                  strokeWidth={zone.zone === activeZone ? 2.25 : 1.75}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              ) : null,
            )}
          </g>
          <line
            data-price-cursor=""
            x1={startX}
            x2={startX}
            y1={PAD.t}
            y2={plotBottom}
            stroke="#A3A3A3"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
            pointerEvents="none"
          />
          {drawn.map((zone) => {
            const point = zone.points[0];
            const highlighted = zone.zone === activeZone;
            return (
              <circle
                key={zone.zone}
                data-zone-dot={zone.zone}
                cx={point?.x ?? startX}
                cy={point?.y ?? PAD.t}
                r={highlighted ? 3 : 2.4}
                fill={zone.color}
                stroke="#111111"
                strokeWidth={1}
                visibility={point ? "visible" : "hidden"}
                pointerEvents="none"
              />
            );
          })}
          {chart.grid.map((row) =>
            row.labeled ? (
              <text
                key={`y-${row.tick}`}
                x={4}
                y={row.y}
                fill="#A3A3A3"
                fontSize={10}
                fontFamily={FONT}
                textAnchor="start"
                dominantBaseline="middle"
                stroke="#111111"
                strokeWidth={3}
                paintOrder="stroke"
              >
                {formatEurocent(row.tick, chart.scale.tickDigits)}
                {row.tick === chart.scale.max ? " c€" : ""}
              </text>
            ) : null,
          )}
        </svg>
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 px-3 pb-1 sm:grid-cols-4">
          {chart.zones.map((zone) => (
            <span
              key={zone.zone}
              className={
                zone.zone === activeZone
                  ? "flex min-w-0 items-center gap-1.5 text-[11px] font-medium text-neutral-100"
                  : "flex min-w-0 items-center gap-1.5 text-[11px] text-neutral-400"
              }
            >
              <span
                className="h-1.5 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: zone.color }}
                aria-hidden
              />
              <span className="truncate">{zone.name}</span>
              <span data-zone-avg={zone.zone} className="ml-auto shrink-0 tabular-nums text-neutral-200">
                {zone.points[0] ? formatLegendPrice(zone.points[0].avg) : "—"}
              </span>
            </span>
          ))}
        </div>
        <div className="flex items-center gap-3 px-3 pb-3 pt-2">
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              disabled={controlsDisabled || playing}
              aria-label="Avvia l'andamento del prezzo"
              onClick={() => {
                userPausedRef.current = false;
                setUserPaused(false);
              }}
              className={ICON_BUTTON_CLASS}
            >
              <PlayIcon />
            </button>
            <button
              type="button"
              disabled={controlsDisabled || !playing}
              aria-label="Metti in pausa l'andamento del prezzo"
              onClick={pause}
              className={ICON_BUTTON_CLASS}
            >
              <PauseIcon />
            </button>
          </div>
          <div className="flex shrink-0 items-center gap-1.5" role="group" aria-label="Velocità dell'andamento">
            <button
              type="button"
              disabled={controlsDisabled}
              aria-pressed={speed === "slow"}
              aria-label="Velocità lenta"
              onClick={() => {
                speedRef.current = SLOW_MS;
                setSpeed("slow");
              }}
              className={speed === "slow" ? ICON_BUTTON_CLASS : SPEED_IDLE_CLASS}
            >
              <SlowIcon />
            </button>
            <button
              type="button"
              disabled={controlsDisabled}
              aria-pressed={speed === "fast"}
              aria-label="Velocità veloce"
              onClick={() => {
                speedRef.current = FAST_MS;
                setSpeed("fast");
              }}
              className={speed === "fast" ? ICON_BUTTON_CLASS : SPEED_IDLE_CLASS}
            >
              <FastIcon />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function xsAt(index: number, count: number) {
  const innerW = CHART_W - PAD.l - PAD.r;
  if (count <= 1) return PAD.l + innerW / 2;
  return PAD.l + (index / (count - 1)) * innerW;
}

export const DailyAvgTrend = memo(DailyAvgTrendInner);
