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
import { formatShare } from "@/lib/generation/format";
import { MIX_RENEWABLE_IDS, MIX_SOURCE_META } from "@/lib/generation/sources";
import {
  MIX_SOURCE_IDS,
  type MixDayPoint,
  type MixSourceId,
} from "@/lib/generation/types";

const MONTHS = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"] as const;
const FAST_MS = 100;
const SLOW_MS = 320;
const RACE_DAYS = 365;
/** 23 keeps the spring-forward day; a partial today (fewer hours) stays out. */
const CLOSED_HOURS = 23;
const W = 400;
const ROW_H = 24;
const LABEL_W = 96;
const VALUE_W = 46;
const PAD_T = 2;
const BAR_H = 12;
const H = PAD_T * 2 + MIX_SOURCE_IDS.length * ROW_H;
const BAR_X = LABEL_W;
const BAR_MAX = W - LABEL_W - VALUE_W;
const BAR_Y = (ROW_H - BAR_H) / 2;
const FONT = "var(--font-geist-sans), system-ui, sans-serif";
const AREA_W = 400;
const AREA_H = 46;
const AREA_RX = 5;
const LINE_W = 400;
const LINE_H = 210;
const LINE_PAD_L = 0;
const LINE_PAD_R = 0;
const LINE_PAD_T = 14;
const LINE_PAD_B = 22;
const LINE_PLOT_W = LINE_W - LINE_PAD_L - LINE_PAD_R;
const LINE_PLOT_H = LINE_H - LINE_PAD_T - LINE_PAD_B;
const RENEWABLE_COLOR = "#22C55E";
const FOSSIL_COLOR = "#EF4444";
const LIMIT_LINE = "#F5F5F5";
const MIX_VIEWS = [
  { id: "bars", label: "Barre" },
  { id: "lines", label: "Linee" },
] as const;
type MixView = (typeof MIX_VIEWS)[number]["id"];
const ICON_BUTTON_CLASS =
  "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-neutral-100 text-neutral-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-neutral-900 disabled:cursor-not-allowed disabled:opacity-40";
const SPEED_IDLE_CLASS =
  "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-neutral-800 text-neutral-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-neutral-300 disabled:cursor-not-allowed disabled:opacity-40";

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

type ShareMap = Record<MixSourceId, number>;

type MixShareFrame = {
  date: string;
  shares: ShareMap;
  renewable: number;
};

function formatRaceDate(ymd: string) {
  const [year, month, day] = ymd.split("-");
  return `${Number(day)} ${MONTHS[Number(month) - 1] ?? month} ${year}`;
}

function sharesForDay(day: MixDayPoint): ShareMap {
  const shares = {} as ShareMap;
  for (const id of MIX_SOURCE_IDS) {
    const mwh = day.mwh[id] ?? 0;
    shares[id] = mwh > 0 ? mwh / day.totalMwh : 0;
  }
  return shares;
}

/** Renewable sources stay the existing list; the complement is non-renewable, so the two shares sum to 100%. */
function renewableShare(shares: ShareMap) {
  let sum = 0;
  for (const id of MIX_RENEWABLE_IDS) sum += shares[id] ?? 0;
  return Math.min(1, Math.max(0, sum));
}

export function buildMixShareFrames(days: MixDayPoint[]): MixShareFrame[] {
  return days
    .filter((day) => day.hourCount >= CLOSED_HOURS && day.totalMwh > 0)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-RACE_DAYS)
    .map((day) => {
      const shares = sharesForDay(day);
      return { date: day.date, shares, renewable: renewableShare(shares) };
    });
}

function sampleFrame(frames: MixShareFrame[], time: number) {
  const count = frames.length;
  const wrapped = ((time % count) + count) % count;
  const index = Math.min(count - 1, Math.floor(wrapped));
  const next = Math.min(count - 1, index + 1);
  const blend = index >= count - 1 ? 0 : wrapped - index;
  const eased = blend * blend * (3 - 2 * blend);
  const from = frames[index];
  const to = frames[next];
  const shares = {} as ShareMap;
  for (const id of MIX_SOURCE_IDS) {
    shares[id] = from.shares[id] + (to.shares[id] - from.shares[id]) * eased;
  }
  return {
    shares,
    index,
    date: eased < 0.5 ? from.date : to.date,
    ratio: count <= 1 ? 1 : (index + eased) / (count - 1),
  };
}

