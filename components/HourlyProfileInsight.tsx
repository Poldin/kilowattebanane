"use client";

import { useEffect, useMemo, useState, type PointerEvent } from "react";
import {
  formatTypicalHoursCaption,
  hourInProfileBands,
  typicalHourlyProfileFromHours,
  type HourlyProfile,
} from "@/lib/hourly-profile";
import {
  CHART_W,
  PAD,
  formatEurocent,
  hourToX,
  yScale,
} from "@/lib/insights";
import {
  DEFAULT_LOOKBACK_RANGE,
  LOOKBACK_RANGES,
  formatLookbackCaptionFromDates,
  lookbackEndDateFromDates,
  lookbackRangeById,
  sliceLookbackDates,
  type LookbackRangeId,
} from "@/lib/lookback";
import type { ZoneHourlyPayload } from "@/lib/zone-home-types";

const BANANA = "#F5D547";
const PEAK = "#EF4444";
const MID = "#737373";
const CHART_H_DESKTOP = 180;
const CHART_W_MOBILE = 400;
const CHART_H_MOBILE = 220;
const PAD_MOBILE = { t: 36, r: 16, b: 48, l: 64 };

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
      axisFontSize: 20,
      unitFontSize: 15,
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

function HourlyProfileChart({ profile }: { profile: HourlyProfile }) {
  const { chartW, chartH, pad, axisFontSize, unitFontSize } = useChartLayout();
  const [pickedHour, setPickedHour] = useState<number | null>(null);

  const avgs = profile.hours.map((hour) => hour.avg);
  const scale = yScale(avgs.length > 0 ? avgs : [0]);
  const innerH = chartH - pad.t - pad.b;
  const innerW = chartW - pad.l - pad.r;
  const range = scale.max - scale.min || 1;
  const slotW = innerW / 24;
  const barW = slotW * 0.7;
  const font = "var(--font-geist-sans), system-ui, sans-serif";
  const xTicks = [0, 6, 12, 18, 24];
  const byHour = new Map(profile.hours.map((hour) => [hour.hour, hour]));
  const picked = pickedHour == null ? null : (byHour.get(pickedHour) ?? null);

  function pickFromPointer(event: PointerEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return;
    const x = ((event.clientX - rect.left) / rect.width) * chartW;
    const hour = Math.floor(((x - pad.l) / innerW) * 24);
    setPickedHour(Math.min(23, Math.max(0, hour)));
  }

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${chartW} ${chartH}`}
        className="h-auto w-full cursor-crosshair touch-manipulation"
        role="img"
        aria-label="Prezzo medio di ogni ora nel periodo scelto, in centesimi di euro per kilowattora."
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

        {xTicks.map((hour) => (
          <g key={hour}>
            <line
              x1={hourToX(hour, chartW, pad)}
              x2={hourToX(hour, chartW, pad)}
              y1={pad.t}
              y2={chartH - pad.b}
              stroke="#1f1f1f"
              strokeWidth="1"
            />
            <text
              x={hourToX(hour, chartW, pad)}
              y={chartH - 16}
              textAnchor="middle"
              fill="#f5f5f5"
              fontSize={axisFontSize}
              fontFamily={font}
              fontWeight="600"
            >
              {String(hour).padStart(2, "0")}
            </text>
          </g>
        ))}

        {profile.hours.map((hour) => {
          const x = pad.l + hour.hour * slotW + (slotW - barW) / 2;
          const y =
            pad.t + (1 - (hour.avg - scale.min) / range) * innerH;
          const height = Math.max(2, chartH - pad.b - y);
          const cheap = hourInProfileBands(hour.hour, profile.cheapBands);
          const peak = hourInProfileBands(hour.hour, profile.peakBands);
          const fill = cheap ? BANANA : peak ? PEAK : MID;
          const active = pickedHour === hour.hour;
          return (
            <rect
              key={hour.hour}
              x={x}
              y={y}
              width={barW}
              height={height}
              rx="2"
              fill={fill}
              opacity={active ? 1 : cheap || peak ? 0.95 : 0.7}
            />
          );
        })}

        {picked ? (
          <line
            x1={pad.l + (picked.hour + 0.5) * slotW}
            x2={pad.l + (picked.hour + 0.5) * slotW}
            y1={pad.t}
            y2={chartH - pad.b}
            stroke="#f5f5f5"
            strokeWidth="1.5"
            strokeDasharray="4 4"
            opacity="0.8"
            pointerEvents="none"
          />
        ) : null}
      </svg>

      {picked ? (
        <button
          type="button"
          className="absolute top-2.5 right-2.5 z-10 flex items-start gap-2 rounded-md border border-white/15 bg-black/80 px-2.5 py-1.5 text-left text-white shadow-sm"
          aria-label={`Chiudi lettura delle ${String(picked.hour).padStart(2, "0")}:00, ${formatEurocent(picked.avg)}`}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => setPickedHour(null)}
        >
          <span>
            <span className="block text-xs font-semibold tabular-nums sm:text-sm">
              {String(picked.hour).padStart(2, "0")}:00 ·{" "}
              {formatEurocent(picked.avg)}
            </span>
            <span className="block text-[11px] text-white/70">
              tra le più basse in {picked.cheapDays} giorni su {picked.samples}
            </span>
          </span>
          <span aria-hidden className="text-sm leading-none text-white/70">
            ×
          </span>
        </button>
      ) : null}
    </div>
  );
}

export function HourlyProfileInsight({ hourly }: { hourly: ZoneHourlyPayload[] }) {
  const [rangeId, setRangeId] = useState<LookbackRangeId>(DEFAULT_LOOKBACK_RANGE);
  const dates = hourly.map((day) => day.date);
  const endDate = lookbackEndDateFromDates(dates);
  const range = lookbackRangeById(rangeId);
  const windowHourly = useMemo(() => {
    if (!endDate) return [];
    const allowed = new Set(sliceLookbackDates(dates, range.days, endDate));
    return hourly
      .filter((day) => allowed.has(day.date))
      .map((day) => ({ deliveryDate: day.date, hours: day.hours }));
  }, [hourly, dates, endDate, range.days]);
  const profile = useMemo(
    () => typicalHourlyProfileFromHours(windowHourly),
    [windowHourly],
  );

  if (!endDate) return null;

  const caption = profile ? formatTypicalHoursCaption(profile) : null;

  return (
    <section
      aria-labelledby="hourly-profile-heading"
      className="mt-10 scroll-mt-20 border-t border-neutral-200 pt-8 dark:border-neutral-800"
    >
      <h3
        id="hourly-profile-heading"
        className="text-lg font-medium tracking-tight text-foreground sm:text-xl"
      >
        A che ora, di solito
      </h3>
      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
        Media di ogni ora nel periodo. Le barre gialle sono le più basse, le
        rosse le più alte.
      </p>

      <div
        role="tablist"
        aria-label="Periodo del profilo orario"
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

      {profile ? (
        <>
          <div className="mt-3 overflow-hidden rounded-lg border border-neutral-800 bg-[#111111]">
            <HourlyProfileChart key={rangeId} profile={profile} />
          </div>
          {windowHourly.length > 0 ? (
            <p className="mt-3 text-xs text-neutral-400 dark:text-neutral-500">
              c€/kWh all&apos;ingrosso ·{" "}
              {formatLookbackCaptionFromDates(
                windowHourly.map((day) => day.deliveryDate),
              )}
            </p>
          ) : null}
          {caption ? (
            <p className="mt-3 text-sm font-medium text-foreground">{caption}</p>
          ) : null}
        </>
      ) : (
        <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
          Ancora pochi dati per questo periodo.
        </p>
      )}
    </section>
  );
}
