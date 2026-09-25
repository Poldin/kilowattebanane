import { formatGw, formatGwh, formatShare } from "@/lib/generation/format";
import {
  MIX_FOSSIL_IDS,
  MIX_RENEWABLE_IDS,
  MIX_SOURCE_META,
} from "@/lib/generation/sources";
import { formatHourLabel, romeHour } from "@/lib/generation/time";
import {
  MIX_SOURCE_IDS,
  type ItalyMixPayload,
  type MixDayPoint,
  type MixHourPoint,
  type MixShare,
  type MixSourceId,
} from "@/lib/generation/types";
import { sharesFromMw } from "@/lib/generation/sources";

export type MixDaySummary = {
  renewableShare: number;
  fossilShare: number;
  energyMwh: number;
  cleanestHour: number;
  cleanestShare: number;
  peakHour: number;
  peakMw: number;
  fromHour: number;
  toHour: number;
  complete: boolean;
};

function sumIds(mw: Partial<Record<MixSourceId, number>>, ids: readonly MixSourceId[]) {
  return ids.reduce((sum, id) => sum + (mw[id] ?? 0), 0);
}

function totalsFromHours(hours: MixHourPoint[]) {
  const mw: Partial<Record<MixSourceId, number>> = {};
  let total = 0;
  for (const hour of hours) {
    for (const id of MIX_SOURCE_IDS) {
      const value = hour.mw[id] ?? 0;
      mw[id] = (mw[id] ?? 0) + value;
      total += value;
    }
  }
  return { mw, total };
}

export function summarizeMixDay(mix: ItalyMixPayload): MixDaySummary | null {
  const hours = mix.hours.length > 0
    ? mix.hours
    : [{
        slotStart: mix.slotStart,
        hour: romeHour(mix.slotStart),
        mw: Object.fromEntries(mix.shares.map((row) => [row.id, row.mw])),
        totalMw: mix.totalMw,
      }];
  const { mw, total } = totalsFromHours(hours);
  if (!(total > 0)) return null;

  let cleanest = hours[0];
  let cleanestShare = 0;
  let peak = hours[0];
  for (const hour of hours) {
    if (!(hour.totalMw > 0)) continue;
    const share = sumIds(hour.mw, MIX_RENEWABLE_IDS) / hour.totalMw;
    if (share > cleanestShare + 1e-6 || (Math.abs(share - cleanestShare) <= 1e-6 && hour.hour < cleanest.hour)) {
      cleanest = hour;
      cleanestShare = share;
    }
    if (hour.totalMw > peak.totalMw) peak = hour;
  }

  const fromHour = hours[0].hour;
  const toHour = hours[hours.length - 1].hour;
  return {
    renewableShare: sumIds(mw, MIX_RENEWABLE_IDS) / total,
    fossilShare: sumIds(mw, MIX_FOSSIL_IDS) / total,
    energyMwh: total,
    cleanestHour: cleanest.hour,
    cleanestShare,
    peakHour: peak.hour,
    peakMw: peak.totalMw,
    fromHour,
    toHour,
    complete: fromHour === 0 && toHour === 23 && hours.length >= 20,
  };
}

export function mixSummaryLead(dateLabel: string, summary: MixDaySummary) {
  if (summary.complete) return `Nell'arco di ${dateLabel}`;
  if (dateLabel === "oggi") return "Finora oggi";
  return `Nell'arco di ${dateLabel}, dalle ${formatHourLabel(summary.fromHour)}:00 alle ${formatHourLabel(summary.toHour + 1)}:00`;
}

export type MixWindowSummary = {
  renewableShare: number;
  fossilShare: number;
  energyMwh: number;
  cleanestDate: string;
  cleanestShare: number;
  peakDate: string;
  peakMw: number;
  shares: MixShare[];
  mwh: Partial<Record<MixSourceId, number>>;
};

export function combineMixDays(days: MixDayPoint[]): MixWindowSummary | null {
  if (days.length === 0) return null;
  const mwh: Partial<Record<MixSourceId, number>> = {};
  let total = 0;
  let cleanest = days[0];
  let peak = days[0];
  for (const day of days) {
    for (const id of MIX_SOURCE_IDS) {
      const value = day.mwh[id] ?? 0;
      if (value > 0) mwh[id] = (mwh[id] ?? 0) + value;
    }
    total += day.totalMwh;
    if (day.renewableShare > cleanest.renewableShare + 1e-6) cleanest = day;
    if (day.peakMw > peak.peakMw) peak = day;
  }
  if (!(total > 0)) return null;
  return {
    renewableShare: MIX_RENEWABLE_IDS.reduce((sum, id) => sum + (mwh[id] ?? 0), 0) / total,
    fossilShare: MIX_FOSSIL_IDS.reduce((sum, id) => sum + (mwh[id] ?? 0), 0) / total,
    energyMwh: total,
    cleanestDate: cleanest.date,
    cleanestShare: cleanest.renewableShare,
    peakDate: peak.date,
    peakMw: peak.peakMw,
    shares: sharesFromMw(mwh),
    mwh,
  };
}

export function mixWindowSourceAverages(summary: MixWindowSummary, days: number) {
  const count = Math.max(days, 1);
  const rows = [];
  for (const id of MIX_SOURCE_IDS) {
    const energy = summary.mwh[id] ?? 0;
    if (!(energy > 0)) continue;
    const meta = MIX_SOURCE_META[id];
    rows.push({
      id,
      emoji: meta.emoji,
      label: meta.label,
      share: energy / summary.energyMwh,
      avgDailyMwh: energy / count,
    });
  }
  return rows.sort((a, b) => b.avgDailyMwh - a.avgDailyMwh);
}

export function mixWindowKpis(
  summary: MixWindowSummary,
  formatDate: (ymd: string) => string,
) {
  return [
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
      label: "più pulito",
      value: formatDate(summary.cleanestDate),
      hint: `${formatShare(summary.cleanestShare)} FER`,
    },
    {
      key: "peak",
      label: "picco",
      value: formatGw(summary.peakMw),
      hint: formatDate(summary.peakDate),
    },
    {
      key: "total",
      label: "totale",
      value: formatGwh(summary.energyMwh),
      hint: "energia prodotta",
    },
  ];
}

export function mixSummaryKpis(summary: MixDaySummary) {
  return [
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
  ];
}
