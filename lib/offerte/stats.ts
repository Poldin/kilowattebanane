import { unstable_cache } from "next/cache";
import { areraPrezzoOrarioKind, resolveOffertePlan } from "@/lib/offerte/codice";
import { offerteReadClient, paginateSelect } from "@/lib/offerte/db";
import { romeToday } from "@/lib/offerte/dates";
import { placetFacts, type OfferteFasciaPlan } from "@/lib/offerte/metrics";
import type {
  OfferteClusterBucket,
  OfferteClusterStats,
  OfferteHeadlineStats,
} from "@/lib/offerte/public-types";

export type { OfferteClusterStats, OfferteHeadlineStats } from "@/lib/offerte/public-types";

type HeadlineRow = {
  p_iva: string | null;
  tipo_offerta: string | null;
  last_seen_on: string | null;
};

type PlacetClusterRow = HeadlineRow & {
  tipo_cliente: string | null;
  coverage: string | null;
  cod_offerta: string;
  p_fix_f: number | null;
  p_fix_v: number | null;
  p_vol_f1: number | null;
  p_vol_f2: number | null;
  p_vol_f3: number | null;
  p_vol_bf1: number | null;
  p_vol_bf23: number | null;
  p_vol_mono: number | null;
  alpha: number | null;
};

type MlClusterRow = HeadlineRow & {
  tipo_cliente: string | null;
  coverage: string | null;
  cod_offerta: string;
  tipologia_fasce: string | null;
};

type ClusterRow = {
  source: "placet" | "ml";
  p_iva: string | null;
  last_seen_on: string | null;
  cliente: string;
  prezzo: string;
  coverage: string;
  fascia: string;
};

export const loadOfferteHeadlineStats = unstable_cache(
  async (): Promise<OfferteHeadlineStats> => {
    const rows = await loadLiveHeadlineRows();
    return headlineFromRows(rows, romeToday());
  },
  ["offerte-headline-stats"],
  { revalidate: 3600 },
);

export const loadOfferteClusterStats = unstable_cache(
  async (): Promise<OfferteClusterStats> => {
    const today = romeToday();
    const [placetRows, mlRows] = await Promise.all([
      paginateSelect<PlacetClusterRow>((from, to) =>
        offerteReadClient()
          .from("po_placet_e_live")
          .select(
            "p_iva, tipo_offerta, tipo_cliente, coverage, last_seen_on, cod_offerta, p_fix_f, p_fix_v, p_vol_f1, p_vol_f2, p_vol_f3, p_vol_bf1, p_vol_bf23, p_vol_mono, alpha",
          )
          .lte("valid_from", today)
          .gte("valid_to", today)
          .range(from, to),
      ),
      paginateSelect<MlClusterRow>((from, to) =>
        offerteReadClient()
          .from("po_ml_e_live")
          .select(
            "p_iva, tipo_offerta, tipo_cliente, coverage, last_seen_on, cod_offerta, tipologia_fasce",
          )
          .lte("valid_from", today)
          .gte("valid_to", today)
          .range(from, to),
      ),
    ]);

    const rows: ClusterRow[] = [
      ...placetRows.map((row) => ({
        source: "placet" as const,
        p_iva: row.p_iva,
        last_seen_on: row.last_seen_on,
        cliente: clienteKey(row.tipo_cliente),
        prezzo: prezzoKey(row.tipo_offerta),
        coverage: coverageKey(row.coverage),
        fascia: fasciaKey({
          source: "placet",
          tipoOfferta: row.tipo_offerta ?? "",
          codOfferta: row.cod_offerta,
          plan: placetFacts(row).plan,
        }),
      })),
      ...mlRows.map((row) => ({
        source: "ml" as const,
        p_iva: row.p_iva,
        last_seen_on: row.last_seen_on,
        cliente: clienteKey(row.tipo_cliente),
        prezzo: prezzoKey(row.tipo_offerta),
        coverage: coverageKey(row.coverage),
        fascia: fasciaKey({
          source: "ml",
          tipoOfferta: row.tipo_offerta ?? "",
          codOfferta: row.cod_offerta,
          plan: mlBandPlan(row.tipologia_fasce, row.cod_offerta),
        }),
      })),
    ];

    const headline = headlineFromRows(rows, today);

    return {
      ...headline,
      cliente: buckets(
        rows,
        (row) => row.cliente,
        [
          ["domestico", "Casa"],
          ["non domestico", "Partita IVA"],
          ["condominio", "Condominio"],
          ["altro", "Altro"],
        ],
      ),
      prezzo: buckets(
        rows,
        (row) => row.prezzo,
        [
          ["fisso", "Fisso"],
          ["variabile", "Variabile"],
          ["altro", "Altro"],
        ],
      ),
      mercato: buckets(
        rows,
        (row) => row.source,
        [
          ["placet", "PLACET"],
          ["ml", "Mercato libero"],
        ],
      ),
      copertura: buckets(
        rows,
        (row) => row.coverage,
        [
          ["nazionale", "Tutta Italia"],
          ["selettiva", "Solo alcuni territori"],
          ["altro", "Altro"],
        ],
      ),
      fascia: buckets(
        rows,
        (row) => row.fascia,
        [
          ["monoraria", "Monoraria"],
          ["bioraria", "Bioraria"],
          ["fasce", "A fasce"],
          ["dinamica", "Dinamica"],
          ["altro", "Non classificata"],
        ],
      ),
    };
  },
  ["offerte-cluster-stats"],
  { revalidate: 3600 },
);