/** Coal and oil are too dark to read on the chart background. */
function lineColor(id: MixSourceId) {
  if (id === "coal") return "#A1A1AA";
  if (id === "oil") return "#D4D4D8";
  return MIX_SOURCE_META[id].color;
}

function lineX(index: number, count: number) {
  if (count <= 1) return 0;
  return (index / (count - 1)) * LINE_PLOT_W;
}

function lineY(share: number) {
  const clamped = Math.min(1, Math.max(0, share));
  return LINE_PAD_T + LINE_PLOT_H * (1 - clamped);
}

function buildSourceLinePaths(frames: MixShareFrame[]) {
  const n = frames.length;
  const order = [...MIX_SOURCE_IDS].sort((a, b) => {
    let sumA = 0;
    let sumB = 0;
    for (const frame of frames) {
      sumA += frame.shares[a];
      sumB += frame.shares[b];
    }
    return sumA - sumB;
  });
  return order.map((id) => {
    if (n === 0) return { id, d: "" };
    let d = `M${lineX(0, n).toFixed(2)} ${lineY(frames[0].shares[id]).toFixed(2)}`;
    for (let i = 1; i < n; i++) {
      d += ` L${lineX(i, n).toFixed(2)} ${lineY(frames[i].shares[id]).toFixed(2)}`;
    }
    return { id, d };
  });
}

function buildMonthTicks(frames: MixShareFrame[]) {
  const ticks: { x: number; label: string; anchor: "start" | "middle" | "end" }[] = [];
  let lastMonth = "";
  const n = frames.length;
  for (let i = 0; i < n; i++) {
    const month = frames[i].date.slice(5, 7);
    if (month === lastMonth) continue;
    lastMonth = month;
    const x = LINE_PAD_L + lineX(i, n);
    const prev = ticks[ticks.length - 1];
    if (prev && x - prev.x < 28) continue;
    ticks.push({
      x,
      label: MONTHS[Number(month) - 1] ?? month,
      anchor: "middle",
    });
  }
  if (ticks.length > 0) {
    if (ticks[0].x < LINE_PAD_L + 14) ticks[0] = { ...ticks[0], anchor: "start" };
    const last = ticks[ticks.length - 1];
    if (last.x > LINE_W - LINE_PAD_R - 16) {
      ticks[ticks.length - 1] = { ...last, anchor: "end" };
    }
  }
  return ticks;
}

