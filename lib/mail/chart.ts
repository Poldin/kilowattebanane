import { QUARTERS_PER_HOUR, toHourlyAverages } from "@/lib/prices";
import {
  computeRecommendations,
  formatEurocent,
  hourToX,
  mergeQuarterBands,
  sampleNearestHour,
  sampleSmoothCurve,
  toEurocentPerKwh,
  toPoints,
  toSmoothPath,
  yScale,
  type CurveSample,
} from "@/lib/insights";
import {
  cheapPeakForTariff,
  fasciaAveragesFromQuarters,
  fasciaBadgeLabel,
  fasciaF23Bands,
  fasciaHourBands,
  FASCIA_COLOR,
  FASCIA_LEGEND_COLOR,
  layersForTariff,
  MAIL_DEFAULT_TARIFF_PLAN,
  type FasciaId,
  type FasciaStatId,
  type TariffPlanId,
} from "@/lib/fasce";
import { resolveMailTariff } from "@/lib/tariff-pref";

export const MAIL_CHART_W = 1120;
export const MAIL_CHART_H = 520;
export const MAIL_CHART_DISPLAY_W = 512;
export const MAIL_CHART_DISPLAY_H = Math.round(
  (MAIL_CHART_DISPLAY_W * MAIL_CHART_H) / MAIL_CHART_W,
);
export const MAIL_CHART_PAD = { t: 56, r: 40, b: 76, l: 100 };

export type MailChartFasciaRect = {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  fillOpacity: number;
  label: string;
  mark: string | null;
  annotX: number;
  annotY: number;
};

export type MailChartLayout = {
  width: number;
  height: number;
  showLine: boolean;
  path: string;
  yTicks: { y: number; label: string }[];
  xTicks: { x: number; y: number; label: string }[];
  hLines: { y: number; x1: number; x2: number }[];
  vLines: { x: number; y1: number; y2: number }[];
  cheapRects: { x: number; y: number; width: number; height: number }[];
  peakRects: { x: number; y: number; width: number; height: number }[];
  bananas: { x: number; y: number }[];
  monkeys: { x: number; y: number }[];
  fasciaRects: MailChartFasciaRect[];
  mono: {
    x: number;
    y: number;
    width: number;
    height: number;
    color: string;
    labelX: number;
    labelY: number;
  } | null;
  unit: { x: number; y: number; label: string };
};

function fasciaBar(
  startHour: number,
  endHour: number,
  price: number,
  scaleMin: number,
  scaleMax: number,
  color: string,
  fillOpacity: number,
  label: string,
  mark: string | null,
): MailChartFasciaRect | null {
  const pad = MAIL_CHART_PAD;
  const innerH = MAIL_CHART_H - pad.t - pad.b;
  const range = scaleMax - scaleMin || 1;
  const fromX = hourToX(startHour, MAIL_CHART_W, pad);
  const toX = hourToX(endHour, MAIL_CHART_W, pad);
  const width = Math.max(toX - fromX, 0);
  const plotBottom = pad.t + innerH;
  const yTop = Math.min(
    plotBottom,
    Math.max(pad.t, pad.t + (1 - (price - scaleMin) / range) * innerH),
  );
  const height = plotBottom - yTop;
  if (width <= 0 || height <= 0) return null;

  const centerX = (fromX + toX) / 2;
  const showLabel = width >= 50;
  const markH = mark ? 36 : 0;
  const labelH = showLabel ? 22 : 0;
  const stackGap = mark && showLabel ? 6 : 0;
  const columnH = markH + stackGap + labelH;
  const annotY =
    yTop - columnH - 8 >= pad.t ? yTop - columnH - 8 : yTop + 8;

  return {
    x: fromX,
    y: yTop,
    width,
    height,
    color,
    fillOpacity,
    label: showLabel ? label : "",
    mark,
    annotX: centerX,
    annotY,
  };
}

