import { isAreaConvenzionaleCode } from "@/lib/cer/pod-parse";
import { GSE_AC_LAYER_URL, gseQuery } from "@/lib/cer/pod-gse";
import { ITALIAN_REGIONS, regionFromParam, type ItalianRegion } from "@/lib/market-zones";

const UA = "kilowattebanane/cer-cabine (informational reuse; https://kilowattebanane.it)";
const PAGE_SIZE = 2000;

type ConfigRow = {
  area_convenzionale: string | null;
  regione: string | null;
};

export type CabinaPrimaria = {
  codice: string;
  lon: number;
  lat: number;
};

function text(value: unknown) {
  if (value == null) return null;
  const s = String(value).trim();
  return s.length > 0 ? s : null;
}

function num(value: unknown) {
  if (value == null) return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export async function fetchGseCabinePrimarie() {
  const cabine: CabinaPrimaria[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const rows = await gseQuery(
      GSE_AC_LAYER_URL,
      {
        where: "1=1",
        outFields: "COD_AC",
        returnGeometry: "false",
        returnCentroid: "true",
        outSR: "4326",
        resultOffset: String(offset),
        resultRecordCount: String(PAGE_SIZE),
      },
      { userAgent: UA },
    );
    if (rows.length === 0) break;
    for (const row of rows) {
      const codice = text(row.attributes?.COD_AC)?.toUpperCase() ?? null;
      const centroid = row as { centroid?: { x?: number; y?: number } };
      const lon = num(centroid.centroid?.x);
      const lat = num(centroid.centroid?.y);
      if (codice && isAreaConvenzionaleCode(codice) && lon != null && lat != null) {
        cabine.push({ codice, lon, lat });
      }
    }
    if (rows.length < PAGE_SIZE) break;
  }
  return cabine;
}

export function acRegionFromConfigs(rows: ConfigRow[]) {
  const votes = new Map<string, Map<ItalianRegion, number>>();
  for (const row of rows) {
    const codice = text(row.area_convenzionale)?.toUpperCase() ?? null;
    const region = regionFromParam(row.regione ?? undefined);
    if (!codice || !isAreaConvenzionaleCode(codice) || !region) continue;
    const bucket = votes.get(codice) ?? new Map<ItalianRegion, number>();
    bucket.set(region, (bucket.get(region) ?? 0) + 1);
    votes.set(codice, bucket);
  }

  const acToRegion = new Map<string, ItalianRegion>();
  for (const [codice, bucket] of votes) {
    const ranked = [...bucket.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "it"));
    const winner = ranked[0]?.[0];
    if (winner) acToRegion.set(codice, winner);
  }
  return acToRegion;
}

function nearestMappedRegion(
  lon: number,
  lat: number,
  mapped: { lon: number; lat: number; region: ItalianRegion }[],
) {
  if (mapped.length === 0) return null;
  let best: ItalianRegion | null = null;
  let bestDist = Infinity;
  for (const ref of mapped) {
    const d = (lon - ref.lon) ** 2 + (lat - ref.lat) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = ref.region;
    }
  }
  return best;
}

export async function countCabinePrimarieByRegion(rows: ConfigRow[]) {
  const cabine = await fetchGseCabinePrimarie();
  const acToRegion = acRegionFromConfigs(rows);
  const mappedRefs = cabine
    .filter((cabina) => acToRegion.has(cabina.codice))
    .map((cabina) => ({
      lon: cabina.lon,
      lat: cabina.lat,
      region: acToRegion.get(cabina.codice)!,
    }));

  const counts = new Map<ItalianRegion, number>(
    ITALIAN_REGIONS.map((region) => [region, 0]),
  );

  for (const cabina of cabine) {
    const region =
      acToRegion.get(cabina.codice) ??
      nearestMappedRegion(cabina.lon, cabina.lat, mappedRefs);
    if (!region) continue;
    counts.set(region, (counts.get(region) ?? 0) + 1);
  }

  return counts;
}