function buildRenewableBand(renewables: number[]) {
  const n = renewables.length;
  const yAt = (share: number) => (AREA_H * (1 - Math.min(1, Math.max(0, share)))).toFixed(2);
  if (n === 0) return { green: "", boundary: "" };
  if (n === 1) {
    const y = yAt(renewables[0]);
    return {
      green: `M0 ${y} H${AREA_W} V${AREA_H} H0 Z`,
      boundary: `M0 ${y} H${AREA_W}`,
    };
  }
  let boundary = `M0 ${yAt(renewables[0])}`;
  for (let i = 1; i < n; i++) {
    const x = ((i / (n - 1)) * AREA_W).toFixed(2);
    boundary += ` L${x} ${yAt(renewables[i])}`;
  }
  return {
    green: `${boundary} L${AREA_W} ${AREA_H} L0 ${AREA_H} Z`,
    boundary,
  };
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

function MixShareRaceInner({ days }: { days: MixDayPoint[] }) {
  const frames = useMemo(() => buildMixShareFrames(days), [days]);
  const band = useMemo(
    () => buildRenewableBand(frames.map((frame) => frame.renewable)),
    [frames],
  );
  const linePaths = useMemo(() => buildSourceLinePaths(frames), [frames]);
  const monthTicks = useMemo(() => buildMonthTicks(frames), [frames]);
  const clipRaw = useId().replace(/:/g, "");
  const clipId = `mix-band-${clipRaw}`;
  const lineClipId = `mix-lines-${clipRaw}`;
  const reduced = useSyncExternalStore(
    subscribeReducedMotion,
    reducedMotionSnapshot,
    () => false,
  );
  const tabVisible = useSyncExternalStore(
    subscribeTabVisible,
    tabVisibleSnapshot,
    () => true,
  );
  const rootRef = useRef<HTMLElement>(null);
  const progressRef = useRef(0);
  const framesRef = useRef(frames);
  const wasReducedRef = useRef(false);
  const userPausedRef = useRef(false);
  const speedRef = useRef(FAST_MS);
  const [inView, setInView] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  const [speed, setSpeed] = useState<"fast" | "slow">("fast");
  const [view, setView] = useState<MixView>("bars");

  const playing =
    frames.length > 1 && inView && tabVisible && !reduced && !userPaused;

  const paintRef = useRef<(time: number) => void>(() => {});

  const paint = (time: number) => {
    const root = rootRef.current;
    const current = framesRef.current;
    if (!root || current.length === 0) return;
    const frame = sampleFrame(current, time);
    const dateEl = root.querySelector<HTMLElement>("[data-race-date]");
    if (dateEl) dateEl.textContent = formatRaceDate(frame.date);
    const renewableEl = root.querySelector<HTMLElement>("[data-race-renewable]");
    if (renewableEl) {
      renewableEl.textContent = formatShare(current[frame.index]?.renewable ?? 0);
    }
    const area = root.querySelector<SVGSVGElement>("[data-race-area]");
    if (area) {
      area.setAttribute("aria-valuenow", String(frame.index));
      area.setAttribute("aria-valuetext", formatRaceDate(frame.date));
    }
    const bars = root.querySelector<SVGSVGElement>("[data-race-bars]");
    if (bars) {
      for (const id of MIX_SOURCE_IDS) {
        const group = bars.querySelector<SVGGElement>(`[data-source="${id}"]`);
        if (!group) continue;
        const bar = group.querySelector<SVGRectElement>("[data-bar]");
        bar?.setAttribute("width", (Math.max(0, frame.shares[id]) * BAR_MAX).toFixed(2));
        const pct = group.querySelector<SVGTextElement>("[data-pct]");
        if (pct) pct.textContent = formatShare(frame.shares[id]);
      }
    }
    const fill = root.querySelector<SVGGElement>("[data-race-fill]");
    if (fill) {
      const count = current.length;
      const ratio = count <= 1 ? 1 : frame.index / (count - 1);
      fill.style.clipPath = `inset(0 ${((1 - ratio) * 100).toFixed(3)}% 0 0)`;
    }
    const lines = root.querySelector<SVGSVGElement>("[data-race-lines]");
    if (lines) {
      const plot = lines.querySelector<SVGRectElement>("[data-race-plot]");
      if (plot) plot.setAttribute("width", (frame.ratio * LINE_PLOT_W).toFixed(2));
      const cursor = lines.querySelector<SVGLineElement>("[data-race-cursor]");
      if (cursor) {
        const x = (LINE_PAD_L + frame.ratio * LINE_PLOT_W).toFixed(2);
        cursor.setAttribute("x1", x);
        cursor.setAttribute("x2", x);
      }
      for (const id of MIX_SOURCE_IDS) {
        const dot = lines.querySelector<SVGCircleElement>(`[data-dot="${id}"]`);
        if (!dot) continue;
        dot.setAttribute("cx", (LINE_PAD_L + frame.ratio * LINE_PLOT_W).toFixed(2));
        dot.setAttribute("cy", lineY(frame.shares[id]).toFixed(2));
      }
    }
    const legend = root.querySelector<HTMLElement>("[data-race-legend]");
    if (legend) {
      for (const id of MIX_SOURCE_IDS) {
        const pct = legend.querySelector<HTMLElement>(`[data-line-pct="${id}"]`);
        if (pct) pct.textContent = formatShare(frame.shares[id]);
      }
    }
  };

  const chooseSpeed = (next: "fast" | "slow") => {
    speedRef.current = next === "fast" ? FAST_MS : SLOW_MS;
    setSpeed(next);
  };

  const pause = () => {
    userPausedRef.current = true;
    setUserPaused(true);
  };

  const seekFromPointer = (event: PointerEvent<SVGSVGElement>) => {
    const count = framesRef.current.length;
    if (count < 2) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return;
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    const index = Math.round(ratio * (count - 1));
    progressRef.current = index;
    paintRef.current(index);
  };

  useLayoutEffect(() => {
    framesRef.current = frames;
    paintRef.current = paint;
    if (reduced && !wasReducedRef.current && frames.length > 0) {
      progressRef.current = frames.length - 1;
    }
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
  }, [frames.length]);

  useEffect(() => {
    if (!playing) return;
    let frameId = 0;
    let last = performance.now();
    const tick = (now: number) => {
      if (userPausedRef.current) return;
      const dt = Math.min(100, now - last);
      last = now;
      const count = framesRef.current.length;
      progressRef.current += dt / speedRef.current;
      if (count > 0 && progressRef.current >= count) progressRef.current = 0;
      paintRef.current(progressRef.current);
      frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [playing]);

  if (frames.length === 0) return null;

  const poster = sampleFrame(frames, 0);
  const firstLabel = formatRaceDate(frames[0].date);
  const lastLabel = formatRaceDate(frames[frames.length - 1].date);
  const controlsDisabled = reduced || frames.length < 2;

  return (
    <section
      ref={rootRef}
      id="corsa-fonti"
      aria-labelledby="corsa-fonti-heading"
      className="mt-6"
    >
      <h2
        id="corsa-fonti-heading"
        className="text-lg font-medium tracking-tight text-foreground"
      >
        Mix energetico Italia 12 mesi
      </h2>
      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
        Mix energetico fonti sulla produzione italiana negli ultimi 12 mesi
      </p>
      <div
        role="tablist"
        aria-label="Vista del mix energetico"
        className="mt-3 flex gap-1"
      >
        {MIX_VIEWS.map((item) => {
          const active = view === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              id={`mix-view-${item.id}`}
              aria-selected={active}
              aria-controls="mix-view-panel"
              onClick={() => setView(item.id)}
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
      <div
        id="mix-view-panel"
        role="tabpanel"
        aria-labelledby={`mix-view-${view}`}
        className="mt-3 overflow-hidden rounded-lg border border-neutral-800 bg-[#111111]"
      >
        <div className="flex items-baseline justify-between gap-3 px-3 pt-3">
          <p data-race-date className="text-sm font-medium tabular-nums text-neutral-100">
            {formatRaceDate(poster.date)}
          </p>
          <p className="text-[11px] text-neutral-500">
            {firstLabel} – {lastLabel}
          </p>
        </div>
        {view === "lines" ? (
          <>
            <div className="px-3">
            <svg
              data-race-lines=""
              viewBox={`0 0 ${LINE_W} ${LINE_H}`}
              className="block h-auto w-full"
              role="img"
              aria-label={`Quota di ogni fonte dal ${firstLabel} al ${lastLabel}. Le linee piene seguono il giorno in corso, quelle tenui mostrano i dodici mesi.`}
            >
              {([0, 0.25, 0.5, 0.75, 1] as const).map((share) => {
                const y = lineY(share);
                const labeled = share === 0 || share === 0.5 || share === 1;
                return (
                  <g key={share}>
                    <line
                      x1={0}
                      x2={LINE_W}
                      y1={y}
                      y2={y}
                      stroke={labeled ? "#333333" : "#222222"}
                      strokeWidth={1}
                      vectorEffect="non-scaling-stroke"
                    />
                  </g>
                );
              })}
              {monthTicks.map((tick) => (
                <text
                  key={`${tick.label}-${tick.x.toFixed(1)}`}
                  x={tick.x}
                  y={LINE_H - 6}
                  fill="#737373"
                  fontSize={10}
                  fontFamily={FONT}
                  textAnchor={tick.anchor}
                >
                  {tick.label}
                </text>
              ))}
              <defs>
                <clipPath id={lineClipId}>
                  <rect data-race-plot="" x={0} y={0} width={0} height={LINE_H} />
                </clipPath>
              </defs>
              <g opacity="0.28">
                  {linePaths.map((path) => (
                    <path
                      key={`ghost-${path.id}`}
                      d={path.d}
                      fill="none"
                      stroke={lineColor(path.id)}
                      strokeWidth={1.5}
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      vectorEffect="non-scaling-stroke"
                    />
                  ))}
                </g>
                <g clipPath={`url(#${lineClipId})`}>
                  {linePaths.map((path) => (
                    <path
                      key={path.id}
                      d={path.d}
                      fill="none"
                      stroke={lineColor(path.id)}
                      strokeWidth={1.75}
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      vectorEffect="non-scaling-stroke"
                    />
                  ))}
                </g>
              <line
                data-race-cursor=""
                x1={LINE_PAD_L}
                x2={LINE_PAD_L}
                y1={LINE_PAD_T}
                y2={LINE_PAD_T + LINE_PLOT_H}
                stroke="#A3A3A3"
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
              {linePaths.map((path) => (
                <circle
                  key={`dot-${path.id}`}
                  data-dot={path.id}
                  cx={LINE_PAD_L}
                  cy={lineY(poster.shares[path.id])}
                  r={2.4}
                  fill={lineColor(path.id)}
                  stroke="#111111"
                  strokeWidth={1}
                />
              ))}
              {([0, 0.5, 1] as const).map((share) => (
                <text
                  key={`y-${share}`}
                  x={4}
                  y={lineY(share)}
                  fill="#A3A3A3"
                  fontSize={10}
                  fontFamily={FONT}
                  textAnchor="start"
                  dominantBaseline="middle"
                  stroke="#111111"
                  strokeWidth={3}
                  paintOrder="stroke"
                >
                  {`${Math.round(share * 100)}%`}
                </text>
              ))}
            </svg>
            </div>
            <div
              data-race-legend=""
              className="grid grid-cols-2 gap-x-3 gap-y-1 px-3 pb-1 sm:grid-cols-5"
            >
              {MIX_SOURCE_IDS.map((id) => (
                <span
                  key={id}
                  className="flex min-w-0 items-center gap-1.5 text-[11px] text-neutral-400"
                >
                  <span
                    className="h-1.5 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: lineColor(id) }}
                    aria-hidden
                  />
                  <span className="truncate">{MIX_SOURCE_META[id].label}</span>
                  <span
                    data-line-pct={id}
                    className="ml-auto shrink-0 tabular-nums text-neutral-200"
                  >
                    {formatShare(poster.shares[id])}
                  </span>
                </span>
              ))}
            </div>
          </>
        ) : (
        <svg
          data-race-bars=""
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full"
          role="img"
          aria-label={`Corsa delle fonti dal ${firstLabel} al ${lastLabel}`}
        >
          {MIX_SOURCE_IDS.map((id, index) => (
            <g
              key={id}
              data-source={id}
              transform={`translate(0 ${PAD_T + index * ROW_H})`}
            >
              <text
                x={0}
                y={ROW_H / 2}
                fill="#E5E5E5"
                fontSize={12}
                fontFamily={FONT}
                dominantBaseline="middle"
              >
                {MIX_SOURCE_META[id].label}
              </text>
              <rect
                data-track=""
                x={BAR_X}
                y={BAR_Y}
                width={BAR_MAX}
                height={BAR_H}
                rx={2}
                fill="#262626"
              />
              <rect
                data-bar=""
                x={BAR_X}
                y={BAR_Y}
                width={poster.shares[id] * BAR_MAX}
                height={BAR_H}
                rx={2}
                fill={MIX_SOURCE_META[id].color}
              />
              <text
                data-pct=""
                x={W - 4}
                y={ROW_H / 2}
                fill="#A3A3A3"
                fontSize={11}
                fontFamily={FONT}
                textAnchor="end"
                dominantBaseline="middle"
              >
                {formatShare(poster.shares[id])}
              </text>
            </g>
          ))}
        </svg>
        )}
        <div className="px-3 pb-1">
          <div className="mt-1 flex items-center gap-3 text-[11px] text-neutral-500">
            <span className="inline-flex items-center gap-1.5">
              <span
                className="h-2 w-2 rounded-[2px]"
                style={{ backgroundColor: RENEWABLE_COLOR }}
                aria-hidden
              />
              Rinnovabili
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span
                className="h-2 w-2 rounded-[2px]"
                style={{ backgroundColor: FOSSIL_COLOR }}
                aria-hidden
              />
              Fossili
            </span>
            <span className="ml-auto tabular-nums text-neutral-300">
              <span data-race-renewable>{formatShare(frames[0].renewable)}</span>
              {" "}rinnovabili
            </span>
          </div>
          <svg
            data-race-area=""
            viewBox={`0 0 ${AREA_W} ${AREA_H}`}
            className="mt-1.5 block h-auto w-full cursor-ew-resize touch-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-400"
            role="slider"
            tabIndex={0}
            aria-label={`Quota rinnovabile e fossile dal ${firstLabel} al ${lastLabel}. La linea segna il limite delle rinnovabili; verde e rosso riempiono il rettangolo fino al giorno corrente.`}
            aria-valuemin={0}
            aria-valuemax={frames.length - 1}
            aria-valuenow={0}
            aria-valuetext={formatRaceDate(poster.date)}
            onKeyDown={(event) => {
              const key = event.key;
              if (key !== "ArrowLeft" && key !== "ArrowRight" && key !== "Home" && key !== "End") return;
              event.preventDefault();
              const count = framesRef.current.length;
              if (count < 2) return;
              pause();
              const current = Math.round(progressRef.current);
              const next =
                key === "Home"
                  ? 0
                  : key === "End"
                    ? count - 1
                    : key === "ArrowRight"
                      ? Math.min(count - 1, current + 1)
                      : Math.max(0, current - 1);
              progressRef.current = next;
              paint(next);
            }}
            onPointerDown={(event) => {
              event.preventDefault();
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
              <clipPath id={clipId}>
                <rect width={AREA_W} height={AREA_H} rx={AREA_RX} ry={AREA_RX} />
              </clipPath>
            </defs>
            <g clipPath={`url(#${clipId})`}>
              <g data-race-fill="" style={{ clipPath: "inset(0 100% 0 0)" }}>
                <rect width={AREA_W} height={AREA_H} fill={FOSSIL_COLOR} />
                <path d={band.green} fill={RENEWABLE_COLOR} />
              </g>
              <path
                d={band.boundary}
                fill="none"
                stroke={LIMIT_LINE}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            </g>
          </svg>
        </div>
        <div className="flex items-center gap-3 px-3 pb-3 pt-2">
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              disabled={controlsDisabled || playing}
              aria-label="Avvia la corsa delle fonti"
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
              aria-label="Metti in pausa la corsa delle fonti"
              onClick={pause}
              className={ICON_BUTTON_CLASS}
            >
              <PauseIcon />
            </button>
          </div>
          <div className="flex shrink-0 items-center gap-1.5" role="group" aria-label="Velocità della corsa">
            <button
              type="button"
              disabled={controlsDisabled}
              aria-pressed={speed === "slow"}
              aria-label="Velocità lenta"
              onClick={() => chooseSpeed("slow")}
              className={speed === "slow" ? ICON_BUTTON_CLASS : SPEED_IDLE_CLASS}
            >
              <SlowIcon />
            </button>
            <button
              type="button"
              disabled={controlsDisabled}
              aria-pressed={speed === "fast"}
              aria-label="Velocità veloce"
              onClick={() => chooseSpeed("fast")}
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

export const MixShareRace = memo(MixShareRaceInner);
