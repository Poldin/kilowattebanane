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

export function zoneForRegion(region: string) {
  return REGION_TO_ZONE[region as ItalianRegion];
}

export function zoneNameForRegion(region: string) {
  const zone = zoneForRegion(region);
  return zone ? MARKET_ZONES[zone].name : undefined;
}
