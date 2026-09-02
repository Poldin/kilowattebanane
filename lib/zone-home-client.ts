import type { DayAheadRow } from "@/lib/day-ahead-core";
import type { MarketZoneId } from "@/lib/market-zones";
import type { ZoneHomePayload } from "@/lib/zone-home-types";

async function readJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    throw new Error(res.status === 404 ? "Zona non trovata" : "Caricamento fallito");
  }
  return res.json() as Promise<T>;
}

export async function fetchZoneHome(zone: MarketZoneId, date?: string) {
  const params = new URLSearchParams();
  if (date) params.set("date", date);
  const query = params.toString();
  return readJson<ZoneHomePayload>(
    await fetch(`/api/zone/${encodeURIComponent(zone)}${query ? `?${query}` : ""}`),
  );
}

export async function fetchZoneSlots(
  zone: MarketZoneId,
  fromDate: string,
  toDate: string,
) {
  const params = new URLSearchParams({ from: fromDate, to: toDate });
  const payload = await readJson<{ rows: DayAheadRow[] }>(
    await fetch(`/api/zone/${encodeURIComponent(zone)}/slots?${params}`),
  );
  return payload.rows;
}
