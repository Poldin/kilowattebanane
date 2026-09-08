"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type PointerEvent,
} from "react";
import { ChartLayerToggles } from "@/components/ChartLayerToggles";
import { RegionZoneBar } from "@/components/RegionZoneBar";
import { TariffSelect } from "@/components/TariffSelect";
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
import { SignupSlot } from "@/components/SignupForm";
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
  type ItalianRegion,
  type MarketZoneId,
} from "@/lib/market-zones";
import { persistRegionPref, readRegionPref } from "@/lib/region-pref";
import { persistTariffPref, readTariffPref, TARIFF_PREF_EVENT } from "@/lib/tariff-pref";
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
  toLinearPath,
  yScale,
} from "@/lib/insights";
import {
  DEFAULT_TARIFF_PLAN,
  cheapPeakForTariff,
  fasciaAveragesFromQuarters,
  fasciaF23Bands,
  fasciaHourBands,
  fasciaRangeLabel,
  FASCIA_COLOR,
  FASCIA_LEGEND_COLOR,
  layersForTariff,
  visibleFasciaStatsFromLayers,
  type ChartLayers,
  type FasciaId,
  type FasciaStatId,
  type TariffPlanId,
} from "@/lib/fasce";
import { computeTariffTips, fasciaNowBadgeLabel, tariffNowAdvice } from "@/lib/tariff-tips";

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
const PAD_MOBILE = { t: 40, r: 16, b: 56, l: 45 };

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

const TIP_TONE_COLOR = {
  cheap: BANANA,
  peak: PEAK,
  mid: MID,
} as const;

type NowLine = {
  hour: number;
  time: string;
  priceLabel: string;
  fruit: "🍌" | "🐵" | null;
  fasciaId: FasciaStatId | null;
  comment: {
    before: string;
    mark: string;
    after: string;
    color: string;
  };
};

const NOW_BADGE =
  "mx-0.5 inline-flex translate-y-px items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 font-medium tabular-nums text-[#111111] dark:bg-neutral-800 dark:text-neutral-100";

