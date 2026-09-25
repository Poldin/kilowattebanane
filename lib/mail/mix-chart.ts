import { formatGw } from "@/lib/generation/format";
import { stackMixLayers, type MixStackLayout } from "@/lib/generation/stack";
import type { ItalyMixPayload } from "@/lib/generation/types";

export const MAIL_MIX_W = 1120;
export const MAIL_MIX_H = 480;
export const MAIL_MIX_DISPLAY_W = 512;
export const MAIL_MIX_DISPLAY_H = Math.round(
  (MAIL_MIX_DISPLAY_W * MAIL_MIX_H) / MAIL_MIX_W,
);
export const MAIL_MIX_PAD = { t: 40, r: 40, b: 80, l: 92 };

const HOUR_TICKS = [0, 6, 12, 18, 24];

export type MailMixChartLayout = {
  width: number;
  height: number;
  stack: MixStackLayout;
  yTicks: { y: number; label: string }[];
  xTicks: { x: number; label: string }[];
  vLines: { x: number; y1: number; y2: number }[];
};

export function buildMailMixChartLayout(mix: ItalyMixPayload): MailMixChartLayout | null {
  if (mix.hours.length < 2) return null;
  const stack = stackMixLayers(mix.hours, MAIL_MIX_W, MAIL_MIX_H, MAIL_MIX_PAD);
  const plotBottom = MAIL_MIX_PAD.t + stack.plotH;

  return {
    width: MAIL_MIX_W,
    height: MAIL_MIX_H,
    stack,
    yTicks: [
      { y: MAIL_MIX_PAD.t, label: formatGw(stack.maxMw) },
      { y: plotBottom, label: "0" },
    ],
    xTicks: HOUR_TICKS.map((hour) => ({
      x: stack.xAt(hour),
      label: String(hour).padStart(2, "0"),
    })),
    vLines: HOUR_TICKS.map((hour) => ({
      x: stack.xAt(hour),
      y1: MAIL_MIX_PAD.t,
      y2: plotBottom,
    })),
  };
}
