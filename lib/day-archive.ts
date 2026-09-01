import { cache } from "react";
import { publicSiteUrl } from "@/lib/app-url";
import {
  fetchDayPrices,
  fetchPriceRowsSince,
  listCompleteDeliveryDates,
  romeToday,
  type ZonedDayAheadRow,
} from "@/lib/day-ahead-query";
import { addCalendarDays } from "@/lib/entsoe";
import {
  computeRecommendations,
  dayHourlyCentStats,
  formatEurocent,
  formatTipRanges,
  isCompleteDay,
  joinItalian,
  toEurocentPerKwh,
} from "@/lib/insights";
import {
  MARKET_ZONE_IDS,
  MARKET_ZONES,
  archiveDayJsonPath,
  archiveDayPath,
  dateFromParam,
  regionsForZone,
  type ItalianRegion,
  type MarketZoneId,
} from "@/lib/market-zones";
import { toHourlyAverages } from "@/lib/prices";

const INDEX_DAYS = 120;

export type ArchiveZone = {
  zone: MarketZoneId;
  zoneName: string;
  regions: ItalianRegion[];
  hourlyCent: number[];
  min: number;
  avg: number;
  max: number;
  cheapHours: string;
  peakHours: string;
};

export type ArchiveFaq = {
  question: string;
  answer: string;
};

export type ArchiveDay = {
  date: string;
  dateLabel: string;
  dateTitle: string;
  isToday: boolean;
  isTomorrow: boolean;
  zones: ArchiveZone[];
  italy: {
    min: number;
    avg: number;
    max: number;
    cheapestZoneName: string;
    cheapestHours: string;
    priciestZoneName: string;
    priciestHours: string;
  };
  prevDate: string | null;
  nextDate: string | null;
  briefing: string;
  faqs: ArchiveFaq[];
};

export type ArchiveIndexItem = {
  date: string;
  dateLabel: string;
  dateTitle: string;
  min: number;
  avg: number;
  max: number;
};

export function formatArchiveDate(ymd: string) {
  const [year, month, day] = ymd.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12)).toLocaleDateString(
    "it-IT",
    {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    },
  );
}

export function titleCaseIt(value: string) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

export function archiveDayUrl(date: string) {
  return `${publicSiteUrl()}${archiveDayPath(date)}`;
}

export function archiveDayJsonUrl(date: string) {
  return `${publicSiteUrl()}${archiveDayJsonPath(date)}`;
}

function rowsByZone(rows: ZonedDayAheadRow[]) {
  const grouped = new Map<MarketZoneId, ZonedDayAheadRow[]>();
  for (const row of rows) {
    const list = grouped.get(row.zone) ?? [];
    list.push(row);
    grouped.set(row.zone, list);
  }
  return grouped;
}

function buildZone(zone: MarketZoneId, rows: ZonedDayAheadRow[]): ArchiveZone | null {
  if (!isCompleteDay(rows.length)) return null;
  const sorted = [...rows].sort((a, b) => a.slot_start.localeCompare(b.slot_start));
  const prices = sorted.map((row) => row.price_eur_mwh);
  const rec = computeRecommendations(prices);
  const stats = dayHourlyCentStats(prices);
  return {
    zone,
    zoneName: MARKET_ZONES[zone].name,
    regions: regionsForZone(zone),
    hourlyCent: toHourlyAverages(prices).map(toEurocentPerKwh),
    min: stats.min,
    avg: stats.avg,
    max: stats.max,
    cheapHours: formatTipRanges(rec.cheapBands),
    peakHours: formatTipRanges(rec.peakBands),
  };
}

function zonesFromRows(rows: ZonedDayAheadRow[]) {
  const grouped = rowsByZone(rows);
  const zones: ArchiveZone[] = [];
  for (const zone of MARKET_ZONE_IDS) {
    const built = buildZone(zone, grouped.get(zone) ?? []);
    if (built) zones.push(built);
  }
  return zones;
}

function italyFromZones(zones: ArchiveZone[]) {
  const cheapest = zones.reduce((best, zone) =>
    zone.min < best.min ? zone : best,
  );
  const priciest = zones.reduce((best, zone) =>
    zone.max > best.max ? zone : best,
  );
  const avg =
    zones.reduce((sum, zone) => sum + zone.avg, 0) / zones.length;
  return {
    min: cheapest.min,
    avg,
    max: priciest.max,
    cheapestZoneName: cheapest.zoneName,
    cheapestHours: cheapest.cheapHours,
    priciestZoneName: priciest.zoneName,
    priciestHours: priciest.peakHours,
  };
}

