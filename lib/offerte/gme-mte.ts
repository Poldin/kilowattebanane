import type { ForwardPoint } from "@/lib/offerte/forward";
import { GME_FORWARD_SOURCE } from "@/lib/offerte/forward-source";
import { GME_MTE_PAGE_URL } from "@/lib/offerte/public-types";

export { GME_MTE_PAGE_URL };
export { GME_FORWARD_SOURCE as GME_MTE_SOURCE };
export const GME_MTE_API_URL =
  "https://www.mercatoelettrico.org/DesktopModules/GmeEsitiMTE/API/GmeEsitiMTE/GetMEESitiMTE";
export const GME_MTE_MODULE_ID = "10259";
export const GME_MTE_TAB_ID = "1532";

const UA = "kilowattebanane/gme-mte (https://kilowattebanane.it)";
const MONTHLY_BL = /^BL-M-(20\d{2})-(0[1-9]|1[0-2])$/;

export type GmeMteRow = {
  Data?: unknown;
  Prodotto?: unknown;
  PrezzoControllo?: unknown;
  PrezzoRiferimento?: unknown;
  UltimoPrezzoAbbinato?: unknown;
  VolumiMW?: unknown;
};

export type GmeMonthlyPoint = ForwardPoint & {
  productCode: string;
  checkPriceEurMwh: number | null;
  refPriceEurMwh: number | null;
  lastPriceEurMwh: number | null;
  volumeMw: number | null;
  raw: GmeMteRow;
};

export type GmeMteFetchResult = {
  asOf: string;
  points: GmeMonthlyPoint[];
  sourceUrl: string;
};

function lastDayOfMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function monthBounds(year: number, month: number) {
  const end = lastDayOfMonth(year, month);
  return {
    start: `${year}-${String(month).padStart(2, "0")}-01`,
    end: `${year}-${String(month).padStart(2, "0")}-${String(end).padStart(2, "0")}`,
  };
}

export function ymdFromGmeDate(raw: unknown) {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (digits.length !== 8) return null;
  const year = Number(digits.slice(0, 4));
  const month = Number(digits.slice(4, 6));
  const day = Number(digits.slice(6, 8));
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function parseGmeNumber(raw: unknown) {
  if (raw == null || raw === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

export function parseGmeMteMonthlyCode(code: string) {
  const match = code.trim().toUpperCase().match(MONTHLY_BL);
  if (!match) return null;
  return monthBounds(Number(match[1]), Number(match[2]));
}

export function pickGmeMtePrice(row: GmeMteRow) {
  const check = parseGmeNumber(row.PrezzoControllo);
  if (check != null && check > 0) return check;
  const ref = parseGmeNumber(row.PrezzoRiferimento);
  if (ref != null && ref > 0) return ref;
  const last = parseGmeNumber(row.UltimoPrezzoAbbinato);
  if (last != null && last > 0) return last;
  return null;
}

export function pointsFromGmeMteRows(rows: GmeMteRow[], fallbackAsOf: string) {
  const byStart = new Map<string, GmeMonthlyPoint>();
  for (const row of rows) {
    const code = String(row.Prodotto ?? "").trim();
    const bounds = parseGmeMteMonthlyCode(code);
    const price = pickGmeMtePrice(row);
    if (!bounds || price == null) continue;
    const asOf = ymdFromGmeDate(row.Data) ?? fallbackAsOf;
    byStart.set(bounds.start, {
      asOf,
      product: "baseload",
      tenor: "month",
      periodStart: bounds.start,
      periodEnd: bounds.end,
      priceEurMwh: price,
      source: GME_FORWARD_SOURCE,
      productCode: code.toUpperCase(),
      checkPriceEurMwh: parseGmeNumber(row.PrezzoControllo),
      refPriceEurMwh: parseGmeNumber(row.PrezzoRiferimento),
      lastPriceEurMwh: parseGmeNumber(row.UltimoPrezzoAbbinato),
      volumeMw: parseGmeNumber(row.VolumiMW),
      raw: row,
    });
  }
  return [...byStart.values()].sort((a, b) => a.periodStart.localeCompare(b.periodStart));
}

function cookieHeader(response: Response) {
  const raw =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : [];
  const byName = new Map<string, string>();
  for (const part of raw) {
    const pair = part.split(";")[0] ?? "";
    const eq = pair.indexOf("=");
    if (eq <= 0) continue;
    byName.set(pair.slice(0, eq), pair.slice(eq + 1));
  }
  return [...byName.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
}

function firstMatch(html: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

function sessionFromPage(html: string) {
  const token = firstMatch(html, [
    /name="__RequestVerificationToken"[^>]*value="([^"]+)"/i,
    /value="([^"]+)"[^>]*name="__RequestVerificationToken"/i,
  ]);
  const moduleId =
    firstMatch(html, [/ModuleId["']?\s*[:=]\s*["']?(\d+)/i]) ?? GME_MTE_MODULE_ID;
  const tabId =
    firstMatch(html, [/sf_tabId":"(\d+)"/i, /TabId":(\d+)/i]) ?? GME_MTE_TAB_ID;
  if (!token) throw new Error("GME MTE: missing request verification token");
  return { token, moduleId, tabId };
}

export async function fetchGmeMteMonthlyForwards(
  snapshotDate: string,
): Promise<GmeMteFetchResult> {
  const page = await fetch(GME_MTE_PAGE_URL, {
    headers: {
      accept: "text/html,application/xhtml+xml",
      "user-agent": UA,
    },
    cache: "no-store",
    redirect: "follow",
  });
  const html = await page.text();
  if (!page.ok) {
    throw new Error(`GME MTE page HTTP ${page.status}`);
  }
  const { token, moduleId, tabId } = sessionFromPage(html);
  const cookie = cookieHeader(page);
  const sourceUrl = `${GME_MTE_API_URL}?data=0`;
  const response = await fetch(sourceUrl, {
    headers: {
      accept: "application/json, text/plain, */*",
      "user-agent": UA,
      referer: GME_MTE_PAGE_URL,
      ModuleId: moduleId,
      TabId: tabId,
      RequestVerificationToken: token,
      ...(cookie ? { cookie } : {}),
    },
    cache: "no-store",
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`GME MTE HTTP ${response.status}: ${text.slice(0, 180)}`);
  }
  const payload = JSON.parse(text) as unknown;
  const rows = Array.isArray(payload) ? (payload as GmeMteRow[]) : [];
  const points = pointsFromGmeMteRows(rows, snapshotDate);
  if (points.length === 0) throw new Error("GME MTE parsed 0 monthly baseload points");
  const asOf = points.reduce((best, row) => (row.asOf > best ? row.asOf : best), points[0].asOf);
  return {
    asOf,
    points: points.filter((row) => row.asOf === asOf),
    sourceUrl,
  };
}
