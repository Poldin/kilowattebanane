"use client";

import { useEffect, useId, useMemo, useState } from "react";
import {
  buildMonthOutlook,
  canExpandMonthOutlook,
  type MonthOutlookPoint,
} from "@/lib/monthly-outlook";
import { formatEurocent } from "@/lib/insights";
import { forwardSourceShortLabel } from "@/lib/offerte/forward-source";
import type { TariffPlanId } from "@/lib/fasce";
import type { ZoneForwardPayload, ZoneHourlyPayload } from "@/lib/zone-home-types";

const BANANA = "#F5D547";
const CHART_BG = "#111111";
const PAST = "#F5F5F5";
const FORWARD = "#E5E5E5";
const AXIS = "#A3A3A3";
const CHART_W = 400;
const CHART_H = 160;
const PAD = { t: 12, r: 10, b: 38, l: 10 };
const VALUE_BAND = 14;

function formatForwardAsOf(ymd: string) {
  const [year, month, day] = ymd.split("-").map(Number);
  return new Intl.DateTimeFormat("it-IT", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function formatMonthAxisLabel(isoDate: string) {
  const [year, month] = isoDate.split("-").map(Number);
  const monthShort = new Intl.DateTimeFormat("it-IT", {
    month: "short",
    timeZone: "UTC",
  })
    .format(new Date(Date.UTC(year, month - 1, 1)))
    .replace(".", "")
    .trim();
  return `${monthShort} '${String(year).slice(-2)}`;
}

export function MonthlyOutlookChart({
  anchorDate,
  hourly,
  forward,
  tariff,
}: {
  anchorDate: string;
  hourly: ZoneHourlyPayload[];
  forward: ZoneForwardPayload;
  tariff: TariffPlanId;
}) {
  const [expanded, setExpanded] = useState(false);
  const patternId = useId().replace(/:/g, "");

  useEffect(() => {
    setExpanded(false);
  }, [anchorDate]);
  const canExpand = canExpandMonthOutlook(anchorDate, hourly, forward.months);

  const series = useMemo(
    () =>
      buildMonthOutlook({
        anchorDate,
        hourly,
        tariff,
        forwardMonths: forward.months,
        forwardAsOf: forward.asOf,
        forwardSource: forward.source,
        expanded,
      }),
    [anchorDate, hourly, tariff, forward, expanded],
  );

  const priced = series.months.filter(
    (month): month is MonthOutlookPoint & { valueCents: number } =>
      month.valueCents != null && Number.isFinite(month.valueCents),
  );
  if (priced.length < 2) return null;

  const values = priced.map((month) => month.valueCents);
  const max = Math.max(...values);
  const span = max || 1;
  const innerW = CHART_W - PAD.l - PAD.r;
  const innerH = CHART_H - PAD.t - PAD.b;
  const barCount = series.months.filter((month) => month.valueCents != null).length;
  const barGap = expanded && barCount > 16 ? 1.5 : expanded ? 2 : 3;
  const barW = (innerW - barGap * (barCount - 1)) / barCount;
  const cramped = barW < 10;
  const plotTop = PAD.t + (cramped ? 24 : VALUE_BAND);
  const plotBottom = PAD.t + innerH;
  const plotH = plotBottom - plotTop;
  const labelPivotY = plotBottom + 20;
  const monthFontSize = barW < 12 ? 7.5 : 9;
  const valueFontSize = cramped ? 5.5 : barW < 14 ? 6 : 7;

  const yFor = (value: number) => plotTop + plotH - (value / span) * plotH;

  let barIndex = -1;

  return (
    <div className="mt-4 w-full max-w-full">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <p className="text-sm font-medium text-foreground">Prezzo medio mensile (c€/kWh)</p>
        {canExpand ? (
          <button
            type="button"
            onClick={() => setExpanded((open) => !open)}
            className="text-[11px] font-medium text-neutral-500 underline decoration-neutral-300 underline-offset-2 transition-colors hover:text-foreground hover:decoration-neutral-500 dark:text-neutral-400 dark:decoration-neutral-600 dark:hover:decoration-neutral-400"
          >
            {expanded ? "Comprimi" : "Vedi tutto"}
          </button>
        ) : null}
      </div>
      <div className="mt-2 rounded-lg border border-neutral-800 bg-[#111111]">
        <svg
          viewBox={`0 0 ${CHART_W} ${CHART_H}`}
          className="h-auto w-full"
          role="img"
          aria-label={`Prezzo medio mensile su ${barCount} mesi. Passato dalla zona, futuro da forward PUN.`}
        >
          <rect width={CHART_W} height={CHART_H} fill={CHART_BG} />

          <defs>
            <pattern
              id={patternId}
              width="5"
              height="5"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <rect width="5" height="5" fill={FORWARD} fillOpacity="0.14" />
              <line
                x1="0"
                y1="0"
                x2="0"
                y2="5"
                stroke={FORWARD}
                strokeWidth="1.2"
                strokeOpacity="0.72"
              />
            </pattern>
          </defs>

          {series.months.map((month) => {
            if (month.valueCents == null) return null;
            barIndex += 1;
            const x = PAD.l + barIndex * (barW + barGap);
            const y = yFor(month.valueCents);
            const height = plotBottom - y;
            const isForward = month.kind === "forward";
            const isAnchor = month.isAnchor;
            const cx = x + barW / 2;
            const fill = isAnchor
              ? BANANA
              : isForward
                ? `url(#${patternId})`
                : PAST;
            const fillOpacity = isAnchor ? 1 : isForward ? 1 : month.kind === "partial" ? 0.82 : 1;

            return (
              <g key={month.start}>
                <rect
                  x={x}
                  y={y}
                  width={barW}
                  height={Math.max(height, 2)}
                  rx="1.5"
                  fill={fill}
                  fillOpacity={fillOpacity}
                />
                <text
                  x={cx}
                  y={y - 4}
                  textAnchor="middle"
                  transform={cramped ? `rotate(-40 ${cx} ${y - 4})` : undefined}
                  fill={isAnchor ? BANANA : isForward ? FORWARD : PAST}
                  fillOpacity={isForward ? 0.82 : 0.92}
                  fontSize={valueFontSize}
                  fontFamily="var(--font-geist-sans), system-ui, sans-serif"
                  fontWeight="500"
                >
                  {formatEurocent(month.valueCents, 1)}
                </text>
                <text
                  x={cx}
                  y={labelPivotY}
                  textAnchor="middle"
                  transform={`rotate(-40 ${cx} ${labelPivotY})`}
                  fill={isAnchor ? BANANA : AXIS}
                  fontSize={monthFontSize}
                  fontFamily="var(--font-geist-sans), system-ui, sans-serif"
                  fontWeight={isAnchor ? "600" : "500"}
                >
                  {formatMonthAxisLabel(month.start)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-neutral-500 dark:text-neutral-400">
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-2.5 rounded-[2px] bg-neutral-100"
            aria-hidden
          />
          Passato · zona
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-2.5 rounded-[2px] bg-[repeating-linear-gradient(45deg,#e5e5e5_0_1px,transparent_1px_4px)] bg-neutral-100/15"
            aria-hidden
          />
          Futuro · forward PUN
          {forward.asOf
            ? ` (${forwardSourceShortLabel(forward.source) ?? "forward"} al ${formatForwardAsOf(forward.asOf)})`
            : null}
        </span>
      </div>
    </div>
  );
}
