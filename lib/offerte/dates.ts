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
