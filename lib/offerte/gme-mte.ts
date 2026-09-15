import { unzipFirstFile } from "@/lib/offerte/zip";
import type { ForwardPoint, ForwardProduct, ForwardTenor } from "@/lib/offerte/forward";

const GME_API = "https://api.mercatoelettrico.org";
const UA = "kilowattebanane/mte (https://kilowattebanane.it)";

const MONTHS: Record<string, number> = {
  gen: 1,
  gennaio: 1,
  jan: 1,
  january: 1,
  feb: 2,
  febbraio: 2,
  february: 2,
  mar: 3,
  marzo: 3,
  march: 3,
  apr: 4,
  aprile: 4,
  april: 4,
  mag: 5,
  maggio: 5,
  may: 5,
  giu: 6,
  giugno: 6,
  jun: 6,
  june: 6,
  lug: 7,
  luglio: 7,
  jul: 7,
  july: 7,
  ago: 8,
  agosto: 8,
  aug: 8,
  august: 8,
  set: 9,
  settembre: 9,
  sep: 9,
  sept: 9,
  september: 9,
  ott: 10,
  ottobre: 10,
  oct: 10,
  october: 10,
  nov: 11,
  novembre: 11,
  november: 11,
  dic: 12,
  dicembre: 12,
  dec: 12,
  december: 12,
};

const ROMAN_Q: Record<string, number> = { i: 1, ii: 2, iii: 3, iv: 4 };

export type MteFetchResult = {
  asOf: string;
  points: ForwardPoint[];
  source: string;
};

function ymdToIso(value: string | number) {
  const raw = String(value).replace(/\D/g, "");
  if (raw.length !== 8) return null;
  return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
}

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

function quarterBounds(year: number, quarter: number) {
  const startMonth = (quarter - 1) * 3 + 1;
  const endMonth = quarter * 3;
  return {
    start: `${year}-${String(startMonth).padStart(2, "0")}-01`,
    end: `${year}-${String(endMonth).padStart(2, "0")}-${String(lastDayOfMonth(year, endMonth)).padStart(2, "0")}`,
  };
}

function yearBounds(year: number) {
  return { start: `${year}-01-01`, end: `${year}-12-31` };
}

function expandYear(raw: string) {
  if (raw.length === 4) return Number(raw);
  const n = Number(raw);
  return n >= 70 ? 1900 + n : 2000 + n;
}

export function parseMteProduct(name: string): {
  product: ForwardProduct;
  tenor: ForwardTenor;
  periodStart: string;
  periodEnd: string;
} | null {
  const text = name.replace(/\s+/g, " ").trim();
  const peak = /\b(pk|peak|peakload)\b/i.test(text);
  const product: ForwardProduct = peak ? "peakload" : "baseload";

  const ym = text.match(/\b(20\d{2})[-./]?(0[1-9]|1[0-2])\b/);
  const compactYm = text.match(/\b(20\d{2})(0[1-9]|1[0-2])\b/);
  const monthHit = text.match(
    /\b(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre|january|february|march|april|may|june|july|august|september|october|november|december|gen|feb|mar|apr|mag|giu|lug|ago|set|ott|nov|dic|jan|jun|jul|aug|sep|sept|oct|dec)\.?\s*-?\s*(20\d{2}|\d{2})\b/i,
  );
  const quarterHit =
    text.match(/\b(?:Q|T|trim(?:estre)?)\s*([1-4])\s*[-/ ]\s*(20\d{2}|\d{2})\b/i) ||
    text.match(/\b(20\d{2})\s*[-/ ]\s*(?:Q|T)\s*([1-4])\b/i) ||
    text.match(/\b(I{1,3}|IV)\s+trimestre\s+(20\d{2}|\d{2})\b/i);
  const yearHit =
    text.match(/\b(?:cal(?:endar)?|anno|year|bl-y|baseload\s+y)\s*[-/ ]*(20\d{2}|\d{2})\b/i) ||
    text.match(/\b(20\d{2})\b/);

  if (/\b(mese|month|mensile|bl-m|fdbm)\b/i.test(text) || compactYm || (ym && !quarterHit)) {
    const compact = compactYm ?? ym;
    if (compact) {
      const year = Number(compact[1].length === 6 ? compact[1].slice(0, 4) : compact[1]);
      const month = Number(compact[2] ?? compact[1].slice(4));
      if (year && month >= 1 && month <= 12) {
        const bounds = monthBounds(year, month);
        return { product, tenor: "month", periodStart: bounds.start, periodEnd: bounds.end };
      }
    }
    if (monthHit) {
      const month = MONTHS[monthHit[1].toLowerCase().replace(".", "")];
      const year = expandYear(monthHit[2]);
      if (month) {
        const bounds = monthBounds(year, month);
        return { product, tenor: "month", periodStart: bounds.start, periodEnd: bounds.end };
      }
    }
  }

  if (quarterHit) {
    const roman = ROMAN_Q[quarterHit[1].toLowerCase()];
    let quarter = roman ?? Number(quarterHit[1]);
    let yearRaw = quarterHit[2] ?? "";
    if (/^20\d{2}/.test(quarterHit[0]) && quarterHit[2]) {
      yearRaw = quarterHit[1];
      quarter = Number(quarterHit[2]);
    }
    const year = expandYear(yearRaw);
    if (Number.isFinite(quarter) && quarter >= 1 && quarter <= 4 && year) {
      const bounds = quarterBounds(year, quarter);
      return { product, tenor: "quarter", periodStart: bounds.start, periodEnd: bounds.end };
    }
  }

  if (/\b(anno|year|calendar|cal|annuale|bl-y)\b/i.test(text) && yearHit) {
    const year = expandYear(yearHit[1]);
    const bounds = yearBounds(year);
    return { product, tenor: "year", periodStart: bounds.start, periodEnd: bounds.end };
  }

  return null;
}