function nowLineForDay(
  day: DayInsight,
  now: RomeNow | null,
  tariff: TariffPlanId,
): NowLine | null {
  if (!now || now.date !== day.deliveryDate || day.prices.length === 0) {
    return null;
  }

  const slot = currentSlotIndex(now.hour, now.minute, day.prices.length);
  const price = day.prices[slot];
  const percentile = expensivePercentile(day.prices, price);
  const avgs = fasciaAveragesFromQuarters(day.deliveryDate, day.prices);
  const advice = tariffNowAdvice(
    day.deliveryDate,
    now.hour,
    tariff,
    percentile,
    avgs,
  );
  return {
    hour: now.hour + now.minute / 60,
    time: formatClock(now.hour, now.minute),
    priceLabel: formatEurocent(toEurocentPerKwh(price)),
    fruit: advice.fruit,
    fasciaId: advice.fasciaId,
    comment: {
      before: advice.before,
      mark: advice.mark,
      after: advice.after,
      color: TIP_TONE_COLOR[advice.tone],
    },
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
          {nowLine.fasciaId ? (
            <>
              e sei in fascia{" "}
              <span className={NOW_BADGE}>
                {nowLine.fruit ? <span aria-hidden>{nowLine.fruit}</span> : null}
                <span className="sr-only">
                  {nowLine.fruit === "🍌"
                    ? "fascia conveniente "
                    : nowLine.fruit === "🐵"
                      ? "fascia cara "
                      : ""}
                </span>
                {fasciaNowBadgeLabel(nowLine.fasciaId)}
              </span>
            </>
          ) : (
            <span className={NOW_BADGE}>
              prezzo a{" "}
              {nowLine.fruit ? <span aria-hidden>{nowLine.fruit}</span> : null}
              <span className="sr-only">
                {nowLine.fruit === "🍌"
                  ? "prezzo conveniente "
                  : nowLine.fruit === "🐵"
                    ? "prezzo alto "
                    : ""}
              </span>
              {nowLine.priceLabel}
            </span>
          )}{" "}
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

const FASCIA_STATS: { id: FasciaStatId; label: string }[] = [
  { id: "F1", label: "F1" },
  { id: "F2", label: "F2" },
  { id: "F3", label: "F3" },
  { id: "F23", label: "F23" },
  { id: "Fmonoraria", label: "Fmonoraria" },
];

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

function StatHint({ children }: { children: string }) {
  return (
    <p className="mt-0.5 text-[11px] leading-tight tabular-nums text-neutral-400 dark:text-neutral-500">
      {children}
    </p>
  );
}

function DayStats({
  date,
  prices,
  tariff,
}: {
  date: string;
  prices: number[];
  tariff: TariffPlanId;
}) {
  const { min, avg, max, minHours, maxHours } = dayHourlyCentStats(prices);
  const fasce = fasciaAveragesFromQuarters(date, prices);
  const fasciaMarks = cheapPeakForTariff(tariff, fasce);
  const stats = [
    { label: "min", value: formatEurocent(min), hint: minHours },
    { label: "medio", value: formatEurocent(avg), hint: "0–24" },
    { label: "max", value: formatEurocent(max), hint: maxHours },
  ] as const;

  return (
    <div className="mt-5" aria-label="Minimo, medio, massimo e medie di fascia del giorno">
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {FASCIA_STATS.map((stat) => {
          const range = fasciaRangeLabel(date, stat.id);
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
                {formatFasciaValue(fasce[stat.id])}
              </p>
              {range ? <StatHint>{range}</StatHint> : null}
            </div>
          );
        })}
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {stats.map((stat) => (
          <div key={stat.label}>
            <p className="text-[11px] font-medium tracking-wider text-neutral-500 uppercase">
              {stat.label}
            </p>
            <p className="text-xl font-semibold tabular-nums tracking-tight text-foreground">
              {stat.value}
            </p>
            {stat.hint ? <StatHint>{stat.hint}</StatHint> : null}
          </div>
        ))}
      </div>
      <p className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">
        c€/kWh all&apos;ingrosso
      </p>
    </div>
  );
}

function FasciaBandMark({
  bandId,
  fromX,
  toX,
  labelY,
  width,
  color,
  cheapId,
  peakId,
}: {
  bandId: FasciaId | "F23";
  fromX: number;
  toX: number;
  labelY: number;
  width: number;
  color: string;
  cheapId: FasciaStatId | null;
  peakId: FasciaStatId | null;
}) {
  const mark =
    cheapId === bandId ? "🍌" : peakId === bandId ? "🐵" : null;
  const centerX = (fromX + toX) / 2;
  const emojiY = labelY - 24;

  if (width >= 28) {
    return (
      <>
        {mark ? (
          <text
            x={centerX}
            y={emojiY}
            textAnchor="middle"
            fontSize={MARKER_FONT_SIZE}
          >
            {mark}
          </text>
        ) : null}
        <text
          x={centerX}
          y={labelY}
          textAnchor="middle"
          fill={color}
          fontSize={11}
          fontFamily="var(--font-geist-sans), system-ui, sans-serif"
          fontWeight="700"
        >
          {bandId}
        </text>
      </>
    );
  }

  if (!mark) return null;

  return (
    <text
      x={centerX}
      y={labelY}
      textAnchor="middle"
      fontSize={width < 18 ? 14 : MARKER_FONT_SIZE}
    >
      {mark}
    </text>
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
  layers,
  onLayersChange,
  tariff = DEFAULT_TARIFF_PLAN,
}: {
  day: DayInsight;
  nowHour?: number;
  layers?: ChartLayers;
  onLayersChange?: (next: ChartLayers) => void;
  tariff?: TariffPlanId;
}) {
  const { chartW, chartH, pad, axisFontSize, unitFontSize } = useChartLayout();
  const [pickedHour, setPickedHour] = useState<number | null>(null);
  const resolvedLayers = layers ?? layersForTariff(DEFAULT_TARIFF_PLAN);
  const showLine = resolvedLayers.line;
  const showMono = resolvedLayers.mono;
  const showF23 = resolvedLayers.f23;
  const showAnyFascia = resolvedLayers.f1 || resolvedLayers.f2 || resolvedLayers.f3;
  const fasciaOn: Record<FasciaId, boolean> = {
    F1: resolvedLayers.f1,
    F2: resolvedLayers.f2,
    F3: resolvedLayers.f3,
  };

  const hourly = useMemo(() => toHourlyAverages(day.prices), [day.prices]);
  const fasciaBands = useMemo(
    () => fasciaHourBands(day.deliveryDate),
    [day.deliveryDate],
  );
  const f23Bands = useMemo(
    () => fasciaF23Bands(day.deliveryDate),
    [day.deliveryDate],
  );
  const fasciaAvgs = useMemo(
    () => fasciaAveragesFromQuarters(day.deliveryDate, day.prices),
    [day.deliveryDate, day.prices],
  );
  const visibleFasciaStats = useMemo(
    () => visibleFasciaStatsFromLayers(resolvedLayers),
    [resolvedLayers],
  );
  const fasciaMarks = useMemo(
    () => cheapPeakForTariff(tariff, fasciaAvgs, visibleFasciaStats),
    [tariff, fasciaAvgs, visibleFasciaStats],
  );
  const pricesCent = useMemo(
    () => hourly.map(toEurocentPerKwh),
    [hourly],
  );
  const scale = useMemo(() => yScale(pricesCent), [pricesCent]);
  const points = useMemo(
    () => toPoints(pricesCent, scale.min, scale.max, chartH, chartW, pad),
    [pricesCent, scale.min, scale.max, chartH, chartW, pad],
  );
  const line = useMemo(() => toLinearPath(points), [points]);
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
  const plotBottom = pad.t + innerH;
  const monoPrice = fasciaAvgs.Fmonoraria;
  const monoY =
    monoPrice != null && Number.isFinite(monoPrice)
      ? Math.min(
          plotBottom,
          Math.max(
            pad.t,
            pad.t + (1 - (monoPrice - scale.min) / range) * innerH,
          ),
        )
      : null;
  const monoFromX = hourToX(0, chartW, pad);
  const monoToX = hourToX(24, chartW, pad);

  return (
    <div className="mt-3" data-price-chart>
      <ChartLayerToggles
        layers={resolvedLayers}
        onChange={(next) => {
          if (next.line !== resolvedLayers.line) setPickedHour(null);
          onLayersChange?.(next);
        }}
      />
      <div className="relative overflow-hidden rounded-lg border border-neutral-800 bg-[#111111]">
        <svg
      viewBox={`0 0 ${chartW} ${chartH}`}
      className={`h-auto w-full touch-manipulation ${showLine ? "cursor-crosshair" : ""}`}
      role="img"
      aria-label={`Andamento orario del prezzo in centesimi di euro per kilowattora. Tocca o clicca un punto per vedere ora e prezzo.${
        nowHour != null
          ? ` L'ora attuale è alle ${formatTipHour(nowHour)}.`
          : ""
      } Momenti più convenienti alle ${bananaHours || "n.d."}, picchi da evitare alle ${monkeyHours || "n.d."}.${
        showAnyFascia ? " Fasce F1, F2 e F3 visibili sul grafico." : ""
      }${showF23 ? " F23 visibile." : ""}${showMono ? " Fmonoraria visibile." : ""}${showLine ? "" : " Linea del prezzo nascosta."}`}
      onPointerDown={(event) => {
        if (!showLine) return;
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
              <tspan
                fontSize={Math.round(axisFontSize * 0.6)}
                fontWeight="500"
                fill="#a3a3a3"
              >
                :00
              </tspan>
            </text>
          </g>
        );
      })}

      {showLine
        ? cheapFills.map((band) => {
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
          })
        : null}
      {showLine
        ? peakFills.map((band) => {
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
          })
        : null}

      {fasciaBands.map((band) => {
            if (!fasciaOn[band.id]) return null;
            const price = fasciaAvgs[band.id];
            if (price == null || !Number.isFinite(price)) return null;
            const fromX = hourToX(band.start, chartW, pad);
            const toX = hourToX(band.end, chartW, pad);
            const width = Math.max(toX - fromX, 0);
            const plotBottom = pad.t + innerH;
            const yTop = Math.min(
              plotBottom,
              Math.max(
                pad.t,
                pad.t + (1 - (price - scale.min) / range) * innerH,
              ),
            );
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
                <FasciaBandMark
                  bandId={band.id}
                  fromX={fromX}
                  toX={toX}
                  labelY={labelY}
                  width={width}
                  color={color}
                  cheapId={fasciaMarks.cheap}
                  peakId={fasciaMarks.peak}
                />
              </g>
            );
          })}

      {showF23
        ? f23Bands.map((band) => {
            const price = fasciaAvgs.F23;
            if (price == null || !Number.isFinite(price)) return null;
            const fromX = hourToX(band.start, chartW, pad);
            const toX = hourToX(band.end, chartW, pad);
            const width = Math.max(toX - fromX, 0);
            const yTop = Math.min(
              plotBottom,
              Math.max(
                pad.t,
                pad.t + (1 - (price - scale.min) / range) * innerH,
              ),
            );
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
                  fillOpacity={resolvedLayers.f2 || resolvedLayers.f3 ? 0.16 : 0.28}
                  stroke={color}
                  strokeWidth="2"
                  shapeRendering="crispEdges"
                />
                <FasciaBandMark
                  bandId="F23"
                  fromX={fromX}
                  toX={toX}
                  labelY={labelY}
                  width={width}
                  color={color}
                  cheapId={fasciaMarks.cheap}
                  peakId={fasciaMarks.peak}
                />
              </g>
            );
          })
        : null}

      {showMono && monoY != null ? (
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

      {showLine ? (
        <>
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
        </>
      ) : null}

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

      {showLine && picked ? (
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
        {showLine && picked && pickedRank != null ? (
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
      <div className="mb-1.5 flex justify-end gap-1.5">
        <SkeletonBone className="h-8 w-8" />
        <SkeletonBone className="h-8 w-8" />
        <SkeletonBone className="h-8 w-8" />
        <SkeletonBone className="h-8 w-8" />
      </div>
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
              <SkeletonBone className="mt-1 h-3 w-10" />
            </div>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-5">
          {["F1", "F2", "F3", "F23", "Fmonoraria"].map((label) => (
            <div key={label}>
              <p className="text-[11px] font-medium tracking-wide text-neutral-400 uppercase">
                {label}
              </p>
              <SkeletonBone className="mt-1 h-6 w-16" />
              <SkeletonBone className="mt-1 h-3 w-12" />
            </div>
          ))}
        </div>
        <SkeletonBone className="mt-1 h-3 w-52" />
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
  const [tariff, setTariff] = useState<TariffPlanId>(DEFAULT_TARIFF_PLAN);
  const [layers, setLayers] = useState<ChartLayers>(() =>
    layersForTariff(DEFAULT_TARIFF_PLAN),
  );
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
  const tips = useMemo(
    () =>
      day
        ? computeTariffTips(day.prices, day.deliveryDate, tariff)
        : { bestTip: "", worstTip: "" },
    [day, tariff],
  );
  const dateIndex = selectedDate ? dates.indexOf(selectedDate) : 0;
  const isOldest = dateIndex < 0 || dateIndex === dates.length - 1;
  const isNewest = dateIndex <= 0;
  const today = romeToday();
  const now = useRomeNow();
  const nowLine = day ? nowLineForDay(day, now, tariff) : null;
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

  function handleTariffChange(next: TariffPlanId) {
    setTariff(next);
    setLayers(layersForTariff(next));
    persistTariffPref(next);
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
    function onTariffPref(event: Event) {
      const next = (event as CustomEvent<TariffPlanId>).detail;
      if (!next) return;
      setTariff(next);
      setLayers(layersForTariff(next));
    }

    window.addEventListener(TARIFF_PREF_EVENT, onTariffPref);
    return () => window.removeEventListener(TARIFF_PREF_EVENT, onTariffPref);
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

    const storedTariff = readTariffPref();
    if (storedTariff) {
      setTariff(storedTariff);
      setLayers(layersForTariff(storedTariff));
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
          I prezzi dell&apos;energia nella tua zona
        </h2>
        <span className="hidden sm:contents">
          <ShareButton
            getUrl={() => pricesShareUrl(window.location.origin, region)}
            title={`kilowatt e banane🍌🍌🍌 prezzi in ${region}`}
            text={`I prezzi dell'energia all'ingrosso in ${region}. Guarda quando conviene consumare.`}
            ariaLabel={`Condividi i prezzi in ${region}`}
          />
        </span>
      </div>
      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
        Scegli giorno, regione e piano tariffario
        {dates.includes(today) ? (
          <>
            {" "}
            <button
              type="button"
              onClick={() => {
                if (selectedDate !== today) goToDate(today);
              }}
              className="underline decoration-neutral-300 underline-offset-2 transition-colors hover:text-foreground hover:decoration-neutral-500 dark:decoration-neutral-600 dark:hover:decoration-neutral-400"
            >
              Vedi il grafico di oggi
            </button>
          </>
        ) : null}
      </p>

      <RegionZoneBar
        region={region}
        onRegionChange={handleRegionChange}
        className="mt-5"
        afterSelect={
          <TariffSelect value={tariff} onChange={handleTariffChange} />
        }
      >
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
      </RegionZoneBar>

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
            <PriceChart
              day={day}
              nowHour={nowLine?.hour}
              layers={layers}
              onLayersChange={setLayers}
              tariff={tariff}
            />
            <PriceTips
              best={tips.bestTip}
              worst={tips.worstTip}
              nowLine={nowLine}
            />
            <DayStats date={day.deliveryDate} prices={day.prices} tariff={tariff} />
            <SignupSlot className="mt-6 w-full scroll-mt-20" />
            <QuarterPriceTable day={day} />
          </div>
          {home ? (
            <>
              <LookbackInsight
                points={home.points}
                hourly={home.hourly}
                region={region}
                onRegionChange={handleRegionChange}
                tariff={tariff}
              />
              <HourlyProfileInsight
                hourly={home.hourly}
                region={region}
                onRegionChange={handleRegionChange}
              />
              <LoadShiftSim
                hourly={home.hourly}
                region={region}
                onRegionChange={handleRegionChange}
              />
            </>
          ) : null}
        </>
      )}
    </section>
  );
}
