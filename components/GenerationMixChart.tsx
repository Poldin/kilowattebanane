"use client";

import { useEffect, useMemo, useState, type PointerEvent, type ReactNode } from "react";
import { fetchItalyMix } from "@/lib/generation/client";
import { MIX_SOURCE_META, MIX_STACK_ORDER, sharesFromMw } from "@/lib/generation/sources";
import { mixSummaryLead, summarizeMixDay } from "@/lib/generation/summary";
import { formatHourLabel, formatMixClock, formatMixDate } from "@/lib/generation/time";
import type { ItalyMixPayload, MixHourPoint, MixShare, MixSourceId } from "@/lib/generation/types";

const CHART_W = 400;
const CHART_H = 192;
const PAD = { t: 16, r: 16, b: 40, l: 36 };
const AXIS = "#A3A3A3";
const FONT = "var(--font-geist-sans), system-ui, sans-serif";
const HOUR_TICKS = [0, 6, 12, 18, 24];
const AXIS_FONT = 12;

function formatGw(mw: number) {
  const gw = mw / 1000;
  return gw >= 10 ? `${gw.toFixed(0)} GW` : `${gw.toFixed(1)} GW`;
}

function formatGwh(mwh: number) {
  const gwh = mwh / 1000;
  return gwh >= 100 ? `${gwh.toFixed(0)} GWh` : `${gwh.toFixed(1)} GWh`;
}

function formatShare(share: number) {
  const pct = share * 100;
  return pct >= 10 ? `${pct.toFixed(0)}%` : `${pct.toFixed(1)}%`;
}

function badgeInk(hex: string) {
  const raw = hex.replace("#", "");
  const r = Number.parseInt(raw.slice(0, 2), 16);
  const g = Number.parseInt(raw.slice(2, 4), 16);
  const b = Number.parseInt(raw.slice(4, 6), 16);
  const luma = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luma > 0.58 ? "#111111" : "#FAFAFA";
}

function hourShares(point: MixHourPoint): MixShare[] {
  return sharesFromMw(point.mw);
}

function stackedPath(xs: number[], tops: number[], bottoms: number[]) {
  if (xs.length < 2) return "";
  let d = `M ${xs[0]} ${tops[0]}`;
  for (let i = 1; i < xs.length; i++) d += ` L ${xs[i]} ${tops[i]}`;
  for (let i = xs.length - 1; i >= 0; i--) d += ` L ${xs[i]} ${bottoms[i]}`;
  return `${d} Z`;
}

function consecutiveRuns(hours: MixHourPoint[]) {
  const runs: MixHourPoint[][] = [];
  let run: MixHourPoint[] = [];
  for (const hour of hours) {
    if (run.length && hour.hour !== run[run.length - 1].hour + 1) {
      runs.push(run);
      run = [];
    }
    run.push(hour);
  }
  if (run.length) runs.push(run);
  return runs;
}

function stackLayers(hours: MixHourPoint[]) {
  const plotW = CHART_W - PAD.l - PAD.r;
  const plotH = CHART_H - PAD.t - PAD.b;
  const maxMw = Math.max(...hours.map((hour) => hour.totalMw), 1);
  const xAt = (hour: number) => PAD.l + (hour / 24) * plotW;
  const yAt = (mw: number) => PAD.t + plotH - (mw / maxMw) * plotH;
  const visible = MIX_STACK_ORDER.filter((id) =>
    hours.some((hour) => (hour.mw[id] ?? 0) > 0),
  );

  const parts = new Map<MixSourceId, string[]>(visible.map((id) => [id, []]));
  for (const run of consecutiveRuns(hours)) {
    const samples = run.flatMap((hour) => [
      { hour: hour.hour, mw: hour.mw },
      { hour: hour.hour + 1, mw: hour.mw },
    ]);
    const xs = samples.map((sample) => xAt(sample.hour));
    const bottoms = samples.map(() => PAD.t + plotH);
    for (const id of visible) {
      const tops = samples.map((sample, index) => {
        const mw = sample.mw[id] ?? 0;
        return bottoms[index] - (mw / maxMw) * plotH;
      });
      parts.get(id)?.push(stackedPath(xs, tops, bottoms));
      bottoms.splice(0, bottoms.length, ...tops);
    }
  }

  return {
    layers: visible.map((id) => ({ id, d: (parts.get(id) ?? []).filter(Boolean).join(" ") })),
    maxMw,
    plotW,
    plotH,
    xAt,
    yAt,
  };
}

