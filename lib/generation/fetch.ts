import { mapEnergyChartsSource } from "@/lib/generation/sources";
import { deliveryDateInRome } from "@/lib/generation/time";
import type { GenerationSlot } from "@/lib/generation/types";

const ENERGY_CHARTS_POWER_URL = "https://api.energy-charts.info/public_power";

type EnergyChartsPowerResponse = {
  unix_seconds?: number[];
  production_types?: Array<{
    name?: string;
    data?: Array<number | null>;
  }>;
};

async function requestItalyGeneration(from: string, to: string, timeoutMs: number) {
  const url = new URL(ENERGY_CHARTS_POWER_URL);
  url.searchParams.set("country", "it");
  url.searchParams.set("start", from);
  url.searchParams.set("end", to);

  return fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "kilowattebanane/1.0" },
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
  });
}

export async function fetchItalyGeneration(
  from: string,
  to: string,
  timeoutMs = 20_000,
): Promise<GenerationSlot[]> {
  let res = await requestItalyGeneration(from, to, timeoutMs);
  if (res.status === 429) {
    const wait = Number(res.headers.get("retry-after") ?? "35");
    await new Promise((resolve) =>
      setTimeout(resolve, Math.min(60, Math.max(1, wait)) * 1000),
    );
    res = await requestItalyGeneration(from, to, timeoutMs);
  }
  if (!res.ok) {
    throw new Error(`energy-charts HTTP ${res.status}`);
  }

  const text = await res.text();
  if (!text || /^no content available/i.test(text.trim())) {
    return [];
  }

  let data: EnergyChartsPowerResponse;
  try {
    data = JSON.parse(text) as EnergyChartsPowerResponse;
  } catch {
    throw new Error("energy-charts invalid JSON");
  }

  const times = data.unix_seconds ?? [];
  const merged = new Map<string, GenerationSlot>();

  for (const series of data.production_types ?? []) {
    const sourceType = series.name ? mapEnergyChartsSource(series.name) : null;
    if (!sourceType) continue;
    const values = series.data ?? [];
    for (let i = 0; i < times.length; i++) {
      const mw = values[i];
      if (mw == null || !Number.isFinite(mw) || mw <= 0) continue;
      const slotStart = new Date(times[i] * 1000);
      const key = `${slotStart.toISOString()}|${sourceType}`;
      const existing = merged.get(key);
      if (existing) {
        existing.mw += mw;
        continue;
      }
      merged.set(key, {
        slotStart,
        deliveryDate: deliveryDateInRome(slotStart),
        sourceType,
        mw,
      });
    }
  }

  return [...merged.values()];
}