async function loadLiveHeadlineRows() {
  const client = offerteReadClient();
  const today = romeToday();
  const [placetRows, mlRows] = await Promise.all([
    paginateSelect<HeadlineRow>((from, to) =>
      client
        .from("po_placet_e_live")
        .select("p_iva, tipo_offerta, last_seen_on")
        .lte("valid_from", today)
        .gte("valid_to", today)
        .range(from, to),
    ),
    paginateSelect<HeadlineRow>((from, to) =>
      client
        .from("po_ml_e_live")
        .select("p_iva, tipo_offerta, last_seen_on")
        .lte("valid_from", today)
        .gte("valid_to", today)
        .range(from, to),
    ),
  ]);
  return [
    ...placetRows.map((row) => ({ ...row, source: "placet" as const })),
    ...mlRows.map((row) => ({ ...row, source: "ml" as const })),
  ];
}

function headlineFromRows(
  rows: Array<{
    source: "placet" | "ml";
    p_iva: string | null;
    tipo_offerta?: string | null;
    prezzo?: string;
    last_seen_on: string | null;
  }>,
  today: string,
): OfferteHeadlineStats {
  const vendors = new Set(
    rows.map((row) => row.p_iva).filter((value): value is string => Boolean(value)),
  );
  const snapshotDate =
    rows.reduce<string | null>((latest, row) => {
      if (!row.last_seen_on) return latest;
      if (!latest || row.last_seen_on > latest) return row.last_seen_on;
      return latest;
    }, null) ?? today;

  return {
    snapshotDate,
    placet: rows.filter((row) => row.source === "placet").length,
    ml: rows.filter((row) => row.source === "ml").length,
    total: rows.length,
    venditori: vendors.size,
    fisso: rows.filter((row) =>
      row.prezzo ? row.prezzo === "fisso" : (row.tipo_offerta ?? "").includes("fisso"),
    ).length,
    variabile: rows.filter((row) =>
      row.prezzo
        ? row.prezzo === "variabile"
        : (row.tipo_offerta ?? "").includes("variabile"),
    ).length,
  };
}

function buckets(
  rows: ClusterRow[],
  pick: (row: ClusterRow) => string,
  order: [string, string][],
): OfferteClusterBucket[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = pick(row);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return order
    .map(([key, label]) => ({ key, label, count: counts.get(key) ?? 0 }))
    .filter((bucket) => bucket.count > 0);
}

function clienteKey(tipo: string | null) {
  if (tipo?.includes("non domestico")) return "non domestico";
  if (tipo?.includes("condominio")) return "condominio";
  if (tipo?.includes("domestico")) return "domestico";
  return "altro";
}

function prezzoKey(tipo: string | null) {
  if (tipo?.includes("variabile")) return "variabile";
  if (tipo?.includes("fisso")) return "fisso";
  return "altro";
}

function coverageKey(coverage: string | null) {
  if (coverage === "nazionale" || coverage === "selettiva") return coverage;
  return "altro";
}

function mlBandPlan(tipologia: string | null, codOfferta: string): OfferteFasciaPlan | null {
  if (tipologia === "01") return "monoraria";
  if (tipologia === "91" || tipologia === "92" || tipologia === "93") return "bioraria";
  if (tipologia === "03") return "fasce";
  const kind = areraPrezzoOrarioKind(codOfferta);
  if (kind === "fasce") return "fasce";
  if (kind === "monorario") return "monoraria";
  return null;
}

function fasciaKey(hit: {
  source: "placet" | "ml";
  tipoOfferta: string;
  codOfferta: string;
  plan: OfferteFasciaPlan | null;
}) {
  return resolveOffertePlan(hit, hit.plan) ?? "altro";
}
