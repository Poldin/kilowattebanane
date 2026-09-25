const ROME_TZ = "Europe/Rome";

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

export function romeToday() {
  return deliveryDateInRome(new Date());
}

export function romeHour(iso: string) {
  return Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: ROME_TZ,
      hour: "numeric",
      hourCycle: "h23",
    }).format(new Date(iso)),
  );
}

export function formatHourLabel(hour: number) {
  return `${String(Math.max(0, Math.min(24, Math.round(hour)))).padStart(2, "0")}`;
}

export function formatMixClock(iso: string) {
  return new Intl.DateTimeFormat("it-IT", {
    timeZone: ROME_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));
}

export function formatMixDate(ymd: string) {
  const today = romeToday();
  if (ymd === today) return "oggi";
  if (ymd === addCalendarDays(today, -1)) return "ieri";
  const [year, month, day] = ymd.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12)).toLocaleDateString("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}