function buildBriefing(day: Omit<ArchiveDay, "briefing" | "faqs">) {
  const min = formatEurocent(day.italy.min);
  const max = formatEurocent(day.italy.max);
  const avg = formatEurocent(day.italy.avg);
  return (
    `${day.dateTitle} il prezzo all'ingrosso più basso in Italia è ${min} c€/kWh ` +
    `in zona ${day.italy.cheapestZoneName}${day.italy.cheapestHours ? `, ${day.italy.cheapestHours}` : ""}. ` +
    `Il picco è ${max} c€/kWh in zona ${day.italy.priciestZoneName}` +
    `${day.italy.priciestHours ? `, ${day.italy.priciestHours}` : ""}. ` +
    `Il medio nazionale è ${avg} c€/kWh. ` +
    `Se hai un contratto a fasce o variabile, conviene spostare i consumi flessibili ` +
    `(lavatrice, boiler, ricarica auto) nelle ore più basse. ` +
    `Non è il prezzo in bolletta: è il mercato day-ahead ENTSO-E, in centesimi di euro per kilowattora.`
  );
}

function zoneLine(zone: ArchiveZone) {
  const regions = joinItalian(zone.regions);
  const cheap = zone.cheapHours
    ? ` conviene ${zone.cheapHours} (minimo ${formatEurocent(zone.min)} c€/kWh)`
    : ` il minimo è ${formatEurocent(zone.min)} c€/kWh`;
  const peak = zone.peakHours
    ? `; evita ${zone.peakHours} (picco ${formatEurocent(zone.max)} c€/kWh)`
    : ` il massimo è ${formatEurocent(zone.max)} c€/kWh`;
  return `Zona ${zone.zoneName} (${regions}):${cheap}${peak}.`;
}

function buildFaqs(day: Omit<ArchiveDay, "briefing" | "faqs">): ArchiveFaq[] {
  const url = archiveDayUrl(day.date);
  const min = formatEurocent(day.italy.min);
  const max = formatEurocent(day.italy.max);
  const avg = formatEurocent(day.italy.avg);
  const cite = `Fonte: kilowatt e banane, ${url}. Dati ENTSO-E day-ahead.`;

  return [
    {
      question: `Quando conviene consumare energia il ${day.dateLabel}?`,
      answer:
        `Il ${day.dateLabel} conviene consumare soprattutto ${day.italy.cheapestHours || "nelle ore più basse"} ` +
        `in zona ${day.italy.cheapestZoneName}, quando il prezzo all'ingrosso scende a ${min} c€/kWh. ` +
        `È lì che conviene lavatrice, boiler, lavastoviglie o ricarica dell'auto, se il contratto segue il mercato. ` +
        `${cite}`,
    },
    {
      question: `A che ora costa di più l'elettricità il ${day.dateLabel}?`,
      answer:
        `Il ${day.dateLabel} il picco all'ingrosso è ${max} c€/kWh in zona ${day.italy.priciestZoneName}` +
        `${day.italy.priciestHours ? `, ${day.italy.priciestHours}` : ""}. ` +
        `In quelle ore, se puoi, sposta i consumi. ${cite}`,
    },
    {
      question: `Qual è il prezzo all'ingrosso dell'energia in Italia il ${day.dateLabel}?`,
      answer:
        `Il ${day.dateLabel} il minimo nazionale è ${min} c€/kWh (zona ${day.italy.cheapestZoneName}), ` +
        `il medio ${avg} c€/kWh e il massimo ${max} c€/kWh (zona ${day.italy.priciestZoneName}). ` +
        `I prezzi sono zonali: Nord, Centro-Nord, Centro-Sud, Sud, Calabria, Sicilia e Sardegna possono differire nella stessa ora. ` +
        `${cite}`,
    },
    {
      question: `Quanto costa l'energia per zona il ${day.dateLabel}?`,
      answer: `${day.zones.map(zoneLine).join(" ")} ${cite}`,
    },
    {
      question: "Il prezzo all'ingrosso è quello che pago in bolletta?",
      answer:
        "No. Qui mostriamo il prezzo all'ingrosso del mercato day-ahead: quanto costa l'energia sul mercato, ora per ora. " +
        "In bolletta il kWh dipende dal contratto. Con un prezzo fisso le oscillazioni non ti toccano. " +
        "Con un piano a fasce o variabile, la bolletta segue (in misura diversa) proprio questi movimenti.",
    },
    {
      question: "Da dove arrivano questi dati?",
      answer:
        "Dai prezzi day-ahead pubblicati sulla Transparency Platform di ENTSO-E, la rete europea dei gestori di trasmissione. " +
        "Risoluzione a 15 minuti, fuso Europe/Rome, unità c€/kWh (euro per megawattora diviso 10). " +
        `${cite}`,
    },
  ];
}

export const listArchiveDates = cache(async () => listCompleteDeliveryDates());

