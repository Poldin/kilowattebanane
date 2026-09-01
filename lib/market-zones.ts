export const MARKET_ZONES = {
  "IT-North": {
    eic: "10Y1001A1001A73I",
    name: "Nord",
  },
  "IT-Centre-North": {
    eic: "10Y1001A1001A70O",
    name: "Centro-Nord",
  },
  "IT-Centre-South": {
    eic: "10Y1001A1001A71M",
    name: "Centro-Sud",
  },
  "IT-South": {
    eic: "10Y1001A1001A788",
    name: "Sud",
  },
  "IT-Calabria": {
    eic: "10Y1001C--00096J",
    name: "Calabria",
  },
  "IT-Sicily": {
    eic: "10Y1001A1001A75E",
    name: "Sicilia",
  },
  "IT-Sardinia": {
    eic: "10Y1001A1001A74G",
    name: "Sardegna",
  },
} as const;

export type MarketZoneId = keyof typeof MARKET_ZONES;

export const REGION_TO_ZONE = {
  Abruzzo: "IT-Centre-South",
  Basilicata: "IT-South",
  Calabria: "IT-Calabria",
  Campania: "IT-Centre-South",
  "Emilia-Romagna": "IT-North",
  "Friuli-Venezia Giulia": "IT-North",
  Lazio: "IT-Centre-South",
  Liguria: "IT-North",
  Lombardia: "IT-North",
  Marche: "IT-Centre-North",
  Molise: "IT-South",
  Piemonte: "IT-North",
  Puglia: "IT-South",
  Sardegna: "IT-Sardinia",
  Sicilia: "IT-Sicily",
  Toscana: "IT-Centre-North",
  "Trentino-Alto Adige": "IT-North",
  Umbria: "IT-Centre-North",
  "Valle d'Aosta": "IT-North",
  Veneto: "IT-North",
} as const;

export type ItalianRegion = keyof typeof REGION_TO_ZONE;

export const ITALIAN_REGIONS = Object.keys(REGION_TO_ZONE) as ItalianRegion[];
export const DEFAULT_REGION: ItalianRegion = "Lombardia";
export const PRICES_SECTION_ID = "prezzi";
export const SHOW_TODAY_PRICES_EVENT = "show-today-prices";
export const REGION_QUERY_PARAM = "regione";
export const DATE_QUERY_PARAM = "giorno";
const DATE_PARAM_RE = /^\d{4}-\d{2}-\d{2}$/;

function slugifyRegion(name: string) {
  return name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const REGION_BY_SLUG = Object.fromEntries(
  ITALIAN_REGIONS.map((region) => [slugifyRegion(region), region]),
) as Record<string, ItalianRegion>;

export function regionToSlug(region: string) {
  return slugifyRegion(region);
}

export function regionFromParam(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return undefined;
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    decoded = raw;
  }
  const trimmed = decoded.trim();
  if (trimmed in REGION_TO_ZONE) return trimmed as ItalianRegion;
  return REGION_BY_SLUG[slugifyRegion(trimmed)];
}

export function dateFromParam(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (!DATE_PARAM_RE.test(trimmed)) return undefined;
  const [year, month, day] = trimmed.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return undefined;
  }
  return trimmed;
}

export function pricesShareUrl(origin: string, region: string) {
  const url = new URL("/", origin);
  url.searchParams.set(REGION_QUERY_PARAM, regionToSlug(region));
  url.hash = PRICES_SECTION_ID;
  return url.toString();
}

export function zoneForRegion(region: string) {
  return REGION_TO_ZONE[region as ItalianRegion];
}

export function zoneNameForRegion(region: string) {
  const zone = zoneForRegion(region);
  return zone ? MARKET_ZONES[zone].name : undefined;
}
