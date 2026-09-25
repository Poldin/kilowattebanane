import { offerteClient } from "@/lib/offerte/client";
import { paginateSelect, offerteReadClient } from "@/lib/offerte/db";
import { romeToday } from "@/lib/offerte/dates";
import { PARETO_PLANS, PARETO_PLANS_FISSO } from "@/lib/offerte/pareto-cluster";
import { paretoFrontier, type ParetoHotAxis } from "@/lib/offerte/pareto";
import { loadLiveParetoHotAxes } from "@/lib/offerte/stats";
import {
  matchesAttivazioneFilter,
  matchesContrattoFilter,
  matchesPagamentoFilter,
} from "@/lib/offerte/portal-labels";
import type { OfferteCatalogFilters, OfferteExploreHit } from "@/lib/offerte/public-types";

type PointRow = {
  source: "placet" | "ml";
  cod_offerta: string;
  nome: string;
  venditore: string;
  venditore_key: string;
  cliente: ParetoHotAxis["cliente"];
  residenza: ParetoHotAxis["residenza"];
  prezzo: ParetoHotAxis["prezzo"];
  plan: ParetoHotAxis["plan"];
  monthly_eur: number;
  energy_eur_kwh: number;
  pagamento: string[] | null;
  attivazione: string[] | null;
  tipologia_contratto: string[] | null;
};

type FrontierRow = {
  rank: number;
  source: "placet" | "ml";
  cod_offerta: string;
  nome: string;
  venditore: string;
  venditore_key: string;
  tipo_cliente: string;
  tipo_offerta: string;
  plan: ParetoHotAxis["plan"];
};

const memory = new Map<string, ParetoHotAxis[]>();

export function paretoFilterKey(filters?: OfferteCatalogFilters) {
  const cliente = filters?.cliente ?? "tutti";
  const residente =
    cliente !== "domestico"
      ? "-"
      : filters?.residente === false
        ? "0"
        : filters?.residente === true
          ? "1"
          : "tutti";
  const prezzo = !filters?.prezzo || filters.prezzo === "tutti" ? "tutti" : filters.prezzo;
  const fascia = !filters?.fascia || filters.fascia === "tutti" ? "tutti" : filters.fascia;
  const mercato = !filters?.mercato || filters.mercato === "tutti" ? "tutti" : filters.mercato;
  const join = (values?: string[]) => (values?.length ? [...values].sort().join(",") : "-");
  return [cliente, residente, prezzo, fascia, mercato, join(filters?.pagamento), join(filters?.attivazione), join(filters?.contratto)].join("|");
}

export async function paretoHotOffers(filters?: OfferteCatalogFilters): Promise<OfferteExploreHit[]> {
  const asOf = romeToday();
  const key = paretoFilterKey(filters);
  const stored = await readFrontier(asOf, key);
  if (stored) return stored;
  const axes = await ensurePoints(asOf);
  const hits = paretoFrontier(filterAxes(axes, filters));
  await saveFrontier(asOf, key, hits);
  return hits.map(toHit);
}

async function ensurePoints(asOf: string) {
  const cached = memory.get(asOf);
  if (cached) return cached;
  const client = offerteReadClient();
  const { count, error } = await client
    .from("po_pareto_point")
    .select("cod_offerta", { count: "exact", head: true })
    .eq("as_of", asOf);
  if (error) throw new Error(error.message);
  if ((count ?? 0) > 0) {
    const axes = await readPoints(asOf);
    memory.set(asOf, axes);
    return axes;
  }
  const axes = await loadLiveParetoHotAxes();
  await writePoints(asOf, axes);
  for (const filters of mainClusters()) {
    const key = paretoFilterKey(filters);
    if (await readFrontier(asOf, key)) continue;
    await saveFrontier(asOf, key, paretoFrontier(filterAxes(axes, filters)));
  }
  memory.set(asOf, axes);
  return axes;
}

function mainClusters(): OfferteCatalogFilters[] {
  const clusters: OfferteCatalogFilters[] = [];
  for (const cliente of ["domestico", "non domestico"] as const) {
    const residences = cliente === "domestico" ? [true, false] : [undefined];
    for (const residente of residences) {
      for (const prezzo of ["prezzo fisso", "prezzo variabile"] as const) {
        const plans = prezzo === "prezzo variabile" ? PARETO_PLANS : PARETO_PLANS_FISSO;
        for (const fascia of plans) {
          clusters.push({ cliente, residente, prezzo, fascia, mercato: "tutti" });
        }
      }
    }
  }
  return clusters;
}

async function readPoints(asOf: string) {
  const rows = await paginateSelect<PointRow>((from, to) =>
    offerteReadClient()
      .from("po_pareto_point")
      .select(
        "source, cod_offerta, nome, venditore, venditore_key, cliente, residenza, prezzo, plan, monthly_eur, energy_eur_kwh, pagamento, attivazione, tipologia_contratto",
      )
      .eq("as_of", asOf)
      .range(from, to),
  );
  return rows.map(rowToAxis);
}

