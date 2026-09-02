import { addCalendarDays } from "@/lib/entsoe";

export type DayAheadRow = {
  delivery_date: string;
  slot_start: string;
  price_eur_mwh: number;
};

export type ZoneDay = {
  deliveryDate: string;
  prices: number[];
  noonIndex: number;
};

export type RomeNow = {
  date: string;
  hour: number;
  minute: number;
};

export function romeNow(): RomeNow {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());

  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return {
    date: `${value("year")}-${value("month")}-${value("day")}`,
    hour: Number(value("hour")),
    minute: Number(value("minute")),
  };
}

export function romeToday() {
  return romeNow().date;
}

export function romeNowHour() {
  return romeNow().hour;
}

function romeHour(iso: string) {
  return Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Europe/Rome",
      hour: "numeric",
      hourCycle: "h23",
    }).format(new Date(iso)),
  );
}

export function groupZoneDays(rows: DayAheadRow[]): ZoneDay[] {
  const byDate = new Map<string, DayAheadRow[]>();

  for (const row of rows) {
    const date = row.delivery_date;
    const list = byDate.get(date) ?? [];
    list.push(row);
    byDate.set(date, list);
  }

  return [...byDate.entries()]
    .map(([deliveryDate, slots]) => {
      const sorted = [...slots].sort((a, b) =>
        a.slot_start.localeCompare(b.slot_start),
      );
      const noonIndex = sorted.findIndex((slot) => romeHour(slot.slot_start) >= 12);
      return {
        deliveryDate,
        prices: sorted.map((slot) => Number(slot.price_eur_mwh)),
        noonIndex: noonIndex >= 0 ? noonIndex : Math.floor(sorted.length / 2),
      };
    })
    .sort((a, b) => b.deliveryDate.localeCompare(a.deliveryDate));
}

export function pickDefaultDeliveryDate(dates: string[]) {
  const today = romeToday();
  const tomorrow = addCalendarDays(today, 1);

  if (romeNowHour() >= 22 && dates.includes(tomorrow)) return tomorrow;
  if (dates.includes(today)) return today;
  return dates[0] ?? null;
}
