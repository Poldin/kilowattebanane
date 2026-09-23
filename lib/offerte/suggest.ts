import { unstable_cache } from "next/cache";
import { resolveOffertePlan } from "@/lib/offerte/codice";
import { offerteReadClient, paginateSelect } from "@/lib/offerte/db";
import { romeToday } from "@/lib/offerte/dates";
import { placetFacts } from "@/lib/offerte/metrics";
import {
  ATTIVAZIONE_FILTERS,
  CONTRATTO_FILTERS,
  matchesAttivazioneFilter,
  matchesContrattoFilter,
  matchesPagamentoFilter,
  mlOfferDettaglio,
  PAGAMENTO_FILTERS,
  parsePortalFilterIds,
  placetOfferDettaglio,
} from "@/lib/offerte/portal-labels";
import { OFFERTE_CACHE_REVALIDATE, OFFERTE_CACHE_TAG } from "@/lib/offerte/revalidate";
import type {
  OfferteCatalogFilters,
  OfferteCliente,
  OfferteExploreHit,
  OfferteFascia,
  OfferteMercato,
  OfferteOfferTraits,
  OffertePrezzo,
  OfferteSuggestCategory,
  OfferteSuggestItem,
  OfferteSuggestResult,
} from "@/lib/offerte/public-types";

