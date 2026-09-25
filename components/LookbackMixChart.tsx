"use client";

import { useMemo, useState, type PointerEvent } from "react";
import { formatAvgGwh, formatAvgShare, formatGw, formatGwh, formatShare } from "@/lib/generation/format";
import { MIX_SOURCE_META, sharesFromMw } from "@/lib/generation/sources";
import { stackMixDayMw } from "@/lib/generation/stack";
import {
  combineMixDays,
  mixWindowKpis,
  mixWindowSourceAverages,
} from "@/lib/generation/summary";
import type { MixDayPoint } from "@/lib/generation/types";
import {
  formatLookbackCaptionFromDates,
  formatLookbackDate,
  pickAxisTicks,
} from "@/lib/lookback";

const CHART_W = 400;
const CHART_H = 192;
const PAD = { t: 16, r: 16, b: 40, l: 36 };
const AXIS = "#A3A3A3";
const FONT = "var(--font-geist-sans), system-ui, sans-serif";
const AXIS_FONT = 12;

function badgeInk(hex: string) {
  const raw = hex.replace("#", "");
  const r = Number.parseInt(raw.slice(0, 2), 16);
  const g = Number.parseInt(raw.slice(2, 4), 16);
  const b = Number.parseInt(raw.slice(4, 6), 16);
  const luma = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luma > 0.58 ? "#111111" : "#FAFAFA";
}

