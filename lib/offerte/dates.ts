const ROME_TZ = "Europe/Rome";
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function romeToday(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ROME_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function addIsoDays(isoDate: string, days: number) {
  if (!ISO_DATE.test(isoDate)) throw new Error(`Invalid date ${isoDate}`);
  const [year, month, day] = isoDate.split("-").map(Number);
  const utc = Date.UTC(year, month - 1, day + days);
  return new Date(utc).toISOString().slice(0, 10);
}

export function monthStart(isoDate: string) {
  if (!ISO_DATE.test(isoDate)) throw new Error(`Invalid date ${isoDate}`);
  return `${isoDate.slice(0, 7)}-01`;
}

export function addIsoMonths(isoDate: string, months: number) {
  if (!ISO_DATE.test(isoDate)) throw new Error(`Invalid date ${isoDate}`);
  const [year, month] = isoDate.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1 + months, 1));
  return `${utc.getUTCFullYear()}-${String(utc.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

/** Default offer start: always the 1st of next calendar month (Rome). */
export function defaultOfferStartDate(now = new Date()) {
  return addIsoMonths(monthStart(romeToday(now)), 1);
}

export function calendarMonthStarts(fromIso: string, count: number) {
  const start = monthStart(fromIso);
  return Array.from({ length: count }, (_, i) => addIsoMonths(start, i));
}

export function formatMonthShortIt(isoDate: string) {
  if (!ISO_DATE.test(isoDate)) return isoDate;
  const [year, month] = isoDate.split("-").map(Number);
  return new Intl.DateTimeFormat("it-IT", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

export function pathParts(isoDate: string) {
  const [year, month, day] = isoDate.split("-");
  return {
    year,
    month: String(Number(month)),
    ymd: `${year}${month}${day}`,
  };
}

/** Portale Offerte uses DD/MM/YYYY or DD/MM/YYYY_HH:MM:SS */
export function parsePortalDate(raw: string | null | undefined) {
  const value = raw?.trim();
  if (!value) return null;
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (!match) return null;
  return `${match[3]}-${match[2]}-${match[1]}`;
}

export function parseNumber(raw: string | null | undefined) {
  const value = raw?.trim();
  if (!value) return null;
  const n = Number(value.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export function parseIntLoose(raw: string | null | undefined) {
  const n = parseNumber(raw);
  if (n == null) return null;
  return Math.trunc(n);
}
