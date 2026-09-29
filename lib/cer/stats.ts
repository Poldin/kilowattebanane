import { unstable_cache } from "next/cache";
import { countCabinePrimarieByRegion } from "@/lib/cer/cabine";
import { cerReadClient } from "@/lib/cer/client";
import type {
  CerClusterBucket,
  CerRegionStat,
  CerStats,
  CerTipologiaKind,
} from "@/lib/cer/public-types";
import { CER_CACHE_REVALIDATE, CER_CACHE_TAG } from "@/lib/cer/revalidate";
import { ITALIAN_REGIONS, regionFromParam, type ItalianRegion } from "@/lib/market-zones";

type LiveRow = {
  codice_richiesta: string;
  tipologia: string | null;
  tipologia_kind: CerTipologiaKind;
  denominazione: string | null;
  potenza_kw: number | string | null;
  n_impianti: number | null;
  n_utenze: number | null;
  regione: string | null;
  area_convenzionale: string | null;
  gestore_rete: string | null;
  gse_aggiornato_il: string | null;
  in_vetrina: boolean;
  last_seen_on: string | null;
};

const KIND_LABEL: Record<CerTipologiaKind, string> = {
  cer: "CER",
  auc: "Autoconsumo collettivo",
  individuale: "Individuale a distanza",
  gruppo_clienti: "Gruppi di clienti attivi",
  cliente_attivo: "Clienti attivi a distanza",
};

const KIND_ORDER: CerTipologiaKind[] = [
  "cer",
  "auc",
  "individuale",
  "gruppo_clienti",
  "cliente_attivo",
];

const POTENZA_BUCKETS = [
  { key: "0-20", label: "fino a 20 kW", max: 20 },
  { key: "20-200", label: "20–200 kW", max: 200 },
  { key: "200-1000", label: "200–1.000 kW", max: 1000 },
  { key: "1000+", label: "oltre 1.000 kW", max: Infinity },
] as const;

const UTENZE_BUCKETS = [
  { key: "1-10", label: "fino a 10 utenze", max: 10 },
  { key: "11-50", label: "11–50 utenze", max: 50 },
  { key: "51-200", label: "51–200 utenze", max: 200 },
  { key: "200+", label: "oltre 200 utenze", max: Infinity },
] as const;

type PotenzaBucketKey = (typeof POTENZA_BUCKETS)[number]["key"];
type UtenzeBucketKey = (typeof UTENZE_BUCKETS)[number]["key"];

async function loadLiveRows() {
  const client = cerReadClient();
  const page = 1000;
  const rows: LiveRow[] = [];
  for (let from = 0; ; from += page) {
    const { data, error } = await client
      .from("cer_configurazioni_live")
      .select(
        "codice_richiesta, tipologia, tipologia_kind, denominazione, potenza_kw, n_impianti, n_utenze, regione, area_convenzionale, gestore_rete, gse_aggiornato_il, in_vetrina, last_seen_on",
      )
      .range(from, from + page - 1);
    if (error) throw new Error(error.message);
    const chunk = (data ?? []) as unknown as LiveRow[];
    rows.push(...chunk);
    if (chunk.length < page) break;
  }
  return rows;
}

function num(value: number | string | null | undefined) {
  if (value == null) return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function median(values: number[]) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid]!;
  return (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function countBy(keys: string[]) {
  const map = new Map<string, number>();
  for (const key of keys) map.set(key, (map.get(key) ?? 0) + 1);
  return map;
}

function bucketsFrom(
  counts: Map<string, number>,
  order: { key: string; label: string }[],
): CerClusterBucket[] {
  return order.map((item) => ({
    key: item.key,
    label: item.label,
    count: counts.get(item.key) ?? 0,
  }));
}

function topPlusAltre(
  counts: Map<string, number>,
  limit: number,
  labelOf: (key: string) => string,
): CerClusterBucket[] {
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const top = ranked.slice(0, limit);
  const rest = ranked.slice(limit);
  const altre = rest.reduce((sum, [, n]) => sum + n, 0);
  const buckets: CerClusterBucket[] = top.map(([key, count]) => ({
    key,
    label: labelOf(key),
    count,
  }));
  if (altre > 0) buckets.push({ key: "altre", label: "Altre", count: altre });
  return buckets;
}

function gestoreKey(raw: string | null) {
  if (!raw) return "non indicato";
  const n = raw.trim().toLowerCase();
  if (n.includes("e-distribuzione") || n.includes("e distribuzione")) {
    return "e-distribuzione";
  }
  return raw.trim();
}

function potenzaKey(value: number | null): PotenzaBucketKey | null {
  if (value == null) return null;
  for (const bucket of POTENZA_BUCKETS) {
    if (value <= bucket.max) return bucket.key;
  }
  return "1000+";
}

function utenzeKey(value: number | null): UtenzeBucketKey | null {
  if (value == null) return null;
  for (const bucket of UTENZE_BUCKETS) {
    if (value <= bucket.max) return bucket.key;
  }
  return "200+";
}

function rowsByCanonicalRegion(rows: LiveRow[]) {
  const by = new Map<ItalianRegion, LiveRow[]>(
    ITALIAN_REGIONS.map((region) => [region, []]),
  );
  for (const row of rows) {
    const key = regionFromParam(row.regione ?? undefined);
    if (!key) continue;
    by.get(key)!.push(row);
  }
  return by;
}

function regionStats(
  rows: LiveRow[],
  cabineByRegion: Map<ItalianRegion, number> | null,
): CerRegionStat[] {
  const by = rowsByCanonicalRegion(rows);
  return ITALIAN_REGIONS.map((key) => {
    const list = by.get(key) ?? [];
    const cer = list.filter((row) => row.tipologia_kind === "cer");
    const potenza = list
      .map((row) => num(row.potenza_kw))
      .filter((value): value is number => value != null);
    const utenze = list
      .map((row) => row.n_utenze)
      .filter((value): value is number => value != null);
    return {
      key,
      label: key,
      total: list.length,
      cer: cer.length,
      cerUniche: new Set(
        cer.map((row) => (row.denominazione ?? row.codice_richiesta).trim().toLowerCase()),
      ).size,
      cerInVetrina: cer.filter((row) => row.in_vetrina).length,
      cabinePrimarie: cabineByRegion?.get(key) ?? null,
      medianaPotenzaKw: median(potenza),
      potenzaKwTotale: potenza.length > 0 ? potenza.reduce((sum, value) => sum + value, 0) : null,
      medianaUtenze: median(utenze),
      utenzeTotale: utenze.length > 0 ? utenze.reduce((sum, value) => sum + value, 0) : null,
    };
  }).sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, "it"));
}

