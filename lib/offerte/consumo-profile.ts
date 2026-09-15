import { DEFAULT_FASCIA_SHARES } from "@/lib/offerte/fasce";
import type { OfferteConsumoProfilo } from "@/lib/offerte/public-types";

export type { OfferteConsumoProfilo };

/** Calendar-month weights, average = 1. Winter lighting/indoor, summer AC bump, spring trough. */
export const STANDARD_MONTH_WEIGHT = [
  1.18, 1.08, 0.98, 0.86, 0.82, 0.9, 1.05, 1.02, 0.9, 0.96, 1.05, 1.2,
] as const;

/**
 * Typical Italian home, relative hours. Evening peak, night low — not inverse-price.
 * Indices 0–23 Europe/Rome.
 */
export const STANDARD_HOUR_WEIGHT = [
  0.55, 0.5, 0.48, 0.48, 0.5, 0.6, 0.8, 1.05, 1.15, 1.0, 0.95, 1.0, 1.05, 1.0, 0.95, 0.95, 1.05,
  1.25, 1.45, 1.5, 1.4, 1.2, 0.9, 0.7,
] as const;

/** Laundry, boiler, EV-ish shift onto F3 (nights + weekends), without emptying F1. */
export const OCULATO_FASCIA_SHARES = { f1: 0.2, f2: 0.27, f3: 0.53 } as const;

const OCULATO_MONTH_FLEX = 0.28;
const OCULATO_HOUR_FLEX = 0.55;

export function parseConsumoProfilo(raw: string | null | undefined): OfferteConsumoProfilo {
  return raw === "oculato" ? "oculato" : "standard";
}

export function fasciaSharesFor(profilo: OfferteConsumoProfilo) {
  return profilo === "oculato" ? { ...OCULATO_FASCIA_SHARES } : { ...DEFAULT_FASCIA_SHARES };
}

function calendarMonthIndex(iso: string) {
  const month = Number(iso.slice(5, 7));
  if (!Number.isFinite(month) || month < 1 || month > 12) return null;
  return month - 1;
}

function normalize(values: number[]) {
  const sum = values.reduce((total, value) => total + value, 0);
  if (!(sum > 0)) return values.map(() => (values.length > 0 ? 1 / values.length : 0));
  return values.map((value) => value / sum);
}

export function monthKwhShares(options: {
  profilo: OfferteConsumoProfilo;
  starts: string[];
  punEurKwh?: Array<number | null | undefined>;
}) {
  const { profilo, starts, punEurKwh = [] } = options;
  const n = starts.length;
  const out = Array.from({ length: n }, () => (n > 0 ? 1 / n : 0));
  for (let offset = 0; offset < n; offset += 12) {
    const len = Math.min(12, n - offset);
    const base = Array.from({ length: len }, (_, i) => {
      const month = calendarMonthIndex(starts[offset + i] ?? "");
      return month == null ? 1 / 12 : STANDARD_MONTH_WEIGHT[month] / 12;
    });
    const normBase = normalize(base);
    if (profilo !== "oculato") {
      for (let i = 0; i < len; i++) out[offset + i] = normBase[i]!;
      continue;
    }
    const inv = Array.from({ length: len }, (_, i) => {
      const pun = punEurKwh[offset + i];
      return pun != null && pun > 0 ? 1 / pun : 1;
    });
    const cheap = normalize(inv);
    for (let i = 0; i < len; i++) {
      out[offset + i] = (1 - OCULATO_MONTH_FLEX) * normBase[i]! + OCULATO_MONTH_FLEX * cheap[i]!;
    }
  }
  return out;
}

export function hourShares(profilo: OfferteConsumoProfilo, hourlyRel?: number[]) {
  const stdSum = STANDARD_HOUR_WEIGHT.reduce((sum, value) => sum + value, 0);
  const std = STANDARD_HOUR_WEIGHT.map((value) => value / stdSum);
  if (profilo !== "oculato" || !hourlyRel || hourlyRel.length !== 24) return std;
  const inv = hourlyRel.map((rel) => 1 / Math.max(Number(rel) || 1, 0.4));
  const cheap = normalize(inv);
  return std.map((share, hour) => (1 - OCULATO_HOUR_FLEX) * share + OCULATO_HOUR_FLEX * cheap[hour]!);
}
