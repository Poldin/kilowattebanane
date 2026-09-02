"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type PointerEvent,
} from "react";
import { RegionSelect } from "@/components/RegionSelect";
import {
  groupZoneDays,
  pickDefaultDeliveryDate,
  romeNow,
  romeToday,
  type DayAheadRow,
  type RomeNow,
  type ZoneDay,
} from "@/lib/day-ahead-core";
import { fetchZoneHome, fetchZoneSlots } from "@/lib/zone-home-client";
import type { ZoneHomePayload } from "@/lib/zone-home-types";
import { ShareButton } from "@/components/ShareButton";
import { HourlyProfileInsight } from "@/components/HourlyProfileInsight";
import { LoadShiftSim } from "@/components/LoadShiftSim";
import { LookbackInsight } from "@/components/LookbackInsight";
import {
  DATE_QUERY_PARAM,
  DEFAULT_REGION,
  PRICES_SECTION_ID,
  REGION_QUERY_PARAM,
  SHOW_TODAY_PRICES_EVENT,
  dateFromParam,
  pricesShareUrl,
  regionFromParam,
  zoneForRegion,
  zoneNameForRegion,
  type ItalianRegion,
  type MarketZoneId,
} from "@/lib/market-zones";
import { persistRegionPref, readRegionPref } from "@/lib/region-pref";
import {
  QUARTERS_PER_HOUR,
  formatQuarterSlot,
  formatQuarterSlotFull,
  toHourlyAverages,
} from "@/lib/prices";
import {
  CHART_H_DESKTOP,
  CHART_W,
  PAD,
  type CurveSample,
  type PriceBand,
  cheapestSlotsInBands,
  computeRecommendations,
  dayHourlyCentStats,
  formatEurocent,
  formatTipHour,
  hourToX,
  joinItalian,
  mergeQuarterBands,
  priciestSlotsInBands,
  sampleNearestHour,
  sampleSmoothCurve,
  slotInBands,
  toEurocentPerKwh,
  toPoints,
  toSmoothPath,
  yScale,
} from "@/lib/insights";

type DayInsight = {
  deliveryDate: string;
  prices: number[];
  noonIndex: number;
  cheapBands: PriceBand[];
  peakBands: PriceBand[];
  bestTip: string;
  worstTip: string;
};

function buildDayInsight(day: ZoneDay): DayInsight {
  const recommendations = computeRecommendations(day.prices);
  return {
    deliveryDate: day.deliveryDate,
    prices: day.prices,
    noonIndex: day.noonIndex,
    cheapBands: recommendations.cheapBands,
    peakBands: recommendations.peakBands,
    bestTip: recommendations.bestTip,
    worstTip: recommendations.worstTip,
  };
}

const BANANA = "#F5D547";
const PEAK = "#EF4444";
const NOW = "#EF4444";
const MID = "#A3A3A3";
const MARKER_FONT_SIZE = 20;
const CHART_W_MOBILE = 400;
const CHART_H_MOBILE = 360;
const PAD_MOBILE = { t: 40, r: 16, b: 56, l: 68 };

function addCalendarDays(ymd: string, delta: number) {
  const [year, month, day] = ymd.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + delta)).toISOString().slice(0, 10);
}

function formatDeliveryDate(ymd: string, today: string) {
  const [year, month, day] = ymd.split("-").map(Number);
  const formatted = new Date(Date.UTC(year, month - 1, day, 12)).toLocaleDateString(
    "it-IT",
    { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" },
  );
  if (ymd === today) return `Oggi · ${formatted}`;
  if (ymd === addCalendarDays(today, -1)) return `Ieri · ${formatted}`;
  if (ymd === addCalendarDays(today, 1)) return `Domani · ${formatted}`;
  return formatted;
}

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
      axisFontSize: 22,
      unitFontSize: 16,
    };
  }

  return {
    chartW: CHART_W,
    chartH: CHART_H_DESKTOP,
    pad: PAD,
    axisFontSize: 15,
    unitFontSize: 13,
  };
}