function statsFromRows(
  rows: LiveRow[],
  cabineByRegion: Map<ItalianRegion, number> | null,
): CerStats {
  const cerRows = rows.filter((row) => row.tipologia_kind === "cer");
  const kindCounts = countBy(rows.map((row) => row.tipologia_kind));
  const regioni = regionStats(rows, cabineByRegion);
  const regioneCounts = new Map(regioni.map((row) => [row.key, row.total]));
  const gestoreCounts = countBy(rows.map((row) => gestoreKey(row.gestore_rete)));
  const potenzaCounts = countBy(
    rows
      .map((row) => potenzaKey(num(row.potenza_kw)))
      .filter((key): key is PotenzaBucketKey => key != null),
  );
  const utenzeCounts = countBy(
    rows
      .map((row) => utenzeKey(row.n_utenze))
      .filter((key): key is UtenzeBucketKey => key != null),
  );

  const snapshotDate =
    rows.map((row) => row.gse_aggiornato_il).find((value) => value != null) ??
    rows.map((row) => row.last_seen_on).find((value) => value != null) ??
    null;
  const potenze = rows
    .map((row) => num(row.potenza_kw))
    .filter((value): value is number => value != null);
  const utenze = rows
    .map((row) => row.n_utenze)
    .filter((value): value is number => value != null);
  const impianti = rows
    .map((row) => row.n_impianti)
    .filter((value): value is number => value != null);

  return {
    total: rows.length,
    cer: cerRows.length,
    cerUniche: new Set(
      cerRows.map((row) => (row.denominazione ?? row.codice_richiesta).trim().toLowerCase()),
    ).size,
    cerInVetrina: cerRows.filter((row) => row.in_vetrina).length,
    cabinePrimarie: cabineByRegion
      ? [...cabineByRegion.values()].reduce((sum, count) => sum + count, 0)
      : null,
    snapshotDate,
    ingestedOn: rows.map((row) => row.last_seen_on).find((value) => value != null) ?? null,
    tipologia: bucketsFrom(
      kindCounts,
      KIND_ORDER.map((key) => ({ key, label: KIND_LABEL[key] })),
    ),
    vetrina: [
      {
        key: "vetrina",
        label: "In vetrina GSE",
        count: cerRows.filter((row) => row.in_vetrina).length,
      },
      {
        key: "mappa",
        label: "Solo mappa",
        count: cerRows.filter((row) => !row.in_vetrina).length,
      },
    ],
    regione: topPlusAltre(regioneCounts, 8, (key) => key),
    regioni,
    gestore: topPlusAltre(gestoreCounts, 5, (key) =>
      key === "e-distribuzione" ? "e-distribuzione" : key,
    ),
    potenza: bucketsFrom(
      potenzaCounts,
      POTENZA_BUCKETS.map((bucket) => ({ key: bucket.key, label: bucket.label })),
    ),
    utenze: bucketsFrom(
      utenzeCounts,
      UTENZE_BUCKETS.map((bucket) => ({ key: bucket.key, label: bucket.label })),
    ),
    medianaPotenzaKw: median(potenze),
    medianaUtenze: median(utenze),
    potenzaKwTotale: potenze.length > 0 ? potenze.reduce((sum, value) => sum + value, 0) : null,
    utenzeTotale: utenze.length > 0 ? utenze.reduce((sum, value) => sum + value, 0) : null,
    impiantiTotale:
      impianti.length > 0 ? impianti.reduce((sum, value) => sum + value, 0) : null,
  };
}

async function buildCerStats(rows: LiveRow[]) {
  const cabineByRegion = await countCabinePrimarieByRegion(rows).catch(() => null);
  return statsFromRows(rows, cabineByRegion);
}

export const loadCerStats = unstable_cache(
  async (): Promise<CerStats> => buildCerStats(await loadLiveRows()),
  ["cer-stats-v6"],
  { revalidate: CER_CACHE_REVALIDATE, tags: [CER_CACHE_TAG] },
);