export const loadArchiveDay = cache(async (date: string): Promise<ArchiveDay | null> => {
  if (!dateFromParam(date)) return null;

  const [rows, dates] = await Promise.all([
    fetchDayPrices(date),
    listCompleteDeliveryDates(),
  ]);
  const zones = zonesFromRows(rows);
  if (zones.length === 0) return null;

  const today = romeToday();
  const dateLabel = formatArchiveDate(date);
  const idx = dates.indexOf(date);
  const assembled: Omit<ArchiveDay, "briefing" | "faqs"> = {
    date,
    dateLabel,
    dateTitle: titleCaseIt(dateLabel),
    isToday: date === today,
    isTomorrow: date === addCalendarDays(today, 1),
    zones,
    italy: italyFromZones(zones),
    prevDate: idx >= 0 ? (dates[idx + 1] ?? null) : null,
    nextDate: idx >= 0 ? (dates[idx - 1] ?? null) : null,
  };

  return {
    ...assembled,
    briefing: buildBriefing(assembled),
    faqs: buildFaqs(assembled),
  };
});

export const loadArchiveIndex = cache(async (): Promise<ArchiveIndexItem[]> => {
  const dates = await listCompleteDeliveryDates();
  if (dates.length === 0) return [];

  const recent = dates.slice(0, INDEX_DAYS);
  const rows = await fetchPriceRowsSince(recent[recent.length - 1]);
  const byDate = new Map<string, ZonedDayAheadRow[]>();
  for (const row of rows) {
    const list = byDate.get(row.delivery_date) ?? [];
    list.push(row);
    byDate.set(row.delivery_date, list);
  }

  return recent.flatMap((date) => {
    const zones = zonesFromRows(byDate.get(date) ?? []);
    if (zones.length === 0) return [];
    const italy = italyFromZones(zones);
    const dateLabel = formatArchiveDate(date);
    return [
      {
        date,
        dateLabel,
        dateTitle: titleCaseIt(dateLabel),
        min: italy.min,
        avg: italy.avg,
        max: italy.max,
      },
    ];
  });
});

export function archiveDayJson(day: ArchiveDay) {
  return {
    source: "ENTSO-E Transparency Platform",
    attribution: "kilowatt e banane",
    url: archiveDayUrl(day.date),
    timezone: "Europe/Rome",
    unit: "c€/kWh",
    note: "Prezzo all'ingrosso day-ahead, non bolletta. c€/kWh = €/MWh / 10.",
    date: day.date,
    dateLabel: day.dateLabel,
    italy: {
      min: day.italy.min,
      avg: Number(day.italy.avg.toFixed(3)),
      max: day.italy.max,
      cheapestZone: day.italy.cheapestZoneName,
      cheapestHours: day.italy.cheapestHours,
      priciestZone: day.italy.priciestZoneName,
      priciestHours: day.italy.priciestHours,
    },
    briefing: day.briefing,
    zones: day.zones.map((zone) => ({
      zone: zone.zone,
      zoneName: zone.zoneName,
      regions: zone.regions,
      min: zone.min,
      avg: Number(zone.avg.toFixed(3)),
      max: zone.max,
      cheapHours: zone.cheapHours,
      peakHours: zone.peakHours,
      hourly: zone.hourlyCent.map((price, hour) => ({
        hour,
        label: `${String(hour).padStart(2, "0")}:00`,
        price: Number(price.toFixed(2)),
      })),
    })),
  };
}

export function archiveJsonLd(day: ArchiveDay) {
  const url = archiveDayUrl(day.date);
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Dataset",
        name: `Prezzi day-ahead energia Italia ${day.dateLabel}`,
        description: day.briefing,
        url,
        inLanguage: "it-IT",
        temporalCoverage: `${day.date}/${day.date}`,
        spatialCoverage: { "@type": "Country", name: "Italy" },
        creator: {
          "@type": "Organization",
          name: "kilowatt e banane",
          url: publicSiteUrl(),
        },
        isBasedOn: "https://transparency.entsoe.eu/",
        variableMeasured:
          "Prezzo all'ingrosso dell'energia elettrica (c€/kWh)",
        measurementTechnique:
          "Prezzi day-ahead ENTSO-E, risoluzione 15 minuti, fuso Europe/Rome",
      },
      {
        "@type": "FAQPage",
        mainEntity: day.faqs.map((faq) => ({
          "@type": "Question",
          name: faq.question,
          acceptedAnswer: { "@type": "Answer", text: faq.answer },
        })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "kilowatt e banane",
            item: publicSiteUrl(),
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Prezzi",
            item: `${publicSiteUrl()}/prezzi`,
          },
          {
            "@type": "ListItem",
            position: 3,
            name: day.dateTitle,
            item: url,
          },
        ],
      },
    ],
  };
}

export function archiveIndexJsonLd(items: ArchiveIndexItem[]) {
  const url = `${publicSiteUrl()}/prezzi`;
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Prezzi energia all'ingrosso, giorno per giorno",
    url,
    inLanguage: "it-IT",
    isPartOf: { "@type": "WebSite", name: "kilowatt e banane", url: publicSiteUrl() },
    mainEntity: {
      "@type": "ItemList",
      itemListElement: items.map((item, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: archiveDayUrl(item.date),
        name: `Quando consumare energia il ${item.dateLabel}`,
      })),
    },
  };
}
