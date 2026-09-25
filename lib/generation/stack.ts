import { MIX_STACK_ORDER } from "@/lib/generation/sources";
import type { MixDayPoint, MixHourPoint, MixSourceId } from "@/lib/generation/types";

export type MixStackPad = { t: number; r: number; b: number; l: number };

export type MixStackLayer = { id: MixSourceId; d: string };

export type MixStackLayout = {
  layers: MixStackLayer[];
  maxMw: number;
  plotW: number;
  plotH: number;
  xAt: (hour: number) => number;
  yAt: (mw: number) => number;
};

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

export function stackMixLayers(
  hours: MixHourPoint[],
  width: number,
  height: number,
  pad: MixStackPad,
): MixStackLayout {
  const plotW = width - pad.l - pad.r;
  const plotH = height - pad.t - pad.b;
  const maxMw = Math.max(...hours.map((hour) => hour.totalMw), 1);
  const xAt = (hour: number) => pad.l + (hour / 24) * plotW;
  const yAt = (mw: number) => pad.t + plotH - (mw / maxMw) * plotH;
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
    const bottoms = samples.map(() => pad.t + plotH);
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

function dayAvgMw(day: MixDayPoint) {
  const hours = Math.max(day.hourCount, 1);
  const mw: Partial<Record<MixSourceId, number>> = {};
  let totalMw = 0;
  for (const id of Object.keys(day.mwh) as MixSourceId[]) {
    const value = (day.mwh[id] ?? 0) / hours;
    if (value > 0) {
      mw[id] = value;
      totalMw += value;
    }
  }
  return { mw, totalMw };
}

export function stackMixDayMw(
  days: MixDayPoint[],
  width: number,
  height: number,
  pad: MixStackPad,
): MixStackLayout {
  const plotW = width - pad.l - pad.r;
  const plotH = height - pad.t - pad.b;
  const n = Math.max(days.length, 1);
  const avgs = days.map(dayAvgMw);
  const maxMw = Math.max(...avgs.map((day) => day.totalMw), 1);
  const xAt = (index: number) => pad.l + (index / n) * plotW;
  const yAt = (mw: number) => pad.t + plotH - (mw / maxMw) * plotH;
  const visible = MIX_STACK_ORDER.filter((id) =>
    avgs.some((day) => (day.mw[id] ?? 0) > 0),
  );

  const parts = new Map<MixSourceId, string[]>(visible.map((id) => [id, []]));
  if (avgs.length > 0) {
    const samples = avgs.flatMap((day, index) => [
      { index, mw: day.mw },
      { index: index + 1, mw: day.mw },
    ]);
    const xs = samples.map((sample) => xAt(sample.index));
    const bottoms = samples.map(() => pad.t + plotH);
    for (const id of visible) {
      const tops = samples.map((sample, sampleIndex) => {
        const mw = sample.mw[id] ?? 0;
        return bottoms[sampleIndex] - (mw / maxMw) * plotH;
      });
      parts.get(id)?.push(stackedPath(xs, tops, bottoms));
      bottoms.splice(0, bottoms.length, ...tops);
    }
  }

  return {
    layers: visible.map((id) => ({
      id,
      d: (parts.get(id) ?? []).filter(Boolean).join(" "),
    })),
    maxMw,
    plotW,
    plotH,
    xAt,
    yAt,
  };
}