export function LookbackMixChart({ days }: { days: MixDayPoint[] }) {
  const [pickedIndex, setPickedIndex] = useState<number | null>(null);
  const stack = useMemo(
    () => (days.length > 0 ? stackMixDayMw(days, CHART_W, CHART_H, PAD) : null),
    [days],
  );
  const summary = useMemo(() => combineMixDays(days), [days]);
  const caption = formatLookbackCaptionFromDates(days.map((day) => day.date));

  if (!stack || !summary || days.length === 0) return null;

  const picked = pickedIndex == null ? null : days[pickedIndex] ?? null;
  const shares = picked ? sharesFromMw(picked.mwh) : summary.shares;
  const spanYears = days[0].date.slice(0, 4) !== days[days.length - 1].date.slice(0, 4);
  const kpis = mixWindowKpis(summary, (ymd) => formatLookbackDate(ymd, spanYears));
  const sourceAvgs = mixWindowSourceAverages(summary, days.length);
  const ticks = pickAxisTicks(days.length);
  const pickedAvgMw = picked
    ? picked.totalMwh / Math.max(picked.hourCount, 1)
    : null;

  function onMove(event: PointerEvent<SVGSVGElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width) * CHART_W;
    const raw = ((x - PAD.l) / stack.plotW) * days.length;
    const index = Math.min(days.length - 1, Math.max(0, Math.floor(raw)));
    setPickedIndex(index);
  }

  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="text-sm font-medium text-foreground">Mix elettrico Italia</p>
        <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
          {picked
            ? `${formatLookbackDate(picked.date, true)} · ${formatGw(pickedAvgMw ?? 0)}`
            : caption}
        </p>
      </div>
      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
        Produzione nello stesso periodo, in GW medi. Tocca una colonna per il
        mix di quel giorno.
      </p>

      <div className="mt-2 overflow-hidden rounded-lg border border-neutral-800 bg-[#111111]">
        <svg
          viewBox={`0 0 ${CHART_W} ${CHART_H}`}
          className="h-auto w-full touch-none"
          role="img"
          aria-label={`Mix elettrico Italia ${caption}: rinnovabili ${formatShare(summary.renewableShare)}, fossili ${formatShare(summary.fossilShare)}, ${formatGwh(summary.energyMwh)}`}
          onPointerMove={onMove}
          onPointerLeave={() => setPickedIndex(null)}
        >
          <rect width={CHART_W} height={CHART_H} fill="#111111" />

          {stack.layers.map((layer) => (
            <path
              key={layer.id}
              d={layer.d}
              fill={MIX_SOURCE_META[layer.id].color}
            />
          ))}

          {picked && pickedAvgMw != null ? (
            <line
              x1={stack.xAt(pickedIndex! + 0.5)}
              x2={stack.xAt(pickedIndex! + 0.5)}
              y1={stack.yAt(pickedAvgMw)}
              y2={CHART_H - PAD.b}
              stroke="#F5F5F5"
              strokeOpacity="0.7"
              strokeWidth="1"
            />
          ) : null}

          <text
            x={PAD.l - 6}
            y={PAD.t + 3}
            textAnchor="end"
            fill={AXIS}
            fontSize={9}
            fontFamily={FONT}
          >
            {formatGw(stack.maxMw)}
          </text>
          <text
            x={PAD.l - 6}
            y={CHART_H - PAD.b + 3}
            textAnchor="end"
            fill={AXIS}
            fontSize={9}
            fontFamily={FONT}
          >
            0
          </text>

          {ticks.map((index) => {
            const day = days[index];
            const x = stack.xAt(index + 0.5);
            return (
              <g key={day?.date ?? index}>
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
                  {day ? formatLookbackDate(day.date, days.length > 90) : ""}
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

      <p className="mt-3 text-sm text-foreground">
        Nel periodo selezionato, il{" "}
        <span className="font-semibold tabular-nums">{formatShare(summary.renewableShare)}</span>
        {" "}dell&apos;elettricità italiana è venuto da rinnovabili, il{" "}
        <span className="font-semibold tabular-nums">{formatShare(summary.fossilShare)}</span>
        {" "}da fonti fossili. In tutto{" "}
        <span className="font-semibold tabular-nums">{formatGwh(summary.energyMwh)}</span>
        .
      </p>

      <div
        className="mt-3 w-fit max-w-full overflow-hidden rounded-md border border-neutral-200 dark:border-neutral-800"
        aria-label="Sintesi del mix elettrico nel periodo"
      >
        <table className="border-collapse text-left">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900/60">
              {kpis.map((kpi, index) => (
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
              {kpis.map((kpi, index) => (
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
              {kpis.map((kpi, index) => (
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
      <p className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">
        Quote ponderate sull&apos;energia · {caption}
        {picked ? ` · ${formatGw(picked.peakMw)} di picco` : ""}
      </p>

      <div
        className="mix-avg-scroll mt-3 w-fit max-w-full overflow-x-auto rounded-md border border-neutral-200 pb-1.5 dark:border-neutral-800"
        aria-label="Media giornaliera per fonte nel periodo"
      >
        <table className="border-collapse text-left">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900/60">
              {sourceAvgs.map((source, index) => (
                <th
                  key={source.id}
                  scope="col"
                  className={`px-1.5 py-0.5 text-xs font-medium whitespace-nowrap text-neutral-600 dark:text-neutral-400 ${
                    index > 0 ? "border-l border-neutral-200 dark:border-neutral-800" : ""
                  }`}
                >
                  <span aria-hidden>{source.emoji} </span>
                  {source.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              {sourceAvgs.map((source, index) => (
                <td
                  key={source.id}
                  className={`px-1.5 py-0.5 text-sm font-semibold tracking-tight whitespace-nowrap tabular-nums ${
                    index > 0 ? "border-l border-neutral-200 dark:border-neutral-800" : ""
                  }`}
                >
                  {formatAvgGwh(source.avgDailyMwh)}
                </td>
              ))}
            </tr>
            <tr className="border-t border-neutral-100 dark:border-neutral-800/80">
              {sourceAvgs.map((source, index) => (
                <td
                  key={source.id}
                  className={`px-1.5 py-0.5 text-[10px] leading-tight whitespace-nowrap tabular-nums text-neutral-400 dark:text-neutral-500 ${
                    index > 0 ? "border-l border-neutral-200 dark:border-neutral-800" : ""
                  }`}
                >
                  {formatAvgShare(source.share)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">
        Media giornaliera per fonte · {caption}
      </p>
    </div>
  );
}
