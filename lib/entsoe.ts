import { MARKET_ZONES, type MarketZoneId } from "@/lib/market-zones";

const ENTSOE_API_URL = "https://web-api.tp.entsoe.eu/api";
const ENERGY_CHARTS_URL = "https://api.energy-charts.info/price";
const ROME_TZ = "Europe/Rome";

export type PriceSlot = {
  zone: MarketZoneId;
  deliveryDate: string;
  slotStart: Date;
  priceEurMwh: number;
};

export type ZonePullResult = {
  zone: MarketZoneId;
  source: "entsoe" | "energy-charts";
  slotCount: number;
};

function stripXml(xml: string) {
  return xml.replace(/<\?xml[^?]*\?>/i, "").trim();
}

function extractBlocks(xml: string, tag: string) {
  const re = new RegExp(
    `<(?:[\\w.-]+:)?${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[\\w.-]+:)?${tag}>`,
    "gi",
  );
  return [...xml.matchAll(re)].map((match) => match[1]);
}

function extractText(xml: string, tag: string) {
  const escaped = tag.replace(/\./g, "\\.");
  return extractBlocks(xml, escaped)[0]?.trim();
}

function parseXmlDate(value: string) {
  const normalized = value.trim().replace(/Z$/, "+00:00");
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid ENTSO-E datetime: ${value}`);
  }
  return parsed;
}

function parseDurationMs(iso: string) {
  const match = iso.trim().match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i);
  if (!match) {
    throw new Error(`Unsupported ENTSO-E resolution: ${iso}`);
  }
  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2] ?? 0);
  const seconds = Number(match[3] ?? 0);
  const ms = ((hours * 60 + minutes) * 60 + seconds) * 1000;
  if (!ms) {
    throw new Error(`Unsupported ENTSO-E resolution: ${iso}`);
  }
  return ms;
}

export function formatEntsoeStamp(date: Date) {
  const y = date.getUTCFullYear();
  const mo = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  const h = String(date.getUTCHours()).padStart(2, "0");
  const mi = String(date.getUTCMinutes()).padStart(2, "0");
  return `${y}${mo}${d}${h}${mi}`;
}

export function deliveryDateInRome(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ROME_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function addCalendarDays(ymd: string, delta: number) {
  const [year, month, day] = ymd.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + delta)).toISOString().slice(0, 10);
}

function timeZoneOffsetMs(instant: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const asUtc = Date.UTC(
    Number(value.year),
    Number(value.month) - 1,
    Number(value.day),
    Number(value.hour),
    Number(value.minute),
    Number(value.second),
  );
  return asUtc - instant.getTime();
}

export function romeMidnightUtc(ymd: string) {
  const [year, month, day] = ymd.split("-").map(Number);
  const naiveUtc = Date.UTC(year, month - 1, day, 0, 0, 0);
  const first = new Date(naiveUtc - timeZoneOffsetMs(new Date(naiveUtc), ROME_TZ));
  return new Date(naiveUtc - timeZoneOffsetMs(first, ROME_TZ));
}

function parseAcknowledgement(xml: string) {
  if (!/<Acknowledgement_MarketDocument\b/i.test(xml)) return null;
  const code = extractText(xml, "code") ?? "unknown";
  const text = extractText(xml, "text") ?? "ENTSO-E acknowledgement";
  return { code, text };
}

function parsePoints(periodXml: string) {
  return extractBlocks(periodXml, "Point").map((pointXml) => {
    const position = Number(extractText(pointXml, "position"));
    const price = Number(extractText(pointXml, "price.amount"));
    if (!Number.isFinite(position) || !Number.isFinite(price)) {
      throw new Error("Invalid ENTSO-E Point");
    }
    return { position, price };
  });
}

export function parsePublicationXml(xml: string, zone: MarketZoneId): PriceSlot[] {
  const body = stripXml(xml);
  const ack = parseAcknowledgement(body);
  if (ack) {
    if (ack.code === "999") return [];
    throw new Error(`ENTSO-E ${ack.code}: ${ack.text}`);
  }

  if (!/<Publication_MarketDocument\b/i.test(body)) {
    throw new Error("Unexpected ENTSO-E response");
  }

  const slots: PriceSlot[] = [];

  for (const seriesXml of extractBlocks(body, "TimeSeries")) {
    for (const periodXml of extractBlocks(seriesXml, "Period")) {
      const intervalXml = extractBlocks(periodXml, "timeInterval")[0] ?? "";
      const start = parseXmlDate(extractText(intervalXml, "start") ?? "");
      const end = parseXmlDate(extractText(intervalXml, "end") ?? "");
      const resolutionMs = parseDurationMs(extractText(periodXml, "resolution") ?? "PT15M");
      const count = Math.round((end.getTime() - start.getTime()) / resolutionMs);
      const byPosition = new Map(parsePoints(periodXml).map((point) => [point.position, point.price]));

      let lastPrice: number | undefined;
      for (let position = 1; position <= count; position++) {
        const price = byPosition.get(position);
        if (price !== undefined) lastPrice = price;
        if (lastPrice === undefined) continue;
        const slotStart = new Date(start.getTime() + (position - 1) * resolutionMs);
        slots.push({
          zone,
          deliveryDate: deliveryDateInRome(slotStart),
          slotStart,
          priceEurMwh: lastPrice,
        });
      }
    }
  }

  return slots;
}

async function readResponseText(res: Response) {
  const text = await res.text();
  if (!res.ok) {
    const snippet = text.replace(/\s+/g, " ").slice(0, 180);
    throw new Error(`ENTSO-E HTTP ${res.status}${snippet ? `: ${snippet}` : ""}`);
  }
  return text;
}

export async function fetchEntsoePrices(options: {
  zone: MarketZoneId;
  periodStart: Date;
  periodEnd: Date;
  apiKey: string;
}): Promise<PriceSlot[]> {
  const eic = MARKET_ZONES[options.zone].eic;
  const url = new URL(ENTSOE_API_URL);
  url.searchParams.set("securityToken", options.apiKey);
  url.searchParams.set("documentType", "A44");
  url.searchParams.set("in_Domain", eic);
  url.searchParams.set("out_Domain", eic);
  url.searchParams.set("periodStart", formatEntsoeStamp(options.periodStart));
  url.searchParams.set("periodEnd", formatEntsoeStamp(options.periodEnd));

  const res = await fetch(url, {
    headers: { Accept: "application/xml, text/xml, */*", "User-Agent": "kilowattebanane/1.0" },
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });
  const xml = await readResponseText(res);
  return parsePublicationXml(xml, options.zone);
}

type EnergyChartsResponse = {
  unix_seconds?: number[];
  price?: Array<number | null>;
};

export async function fetchEnergyChartsPrices(options: {
  zone: MarketZoneId;
  startDate: string;
  endDate: string;
}): Promise<PriceSlot[]> {
  const url = new URL(ENERGY_CHARTS_URL);
  url.searchParams.set("bzn", options.zone);
  url.searchParams.set("start", options.startDate);
  url.searchParams.set("end", options.endDate);

  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "kilowattebanane/1.0" },
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    throw new Error(`energy-charts HTTP ${res.status}`);
  }

  const data = (await res.json()) as EnergyChartsResponse;
  const times = data.unix_seconds ?? [];
  const prices = data.price ?? [];
  const slots: PriceSlot[] = [];

  for (let i = 0; i < times.length; i++) {
    const price = prices[i];
    if (price == null || !Number.isFinite(price)) continue;
    const slotStart = new Date(times[i] * 1000);
    slots.push({
      zone: options.zone,
      deliveryDate: deliveryDateInRome(slotStart),
      slotStart,
      priceEurMwh: price,
    });
  }

  return slots;
}
