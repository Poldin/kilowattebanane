import type { ForwardPoint } from "@/lib/offerte/forward";
import { CME_ITB_PAGE_URL } from "@/lib/offerte/public-types";

export { CME_ITB_PAGE_URL };

export const CME_ITB_PRODUCT_ID = 8383;
export const CME_ITB_QUOTES_URL = `https://www.cmegroup.com/CmeWS/mvc/quotes/v2/${CME_ITB_PRODUCT_ID}`;
export const CME_ITB_SOURCE = "cme_itb";

const UA = "kilowattebanane/cme-itb (https://kilowattebanane.it)";
const MONTHS: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

export type CmeFetchResult = {
  asOf: string;
  tradeDate: string | null;
  points: ForwardPoint[];
  sourceUrl: string;
};

type CmeQuote = {
  last?: unknown;
  priorSettle?: unknown;
  close?: unknown;
  code?: unknown;
  expirationDate?: unknown;
  expirationMonth?: unknown;
  volume?: unknown;
  updated?: unknown;
};

type CmeQuotesPayload = {
  tradeDate?: unknown;
  quotes?: CmeQuote[];
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

export function parseCmeNumber(raw: unknown) {
  if (raw == null) return null;
  const text = String(raw).trim().replace(/,/g, "");
  if (!text || text === "-") return null;
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

export function parseCmeTradeDate(raw: unknown) {
  if (raw == null) return null;
  const text = String(raw).trim();
  const match = text.match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/);
  if (!match) return null;
  const month = MONTHS[match[2].toLowerCase()];
  const day = Number(match[1]);
  const year = Number(match[3]);
  if (!month || day < 1 || day > 31) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function parseCmeExpirationDate(raw: unknown) {
  if (raw == null) return null;
  const digits = String(raw).replace(/\D/g, "");
  if (digits.length !== 8) return null;
  const year = Number(digits.slice(0, 4));
  const month = Number(digits.slice(4, 6));
  if (!year || month < 1 || month > 12) return null;
  return monthBounds(year, month);
}

function quotePrice(quote: CmeQuote) {
  return parseCmeNumber(quote.last) ?? parseCmeNumber(quote.close) ?? parseCmeNumber(quote.priorSettle);
}

export function jsonFromMaybeMarkdown(text: string) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new Error("CME quotes: JSON not found in response");
  }
  return JSON.parse(text.slice(start, end + 1)) as unknown;
}

export function pointsFromCmeQuotes(payload: unknown, asOf: string): ForwardPoint[] {
  const record = (payload ?? {}) as CmeQuotesPayload;
  const quotes = Array.isArray(record.quotes) ? record.quotes : [];
  const byKey = new Map<string, ForwardPoint>();
  for (const quote of quotes) {
    const bounds = parseCmeExpirationDate(quote.expirationDate);
    const price = quotePrice(quote);
    if (!bounds || price == null) continue;
    const point: ForwardPoint = {
      asOf,
      product: "baseload",
      tenor: "month",
      periodStart: bounds.start,
      periodEnd: bounds.end,
      priceEurMwh: price,
      source: CME_ITB_SOURCE,
    };
    byKey.set(point.periodStart, point);
  }
  return [...byKey.values()].sort((a, b) => a.periodStart.localeCompare(b.periodStart));
}

async function readCmePayload(url: string, headers: Record<string, string>) {
  const response = await fetch(url, { headers, cache: "no-store" });
  const text = await response.text();
  return { ok: response.ok, status: response.status, text };
}

export async function fetchCmeItalianPowerForwards(snapshotDate: string): Promise<CmeFetchResult> {
  const quotesUrl = `${CME_ITB_QUOTES_URL}?isProtected&_t=${Date.now()}`;
  const direct = await readCmePayload(quotesUrl, {
    accept: "application/json, text/plain, */*",
    "user-agent": UA,
    referer: CME_ITB_PAGE_URL,
    origin: "https://www.cmegroup.com",
  });

  let payload: unknown;
  let sourceUrl = CME_ITB_QUOTES_URL;
  if (direct.ok) {
    payload = jsonFromMaybeMarkdown(direct.text);
  } else {
    const jina = await readCmePayload(`https://r.jina.ai/${CME_ITB_QUOTES_URL}?isProtected`, {
      accept: "text/plain",
      "user-agent": UA,
    });
    if (!jina.ok) {
      throw new Error(`CME ITB HTTP ${direct.status}; mirror HTTP ${jina.status}`);
    }
    payload = jsonFromMaybeMarkdown(jina.text);
    sourceUrl = `https://r.jina.ai/${CME_ITB_QUOTES_URL}`;
  }

  const points = pointsFromCmeQuotes(payload, snapshotDate);
  if (points.length === 0) throw new Error("CME ITB parsed 0 forward points");
  const tradeDate = parseCmeTradeDate((payload as CmeQuotesPayload).tradeDate);
  return {
    asOf: snapshotDate,
    tradeDate,
    points,
    sourceUrl,
  };
}