export function buildMailChartLayout(
  pricesEuroPerMwh: number[],
  deliveryDate: string,
  tariff: TariffPlanId = MAIL_DEFAULT_TARIFF_PLAN,
): MailChartLayout {
  const resolved = resolveMailTariff(tariff);
  const layers = layersForTariff(resolved);
  const rec = computeRecommendations(pricesEuroPerMwh);
  const hourly = toHourlyAverages(pricesEuroPerMwh);
  const pricesCent = hourly.map(toEurocentPerKwh);
  const scale = yScale(pricesCent);
  const points = toPoints(
    pricesCent,
    scale.min,
    scale.max,
    MAIL_CHART_H,
    MAIL_CHART_W,
    MAIL_CHART_PAD,
  );
  const path = toSmoothPath(points);
  const samples = sampleSmoothCurve(
    points,
    scale.min,
    scale.max,
    MAIL_CHART_W,
    MAIL_CHART_PAD,
    MAIL_CHART_H,
  );
  const innerH = MAIL_CHART_H - MAIL_CHART_PAD.t - MAIL_CHART_PAD.b;
  const range = scale.max - scale.min || 1;
  const pad = MAIL_CHART_PAD;
  const avgs = fasciaAveragesFromQuarters(deliveryDate, pricesEuroPerMwh);
  const visibleIds: FasciaStatId[] = [];
  if (layers.f23) visibleIds.push("F23");
  if (layers.f1) visibleIds.push("F1");
  if (layers.f2) visibleIds.push("F2");
  if (layers.f3) visibleIds.push("F3");
  const fasciaMarks = cheapPeakForTariff(resolved, avgs, visibleIds);
  const markFor = (id: FasciaStatId) =>
    fasciaMarks.cheap === id ? "🍌" : fasciaMarks.peak === id ? "🐵" : null;

  const fasciaRects: MailChartFasciaRect[] = [];
  if (layers.f1 || layers.f2 || layers.f3) {
    const fasciaOn: Record<FasciaId, boolean> = {
      F1: layers.f1,
      F2: layers.f2,
      F3: layers.f3,
    };
    for (const band of fasciaHourBands(deliveryDate)) {
      if (!fasciaOn[band.id]) continue;
      const price = avgs[band.id];
      if (price == null || !Number.isFinite(price)) continue;
      const rect = fasciaBar(
        band.start,
        band.end,
        price,
        scale.min,
        scale.max,
        FASCIA_COLOR[band.id],
        0.28,
        fasciaBadgeLabel(band.id),
        markFor(band.id),
      );
      if (rect) fasciaRects.push(rect);
    }
  }

  if (layers.f23) {
    const price = avgs.F23;
    if (price != null && Number.isFinite(price)) {
      const overlap = layers.f2 || layers.f3;
      for (const band of fasciaF23Bands(deliveryDate)) {
        const rect = fasciaBar(
          band.start,
          band.end,
          price,
          scale.min,
          scale.max,
          FASCIA_LEGEND_COLOR.F23,
          overlap ? 0.16 : 0.28,
          fasciaBadgeLabel("F23"),
          markFor("F23"),
        );
        if (rect) fasciaRects.push(rect);
      }
    }
  }

  const monoPrice = avgs.Fmonoraria;
  const plotBottom = pad.t + innerH;
  const monoY =
    layers.mono && monoPrice != null && Number.isFinite(monoPrice)
      ? Math.min(
          plotBottom,
          Math.max(
            pad.t,
            pad.t + (1 - (monoPrice - scale.min) / range) * innerH,
          ),
        )
      : null;
  const monoFromX = hourToX(0, MAIL_CHART_W, pad);
  const monoToX = hourToX(24, MAIL_CHART_W, pad);

  const marks = (hours: { hour: number }[]) =>
    hours
      .map((band) => sampleNearestHour(samples, band.hour))
      .filter((mark): mark is CurveSample => mark !== null);

  return {
    width: MAIL_CHART_W,
    height: MAIL_CHART_H,
    showLine: layers.line,
    path,
    unit: { x: pad.l, y: 18, label: "c€/kWh" },
    yTicks: scale.ticks.map((tick) => ({
      y: pad.t + (1 - (tick - scale.min) / range) * innerH,
      label: formatEurocent(tick, scale.tickDigits),
    })),
    xTicks: [0, 6, 12, 18, 24].map((hour) => ({
      x: hourToX(hour, MAIL_CHART_W, pad),
      y: MAIL_CHART_H - 52,
      label: String(hour).padStart(2, "0"),
    })),
    hLines: scale.ticks.map((tick) => {
      const y = pad.t + (1 - (tick - scale.min) / range) * innerH;
      return { y, x1: pad.l, x2: MAIL_CHART_W - pad.r };
    }),
    vLines: [0, 6, 12, 18, 24].map((hour) => ({
      x: hourToX(hour, MAIL_CHART_W, pad),
      y1: pad.t,
      y2: MAIL_CHART_H - pad.b,
    })),
    cheapRects: layers.line
      ? mergeQuarterBands(rec.cheapBands).map((band) => {
          const fromX = hourToX(band.start / QUARTERS_PER_HOUR, MAIL_CHART_W, pad);
          const toX = hourToX((band.end + 1) / QUARTERS_PER_HOUR, MAIL_CHART_W, pad);
          return {
            x: fromX,
            y: pad.t,
            width: Math.max(toX - fromX, 8),
            height: innerH,
          };
        })
      : [],
    peakRects: layers.line
      ? mergeQuarterBands(rec.peakBands).map((band) => {
          const fromX = hourToX(band.start / QUARTERS_PER_HOUR, MAIL_CHART_W, pad);
          const toX = hourToX((band.end + 1) / QUARTERS_PER_HOUR, MAIL_CHART_W, pad);
          return {
            x: fromX,
            y: pad.t,
            width: Math.max(toX - fromX, 8),
            height: innerH,
          };
        })
      : [],
    bananas: layers.line ? marks(rec.cheapBands).map((mark) => ({ x: mark.x, y: mark.y })) : [],
    monkeys: layers.line ? marks(rec.peakBands).map((mark) => ({ x: mark.x, y: mark.y })) : [],
    fasciaRects,
    mono:
      monoY != null
        ? {
            x: monoFromX,
            y: monoY,
            width: monoToX - monoFromX,
            height: plotBottom - monoY,
            color: FASCIA_LEGEND_COLOR.Fmonoraria,
            labelX: monoFromX + 10,
            labelY: monoY - 10 < pad.t + 18 ? monoY + 28 : monoY - 10,
          }
        : null,
  };
}
