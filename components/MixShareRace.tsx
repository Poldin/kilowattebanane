"use client";

import {
  memo,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { formatShare } from "@/lib/generation/format";
import { MIX_SOURCE_META, MIX_STACK_ORDER } from "@/lib/generation/sources";
import {
  MIX_SOURCE_IDS,
  type MixDayPoint,
  type MixSourceId,
} from "@/lib/generation/types";

const MONTHS = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"] as const;
const MS_PER_DAY = 100;
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

const STACK_INDEX = new Map<MixSourceId, number>(
  MIX_STACK_ORDER.map((id, index) => [id, index]),
);

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

export function buildMixShareFrames(days: MixDayPoint[]): MixShareFrame[] {
  return days
    .filter((day) => day.hourCount >= CLOSED_HOURS && day.totalMwh > 0)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-RACE_DAYS)
    .map((day) => ({ date: day.date, shares: sharesForDay(day) }));
}

function ranksFor(shares: ShareMap): ShareMap {
  const order = [...MIX_SOURCE_IDS].sort((a, b) => {
    const delta = shares[b] - shares[a];
    if (Math.abs(delta) > 1e-9) return delta;
    return (STACK_INDEX.get(a) ?? 0) - (STACK_INDEX.get(b) ?? 0);
  });
  const rank = {} as ShareMap;
  order.forEach((id, index) => {
    rank[id] = index;
  });
  return rank;
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
  const rankFrom = ranksFor(from.shares);
  const rankTo = ranksFor(to.shares);
  const shares = {} as ShareMap;
  const rank = {} as ShareMap;
  for (const id of MIX_SOURCE_IDS) {
    shares[id] = from.shares[id] + (to.shares[id] - from.shares[id]) * eased;
    rank[id] = rankFrom[id] + (rankTo[id] - rankFrom[id]) * eased;
  }
  return {
    shares,
    rank,
    index,
    date: eased < 0.5 ? from.date : to.date,
  };
}

function MixShareRaceInner({ days }: { days: MixDayPoint[] }) {
  const frames = useMemo(() => buildMixShareFrames(days), [days]);
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
  const [inView, setInView] = useState(false);
  const [userPaused, setUserPaused] = useState(false);

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
    const range = root.querySelector<HTMLInputElement>("[data-race-range]");
    if (range) {
      range.setAttribute("aria-valuetext", formatRaceDate(frame.date));
      if (document.activeElement !== range) range.value = String(frame.index);
    }
    const svg = root.querySelector("svg");
    if (!svg) return;
    for (const id of MIX_SOURCE_IDS) {
      const group = svg.querySelector<SVGGElement>(`[data-source="${id}"]`);
      if (!group) continue;
      group.setAttribute("transform", `translate(0 ${PAD_T + frame.rank[id] * ROW_H})`);
      const bar = group.querySelector<SVGRectElement>("[data-bar]");
      bar?.setAttribute("width", (Math.max(0, frame.shares[id]) * BAR_MAX).toFixed(2));
      const pct = group.querySelector<SVGTextElement>("[data-pct]");
      if (pct) pct.textContent = formatShare(frame.shares[id]);
    }
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
      const dt = Math.min(100, now - last);
      last = now;
      const count = framesRef.current.length;
      progressRef.current += dt / MS_PER_DAY;
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
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full"
          role="img"
          aria-label={`Corsa delle fonti dal ${firstLabel} al ${lastLabel}`}
        >
          {MIX_SOURCE_IDS.map((id) => (
            <g
              key={id}
              data-source={id}
              transform={`translate(0 ${PAD_T + poster.rank[id] * ROW_H})`}
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
        <div className="flex items-center gap-3 px-3 pb-3">
          <button
            type="button"
            disabled={reduced || frames.length < 2}
            aria-pressed={playing}
            aria-label={
              playing ? "Metti in pausa la corsa delle fonti" : "Avvia la corsa delle fonti"
            }
            onClick={() => setUserPaused(playing)}
            className="inline-flex h-8 shrink-0 items-center rounded-md bg-neutral-100 px-3 text-xs font-medium text-neutral-900 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {playing ? "Pausa" : "Avvia"}
          </button>
          <input
            data-race-range=""
            type="range"
            min={0}
            max={frames.length - 1}
            step={1}
            defaultValue={0}
            aria-label="Giorno della corsa delle fonti"
            aria-valuetext={formatRaceDate(poster.date)}
            onPointerDown={() => setUserPaused(true)}
            onInput={(event) => {
              setUserPaused(true);
              const next = Number(event.currentTarget.value);
              progressRef.current = next;
              paint(next);
            }}
            className="h-8 w-full cursor-pointer accent-[#F5D547]"
          />
        </div>
      </div>
    </section>
  );
}

export const MixShareRace = memo(MixShareRaceInner);
