import { buildMlScheda, buildPlacetScheda, type CompareScheda } from "@/lib/offerte/compare-scheda";
import { resolveOffertePlan } from "@/lib/offerte/codice";
import { romeToday } from "@/lib/offerte/dates";
import { offerteReadClient } from "@/lib/offerte/db";
import { mlFacts, placetFacts } from "@/lib/offerte/metrics";
import {
  mlOfferDettaglio,
  onereRecessoFrom,
  placetOfferDettaglio,
} from "@/lib/offerte/portal-labels";
import type { OfferteHitDettaglio } from "@/lib/offerte/public-types";
import type { OfferteFasciaPlan } from "@/lib/offerte/metrics";

export type OfferteCompareProfile = {
  source: "placet" | "ml";
  codOfferta: string;
  nome: string;
  venditore: string;
  tipoOfferta: string;
  tipoCliente: string | null;
  plan: OfferteFasciaPlan | null;
  monthlyEur: number | null;
  spreadEurKwh: number | null;
  spreadMinEurKwh: number | null;
  spreadMaxEurKwh: number | null;
  validFrom: string;
  validTo: string;
  durataMesi: number | null;
  urlOfferta: string | null;
  dettaglio: OfferteHitDettaglio;
  scheda: CompareScheda;
};

const PLACET_COLS =
  "id, cod_offerta, denominazione, nome_offerta, tipo_offerta, tipo_cliente, coverage, valid_from, valid_to, url_offerta, url_sito_venditore, telefono, modalita_attivazione, modalita_pagamento, p_fix_f, p_fix_v, p_vol_f1, p_vol_f2, p_vol_f3, p_vol_bf1, p_vol_bf23, p_vol_mono, alpha";
const ML_COLS =
  "id, cod_offerta, p_iva, nome_offerta, descrizione, tipo_offerta, tipo_cliente, coverage, valid_from, valid_to, url_offerta, url_sito_venditore, telefono, garanzie, tipologia_att_contr, modalita_attivazione, modalita_pagamento, domestico_residente, offerta_singola, offerta_onnicomprensiva, idx_prezzo_energia, coefficiente, tipologia_fasce, durata, consumo_min, consumo_max, potenza_min, potenza_max";

export async function loadCompareOfferProfile(
  source: "placet" | "ml",
  codOfferta: string,
): Promise<OfferteCompareProfile | null> {
  const cod = codOfferta.trim();
  if (!cod) return null;

  const today = romeToday();
  const client = offerteReadClient();

  if (source === "placet") {
    const { data, error } = await client
      .from("po_placet_e_live")
      .select(PLACET_COLS)
      .eq("cod_offerta", cod)
      .lte("valid_from", today)
      .gte("valid_to", today)
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;

    const tipoOfferta = data.tipo_offerta ?? "";
    const facts = placetFacts(data);
    const plan = resolveOffertePlan(
      { source: "placet", tipoOfferta, codOfferta: data.cod_offerta },
      facts.plan,
    );
    const dettaglio = placetOfferDettaglio(data);
    const copertura = await coperturaPhrase(client, "placet", data.id, data.coverage);

    return {
      source: "placet",
      codOfferta: data.cod_offerta,
      nome: data.nome_offerta?.trim() || data.cod_offerta,
      venditore: data.denominazione?.trim() || "Venditore",
      tipoOfferta,
      tipoCliente: data.tipo_cliente,
      plan,
      monthlyEur: facts.monthlyEur,
      spreadEurKwh: facts.spreadEurKwh,
      spreadMinEurKwh: facts.spreadMinEurKwh,
      spreadMaxEurKwh: facts.spreadMaxEurKwh,
      validFrom: data.valid_from,
      validTo: data.valid_to,
      durataMesi: 12,
      urlOfferta: data.url_offerta,
      dettaglio,
      scheda: buildPlacetScheda({
        tipoOfferta,
        tipoCliente: data.tipo_cliente,
        dettaglio,
        copertura,
        prices: data,
      }),
    };
  }

  const { data, error } = await client
    .from("po_ml_e_live")
    .select(ML_COLS)
    .eq("cod_offerta", cod)
    .lte("valid_from", today)
    .gte("valid_to", today)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  const [{ data: componenti, error: componentiError }, { data: condizioni, error: condizioniError }, { data: sconti, error: scontiError }, { data: dispacciamento, error: dispError }] =
    await Promise.all([
      client
        .from("po_ml_e_componenti")
        .select("nome, tipologia, macroarea, unita_misura, prezzo, fascia")
        .eq("offer_id", data.id),
      client
        .from("po_ml_e_condizioni")
        .select("tipologia, descrizione")
        .eq("offer_id", data.id),
      client
        .from("po_ml_e_sconti")
        .select(
          "nome, descrizione, valore, unita_misura, tipologia_prezzo, validita, condizione_applicazione, descrizione_condizione",
        )
        .eq("offer_id", data.id),
      client.from("po_ml_e_dispacciamento").select("tipo, valore").eq("offer_id", data.id),
    ]);
  const childError = componentiError ?? condizioniError ?? scontiError ?? dispError;
  if (childError) throw new Error(childError.message);

  const tipoOfferta = data.tipo_offerta ?? "";
  const facts = mlFacts({
    tipo_offerta: tipoOfferta,
    tipologia_fasce: data.tipologia_fasce,
    components: componenti ?? [],
  });
  const plan = resolveOffertePlan(
    { source: "ml", tipoOfferta, codOfferta: data.cod_offerta },
    facts.plan,
  );
  const durata = Number(data.durata);
  const durataMesi = Number.isFinite(durata) && durata > 0 ? durata : null;
  const dettaglio = mlOfferDettaglio(data, [], onereRecessoFrom(condizioni ?? undefined));
  const copertura = await coperturaPhrase(client, "ml", data.id, data.coverage);
  const pluriennale = (condizioni ?? [])
    .filter((row) => padCode(row.tipologia) === "04")
    .map((row) => row.descrizione?.replace(/\s+/g, " ").trim() ?? "")
    .filter((text) => text.length > 0)
    .join(" ");

  return {
    source: "ml",
    codOfferta: data.cod_offerta,
    nome: data.nome_offerta?.trim() || data.cod_offerta,
    venditore: vendorLabel(data.url_sito_venditore, data.p_iva),
    tipoOfferta,
    tipoCliente: data.tipo_cliente,
    plan,
    monthlyEur: facts.monthlyEur,
    spreadEurKwh: facts.spreadEurKwh,
    spreadMinEurKwh: facts.spreadMinEurKwh,
    spreadMaxEurKwh: facts.spreadMaxEurKwh,
    validFrom: data.valid_from,
    validTo: data.valid_to,
    durataMesi,
    urlOfferta: data.url_offerta,
    dettaglio,
    scheda: buildMlScheda({
      tipoOfferta,
      tipoCliente: data.tipo_cliente,
      coefficiente: data.coefficiente,
      idxPrezzo: data.idx_prezzo_energia,
      dettaglio,
      copertura,
      pluriennale: pluriennale || null,
      components: componenti ?? [],
      dispacciamento: dispacciamento ?? [],
      sconti: sconti ?? [],
    }),
  };
}

