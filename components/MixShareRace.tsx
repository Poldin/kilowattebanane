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
const RENEWABLE_COLOR = "#22C55E";
const FOSSIL_COLOR = "#EF4444";
const LIMIT_LINE = "#F5F5F5";
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
  };
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
  const clipId = `mix-band-${useId().replace(/:/g, "")}`;
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
        Corsa delle fonti
      </h2>
      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
        Quota di ogni fonte sulla produzione italiana, un giorno alla volta,
        nell&apos;ultimo anno chiuso.
      </p>
      <div className="mt-3 overflow-hidden rounded-lg border border-neutral-800 bg-[#111111]">
        <div className="flex items-baseline justify-between gap-3 px-3 pt-3">
          <p data-race-date className="text-sm font-medium tabular-nums text-neutral-100">
            {formatRaceDate(poster.date)}
          </p>
          <p className="text-[11px] text-neutral-500">
            {firstLabel} – {lastLabel}
          </p>
        </div>
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
