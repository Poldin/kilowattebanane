/** ARERA F1/F2/F3, without national holidays (Sundays + listed feste → F3). */

const ROME_TZ = "Europe/Rome";

const FIXED_HOLIDAYS = new Set([
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
]);

export const DEFAULT_FASCIA_SHARES = { f1: 0.33, f2: 0.31, f3: 0.36 } as const;

export type FasciaId = "f1" | "f2" | "f3";

export function easterSundayIso(year: number) {
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

export function addDaysIso(isoDate: string, days: number) {
  const [y, m, d] = isoDate.split("-").map(Number);
  const utc = Date.UTC(y, m - 1, d + days);
  return new Date(utc).toISOString().slice(0, 10);
}

export function isItalianHoliday(isoDate: string) {
  const md = isoDate.slice(5);
  if (FIXED_HOLIDAYS.has(md)) return true;
  const year = Number(isoDate.slice(0, 4));
  const easter = easterSundayIso(year);
  return isoDate === addDaysIso(easter, 1);
}

export function weekdayMonday0(isoDate: string) {
  const [y, m, d] = isoDate.split("-").map(Number);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

export function fasciaForHour(isoDate: string, hour: number): FasciaId {
  if (isItalianHoliday(isoDate) || weekdayMonday0(isoDate) === 6) return "f3";
  const sat = weekdayMonday0(isoDate) === 5;
  if (sat) {
    if (hour >= 7 && hour < 23) return "f2";
    return "f3";
  }
  if (hour >= 8 && hour < 19) return "f1";
  if (hour === 7 || (hour >= 19 && hour < 23)) return "f2";
  return "f3";
}

export function romeHourFromIso(slotStart: string) {
  const hour = new Intl.DateTimeFormat("en-GB", {
    timeZone: ROME_TZ,
    hour: "2-digit",
    hourCycle: "h23",
  }).format(new Date(slotStart));
  return Number(hour);
}

export function normalizeFasciaShares(input?: {
  f1?: number;
  f2?: number;
  f3?: number;
}) {
  const f1 = input?.f1 ?? DEFAULT_FASCIA_SHARES.f1;
  const f2 = input?.f2 ?? DEFAULT_FASCIA_SHARES.f2;
  const f3 = input?.f3 ?? DEFAULT_FASCIA_SHARES.f3;
  const sum = f1 + f2 + f3;
  if (!(sum > 0)) return { ...DEFAULT_FASCIA_SHARES };
  return { f1: f1 / sum, f2: f2 / sum, f3: f3 / sum };
}

export function splitConsumo(
  consumoKwh: number,
  shares?: { f1?: number; f2?: number; f3?: number },
) {
  const { f1, f2, f3 } = normalizeFasciaShares(shares);
  return {
    f1: consumoKwh * f1,
    f2: consumoKwh * f2,
    f3: consumoKwh * f3,
    f23: consumoKwh * (f2 + f3),
    f0: consumoKwh,
  };
}