const ZONE_PLURAL = {
  regione: "regioni",
  provincia: "province",
  comune: "comuni",
} as const;

const ZONE_TABLE = {
  regione: "po_geo_regioni",
  provincia: "po_geo_province",
  comune: "po_geo_comuni",
} as const;

async function coperturaPhrase(
  client: ReturnType<typeof offerteReadClient>,
  source: "placet" | "ml",
  offerId: number,
  coverage: string | null,
) {
  if (coverage !== "selettiva") return "Tutta Italia";
  const table = source === "placet" ? "po_placet_e_copertura" : "po_ml_e_copertura";
  const { data, error } = await client.from(table).select("livello, codice").eq("offer_id", offerId);
  if (error) throw new Error(error.message);

  const codes = { regione: new Set<string>(), provincia: new Set<string>(), comune: new Set<string>() };
  for (const row of data ?? []) {
    const livello = String(row.livello ?? "");
    if (livello !== "regione" && livello !== "provincia" && livello !== "comune") continue;
    const codice = String(row.codice ?? "").trim();
    if (codice) codes[livello].add(codice);
  }

  const parts: string[] = [];
  for (const livello of ["regione", "provincia", "comune"] as const) {
    const list = [...codes[livello]];
    if (list.length === 0) continue;
    if (list.length > 5) {
      parts.push(`${list.length} ${ZONE_PLURAL[livello]}`);
      continue;
    }
    const { data: named, error: nameError } = await client
      .from(ZONE_TABLE[livello])
      .select("nome")
      .in("codice", list);
    if (nameError) throw new Error(nameError.message);
    const names = (named ?? [])
      .map((row) => row.nome?.trim())
      .filter((nome): nome is string => Boolean(nome))
      .sort((a, b) => a.localeCompare(b, "it"));
    parts.push(names.length > 0 ? names.join(", ") : `${list.length} ${ZONE_PLURAL[livello]}`);
  }
  return parts.length > 0 ? parts.join(" · ") : "Solo alcuni territori";
}

function padCode(value: string | null | undefined) {
  const raw = value?.trim();
  if (!raw) return null;
  return /^\d+$/.test(raw) ? raw.padStart(2, "0") : raw;
}

function vendorLabel(url: string | null, piva: string | null) {
  const href = url?.trim();
  if (href) {
    try {
      const host = new URL(href.startsWith("http") ? href : `https://${href}`).hostname.replace(
        /^www\./,
        "",
      );
      if (host) return host;
    } catch {
      /* ignore */
    }
  }
  return piva ? `P.IVA ${piva}` : "Venditore";
}
