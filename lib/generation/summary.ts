import { formatGw, formatGwh, formatShare } from "@/lib/generation/format";
import { MIX_FOSSIL_IDS, MIX_RENEWABLE_IDS } from "@/lib/generation/sources";
import { formatHourLabel, romeHour } from "@/lib/generation/time";
import { MIX_SOURCE_IDS, type ItalyMixPayload, type MixHourPoint, type MixSourceId } from "@/lib/generation/types";

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
