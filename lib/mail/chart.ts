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
  type DayRecommendations,
} from "@/lib/insights";

export const MAIL_CHART_W = 1120;
export const MAIL_CHART_H = 520;
export const MAIL_CHART_DISPLAY_W = 512;
export const MAIL_CHART_DISPLAY_H = Math.round(
  (MAIL_CHART_DISPLAY_W * MAIL_CHART_H) / MAIL_CHART_W,
);
export const MAIL_CHART_PAD = { t: 56, r: 40, b: 76, l: 100 };

export type MailChartLayout = {
  width: number;
  height: number;
  path: string;
  yTicks: { y: number; label: string }[];
  xTicks: { x: number; y: number; label: string }[];
  hLines: { y: number; x1: number; x2: number }[];
  vLines: { x: number; y1: number; y2: number }[];
  cheapRects: { x: number; y: number; width: number; height: number }[];
  peakRects: { x: number; y: number; width: number; height: number }[];
  bananas: { x: number; y: number }[];
  monkeys: { x: number; y: number }[];
  unit: { x: number; y: number; label: string };
};

export function buildMailChartLayout(
  pricesEuroPerMwh: number[],
  recommendations?: DayRecommendations,
): MailChartLayout {
  const rec = recommendations ?? computeRecommendations(pricesEuroPerMwh);
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

  const marks = (hours: { hour: number }[]) =>
    hours
      .map((band) => sampleNearestHour(samples, band.hour))
      .filter((mark): mark is CurveSample => mark !== null);

  return {
    width: MAIL_CHART_W,
    height: MAIL_CHART_H,
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
    cheapRects: mergeQuarterBands(rec.cheapBands).map((band) => {
      const fromX = hourToX(band.start / QUARTERS_PER_HOUR, MAIL_CHART_W, pad);
      const toX = hourToX((band.end + 1) / QUARTERS_PER_HOUR, MAIL_CHART_W, pad);
      return {
        x: fromX,
        y: pad.t,
        width: Math.max(toX - fromX, 8),
        height: innerH,
      };
    }),
    peakRects: mergeQuarterBands(rec.peakBands).map((band) => {
      const fromX = hourToX(band.start / QUARTERS_PER_HOUR, MAIL_CHART_W, pad);
      const toX = hourToX((band.end + 1) / QUARTERS_PER_HOUR, MAIL_CHART_W, pad);
      return {
        x: fromX,
        y: pad.t,
        width: Math.max(toX - fromX, 8),
        height: innerH,
      };
    }),
    bananas: marks(rec.cheapBands).map((mark) => ({ x: mark.x, y: mark.y })),
    monkeys: marks(rec.peakBands).map((mark) => ({ x: mark.x, y: mark.y })),
  };
}