type PlacetSuggestRow = {
  cod_offerta: string;
  nome_offerta: string | null;
  denominazione: string | null;
  p_iva: string | null;
  url_sito_venditore: string | null;
  tipo_cliente: string | null;
  tipo_offerta: string | null;
  modalita_attivazione: string | null;
  modalita_pagamento: string | null;
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

type MlSuggestRow = {
  cod_offerta: string;
  nome_offerta: string | null;
  p_iva: string | null;
  url_sito_venditore: string | null;
  tipo_cliente: string | null;
  tipo_offerta: string | null;
  tipologia_fasce: string | null;
  tipologia_att_contr: string[] | string | null;
  modalita_attivazione: string[] | string | null;
  modalita_pagamento: string[] | string | null;
  domestico_residente: string | null;
};

type IndexOffer = {
  source: "placet" | "ml";
  codOfferta: string;
  nome: string;
  venditore: string;
  venditoreKey: string;
  tipoCliente: string | null;
  tipoOfferta: string;
  plan: OfferteOfferTraits["plan"];
  pagamento: string[];
  attivazione: string[];
  tipologiaContratto: string[];
  residenza: "residente" | "non residente" | "entrambe" | null;
};

const CATEGORY_LIMITS: Record<OfferteSuggestCategory, number> = {
  fornitore: 5,
  codice: 5,
  nome: 8,
};

const VENDOR_OFFER_LIMIT = 40;
const PLACET_SUGGEST_COLS =
  "cod_offerta, nome_offerta, denominazione, p_iva, url_sito_venditore, tipo_cliente, tipo_offerta, modalita_attivazione, modalita_pagamento, p_fix_f, p_fix_v, p_vol_f1, p_vol_f2, p_vol_f3, p_vol_bf1, p_vol_bf23, p_vol_mono, alpha";
const ML_SUGGEST_COLS =
  "cod_offerta, nome_offerta, p_iva, url_sito_venditore, tipo_cliente, tipo_offerta, tipologia_fasce, tipologia_att_contr, modalita_attivazione, modalita_pagamento, domestico_residente";

const loadSuggestIndex = unstable_cache(
  async (): Promise<IndexOffer[]> => {
    const today = romeToday();
    const client = offerteReadClient();
    const [placetRows, mlRows] = await Promise.all([
      paginateSelect<PlacetSuggestRow>((from, to) =>
        client
          .from("po_placet_e_live")
          .select(PLACET_SUGGEST_COLS)
          .lte("valid_from", today)
          .gte("valid_to", today)
          .range(from, to),
      ),
      paginateSelect<MlSuggestRow>((from, to) =>
        client
          .from("po_ml_e_live")
          .select(ML_SUGGEST_COLS)
          .lte("valid_from", today)
          .gte("valid_to", today)
          .range(from, to),
      ),
    ]);

    return [
      ...placetRows.map((row) => toPlacetIndexOffer(row)),
      ...mlRows.map((row) => toMlIndexOffer(row)),
    ];
  },
  ["offerte-suggest-index-v3"],
  { revalidate: OFFERTE_CACHE_REVALIDATE, tags: [OFFERTE_CACHE_TAG] },
);

function toPlacetIndexOffer(row: PlacetSuggestRow): IndexOffer {
  const venditoreKey = vendorKey(row.p_iva, row.url_sito_venditore);
  const venditore =
    row.denominazione?.replace(/\s+/g, " ").trim() ||
    vendorFromUrl(row.url_sito_venditore, row.p_iva) ||
    "Venditore";
  const nome = row.nome_offerta?.replace(/\s+/g, " ").trim() || row.cod_offerta;
  const tipoOfferta = row.tipo_offerta ?? "";
  const dettaglio = placetOfferDettaglio({
    telefono: null,
    modalita_attivazione: row.modalita_attivazione,
    modalita_pagamento: row.modalita_pagamento,
    coverage: null,
  });
  return {
    source: "placet",
    codOfferta: row.cod_offerta,
    nome,
    venditore,
    venditoreKey,
    tipoCliente: row.tipo_cliente,
    tipoOfferta,
    plan: resolveOffertePlan(
      { source: "placet", tipoOfferta, codOfferta: row.cod_offerta },
      placetFacts(row).plan,
    ),
    pagamento: dettaglio.pagamento,
    attivazione: dettaglio.attivazione,
    tipologiaContratto: dettaglio.tipologiaContratto,
    residenza: null,
  };
}

function toMlIndexOffer(row: MlSuggestRow): IndexOffer {
  const venditoreKey = vendorKey(row.p_iva, row.url_sito_venditore);
  const venditore = vendorFromUrl(row.url_sito_venditore, row.p_iva) || "Venditore";
  const nome = row.nome_offerta?.replace(/\s+/g, " ").trim() || row.cod_offerta;
  const tipoOfferta = row.tipo_offerta ?? "";
  const dettaglio = mlOfferDettaglio({
    descrizione: null,
    garanzie: null,
    telefono: null,
    tipologia_att_contr: row.tipologia_att_contr,
    modalita_attivazione: row.modalita_attivazione,
    modalita_pagamento: row.modalita_pagamento,
    domestico_residente: row.domestico_residente,
    offerta_singola: null,
    offerta_onnicomprensiva: null,
    consumo_min: null,
    consumo_max: null,
    potenza_min: null,
    potenza_max: null,
    idx_prezzo_energia: null,
    coefficiente: null,
    coverage: null,
  });
  return {
    source: "ml",
    codOfferta: row.cod_offerta,
    nome,
    venditore,
    venditoreKey,
    tipoCliente: row.tipo_cliente,
    tipoOfferta,
    plan: resolveOffertePlan(
      { source: "ml", tipoOfferta, codOfferta: row.cod_offerta },
      mlBandPlan(row.tipologia_fasce),
    ),
    pagamento: dettaglio.pagamento,
    attivazione: dettaglio.attivazione,
    tipologiaContratto: dettaglio.tipologiaContratto,
    residenza: residenzaFromCode(row.domestico_residente),
  };
}

function residenzaFromCode(value: string | null): IndexOffer["residenza"] {
  const raw = value?.trim();
  if (!raw) return null;
  const code = /^\d+$/.test(raw) ? raw.padStart(2, "0") : raw;
  if (code === "01") return "residente";
  if (code === "02") return "non residente";
  if (code === "03") return "entrambe";
  return null;
}

function matchesResidenzaFilter(residenza: IndexOffer["residenza"], wanted?: boolean) {
  if (wanted == null) return true;
  if (residenza == null || residenza === "entrambe") return true;
  return wanted ? residenza === "residente" : residenza === "non residente";
}

function mlBandPlan(tipologia: string | null): OfferteOfferTraits["plan"] {
  if (tipologia === "01") return "monoraria";
  if (tipologia === "91" || tipologia === "92" || tipologia === "93") return "bioraria";
  if (tipologia === "03") return "fasce";
  return null;
}

function vendorKey(piva: string | null, url: string | null) {
  return piva || hostnameFromUrl(url) || "sconosciuto";
}

function vendorFromUrl(url: string | null, piva: string | null) {
  return hostnameFromUrl(url) ?? (piva ? `P.IVA ${piva}` : null);
}

function hostnameFromUrl(url: string | null) {
  const href = absoluteVendorUrl(url);
  if (!href) return null;
  try {
    return new URL(href).hostname.replace(/^www\./, "") || null;
  } catch {
    return null;
  }
}

function absoluteVendorUrl(url: string | null) {
  const raw = url?.trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw.replace(/^\/\//, "")}`;
}

function normalizeQuery(q: string) {
  return q.trim().toLowerCase().replace(/\s+/g, " ");
}

function scoreMatch(haystack: string, needle: string) {
  const value = haystack.toLowerCase();
  if (value === needle) return 0;
  if (value.startsWith(needle)) return 1;
  const index = value.indexOf(needle);
  return index >= 0 ? 2 + index / 100 : 99;
}

export function parseCatalogFilters(params: URLSearchParams): OfferteCatalogFilters {
  const clienteRaw = params.get("cliente");
  const cliente: OfferteCliente | undefined =
    clienteRaw === "non domestico" || clienteRaw === "domestico" ? clienteRaw : undefined;
  const mercatoRaw = params.get("mercato");
  const mercato: OfferteMercato | undefined =
    mercatoRaw === "placet" || mercatoRaw === "ml" || mercatoRaw === "tutti" ? mercatoRaw : undefined;
  const prezzoRaw = params.get("prezzo");
  const prezzo: OffertePrezzo | undefined =
    prezzoRaw === "prezzo fisso" || prezzoRaw === "prezzo variabile" || prezzoRaw === "tutti"
      ? prezzoRaw
      : undefined;
  const fasciaRaw = params.get("fascia");
  const fascia: OfferteFascia | undefined =
    fasciaRaw === "monoraria" ||
    fasciaRaw === "bioraria" ||
    fasciaRaw === "fasce" ||
    fasciaRaw === "dinamica" ||
    fasciaRaw === "tutti"
      ? fasciaRaw
      : undefined;
  const residenteRaw = params.get("residente");
  return {
    cliente,
    mercato,
    prezzo,
    fascia,
    residente:
      residenteRaw === "0" ? false : residenteRaw === "1" ? true : undefined,
    pagamento: parsePortalFilterIds(params.get("pagamento"), PAGAMENTO_FILTERS),
    attivazione: parsePortalFilterIds(params.get("attivazione"), ATTIVAZIONE_FILTERS),
    contratto: parsePortalFilterIds(params.get("contratto"), CONTRATTO_FILTERS),
  };
}

function matchesCatalogFilters(offer: IndexOffer, filters?: OfferteCatalogFilters) {
  if (!filters) return true;
  if (filters.cliente && offer.tipoCliente !== filters.cliente) return false;
  if (filters.mercato && filters.mercato !== "tutti" && offer.source !== filters.mercato) {
    return false;
  }
  if (filters.prezzo && filters.prezzo !== "tutti" && offer.tipoOfferta !== filters.prezzo) {
    return false;
  }
  if (filters.fascia && filters.fascia !== "tutti" && offer.plan !== filters.fascia) return false;
  if (filters.cliente === "domestico" && !matchesResidenzaFilter(offer.residenza, filters.residente)) {
    return false;
  }
  if (!matchesPagamentoFilter(offer.pagamento, filters.pagamento)) return false;
  if (!matchesAttivazioneFilter(offer.attivazione, filters.attivazione)) return false;
  if (!matchesContrattoFilter(offer.tipologiaContratto, filters.contratto)) return false;
  return true;
}

export async function suggestOfferte(
  rawQuery: string,
  vendorKey?: string | null,
  filters?: OfferteCatalogFilters,
): Promise<OfferteSuggestResult> {
  const q = normalizeQuery(rawQuery);
  const scopedVendor = vendorKey?.trim() || null;
  if (!scopedVendor && q.length < 2) return { q: rawQuery.trim(), items: [] };

  const index = (await loadSuggestIndex()).filter((offer) => matchesCatalogFilters(offer, filters));

  if (scopedVendor) {
    const offers = index
      .filter((offer) => offer.venditoreKey === scopedVendor)
      .sort((a, b) => a.nome.localeCompare(b.nome, "it") || a.codOfferta.localeCompare(b.codOfferta));
    return {
      q: rawQuery.trim(),
      items: offers.slice(0, VENDOR_OFFER_LIMIT).map((offer) => toNomeItem(offer, offer.codOfferta)),
    };
  }

  const items: OfferteSuggestItem[] = [];

  const vendorMap = new Map<
    string,
    { venditore: string; offerte: number; placet: number; ml: number }
  >();
  for (const offer of index) {
    const acc = vendorMap.get(offer.venditoreKey) ?? {
      venditore: offer.venditore,
      offerte: 0,
      placet: 0,
      ml: 0,
    };
    acc.offerte += 1;
    if (offer.source === "placet") acc.placet += 1;
    else acc.ml += 1;
    vendorMap.set(offer.venditoreKey, acc);
  }

  const vendors = [...vendorMap.entries()]
    .filter(([, acc]) => acc.venditore.toLowerCase().includes(q))
    .sort(
      (a, b) =>
        scoreMatch(a[1].venditore, q) - scoreMatch(b[1].venditore, q) ||
        b[1].offerte - a[1].offerte ||
        a[1].venditore.localeCompare(b[1].venditore, "it"),
    )
    .slice(0, CATEGORY_LIMITS.fornitore);

  for (const [key, acc] of vendors) {
    items.push({
      id: `fornitore:${key}`,
      category: "fornitore",
      label: acc.venditore,
      detail: `${acc.offerte} offerte`,
      codOfferta: null,
      venditoreKey: key,
      venditore: acc.venditore,
      source: acc.placet > 0 && acc.ml > 0 ? null : acc.placet > 0 ? "placet" : "ml",
    });
  }

  const codes = index
    .filter((offer) => offer.codOfferta.toLowerCase().includes(q))
    .sort(
      (a, b) =>
        scoreMatch(a.codOfferta, q) - scoreMatch(b.codOfferta, q) ||
        a.nome.localeCompare(b.nome, "it"),
    )
    .slice(0, CATEGORY_LIMITS.codice);

  for (const offer of codes) {
    items.push({
      id: `codice:${offer.source}:${offer.codOfferta}`,
      category: "codice",
      label: offer.codOfferta,
      detail: offer.nome,
      codOfferta: offer.codOfferta,
      venditoreKey: offer.venditoreKey,
      venditore: offer.venditore,
      source: offer.source,
      tipoCliente: offer.tipoCliente,
      tipoOfferta: offer.tipoOfferta,
      plan: offer.plan,
    });
  }

  const names = index
    .filter((offer) => offer.nome.toLowerCase().includes(q))
    .sort(
      (a, b) =>
        scoreMatch(a.nome, q) - scoreMatch(b.nome, q) ||
        a.venditore.localeCompare(b.venditore, "it"),
    )
    .slice(0, CATEGORY_LIMITS.nome);

  for (const offer of names) {
    items.push(toNomeItem(offer, `${offer.venditore} · ${offer.codOfferta}`));
  }

  return { q: rawQuery.trim(), items };
}

function toNomeItem(offer: IndexOffer, detail: string): OfferteSuggestItem {
  return {
    id: `nome:${offer.source}:${offer.codOfferta}`,
    category: "nome",
    label: offer.nome,
    detail,
    codOfferta: offer.codOfferta,
    venditoreKey: offer.venditoreKey,
    venditore: offer.venditore,
    source: offer.source,
    tipoCliente: offer.tipoCliente,
    tipoOfferta: offer.tipoOfferta,
    plan: offer.plan,
  };
}

function toExploreHit(offer: IndexOffer): OfferteExploreHit {
  return {
    source: offer.source,
    codOfferta: offer.codOfferta,
    nome: offer.nome,
    venditore: offer.venditore,
    venditoreKey: offer.venditoreKey,
    tipoCliente: offer.tipoCliente,
    tipoOfferta: offer.tipoOfferta,
    plan: offer.plan,
  };
}

const EXPLORE_DEFAULT_LIMIT = 10;

export async function exploreOffers(
  limit = EXPLORE_DEFAULT_LIMIT,
  filters?: OfferteCatalogFilters,
): Promise<OfferteExploreHit[]> {
  const index = await loadSuggestIndex();
  const matched = index.filter((offer) => matchesCatalogFilters(offer, filters));
  const capped = Math.max(1, Math.min(limit, 20));
  return matched.slice(0, capped).map(toExploreHit);
}
