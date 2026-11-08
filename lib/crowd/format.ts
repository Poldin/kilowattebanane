const euro = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const integer = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 0 });

const dayMonth = new Intl.DateTimeFormat("it-IT", {
  day: "numeric",
  month: "long",
  timeZone: "Europe/Rome",
});

export function formatEuro(value: number) {
  return euro.format(value);
}

export function formatInt(value: number) {
  return integer.format(value);
}

export function formatCloses(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return iso;
  return dayMonth.format(new Date(Date.UTC(year, month - 1, day, 12)));
}

export function fundedPercent(raised: number, goal: number) {
  if (goal <= 0) return 0;
  return Math.min(100, Math.round((raised / goal) * 100));
}

export function parseEuroInput(raw: string) {
  const trimmed = raw.trim().replace(/\s/g, "");
  if (!trimmed) return null;

  let normalized = trimmed;
  if (trimmed.includes(",") && trimmed.includes(".")) {
    normalized = trimmed.replace(/\./g, "").replace(",", ".");
  } else if (trimmed.includes(",")) {
    normalized = trimmed.replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(trimmed)) {
    normalized = trimmed.replace(/\./g, "");
  }

  const value = Number(normalized);
  if (!Number.isFinite(value)) return null;
  return Math.round(value);
}
