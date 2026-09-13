import { offerteReadClient, paginateSelect } from "@/lib/offerte/db";
import { romeToday } from "@/lib/offerte/dates";
import type { MlComponentInput } from "@/lib/offerte/estimate";
import { resolveOffertePlan } from "@/lib/offerte/codice";
import { compareOfferFacts, mlFacts, placetFacts } from "@/lib/offerte/metrics";
import {
  formatScontoValore,
  mlOfferDettaglio,
  placetOfferDettaglio,
} from "@/lib/offerte/portal-labels";
import type {
  CapPlace,
  OfferteFascia,
  OfferteSearchHit,
  OfferteSearchQuery,
  OfferteSearchResult,
  OfferteSconto,
} from "@/lib/offerte/public-types";

export type {
  CapPlace,
  OfferteCliente,
  OfferteFascia,
  OfferteMercato,
  OffertePrezzo,
  OfferteSearchHit,
  OfferteSearchQuery,
  OfferteSearchResult,
} from "@/lib/offerte/public-types";
export {
  PORTALE_OFFERTE_HOME,
  PORTALE_OFFERTE_URL,
} from "@/lib/offerte/public-types";

type CoverageRow = {
  offer_id: number;
  livello: string;
  codice: string;
};

type PlacetRow = {
  id: number;
  cod_offerta: string;
  denominazione: string | null;
  nome_offerta: string | null;
  tipo_offerta: string | null;
  tipo_cliente: string | null;
  coverage: string;
  valid_from: string;
  valid_to: string;
  url_offerta: string | null;
  url_sito_venditore: string | null;
  telefono: string | null;
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

type MlRow = {
  id: number;
  cod_offerta: string;
  p_iva: string | null;
  nome_offerta: string | null;
  descrizione: string | null;
  tipo_offerta: string | null;
  tipo_cliente: string | null;
  coverage: string;
  valid_from: string;
  valid_to: string;
  url_offerta: string | null;
  url_sito_venditore: string | null;
  telefono: string | null;
  garanzie: string | null;
  tipologia_att_contr: string[] | string | null;
  modalita_attivazione: string[] | string | null;
  modalita_pagamento: string[] | string | null;
  domestico_residente: string | null;
  offerta_singola: string | null;
  offerta_onnicomprensiva: string | null;
  idx_prezzo_energia: string | null;
  coefficiente: number | null;
  tipologia_fasce: string | null;
  durata: number | null;
  consumo_min: number | null;
  consumo_max: number | null;
  potenza_min: number | null;
  potenza_max: number | null;
};

type MlScontoRow = {
  offer_id: number;
  nome: string | null;
  descrizione: string | null;
  valore: number | string | null;
  unita_misura: string | null;
};

type MlCompRow = MlComponentInput & { offer_id: number };

const PLACET_DURATA_MESI = 12;

const PLACET_COLS =
  "id, cod_offerta, denominazione, nome_offerta, tipo_offerta, tipo_cliente, coverage, valid_from, valid_to, url_offerta, url_sito_venditore, telefono, modalita_attivazione, modalita_pagamento, p_fix_f, p_fix_v, p_vol_f1, p_vol_f2, p_vol_f3, p_vol_bf1, p_vol_bf23, p_vol_mono, alpha";
const ML_COLS =
  "id, cod_offerta, p_iva, nome_offerta, descrizione, tipo_offerta, tipo_cliente, coverage, valid_from, valid_to, url_offerta, url_sito_venditore, telefono, garanzie, tipologia_att_contr, modalita_attivazione, modalita_pagamento, domestico_residente, offerta_singola, offerta_onnicomprensiva, idx_prezzo_energia, coefficiente, tipologia_fasce, durata, consumo_min, consumo_max, potenza_min, potenza_max";

export async function lookupCap(cap: string) {
  const normalized = cap.replace(/\D/g, "");
  if (!/^\d{5}$/.test(normalized)) return [] as CapPlace[];
  const client = offerteReadClient();
  const { data: capRows, error: capError } = await client
    .from("po_geo_cap")
    .select("cap, comune_codice")
    .eq("cap", normalized);
  if (capError) throw new Error(capError.message);
  if (!capRows?.length) return [];

  const comuneCodes = [...new Set(capRows.map((row) => row.comune_codice as string))];
  const { data: comuni, error: comuniError } = await client
    .from("po_geo_comuni")
    .select("codice, nome, provincia_codice, regione_codice")
    .in("codice", comuneCodes);
  if (comuniError) throw new Error(comuniError.message);

  const provinciaCodes = [...new Set((comuni ?? []).map((row) => row.provincia_codice as string))];
  const regioneCodes = [...new Set((comuni ?? []).map((row) => row.regione_codice as string))];
  const [{ data: province, error: provinceError }, { data: regioni, error: regioniError }] =
    await Promise.all([
      client.from("po_geo_province").select("codice, nome").in("codice", provinciaCodes),
      client.from("po_geo_regioni").select("codice, nome").in("codice", regioneCodes),
    ]);
  if (provinceError) throw new Error(provinceError.message);
  if (regioniError) throw new Error(regioniError.message);

  const provinciaNome = new Map((province ?? []).map((row) => [row.codice as string, row.nome as string]));
  const regioneNome = new Map((regioni ?? []).map((row) => [row.codice as string, row.nome as string]));
  const comuneByCode = new Map((comuni ?? []).map((row) => [row.codice as string, row]));

  return capRows.flatMap((row) => {
    const comune = comuneByCode.get(row.comune_codice as string);
    if (!comune) return [];
    return [
      {
        cap: row.cap as string,
        comuneCodice: comune.codice as string,
        comuneNome: comune.nome as string,
        provinciaCodice: comune.provincia_codice as string,
        provinciaNome: provinciaNome.get(comune.provincia_codice as string) ?? "",
        regioneCodice: comune.regione_codice as string,
        regioneNome: regioneNome.get(comune.regione_codice as string) ?? "",
      },
    ];
  });
}

export async function searchOfferte(
  query: OfferteSearchQuery,
): Promise<OfferteSearchResult> {
  const cap = query.cap.replace(/\D/g, "");
  const places = await lookupCap(cap);
  if (places.length === 0) {
    return { cap, places: [], punEurKwh: null, hits: [], totalMatched: 0 };
  }

  const today = romeToday();
  const codes = {
    comune: new Set(places.map((p) => p.comuneCodice)),
    provincia: new Set(places.map((p) => p.provinciaCodice)),
    regione: new Set(places.map((p) => p.regioneCodice)),
  };

  const client = offerteReadClient();
  const includePlacet = query.mercato !== "ml";
  const includeMl = query.mercato !== "placet";

  const [placetSelectiveIds, mlSelectiveIds] = await Promise.all([
    includePlacet ? matchingCoverageIds("po_placet_e_copertura", codes) : Promise.resolve(new Set<number>()),
    includeMl ? matchingCoverageIds("po_ml_e_copertura", codes) : Promise.resolve(new Set<number>()),
  ]);

  const [placetRows, mlRows] = await Promise.all([
    includePlacet
      ? loadLiveOffers<PlacetRow>(
          (from, to) => {
            let q = client
              .from("po_placet_e_live")
              .select(PLACET_COLS)
              .eq("tipo_cliente", query.cliente)
              .lte("valid_from", today)
              .gte("valid_to", today)
              .range(from, to);
            if (query.prezzo !== "tutti") q = q.eq("tipo_offerta", query.prezzo);
            return q;
          },
          placetSelectiveIds,
        )
      : Promise.resolve([] as PlacetRow[]),
    includeMl
      ? loadLiveOffers<MlRow>(
          (from, to) => {
            let q = client
              .from("po_ml_e_live")
              .select(ML_COLS)
              .eq("tipo_cliente", query.cliente)
              .lte("valid_from", today)
              .gte("valid_to", today)
              .range(from, to);
            if (query.prezzo !== "tutti") q = q.eq("tipo_offerta", query.prezzo);
            return q;
          },
          mlSelectiveIds,
        )
      : Promise.resolve([] as MlRow[]),
  ]);

  const placetCovered = placetRows;
  const mlCovered = mlRows.filter(
    (row) =>
      inBound(query.consumoKwh, row.consumo_min, row.consumo_max) &&
      inBound(query.potenzaKw, row.potenza_min, row.potenza_max),
  );

  const componenti = await loadComponenti(mlCovered.map((row) => row.id));
  const byOffer = new Map<number, MlCompRow[]>();
  for (const row of componenti) {
    const list = byOffer.get(row.offer_id) ?? [];
    list.push(row);
    byOffer.set(row.offer_id, list);
  }

  type RankedHit = OfferteSearchHit & { mlOfferId?: number };

  const hits: RankedHit[] = [
    ...placetCovered.map((row) => {
      const tipoOfferta = row.tipo_offerta ?? "";
      const facts = placetFacts(row);
      return {
        source: "placet" as const,
        codOfferta: row.cod_offerta,
        nome: row.nome_offerta ?? "Offerta PLACET",
        venditore: row.denominazione ?? "Venditore",
        tipoCliente: row.tipo_cliente,
        tipoOfferta,
        validFrom: row.valid_from,
        validTo: row.valid_to,
        durataMesi: PLACET_DURATA_MESI,
        ...facts,
        plan: resolveOffertePlan(
          { source: "placet", tipoOfferta, codOfferta: row.cod_offerta },
          facts.plan,
        ),
        urlOfferta: row.url_offerta,
        urlVenditore: row.url_sito_venditore,
        dettaglio: placetOfferDettaglio(row),
      };
    }),
    ...mlCovered.map((row) => {
      const tipoOfferta = row.tipo_offerta ?? "";
      const facts = mlFacts({
        tipo_offerta: row.tipo_offerta,
        tipologia_fasce: row.tipologia_fasce,
        components: byOffer.get(row.id) ?? [],
      });
      return {
        source: "ml" as const,
        mlOfferId: row.id,
        codOfferta: row.cod_offerta,
        nome: row.nome_offerta ?? "Offerta mercato libero",
        venditore: vendorLabel(row.url_sito_venditore, row.p_iva),
        tipoCliente: row.tipo_cliente,
        tipoOfferta,
        validFrom: row.valid_from,
        validTo: row.valid_to,
        durataMesi: normalizeDurata(row.durata),
        ...facts,
        plan: resolveOffertePlan(
          { source: "ml", tipoOfferta, codOfferta: row.cod_offerta },
          facts.plan,
        ),
        urlOfferta: row.url_offerta,
        urlVenditore: row.url_sito_venditore,
        dettaglio: mlOfferDettaglio(row),
      };
    }),
  ];

  const filtered = hits.filter((hit) => matchesFasciaFilter(hit, query.fascia));

  filtered.sort((a, b) => {
    const byFacts = compareOfferFacts(a, b);
    if (byFacts !== 0) return byFacts;
    return a.nome.localeCompare(b.nome, "it");
  });

  const ranked = filtered.slice(0, 40);
  const scontiByOffer = await loadSconti(
    ranked.flatMap((hit) => (hit.mlOfferId != null ? [hit.mlOfferId] : [])),
  );

  return {
    cap,
    places,
    punEurKwh: null,
    totalMatched: filtered.length,
    hits: ranked.map(({ mlOfferId, ...hit }) => ({
      ...hit,
      dettaglio: {
        ...hit.dettaglio,
        sconti: mlOfferId != null ? (scontiByOffer.get(mlOfferId) ?? []) : hit.dettaglio.sconti,
      },
    })),
  };
}

function matchesFasciaFilter(hit: OfferteSearchHit, fascia: OfferteSearchQuery["fascia"]) {
  if (fascia === "tutti") return true;
  return hit.plan === fascia;
}

async function matchingCoverageIds(
  table: string,
  codes: { comune: Set<string>; provincia: Set<string>; regione: Set<string> },
) {
  const filters: string[] = [];
  for (const codice of codes.comune) filters.push(`and(livello.eq.comune,codice.eq.${codice})`);
  for (const codice of codes.provincia) {
    filters.push(`and(livello.eq.provincia,codice.eq.${codice})`);
  }
  for (const codice of codes.regione) filters.push(`and(livello.eq.regione,codice.eq.${codice})`);
  if (filters.length === 0) return new Set<number>();

  const client = offerteReadClient();
  const rows = await paginateSelect<Pick<CoverageRow, "offer_id">>((from, to) =>
    client.from(table).select("offer_id").or(filters.join(",")).range(from, to),
  );
  return new Set(rows.map((row) => row.offer_id));
}

async function loadLiveOffers<T extends { id: number; coverage: string }>(
  build: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  selectiveIds: Set<number>,
) {
  const rows = await paginateSelect<T>(build);
  return rows.filter((row) => row.coverage === "nazionale" || selectiveIds.has(row.id));
}

async function loadComponenti(offerIds: number[]) {
  if (offerIds.length === 0) return [] as MlCompRow[];
  const client = offerteReadClient();
  const rows: MlCompRow[] = [];
  for (let i = 0; i < offerIds.length; i += 200) {
    const slice = offerIds.slice(i, i + 200);
    const page = await paginateSelect<MlCompRow>((from, to) =>
      client
        .from("po_ml_e_componenti")
        .select("offer_id, macroarea, unita_misura, fascia, prezzo, nome")
        .in("offer_id", slice)
        .range(from, to),
    );
    rows.push(...page);
  }
  return rows;
}

async function loadSconti(offerIds: number[]) {
  const byOffer = new Map<number, OfferteSconto[]>();
  if (offerIds.length === 0) return byOffer;
  const client = offerteReadClient();
  const rows: MlScontoRow[] = [];
  for (let i = 0; i < offerIds.length; i += 200) {
    const slice = offerIds.slice(i, i + 200);
    const page = await paginateSelect<MlScontoRow>((from, to) =>
      client
        .from("po_ml_e_sconti")
        .select("offer_id, nome, descrizione, valore, unita_misura")
        .in("offer_id", slice)
        .range(from, to),
    );
    rows.push(...page);
  }
  for (const row of rows) {
    const list = byOffer.get(row.offer_id) ?? [];
    const nome = row.nome?.replace(/\s+/g, " ").trim() || "Sconto";
    const descrizione = row.descrizione?.replace(/\s+/g, " ").trim() || null;
    list.push({
      nome,
      descrizione: descrizione && descrizione !== nome ? descrizione : null,
      valore: formatScontoValore(row.valore, row.unita_misura),
    });
    byOffer.set(row.offer_id, list);
  }
  return byOffer;
}

function vendorLabel(url: string | null, piva: string | null) {
  if (url) {
    try {
      const href = url.startsWith("http") ? url : `https://${url}`;
      return new URL(href).hostname.replace(/^www\./, "");
    } catch {
      /* ignore */
    }
  }
  return piva ? `P.IVA ${piva}` : "Venditore";
}

function inBound(value: number, min: number | null, max: number | null) {
  if (min != null && min > 0 && value < min) return false;
  if (max != null && max > 0 && value > max) return false;
  return true;
}

function normalizeDurata(value: number | null) {
  if (value == null || value <= 0) return null;
  return value;
}
