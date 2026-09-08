import { addCalendarDays } from "@/lib/entsoe";
import { toEurocentPerKwh } from "@/lib/insights";
import { toHourlyAverages } from "@/lib/prices";

export type FasciaId = "F1" | "F2" | "F3";
export type FasciaStatId = FasciaId | "F23" | "Fmonoraria";

export const TARIFF_PLANS = [
  { id: "fasce", label: "A fasce", hint: "F1 F2 F3" },
  { id: "bioraria", label: "Bioraria", hint: "F1 F23" },
  { id: "monoraria", label: "Monoraria", hint: "Fmono" },
  { id: "dinamica", label: "Dinamica", hint: "ora per ora" },
] as const;

export type TariffPlanId = (typeof TARIFF_PLANS)[number]["id"];
export const DEFAULT_TARIFF_PLAN: TariffPlanId = "dinamica";

export const FASCIA_COLOR: Record<FasciaId, string> = {
  F1: "#F97316",
  F2: "#A78BFA",
  F3: "#38BDF8",
};

export const FASCIA_LEGEND_COLOR: Record<FasciaStatId, string> = {
  F1: FASCIA_COLOR.F1,
  F2: FASCIA_COLOR.F2,
  F3: FASCIA_COLOR.F3,
  F23: "#70B4F9",
  Fmonoraria: "#34D399",
};

export function fasciaBadgesForPlan(id: TariffPlanId): FasciaStatId[] {
  switch (id) {
    case "fasce":
      return ["F1", "F2", "F3"];
    case "bioraria":
      return ["F1", "F23"];
    case "monoraria":
      return ["Fmonoraria"];
    case "dinamica":
      return [];
  }
}

export function fasciaBadgeLabel(id: FasciaStatId): string {
  if (id === "Fmonoraria") return "Fmono";
  return id;
}

export function fasciaStatsForCheapPeak(id: TariffPlanId): FasciaStatId[] {
  switch (id) {
    case "fasce":
      return ["F1", "F2", "F3"];
    case "bioraria":
      return ["F1", "F23"];
    case "dinamica":
      return ["F1", "F2", "F3"];
    case "monoraria":
      return [];
  }
}

export function visibleFasciaStatsFromLayers(layers: ChartLayers): FasciaStatId[] {
  if (layers.line || layers.mono) return [];
  const ids: FasciaStatId[] = [];
  if (layers.f23) ids.push("F23");
  if (layers.f1) ids.push("F1");
  if (layers.f2) ids.push("F2");
  if (layers.f3) ids.push("F3");
  return ids;
}

export function fasciaCheapPeak(
  avgs: FasciaAverages,
  ids: FasciaStatId[],
): { cheap: FasciaStatId | null; peak: FasciaStatId | null } {
  const priced = ids
    .map((id) => ({ id, price: avgs[id] }))
    .filter(
      (entry): entry is { id: FasciaStatId; price: number } =>
        entry.price != null && Number.isFinite(entry.price),
    );
  if (priced.length < 2) return { cheap: null, peak: null };
  const min = Math.min(...priced.map((entry) => entry.price));
  const max = Math.max(...priced.map((entry) => entry.price));
  if (min === max) return { cheap: null, peak: null };
  return {
    cheap: priced.find((entry) => entry.price === min)?.id ?? null,
    peak: priced.find((entry) => entry.price === max)?.id ?? null,
  };
}

export function cheapPeakForTariff(
  tariff: TariffPlanId,
  avgs: FasciaAverages,
  ids: FasciaStatId[] = fasciaStatsForCheapPeak(tariff),
): { cheap: FasciaStatId | null; peak: FasciaStatId | null } {
  return fasciaCheapPeak(avgs, ids);
}

export function fasciaStatForPlanHour(
  ymd: string,
  hour: number,
  tariff: TariffPlanId,
): FasciaStatId | null {
  if (tariff === "monoraria") return "Fmonoraria";
  if (tariff === "dinamica") return null;
  const fascia = fasciaForHour(ymd, hour);
  if (tariff === "bioraria") return fascia === "F1" ? "F1" : "F23";
  return fascia;
}

export function fasciaTipLabel(ymd: string, id: FasciaStatId): string {
  const range = fasciaRangeLabel(ymd, id);
  return range ? `${id} · ${range}` : id;
}

export function tariffDayOccasion(ymd: string): "festivo" | "domenica" | "sabato" | null {
  if (isItalianElectricityHoliday(ymd)) return "festivo";
  const kind = fasciaDayKind(ymd);
  if (kind === "sunday") return "domenica";
  if (kind === "saturday") return "sabato";
  return null;
}

export type ChartLayers = {
  line: boolean;
  f1: boolean;
  f2: boolean;
  f3: boolean;
  f23: boolean;
  mono: boolean;
};

export function layersForTariff(id: TariffPlanId): ChartLayers {
  switch (id) {
    case "fasce":
      return { line: false, f1: true, f2: true, f3: true, f23: false, mono: false };
    case "bioraria":
      return { line: false, f1: true, f2: false, f3: false, f23: true, mono: false };
    case "monoraria":
      return { line: false, f1: false, f2: false, f3: false, f23: false, mono: true };
    case "dinamica":
      return { line: true, f1: false, f2: false, f3: false, f23: false, mono: false };
  }
}