function pickPrice(row: Record<string, unknown>) {
  const keys = [
    "CheckPrice",
    "checkPrice",
    "PrezzoControllo",
    "RefPrice",
    "refPrice",
    "LastMatchedPrice",
    "lastMatchedPrice",
    "SettlementPrice",
    "Price",
  ];
  for (const key of keys) {
    const value = Number(row[key]);
    if (Number.isFinite(value) && value > 0) return value;
  }
  return null;
}

function asRows(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload as Record<string, unknown>[];
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    for (const key of ["data", "Data", "results", "Results", "MTEResults", "items"]) {
      if (Array.isArray(record[key])) return record[key] as Record<string, unknown>[];
    }
  }
  return [];
}

export function pointsFromMteRows(rows: Record<string, unknown>[], fallbackAsOf: string) {
  const byKey = new Map<string, ForwardPoint>();
  for (const row of rows) {
    const name = String(row.Product ?? row.product ?? row.NomeProdotto ?? row.Instrument ?? "");
    const parsed = parseMteProduct(name);
    if (!parsed) continue;
    const price = pickPrice(row);
    if (price == null) continue;
    const asOf =
      ymdToIso(String(row.Date ?? row.SessionDate ?? row.data ?? fallbackAsOf.replace(/-/g, ""))) ??
      fallbackAsOf;
    const point: ForwardPoint = {
      asOf,
      product: parsed.product,
      tenor: parsed.tenor,
      periodStart: parsed.periodStart,
      periodEnd: parsed.periodEnd,
      priceEurMwh: price,
      source: "gme_mte",
    };
    const key = `${point.asOf}|${point.product}|${point.tenor}|${point.periodStart}`;
    const prev = byKey.get(key);
    if (!prev || point.priceEurMwh > 0) byKey.set(key, point);
  }
  return [...byKey.values()];
}

async function gmeAuth(login: string, password: string) {
  const response = await fetch(`${GME_API}/api/v1/Auth`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json", "user-agent": UA },
    body: JSON.stringify({ Login: login, Password: password }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`GME auth HTTP ${response.status}`);
  const payload = (await response.json()) as { Success?: boolean; token?: string; Reason?: string };
  if (!payload.Success || !payload.token) {
    throw new Error(payload.Reason || "GME auth failed");
  }
  return payload.token;
}

async function gmeRequestData(token: string, start: string, end: string) {
  const response = await fetch(`${GME_API}/api/v1/RequestData`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      authorization: `Bearer ${token}`,
      "user-agent": UA,
    },
    body: JSON.stringify({
      Platform: "PublicMarketResults",
      Segment: "MTE",
      DataName: "ME_MTEResults",
      IntervalStart: start.replace(/-/g, ""),
      IntervalEnd: end.replace(/-/g, ""),
      Attributes: {},
    }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`GME MTE HTTP ${response.status}`);
  const payload = (await response.json()) as {
    ResultRequest?: string;
    ContentResponse?: string;
    FormatType?: string;
  };
  if (!payload.ContentResponse) {
    throw new Error(payload.ResultRequest || "GME MTE empty response");
  }
  const zip = Buffer.from(payload.ContentResponse, "base64");
  const text = unzipFirstFile(zip);
  return JSON.parse(text) as unknown;
}

function gmeCredentials() {
  const login = process.env.GME_API_LOGIN?.trim() || process.env.GME_API_USER?.trim();
  const password = process.env.GME_API_PASSWORD?.trim();
  if (!login || !password) return null;
  return { login, password };
}

export async function fetchMteForwards(asOf: string, lookbackDays = 10): Promise<MteFetchResult> {
  const creds = gmeCredentials();
  if (!creds) {
    throw new Error("Missing GME_API_LOGIN and GME_API_PASSWORD");
  }
  const startDate = new Date(`${asOf}T00:00:00Z`);
  startDate.setUTCDate(startDate.getUTCDate() - lookbackDays);
  const start = startDate.toISOString().slice(0, 10);
  const token = await gmeAuth(creds.login, creds.password);
  const payload = await gmeRequestData(token, start, asOf);
  const points = pointsFromMteRows(asRows(payload), asOf);
  if (points.length === 0) throw new Error("GME MTE parsed 0 forward points");
  const latest = points.reduce((best, row) => (row.asOf > best ? row.asOf : best), points[0].asOf);
  return {
    asOf: latest,
    source: "gme_mte",
    points: points.filter((row) => row.asOf === latest),
  };
}