function formatClock(hour: number, minute: number) {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function useRomeNow() {
  const [now, setNow] = useState<RomeNow | null>(null);

  useEffect(() => {
    const tick = () => setNow(romeNow());
    tick();

    let intervalId: number | undefined;
    const msUntilNextMinute = 60_000 - (Date.now() % 60_000) + 50;
    const timeoutId = window.setTimeout(() => {
      tick();
      intervalId = window.setInterval(tick, 60_000);
    }, msUntilNextMinute);

    return () => {
      window.clearTimeout(timeoutId);
      if (intervalId !== undefined) window.clearInterval(intervalId);
    };
  }, []);

  return now;
}

function currentSlotIndex(hour: number, minute: number, slotCount: number) {
  if (slotCount <= 0) return 0;
  const slot = Math.floor((hour * 60 + minute) / 15);
  return Math.max(0, Math.min(slotCount - 1, slot));
}

function expensivePercentile(prices: number[], current: number) {
  if (prices.length === 0) return 0.5;
  const cheaper = prices.filter((price) => price < current).length;
  const ties = prices.filter((price) => price === current).length;
  return (cheaper + ties * 0.5) / prices.length;
}

function nowMomentComment(percentile: number) {
  if (percentile >= 0.95) {
    return {
      before: "tra i ",
      mark: "5% più cari",
      after: ": se puoi, non consumare",
      color: PEAK,
    };
  }
  if (percentile >= 0.9) {
    return {
      before: "tra i ",
      mark: "10% più cari",
      after: ": meglio evitare i consumi",
      color: PEAK,
    };
  }
  if (percentile >= 0.65) {
    return {
      before: "",
      mark: "non è il momento più idilliaco",
      after: " per consumare",
      color: PEAK,
    };
  }
  if (percentile >= 0.35) {
    return {
      before: "prezzi nella media, ",
      mark: "il medione",
      after: "",
      color: MID,
    };
  }
  if (percentile >= 0.1) {
    return {
      before: "",
      mark: "momento discreto",
      after: " per consumare",
      color: BANANA,
    };
  }
  if (percentile >= 0.05) {
    return {
      before: "tra i ",
      mark: "10% più convenienti",
      after: ": buon momento",
      color: BANANA,
    };
  }
  return {
    before: "tra i ",
    mark: "5% più convenienti",
    after: ": se puoi, consuma ora",
    color: BANANA,
  };
}

type NowLine = {
  hour: number;
  time: string;
  priceLabel: string;
  cheap: boolean;
  comment: ReturnType<typeof nowMomentComment>;
};

const NOW_BADGE =
  "mx-0.5 inline-flex translate-y-px items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 font-medium tabular-nums text-[#111111] dark:bg-neutral-800 dark:text-neutral-100";

function nowLineForDay(day: DayInsight, now: RomeNow | null): NowLine | null {
  if (!now || now.date !== day.deliveryDate || day.prices.length === 0) {
    return null;
  }

  const slot = currentSlotIndex(now.hour, now.minute, day.prices.length);
  const price = day.prices[slot];
  const percentile = expensivePercentile(day.prices, price);
  return {
    hour: now.hour + now.minute / 60,
    time: formatClock(now.hour, now.minute),
    priceLabel: formatEurocent(toEurocentPerKwh(price)),
    cheap: percentile < 0.5,
    comment: nowMomentComment(percentile),
  };
}

function PriceTips({
  best,
  worst,
  nowLine,
}: {
  best: string;
  worst: string;
  nowLine: NowLine | null;
}) {
  return (
    <div
      className="mt-4 space-y-1 text-left text-sm sm:text-base"
      aria-live="polite"
      aria-label="Consigli su quando consumare o evitare"
    >
      {nowLine ? (
        <p className="font-medium text-foreground">
          <span
            aria-hidden
            className="mr-2 inline-block h-[1em] w-[2px] translate-y-[0.12em] align-middle"
            style={{ backgroundColor: NOW }}
          />
          Sono le{" "}
          <span className={NOW_BADGE}>{nowLine.time}</span>{" "}
          <span className={NOW_BADGE}>prezzo a 
            <span aria-hidden>{nowLine.cheap ? "🍌" : "🐵"}</span>
            <span className="sr-only">
              {nowLine.cheap ? "prezzo conveniente " : "prezzo alto "}
            </span>
            {nowLine.priceLabel}
          </span>{" "}
          {nowLine.comment.before}
          {nowLine.comment.mark ? (
            <span
              className="underline decoration-2 underline-offset-2"
              style={{ textDecorationColor: nowLine.comment.color ?? undefined }}
            >
              {nowLine.comment.mark}
            </span>
          ) : null}
          {nowLine.comment.after}
        </p>
      ) : null}
      <p className="font-medium text-foreground">{best}</p>
      {worst ? (
        <p className="text-neutral-600 dark:text-neutral-400">{worst}</p>
      ) : null}
    </div>
  );
}

function DayStats({ prices }: { prices: number[] }) {
  const { min, avg, max } = dayHourlyCentStats(prices);
  const stats = [
    { label: "min", value: formatEurocent(min) },
    { label: "medio", value: formatEurocent(avg) },
    { label: "max", value: formatEurocent(max) },
  ] as const;

  return (
    <div className="mt-5" aria-label="Minimo, medio e massimo del giorno">
      <div className="grid grid-cols-3 gap-2">
        {stats.map((stat) => (
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
        c€/kWh all&apos;ingrosso
      </p>
    </div>
  );
}

function bananaToMonkeyPercent(price: number, min: number, max: number) {
  const span = max - min;
  if (span <= 0) return 50;
  return Math.round(Math.min(100, Math.max(0, ((price - min) / span) * 100)));
}

function pointerToHour(
  event: PointerEvent<SVGSVGElement>,
  chartW: number,
  pad: { t: number; r: number; b: number; l: number },
) {
  const rect = event.currentTarget.getBoundingClientRect();
  if (rect.width <= 0) return 0;
  const x = ((event.clientX - rect.left) / rect.width) * chartW;
  const innerW = chartW - pad.l - pad.r;
  return Math.min(24, Math.max(0, ((x - pad.l) / innerW) * 24));
}

function PriceChart({
  day,
  nowHour,
}: {
  day: DayInsight;
  nowHour?: number;
}) {
  const { chartW, chartH, pad, axisFontSize, unitFontSize } = useChartLayout();
  const [pickedHour, setPickedHour] = useState<number | null>(null);
  const hourly = useMemo(() => toHourlyAverages(day.prices), [day.prices]);
  const pricesCent = useMemo(
    () => hourly.map(toEurocentPerKwh),
    [hourly],
  );
  const scale = useMemo(() => yScale(pricesCent), [pricesCent]);
  const points = useMemo(
    () => toPoints(pricesCent, scale.min, scale.max, chartH, chartW, pad),
    [pricesCent, scale.min, scale.max, chartH, chartW, pad],
  );
  const line = useMemo(() => toSmoothPath(points), [points]);
  const samples = useMemo(
    () =>
      sampleSmoothCurve(points, scale.min, scale.max, chartW, pad, chartH),
    [points, scale.min, scale.max, chartW, pad, chartH],
  );
  const bananaMarks = useMemo(
    () =>
      day.cheapBands
        .map((band) => sampleNearestHour(samples, band.hour))
        .filter((mark): mark is CurveSample => mark !== null),
    [day.cheapBands, samples],
  );
  const monkeyMarks = useMemo(
    () =>
      day.peakBands
        .map((band) => sampleNearestHour(samples, band.hour))
        .filter((mark): mark is CurveSample => mark !== null),
    [day.peakBands, samples],
  );

  const innerH = chartH - pad.t - pad.b;
  const cheapFills = mergeQuarterBands(day.cheapBands);
  const peakFills = mergeQuarterBands(day.peakBands);
  const range = scale.max - scale.min || 1;
  const bananaHours = joinItalian(
    day.cheapBands.map((band) => formatTipHour(band.hour)),
  );
  const monkeyHours = joinItalian(
    day.peakBands.map((band) => formatTipHour(band.hour)),
  );

  const hourTicks = [0, 6, 12, 18, 24];
  const font = "var(--font-geist-sans), system-ui, sans-serif";
  const picked =
    pickedHour != null ? sampleNearestHour(samples, pickedHour) : null;
  const dayMinCent = Math.min(...pricesCent);
  const dayMaxCent = Math.max(...pricesCent);
  const pickedRank =
    picked != null
      ? bananaToMonkeyPercent(picked.price, dayMinCent, dayMaxCent)
      : null;

  return (
    <div className="relative" data-price-chart>
    <svg
      viewBox={`0 0 ${chartW} ${chartH}`}
      className="h-auto w-full cursor-crosshair touch-manipulation"
      role="img"
      aria-label={`Andamento orario del prezzo in centesimi di euro per kilowattora. Tocca o clicca un punto per vedere ora e prezzo.${
        nowHour != null
          ? ` L'ora attuale è alle ${formatTipHour(nowHour)}.`
          : ""
      } Momenti più convenienti alle ${bananaHours || "n.d."}, picchi da evitare alle ${monkeyHours || "n.d."}.`}
      onPointerDown={(event) => {
        if (event.pointerType === "mouse" && event.button !== 0) return;
        setPickedHour(pointerToHour(event, chartW, pad));
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

      {hourTicks.map((hour) => {
        const x = hourToX(hour, chartW, pad);
        return (
          <g key={hour}>
            <line
              x1={x}
              x2={x}
              y1={pad.t}
              y2={chartH - pad.b}
              stroke="#1f1f1f"
              strokeWidth="1"
            />
            <text
              x={x}
              y={chartH - 18}
              textAnchor="middle"
              fill="#f5f5f5"
              fontSize={axisFontSize}
              fontFamily={font}
              fontWeight="600"
            >
              {String(hour).padStart(2, "0")}
            </text>
          </g>
        );
      })}

      {cheapFills.map((band) => {
        const fromX = hourToX(band.start / QUARTERS_PER_HOUR, chartW, pad);
        const toX = hourToX((band.end + 1) / QUARTERS_PER_HOUR, chartW, pad);
        return (
          <rect
            key={`cheap-${band.start}-${band.end}`}
            x={fromX}
            y={pad.t}
            width={Math.max(toX - fromX, 8)}
            height={innerH}
            fill={BANANA}
            opacity="0.08"
          />
        );
      })}
      {peakFills.map((band) => {
        const fromX = hourToX(band.start / QUARTERS_PER_HOUR, chartW, pad);
        const toX = hourToX((band.end + 1) / QUARTERS_PER_HOUR, chartW, pad);
        return (
          <rect
            key={`peak-${band.start}-${band.end}`}
            x={fromX}
            y={pad.t}
            width={Math.max(toX - fromX, 8)}
            height={innerH}
            fill={PEAK}
            opacity="0.16"
          />
        );
      })}

      <path
        d={line}
        fill="none"
        stroke={BANANA}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {bananaMarks.map((mark) => (
        <text
          key={`banana-${mark.hour}`}
          x={mark.x}
          y={mark.y - 11}
          textAnchor="middle"
          fontSize={MARKER_FONT_SIZE}
        >
          🍌
        </text>
      ))}

      {monkeyMarks.map((mark) => (
        <text
          key={`monkey-${mark.hour}`}
          x={mark.x}
          y={mark.y - 11}
          textAnchor="middle"
          fontSize={MARKER_FONT_SIZE}
        >
          🐵
        </text>
      ))}

      {nowHour != null ? (
        <line
          x1={hourToX(nowHour, chartW, pad)}
          x2={hourToX(nowHour, chartW, pad)}
          y1={pad.t}
          y2={chartH - pad.b}
          stroke={NOW}
          strokeWidth="2"
          strokeLinecap="round"
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
          <line
            x1={pad.l}
            x2={chartW - pad.r}
            y1={picked.y}
            y2={picked.y}
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
      {picked && pickedRank != null ? (
        <button
          type="button"
          className="absolute top-2.5 right-2.5 z-10 flex items-center gap-2 rounded-md border border-white/15 bg-black/80 px-2.5 py-1.5 text-white shadow-sm"
          aria-label={`Chiudi lettura delle ${formatTipHour(picked.hour)}, ${formatEurocent(picked.price)}, ${pickedRank}%`}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => setPickedHour(null)}
        >
          <span className="text-xs font-semibold tabular-nums sm:text-sm">
            {formatTipHour(picked.hour)} · {formatEurocent(picked.price)} ·{" "}
            {pickedRank}% {pickedRank < 50 ? "🍌" : "🐵"}
          </span>
          <span aria-hidden className="text-sm leading-none text-white/70">
            ×
          </span>
        </button>
      ) : null}
    </div>
  );
}

function QuarterColumn({
  prices,
  offset,
  bananaSlots,
  monkeySlots,
  cheapBands,
  peakBands,
}: {
  prices: number[];
  offset: number;
  bananaSlots: Set<number>;
  monkeySlots: Set<number>;
  cheapBands: PriceBand[];
  peakBands: PriceBand[];
}) {
  return (
    <table className="w-full table-fixed border-collapse text-xs leading-tight sm:text-sm">
      <colgroup>
        <col className="w-[58%]" />
        <col className="w-[42%]" />
      </colgroup>
      <thead>
        <tr className="border-b border-neutral-200 text-left text-[11px] text-neutral-500 sm:text-xs dark:border-neutral-800 dark:text-neutral-400">
          <th scope="col" className="px-1.5 py-1.5 font-medium sm:px-2">
            Quarto
          </th>
          <th scope="col" className="px-1.5 py-1.5 text-right font-medium sm:px-2">
            c€/kWh
          </th>
        </tr>
      </thead>
      <tbody>
        {prices.map((price, i) => {
          const slot = offset + i;
          const cheap = slotInBands(slot, cheapBands);
          const peak = slotInBands(slot, peakBands);
          const cheapest = bananaSlots.has(slot);
          const peakiest = monkeySlots.has(slot);
          return (
            <tr
              key={slot}
              className={
                peak
                  ? "bg-red-500/15 dark:bg-red-500/20"
                  : cheap
                    ? "bg-[#F5D547]/20 dark:bg-[#F5D547]/15"
                    : "odd:bg-neutral-50 dark:odd:bg-neutral-950"
              }
            >
              <th
                scope="row"
                className={`truncate px-1.5 py-1 text-left font-normal tabular-nums sm:px-2 ${
                  peak
                    ? "text-red-700 dark:text-red-400"
                    : "text-neutral-600 dark:text-neutral-400"
                }`}
              >
                <span className="sr-only">{formatQuarterSlotFull(slot)}</span>
                <span aria-hidden>{formatQuarterSlot(slot)}</span>
              </th>
              <td
                className={`truncate px-1.5 py-1 text-right tabular-nums sm:px-2 ${
                  peak
                    ? "font-medium text-red-700 dark:text-red-400"
                    : cheapest
                      ? "font-medium text-foreground"
                      : "text-foreground"
                }`}
              >
                {cheapest ? (
                  <>
                    <span className="sr-only">minimo </span>
                    <span className="mr-0.5" aria-hidden>
                      🍌
                    </span>
                  </>
                ) : null}
                {peakiest ? (
                  <>
                    <span className="sr-only">picco </span>
                    <span className="mr-0.5" aria-hidden>
                      🐵
                    </span>
                  </>
                ) : peak ? (
                  <span className="sr-only">picco </span>
                ) : null}
                {formatEurocent(toEurocentPerKwh(price))}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function QuarterPriceTable({ day }: { day: DayInsight }) {
  const bananaSlots = cheapestSlotsInBands(day.prices, day.cheapBands);
  const monkeySlots = priciestSlotsInBands(day.prices, day.peakBands);
  const split = day.noonIndex > 0 && day.noonIndex < day.prices.length
    ? day.noonIndex
    : Math.floor(day.prices.length / 2);
  const columns = [
    { start: 0, end: split, label: "00–12" },
    { start: split, end: day.prices.length, label: "12–24" },
  ];

  return (
    <div className="mt-6">
      <h3 className="text-sm font-medium tracking-tight text-foreground">
        Prezzi ogni quarto d&apos;ora
      </h3>
      <div className="mt-2 min-w-0 overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-800">
        <div className="grid min-w-0 grid-cols-2">
          {columns.map((column, i) => (
            <div
              key={column.start}
              className={`min-w-0 overflow-hidden ${
                i === 1 ? "border-l border-neutral-200 dark:border-neutral-800" : ""
              }`}
            >
              <p className="border-b border-neutral-200 bg-neutral-50 px-2 py-1.5 text-center text-[11px] font-medium tabular-nums text-neutral-500 sm:text-xs dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
                {column.label}
              </p>
              <QuarterColumn
                prices={day.prices.slice(column.start, column.end)}
                offset={column.start}
                bananaSlots={bananaSlots}
                monkeySlots={monkeySlots}
                cheapBands={day.cheapBands}
                peakBands={day.peakBands}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SkeletonBone({
  className,
  chart = false,
}: {
  className: string;
  chart?: boolean;
}) {
  return (
    <div
      aria-hidden
      className={`insight-skeleton rounded-md ${chart ? "insight-skeleton-chart" : ""} ${className}`}
    />
  );
}

function InsightSkeleton() {
  const tableRows = Array.from({ length: 12 }, (_, i) => i);

  return (
    <div className="mt-3" aria-hidden>
      <div className="overflow-hidden rounded-lg border border-neutral-800 bg-[#111111]">
        <div className="relative h-90 w-full sm:h-65">
          <SkeletonBone chart className="absolute inset-0 rounded-none" />
          <div className="absolute inset-x-10 bottom-10 top-12 flex flex-col justify-between">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="h-px w-full bg-white/6" />
            ))}
          </div>
          <div className="absolute inset-x-[12%] top-[30%] h-[32%] overflow-hidden rounded-full opacity-40">
            <SkeletonBone chart className="h-full w-full rounded-full" />
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <SkeletonBone className="h-4 w-[min(100%,20rem)]" />
        <SkeletonBone className="h-4 w-[min(88%,16rem)]" />
      </div>

      <div className="mt-5">
        <div className="grid grid-cols-3 gap-2">
          {["min", "medio", "max"].map((label) => (
            <div key={label}>
              <p className="text-[11px] font-medium tracking-wider text-neutral-400 uppercase">
                {label}
              </p>
              <SkeletonBone className="mt-1 h-6 w-16" />
            </div>
          ))}
        </div>
        <SkeletonBone className="mt-1 h-3 w-28" />
      </div>

      <div className="mt-6">
        <SkeletonBone className="h-4 w-44" />
        <div className="mt-2 overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-800">
          <div className="grid grid-cols-2">
            {["00–12", "12–24"].map((label, column) => (
              <div
                key={label}
                className={
                  column === 1
                    ? "border-l border-neutral-200 dark:border-neutral-800"
                    : undefined
                }
              >
                <p className="border-b border-neutral-200 bg-neutral-50 px-2 py-1.5 text-center text-[11px] font-medium tabular-nums text-neutral-400 sm:text-xs dark:border-neutral-800 dark:bg-neutral-900">
                  {label}
                </p>
                <div className="space-y-2 px-2 py-2">
                  {tableRows.map((row) => (
                    <div key={row} className="flex items-center justify-between gap-3">
                      <SkeletonBone className="h-3 w-16" />
                      <SkeletonBone className="h-3 w-10" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function DailyInsight({
  initialRegion = DEFAULT_REGION,
  initialZone = "IT-North",
  initialDate,
  initialHome,
}: {
  initialRegion?: ItalianRegion;
  initialZone?: MarketZoneId;
  initialDate?: string;
  initialHome?: ZoneHomePayload;
} = {}) {
  const [region, setRegion] = useState(initialRegion);
  const [selectedDate, setSelectedDate] = useState<string | null>(() => {
    const dates = initialHome?.dates ?? [];
    if (initialDate && (dates.length === 0 || dates.includes(initialDate))) {
      return initialDate;
    }
    return initialHome?.date ?? pickDefaultDeliveryDate(dates);
  });
  const [homeByZone, setHomeByZone] = useState<
    Partial<Record<MarketZoneId, ZoneHomePayload>>
  >(() => (initialHome ? { [initialZone]: initialHome } : {}));
  const [slotsByKey, setSlotsByKey] = useState<Record<string, DayAheadRow[]>>(
    () => {
      if (!initialHome?.date || !initialHome.slots.length) return {};
      return { [`${initialHome.zone}:${initialHome.date}`]: initialHome.slots };
    },
  );
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [, startTransition] = useTransition();

  const zone = zoneForRegion(region);
  const zoneName = zoneNameForRegion(region);
  const home = zone ? homeByZone[zone] : undefined;
  const dates = home?.dates ?? [];
  const slotKey = zone && selectedDate ? `${zone}:${selectedDate}` : null;
  const selectedSlots = slotKey ? slotsByKey[slotKey] : undefined;
  const fetchingHome = Boolean(zone) && home === undefined && !error;
  const fetchingDay =
    Boolean(slotKey) &&
    selectedSlots === undefined &&
    !fetchingHome &&
    Boolean(home) &&
    !error;
  const fetching = fetchingHome || fetchingDay;

  useEffect(() => {
    if (!zone || home) return;

    let cancelled = false;
    setError(null);

    fetchZoneHome(zone, selectedDate ?? undefined)
      .then((payload) => {
        if (cancelled) return;
        setHomeByZone((prev) => ({ ...prev, [zone]: payload }));
        if (payload.date && payload.slots.length) {
          setSlotsByKey((prev) => ({
            ...prev,
            [`${payload.zone}:${payload.date}`]: payload.slots,
          }));
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Caricamento fallito");
      });

    return () => {
      cancelled = true;
    };
  }, [zone, home, selectedDate]);

  useEffect(() => {
    if (!zone || !selectedDate || selectedSlots || !home) return;
    if (!home.dates.includes(selectedDate)) return;

    let cancelled = false;
    fetchZoneSlots(zone, selectedDate, selectedDate)
      .then((rows) => {
        if (cancelled) return;
        setSlotsByKey((prev) => ({
          ...prev,
          [`${zone}:${selectedDate}`]: rows,
        }));
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Caricamento fallito");
      });

    return () => {
      cancelled = true;
    };
  }, [zone, selectedDate, selectedSlots, home]);

  useEffect(() => {
    if (!isRefreshing) return;
    if (fetching) return;
    const id = window.setTimeout(() => setIsRefreshing(false), 180);
    return () => window.clearTimeout(id);
  }, [isRefreshing, fetching, selectedDate, region]);

  useEffect(() => {
    if (dates.length === 0) return;
    setSelectedDate((current) => {
      if (current && dates.includes(current)) return current;
      return home?.date ?? pickDefaultDeliveryDate(dates);
    });
  }, [dates, home?.date]);

  const selected = useMemo(() => {
    const grouped = groupZoneDays(selectedSlots ?? []);
    return grouped.find((day) => day.deliveryDate === selectedDate) ?? grouped[0];
  }, [selectedSlots, selectedDate]);
  const day = useMemo(
    () => (selected ? buildDayInsight(selected) : null),
    [selected],
  );
  const dateIndex = selectedDate ? dates.indexOf(selectedDate) : 0;
  const isOldest = dateIndex < 0 || dateIndex === dates.length - 1;
  const isNewest = dateIndex <= 0;
  const today = romeToday();
  const now = useRomeNow();
  const nowLine = day ? nowLineForDay(day, now) : null;
  const showSkeleton = fetching || isRefreshing;
  const dateLabel = day
    ? formatDeliveryDate(day.deliveryDate, today)
    : selectedDate
      ? formatDeliveryDate(selectedDate, today)
      : "Prezzi";

  function goToDate(date: string) {
    setIsRefreshing(true);
    startTransition(() => setSelectedDate(date));
  }

  function handleRegionChange(next: string) {
    if (next === region) return;
    if (zoneForRegion(next) !== zone) setIsRefreshing(true);
    startTransition(() => setRegion(next as ItalianRegion));
    persistRegionPref(next);
  }

  const selectedDateRef = useRef(selectedDate);
  selectedDateRef.current = selectedDate;

  useEffect(() => {
    function onShowTodayPrices() {
      const today = romeToday();
      if (selectedDateRef.current === today) return;
      setIsRefreshing(true);
      startTransition(() => setSelectedDate(today));
    }

    window.addEventListener(SHOW_TODAY_PRICES_EVENT, onShowTodayPrices);
    return () => {
      window.removeEventListener(SHOW_TODAY_PRICES_EVENT, onShowTodayPrices);
    };
  }, []);

  useEffect(() => {
    const url = new URL(window.location.href);
    const search = url.searchParams;
    const fromUrl = regionFromParam(search.get(REGION_QUERY_PARAM) ?? undefined);
    if (fromUrl) {
      persistRegionPref(fromUrl);
    } else {
      const stored = readRegionPref();
      if (stored && stored !== initialRegion) {
        if (zoneForRegion(stored) !== initialZone) setIsRefreshing(true);
        startTransition(() => setRegion(stored));
        persistRegionPref(stored);
      }
    }

    const fromDate = dateFromParam(search.get(DATE_QUERY_PARAM) ?? undefined);
    if (fromDate && fromDate !== selectedDateRef.current) {
      startTransition(() => setSelectedDate(fromDate));
    }

    const hash = url.hash.replace(/^#/, "");
    const hadRegionParam = search.has(REGION_QUERY_PARAM);
    const hadDateParam = search.has(DATE_QUERY_PARAM);
    const hasDeepLink =
      hash === PRICES_SECTION_ID || hadRegionParam || hadDateParam;
    if (hasDeepLink) {
      document.getElementById(PRICES_SECTION_ID)?.scrollIntoView();
    }

    if (!hadRegionParam && !hadDateParam) return;
    search.delete(REGION_QUERY_PARAM);
    search.delete(DATE_QUERY_PARAM);
    const nextSearch = search.toString();
    const next = `${url.pathname}${nextSearch ? `?${nextSearch}` : ""}${url.hash}`;
    window.history.replaceState(window.history.state, "", next);
  }, [initialRegion, initialZone]);

  return (
    <section
      id={PRICES_SECTION_ID}
      aria-labelledby="daily-insight-heading"
      aria-busy={showSkeleton}
      className="w-full scroll-mt-20"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2
          id="daily-insight-heading"
          className="text-lg font-medium tracking-tight text-foreground sm:text-xl"
        >
          I prezzi all&apos;ingrosso nella tua zona
        </h2>
        <ShareButton
          getUrl={() => pricesShareUrl(window.location.origin, region)}
          title={`kilowatt e banane🍌🍌🍌 — prezzi in ${region}`}
          text={`I prezzi dell'energia all'ingrosso in ${region}. Guarda quando conviene consumare.`}
          ariaLabel={`Condividi i prezzi in ${region}`}
        />
      </div>
      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
        Scegli il giorno e la regione: grafico e tabella ti dicono quando
        conviene consumare.
        {selectedDate ? (
          <>
            {" "}
            <Link
              href={`/prezzi/${selectedDate}`}
              className="underline decoration-neutral-300 underline-offset-2 transition-colors hover:text-foreground hover:decoration-neutral-500 dark:decoration-neutral-600 dark:hover:decoration-neutral-400"
            >
              Pagina del giorno
            </Link>
          </>
        ) : null}
      </p>

      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <div className="flex min-w-0 items-center gap-1.5 sm:flex-1 sm:gap-2">
          <button
            type="button"
            onClick={() => {
              const next = dates[dateIndex + 1];
              if (next) goToDate(next);
            }}
            disabled={isOldest || dates.length === 0 || fetching}
            aria-label="Giorno precedente"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-neutral-200 text-2xl leading-none text-neutral-700 transition-colors hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-30 sm:h-8 sm:w-8 sm:text-lg dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-900"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => {
              const next = dates[dateIndex - 1];
              if (next) goToDate(next);
            }}
            disabled={isNewest || dates.length === 0 || fetching}
            aria-label="Giorno successivo"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-neutral-200 text-2xl leading-none text-neutral-700 transition-colors hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-30 sm:h-8 sm:w-8 sm:text-lg dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-900"
          >
            ›
          </button>
          <p
            className="min-w-0 truncate text-sm font-medium capitalize tracking-tight text-foreground sm:text-base"
            aria-live="polite"
          >
            {dateLabel}
          </p>
        </div>

        <div className="w-full sm:w-auto sm:shrink-0">
          <RegionSelect
            value={region}
            onChange={handleRegionChange}
            variant="banana"
            compact
            hideLabel
            align="right"
          />
        </div>
      </div>

      {zoneName ? (
        <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
          Zona di mercato:
          <span className="inline-flex items-center rounded-full bg-[#F5D547] px-2 py-0.5 font-medium text-[#111111]">
            {zoneName}
          </span>
        </p>
      ) : null}

      {error ? (
        <p className="mt-4 text-sm text-red-600 dark:text-red-400">
          Non riesco a caricare i prezzi. Riprova tra poco.
        </p>
      ) : showSkeleton ? (
        <>
          <span className="sr-only">Carico i prezzi della zona…</span>
          <InsightSkeleton />
        </>
      ) : !day || day.prices.length === 0 ? (
        <p className="mt-4 text-sm text-neutral-500 dark:text-neutral-400">
          Ancora nessun prezzo per questa zona.
        </p>
      ) : (
        <>
          <div
            key={`${zone}-${day.deliveryDate}`}
            className="insight-content-in"
          >
            <div className="mt-3 overflow-hidden rounded-lg border border-neutral-800 bg-[#111111]">
              <PriceChart day={day} nowHour={nowLine?.hour} />
            </div>
            <PriceTips best={day.bestTip} worst={day.worstTip} nowLine={nowLine} />
            <DayStats prices={day.prices} />
            <QuarterPriceTable day={day} />
          </div>
          {home ? (
            <>
              <LookbackInsight points={home.points} hourly={home.hourly} />
              <HourlyProfileInsight hourly={home.hourly} />
              <LoadShiftSim hourly={home.hourly} />
            </>
          ) : null}
        </>
      )}
    </section>
  );
}