export type FasciaAverages = Record<FasciaStatId, number | null>;

const FIXED_HOLIDAYS = [
  "01-01",
  "01-06",
  "04-25",
  "05-01",
  "06-02",
  "08-15",
  "11-01",
  "12-08",
  "12-25",
  "12-26",
] as const;

function easterSunday(year: number) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function weekdayUtc(ymd: string) {
  const [year, month, day] = ymd.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay();
}

export function isItalianElectricityHoliday(ymd: string) {
  const mmdd = ymd.slice(5);
  if ((FIXED_HOLIDAYS as readonly string[]).includes(mmdd)) return true;
  const year = Number(ymd.slice(0, 4));
  return ymd === addCalendarDays(easterSunday(year), 1);
}

export type FasciaDayKind = "weekday" | "saturday" | "sunday";

export function fasciaDayKind(ymd: string): FasciaDayKind {
  if (!ymd) return "weekday";
  const weekday = weekdayUtc(ymd);
  if (weekday === 0 || isItalianElectricityHoliday(ymd)) return "sunday";
  if (weekday === 6) return "saturday";
  return "weekday";
}

export function fasciaForHour(ymd: string, hour: number): FasciaId {
  const h = ((hour % 24) + 24) % 24;
  const kind = fasciaDayKind(ymd);
  if (kind === "sunday") return "F3";
  if (kind === "saturday") return h >= 7 && h < 23 ? "F2" : "F3";
  if (h >= 8 && h < 19) return "F1";
  if (h === 7 || (h >= 19 && h < 23)) return "F2";
  return "F3";
}

export function fasciaRangeLabel(ymd: string, id: FasciaStatId): string | null {
  const kind = fasciaDayKind(ymd);
  if (id === "Fmonoraria") return "0–24";
  if (kind === "sunday") return id === "F3" || id === "F23" ? "0–24" : null;
  if (kind === "saturday") {
    if (id === "F1") return null;
    if (id === "F2") return "7–23";
    if (id === "F3") return "23–7";
    return "0–24";
  }
  if (id === "F1") return "8–19";
  if (id === "F2") return "7–8, 19–23";
  if (id === "F3") return "23–7";
  return "19–8";
}

export type FasciaHourBand = {
  id: FasciaId;
  start: number;
  end: number;
};

export function fasciaHourBands(ymd: string): FasciaHourBand[] {
  if (!ymd) return [];
  const bands: FasciaHourBand[] = [];
  for (let hour = 0; hour < 24; hour++) {
    const id = fasciaForHour(ymd, hour);
    const last = bands[bands.length - 1];
    if (last && last.id === id && last.end === hour) {
      last.end = hour + 1;
    } else {
      bands.push({ id, start: hour, end: hour + 1 });
    }
  }
  return bands;
}

export function fasciaF23Bands(ymd: string) {
  if (!ymd) return [];
  const bands: { start: number; end: number }[] = [];
  for (let hour = 0; hour < 24; hour++) {
    if (fasciaForHour(ymd, hour) === "F1") continue;
    const last = bands[bands.length - 1];
    if (last && last.end === hour) last.end = hour + 1;
    else bands.push({ start: hour, end: hour + 1 });
  }
  return bands;
}

function emptyAverages(): FasciaAverages {
  return { F1: null, F2: null, F3: null, F23: null, Fmonoraria: null };
}

function meanOrNull(sum: number, count: number) {
  return count > 0 ? sum / count : null;
}

export function fasciaAveragesFromDays(
  days: { date: string; hours: (number | null)[] }[],
): FasciaAverages {
  const sums: Record<FasciaId, number> = { F1: 0, F2: 0, F3: 0 };
  const counts: Record<FasciaId, number> = { F1: 0, F2: 0, F3: 0 };

  for (const day of days) {
    for (let hour = 0; hour < day.hours.length; hour++) {
      const value = day.hours[hour];
      if (value == null || !Number.isFinite(value)) continue;
      const fascia = fasciaForHour(day.date, hour);
      sums[fascia] += toEurocentPerKwh(value);
      counts[fascia] += 1;
    }
  }

  const f23Count = counts.F2 + counts.F3;
  const allCount = counts.F1 + counts.F2 + counts.F3;
  return {
    F1: meanOrNull(sums.F1, counts.F1),
    F2: meanOrNull(sums.F2, counts.F2),
    F3: meanOrNull(sums.F3, counts.F3),
    F23: meanOrNull(sums.F2 + sums.F3, f23Count),
    Fmonoraria: meanOrNull(sums.F1 + sums.F2 + sums.F3, allCount),
  };
}

export function fasciaAveragesFromHourly(
  ymd: string,
  hours: (number | null)[],
): FasciaAverages {
  return fasciaAveragesFromDays([{ date: ymd, hours }]);
}

export function fasciaAveragesFromQuarters(
  ymd: string,
  quarterPricesEurMwh: number[],
): FasciaAverages {
  if (!ymd || quarterPricesEurMwh.length === 0) return emptyAverages();
  return fasciaAveragesFromHourly(ymd, toHourlyAverages(quarterPricesEurMwh));
}