export function GenerationMixChart({
  date,
  initialMix,
}: {
  date: string;
  initialMix?: ItalyMixPayload | null;
}) {
  const seed = initialMix?.date === date ? initialMix : null;
  const [mix, setMix] = useState<ItalyMixPayload | null>(seed);
  const [missing, setMissing] = useState(seed === null);
  const [hoverHour, setHoverHour] = useState<number | null>(null);

  useEffect(() => {
    setHoverHour(null);
    if (initialMix?.date === date) {
      setMix(initialMix);
      setMissing(false);
      return;
    }
    let cancelled = false;
    setMix(null);
    setMissing(false);
    fetchItalyMix(date)
      .then((payload) => {
        if (cancelled) return;
        setMix(payload.date === date ? payload : null);
        setMissing(payload.date !== date);
      })
      .catch(() => {
        if (cancelled) return;
        setMix(null);
        setMissing(true);
      });
    return () => {
      cancelled = true;
    };
  }, [date, initialMix]);

  const hours = mix?.hours ?? [];
  const stack = useMemo(() => (hours.length >= 2 ? stackLayers(hours) : null), [hours]);
  const hovered = hoverHour == null ? null : (hours.find((hour) => hour.hour === hoverHour) ?? null);
  const active = hovered ?? hours.at(-1) ?? null;
  const shares = active && stack ? hourShares(active) : (mix?.shares ?? []);
  const activeTotal = active?.totalMw ?? mix?.totalMw ?? 0;
  const activeStart = active?.slotStart ?? mix?.slotStart;

  if (missing && !mix) return null;
  if (!mix || shares.length === 0) return null;

  const dateLabel = formatMixDate(mix.date);
  const clock = stack && active
    ? `${formatHourLabel(active.hour)}:00`
    : activeStart
      ? formatMixClock(activeStart)
      : "";
  const summary = summarizeMixDay(mix);
  const summaryKpis = summary
    ? [
        {
          key: "renewable",
          label: "rinnovabili",
          value: formatShare(summary.renewableShare),
          hint: "solare, eolico, idro, geo, bio",
        },
        {
          key: "fossil",
          label: "fossili",
          value: formatShare(summary.fossilShare),
          hint: "gas, carbone, olio",
        },
        {
          key: "cleanest",
          label: "ora più pulita",
          value: `${formatHourLabel(summary.cleanestHour)}:00`,
          hint: `${formatShare(summary.cleanestShare)} FER`,
        },
        {
          key: "peak",
          label: "picco",
          value: formatGw(summary.peakMw),
          hint: `${formatHourLabel(summary.peakHour)}:00`,
        },
        {
          key: "total",
          label: "totale",
          value: formatGwh(summary.energyMwh),
          hint: "energia prodotta",
        },
      ]
    : [];

  function onMove(event: PointerEvent<SVGSVGElement>) {
    if (!stack || hours.length === 0) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width) * CHART_W;
    const raw = ((x - PAD.l) / stack.plotW) * 24;
    const bucket = Math.min(23, Math.max(0, Math.floor(raw)));
    const exact = hours.find((hour) => hour.hour === bucket);
    if (exact) {
      setHoverHour(exact.hour);
      return;
    }
    let nearest = hours[0];
    let best = Infinity;
    for (const hour of hours) {
      const dist = Math.abs(hour.hour + 0.5 - raw);
      if (dist < best) {
        best = dist;
        nearest = hour;
      }
    }
    setHoverHour(nearest.hour);
  }

  return (
    <div className="mt-4 w-full max-w-full">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="text-sm font-medium text-foreground">Mix elettrico Italia</p>
        <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
          {dateLabel} · {clock} · {formatGw(activeTotal)}
        </p>
      </div>
      <div className="mt-2 rounded-lg border border-neutral-800 bg-[#111111]">
        <svg
          viewBox={`0 0 ${CHART_W} ${CHART_H}`}
          className="h-auto w-full touch-none"
          role="img"
          aria-label={`Mix elettrico Italia ${dateLabel} alle ${clock}: ${shares
            .map((share) => `${share.label} ${formatShare(share.share)}`)
            .join(", ")}`}
          onPointerMove={stack ? onMove : undefined}
          onPointerLeave={() => setHoverHour(null)}
        >
          <rect width={CHART_W} height={CHART_H} fill="#111111" />

          {stack
            ? stack.layers.map((layer) => (
                <path
                  key={layer.id}
                  d={layer.d}
                  fill={MIX_SOURCE_META[layer.id].color}
                />
              ))
            : null}

          {!stack
            ? mix.shares.reduce<{ nodes: ReactNode[]; x: number }>(
                (acc, share) => {
                  const plotW = CHART_W - PAD.l - PAD.r;
                  const width = Math.max(share.share * plotW, 1.2);
                  const sliceX = acc.x;
                  acc.x += width;
                  acc.nodes.push(
                    <rect
                      key={share.id}
                      x={sliceX}
                      y={PAD.t}
                      width={width}
                      height={CHART_H - PAD.t - PAD.b}
                      fill={MIX_SOURCE_META[share.id].color}
                    />,
                  );
                  return acc;
                },
                { nodes: [], x: PAD.l },
              ).nodes
            : null}

          {stack && active ? (
            <line
              x1={stack.xAt(active.hour + 0.5)}
              x2={stack.xAt(active.hour + 0.5)}
              y1={stack.yAt(active.totalMw)}
              y2={CHART_H - PAD.b}
              stroke="#F5F5F5"
              strokeOpacity={hovered ? 0.7 : 0.28}
              strokeWidth="1"
            />
          ) : null}

          {stack ? (
            <>
              <text
                x={PAD.l - 6}
                y={PAD.t + 3}
                textAnchor="end"
                fill={AXIS}
                fontSize={9}
                fontFamily="var(--font-geist-sans), system-ui, sans-serif"
              >
                {formatGw(stack.maxMw)}
              </text>
              <text
                x={PAD.l - 6}
                y={CHART_H - PAD.b + 3}
                textAnchor="end"
                fill={AXIS}
                fontSize={9}
                fontFamily="var(--font-geist-sans), system-ui, sans-serif"
              >
                0
              </text>
            </>
          ) : null}

          {HOUR_TICKS.map((hour) => {
            const x = PAD.l + (hour / 24) * (CHART_W - PAD.l - PAD.r);
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
                  y={CHART_H - 16}
                  textAnchor="middle"
                  fill="#f5f5f5"
                  fontSize={AXIS_FONT}
                  fontFamily={FONT}
                  fontWeight="600"
                >
                  {String(hour).padStart(2, "0")}
                  <tspan fontSize={Math.round(AXIS_FONT * 0.6)} fontWeight="500" fill="#a3a3a3">
                    :00
                  </tspan>
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {shares.map((share) => {
          const color = MIX_SOURCE_META[share.id].color;
          return (
            <span
              key={share.id}
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] leading-tight"
              style={{ backgroundColor: color, color: badgeInk(color) }}
            >
              <span aria-hidden>{share.emoji}</span>
              <span>{share.label}</span>
              <span className="font-bold tabular-nums">{formatShare(share.share)}</span>
            </span>
          );
        })}
      </div>
      {summary ? (
        <>
          <p className="mt-3 text-sm text-foreground">
            {mixSummaryLead(dateLabel, summary)} il{" "}
            <span className="font-semibold tabular-nums">{formatShare(summary.renewableShare)}</span>
            {" "}dell&apos;elettricità italiana è venuto da rinnovabili, il{" "}
            <span className="font-semibold tabular-nums">{formatShare(summary.fossilShare)}</span>
            {" "}da fonti fossili. In tutto{" "}
            <span className="font-semibold tabular-nums">{formatGwh(summary.energyMwh)}</span>
            .
          </p>
          <div
            className="mt-3 w-fit max-w-full overflow-hidden rounded-md border border-neutral-200 dark:border-neutral-800"
            aria-label="Sintesi del mix elettrico sulla giornata"
          >
            <table className="border-collapse text-left">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900/60">
                  {summaryKpis.map((kpi, index) => (
                    <th
                      key={kpi.key}
                      scope="col"
                      className={`px-1.5 py-0.5 text-xs font-medium whitespace-nowrap text-neutral-600 dark:text-neutral-400 ${
                        index > 0 ? "border-l border-neutral-200 dark:border-neutral-800" : ""
                      }`}
                    >
                      {kpi.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {summaryKpis.map((kpi, index) => (
                    <td
                      key={kpi.key}
                      className={`px-1.5 py-0.5 text-sm font-semibold tracking-tight whitespace-nowrap tabular-nums ${
                        index > 0 ? "border-l border-neutral-200 dark:border-neutral-800" : ""
                      }`}
                    >
                      {kpi.value}
                    </td>
                  ))}
                </tr>
                <tr className="border-t border-neutral-100 dark:border-neutral-800/80">
                  {summaryKpis.map((kpi, index) => (
                    <td
                      key={kpi.key}
                      className={`px-1.5 py-0.5 text-[10px] leading-tight whitespace-nowrap tabular-nums text-neutral-400 dark:text-neutral-500 ${
                        index > 0 ? "border-l border-neutral-200 dark:border-neutral-800" : ""
                      }`}
                    >
                      {kpi.hint}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  );
}