async function writePoints(asOf: string, axes: ParetoHotAxis[]) {
  const client = offerteClient();
  for (const group of chunk(axes, 200)) {
    const { error } = await client.from("po_pareto_point").upsert(
      group.map((axis) => ({
        as_of: asOf,
        source: axis.source,
        cod_offerta: axis.codOfferta,
        nome: axis.nome,
        venditore: axis.venditore,
        venditore_key: axis.venditoreKey,
        cliente: axis.cliente,
        residenza: axis.residenza,
        prezzo: axis.prezzo,
        plan: axis.plan,
        monthly_eur: axis.monthlyEur,
        energy_eur_kwh: axis.energyEurKwh,
        pagamento: axis.pagamento,
        attivazione: axis.attivazione,
        tipologia_contratto: axis.tipologiaContratto,
      })),
      { onConflict: "as_of,source,cod_offerta" },
    );
    if (error) throw new Error(error.message);
  }
}

async function readFrontier(asOf: string, key: string): Promise<OfferteExploreHit[] | null> {
  const client = offerteReadClient();
  const { data: slice, error } = await client
    .from("po_pareto_slice")
    .select("filter_key")
    .eq("as_of", asOf)
    .eq("filter_key", key)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!slice) return null;
  const rows = await paginateSelect<FrontierRow>((from, to) =>
    client
      .from("po_pareto_frontier")
      .select("rank, source, cod_offerta, nome, venditore, venditore_key, tipo_cliente, tipo_offerta, plan")
      .eq("as_of", asOf)
      .eq("filter_key", key)
      .order("rank")
      .range(from, to),
  );
  return rows.map((row) => ({
    source: row.source,
    codOfferta: row.cod_offerta,
    nome: row.nome,
    venditore: row.venditore,
    venditoreKey: row.venditore_key,
    tipoCliente: row.tipo_cliente,
    tipoOfferta: row.tipo_offerta,
    plan: row.plan,
  }));
}

async function saveFrontier(asOf: string, key: string, hits: ParetoHotAxis[]) {
  const client = offerteClient();
  const { error: sliceError } = await client
    .from("po_pareto_slice")
    .upsert({ as_of: asOf, filter_key: key }, { onConflict: "as_of,filter_key" });
  if (sliceError) throw new Error(sliceError.message);
  if (hits.length === 0) return;
  const { error } = await client.from("po_pareto_frontier").upsert(
    hits.map((hit, rank) => ({
      as_of: asOf,
      filter_key: key,
      rank,
      source: hit.source,
      cod_offerta: hit.codOfferta,
      nome: hit.nome,
      venditore: hit.venditore,
      venditore_key: hit.venditoreKey,
      tipo_cliente: hit.cliente,
      tipo_offerta: hit.prezzo === "fisso" ? "prezzo fisso" : "prezzo variabile",
      plan: hit.plan,
    })),
    { onConflict: "as_of,filter_key,source,cod_offerta" },
  );
  if (error) throw new Error(error.message);
}

function filterAxes(axes: ParetoHotAxis[], filters?: OfferteCatalogFilters) {
  if (!filters) return axes;
  return axes.filter((axis) => {
    if (filters.cliente && axis.cliente !== filters.cliente) return false;
    if (filters.mercato && filters.mercato !== "tutti" && axis.source !== filters.mercato) return false;
    if (filters.prezzo === "prezzo fisso" && axis.prezzo !== "fisso") return false;
    if (filters.prezzo === "prezzo variabile" && axis.prezzo !== "variabile") return false;
    if (filters.fascia && filters.fascia !== "tutti" && axis.plan !== filters.fascia) return false;
    if (filters.cliente === "domestico" && !matchesResidenza(axis.residenza, filters.residente)) return false;
    if (!matchesPagamentoFilter(axis.pagamento, filters.pagamento)) return false;
    if (!matchesAttivazioneFilter(axis.attivazione, filters.attivazione)) return false;
    if (!matchesContrattoFilter(axis.tipologiaContratto, filters.contratto)) return false;
    return true;
  });
}

function matchesResidenza(residenza: ParetoHotAxis["residenza"], wanted?: boolean) {
  if (wanted == null) return true;
  return residenza === (wanted ? "residente" : "non residente") || residenza === "entrambe";
}

function rowToAxis(row: PointRow): ParetoHotAxis {
  return {
    source: row.source,
    codOfferta: row.cod_offerta,
    nome: row.nome,
    venditore: row.venditore,
    venditoreKey: row.venditore_key,
    cliente: row.cliente,
    residenza: row.residenza,
    prezzo: row.prezzo,
    plan: row.plan,
    monthlyEur: Number(row.monthly_eur),
    energyEurKwh: Number(row.energy_eur_kwh),
    pagamento: row.pagamento ?? [],
    attivazione: row.attivazione ?? [],
    tipologiaContratto: row.tipologia_contratto ?? [],
  };
}

function toHit(axis: ParetoHotAxis): OfferteExploreHit {
  return {
    source: axis.source,
    codOfferta: axis.codOfferta,
    nome: axis.nome,
    venditore: axis.venditore,
    venditoreKey: axis.venditoreKey,
    tipoCliente: axis.cliente,
    tipoOfferta: axis.prezzo === "fisso" ? "prezzo fisso" : "prezzo variabile",
    plan: axis.plan,
  };
}

function chunk<T>(items: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
