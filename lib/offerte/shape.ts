import { addIsoDays, romeToday } from "@/lib/offerte/dates";
import { fasciaForHour } from "@/lib/offerte/fasce";
import { offerteClient } from "@/lib/offerte/client";
import { offerteReadClient } from "@/lib/offerte/db";
import { fetchZoneHourlyStatsSince } from "@/lib/day-ahead-query";
import { MARKET_ZONE_IDS } from "@/lib/market-zones";

const LOOKBACK_DAYS = 365;

export type PunShape = {
  asOf: string;
  zone: string;
  lookbackDays: number;
  shareF1: number;
  shareF2: number;
  shareF3: number;
  meanF1EurMwh: number | null;
  meanF2EurMwh: number | null;
  meanF3EurMwh: number | null;
  meanBaseEurMwh: number | null;
  hourlyRel: number[];
  sampleDays: number;
};

function mean(values: number[]) {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function fasciaFactors(shape: PunShape | null) {
  const base = shape?.meanBaseEurMwh;
  const f1 = shape?.meanF1EurMwh;
  const f2 = shape?.meanF2EurMwh;
  const f3 = shape?.meanF3EurMwh;
  const rel = (value: number | null | undefined) =>
    base != null && base > 0 && value != null ? value / base : 1;
  const factorF1 = rel(f1);
  const factorF2 = rel(f2);
  const factorF3 = rel(f3);
  const share2 = shape?.shareF2 ?? 0.31;
  const share3 = shape?.shareF3 ?? 0.36;
  const factorF23 =
    share2 + share3 > 0 ? (factorF2 * share2 + factorF3 * share3) / (share2 + share3) : 1;
  return { factorF1, factorF2, factorF3, factorF23, factorF0: 1 };
}

export async function loadLatestPunShape(zone = "IT"): Promise<PunShape | null> {
  const client = offerteReadClient();
  const { data, error } = await client
    .from("po_pun_shape")
    .select(
      "as_of, zone, lookback_days, share_f1, share_f2, share_f3, mean_f1_eur_mwh, mean_f2_eur_mwh, mean_f3_eur_mwh, mean_base_eur_mwh, hourly_rel, sample_days",
    )
    .eq("zone", zone)
    .order("as_of", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const hourly = Array.isArray(data.hourly_rel)
    ? data.hourly_rel.map((value) => Number(value)).filter((value) => Number.isFinite(value))
    : [];
  return {
    asOf: String(data.as_of),
    zone: String(data.zone),
    lookbackDays: Number(data.lookback_days) || LOOKBACK_DAYS,
    shareF1: Number(data.share_f1) || 0,
    shareF2: Number(data.share_f2) || 0,
    shareF3: Number(data.share_f3) || 0,
    meanF1EurMwh: data.mean_f1_eur_mwh == null ? null : Number(data.mean_f1_eur_mwh),
    meanF2EurMwh: data.mean_f2_eur_mwh == null ? null : Number(data.mean_f2_eur_mwh),
    meanF3EurMwh: data.mean_f3_eur_mwh == null ? null : Number(data.mean_f3_eur_mwh),
    meanBaseEurMwh: data.mean_base_eur_mwh == null ? null : Number(data.mean_base_eur_mwh),
    hourlyRel: hourly.length === 24 ? hourly : Array.from({ length: 24 }, () => 1),
    sampleDays: Number(data.sample_days) || 0,
  };
}

export async function rebuildPunShape(asOf = romeToday()) {
  const fromDate = addIsoDays(asOf, -LOOKBACK_DAYS);
  const byFascia = { f1: [] as number[], f2: [] as number[], f3: [] as number[] };
  const byHour = Array.from({ length: 24 }, () => [] as number[]);
  const days = new Set<string>();

  for (const zone of MARKET_ZONE_IDS) {
    const rows = await fetchZoneHourlyStatsSince(zone, fromDate);
    for (const row of rows) {
      if (row.deliveryDate > asOf) continue;
      let used = false;
      row.hours.forEach((price, hour) => {
        if (price == null || !Number.isFinite(price) || hour > 23) return;
        const fascia = fasciaForHour(row.deliveryDate, hour);
        byFascia[fascia].push(price);
        byHour[hour].push(price);
        used = true;
      });
      if (used) days.add(row.deliveryDate);
    }
  }

  const meanF1 = mean(byFascia.f1);
  const meanF2 = mean(byFascia.f2);
  const meanF3 = mean(byFascia.f3);
  const all = [...byFascia.f1, ...byFascia.f2, ...byFascia.f3];
  const meanBase = mean(all);
  const hours = all.length;
  const shareF1 = hours ? byFascia.f1.length / hours : 0;
  const shareF2 = hours ? byFascia.f2.length / hours : 0;
  const shareF3 = hours ? byFascia.f3.length / hours : 0;
  const hourlyRel = byHour.map((values) => {
    const m = mean(values);
    if (m == null || meanBase == null || meanBase === 0) return 1;
    return m / meanBase;
  });

  const shape: PunShape = {
    asOf,
    zone: "IT",
    lookbackDays: LOOKBACK_DAYS,
    shareF1,
    shareF2,
    shareF3,
    meanF1EurMwh: meanF1,
    meanF2EurMwh: meanF2,
    meanF3EurMwh: meanF3,
    meanBaseEurMwh: meanBase,
    hourlyRel,
    sampleDays: days.size,
  };

  const client = offerteClient();
  const { error } = await client.from("po_pun_shape").upsert(
    {
      as_of: asOf,
      zone: "IT",
      lookback_days: LOOKBACK_DAYS,
      share_f1: shareF1,
      share_f2: shareF2,
      share_f3: shareF3,
      mean_f1_eur_mwh: meanF1,
      mean_f2_eur_mwh: meanF2,
      mean_f3_eur_mwh: meanF3,
      mean_base_eur_mwh: meanBase,
      hourly_rel: hourlyRel,
      sample_days: days.size,
      rebuilt_at: new Date().toISOString(),
    },
    { onConflict: "as_of,zone" },
  );
  if (error) throw new Error(error.message);
  return shape;
}
