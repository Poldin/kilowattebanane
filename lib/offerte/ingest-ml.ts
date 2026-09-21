import {
  chunk,
  fetchAllRows,
  finishImportRun,
  offerteClient,
  startImportRun,
} from "@/lib/offerte/client";
import { mergeCoverage, splitCodes } from "@/lib/offerte/coverage";
import { parseIntLoose, parseNumber, parsePortalDate } from "@/lib/offerte/dates";
import { contentHash } from "@/lib/offerte/hash";
import { downloadOfferteFile, type DownloadedFile } from "@/lib/offerte/source";
import type { CoverageHit, IngestSummary } from "@/lib/offerte/types";
import { xmlBlocks, xmlText, xmlTexts } from "@/lib/offerte/xml";

const TIPO_CLIENTE: Record<string, string> = {
  "01": "domestico",
  "02": "non domestico",
  "03": "condominio",
};

const TIPO_OFFERTA: Record<string, string> = {
  "01": "prezzo fisso",
  "02": "prezzo variabile",
  "03": "flat",
  "04": "mista",
};

type ExistingRow = {
  id: number;
  cod_offerta: string;
  content_hash: string;
  is_listed: boolean;
};

type ParsedMl = {
  cod: string;
  hash: string;
  validFrom: string;
  row: Record<string, unknown>;
  coverage: CoverageHit[];
  componenti: Record<string, unknown>[];
  dispacciamento: Record<string, unknown>[];
  indici: Record<string, unknown>[];
  sconti: Record<string, unknown>[];
  condizioni: Record<string, unknown>[];
};

export async function ingestMlE(
  snapshotDate?: string,
  uploaded?: DownloadedFile,
): Promise<IngestSummary> {
  const file = uploaded ?? (await downloadOfferteFile("ml_e", snapshotDate));
  const client = offerteClient();
  const runId = await startImportRun(client, "ml_e", file.snapshotDate, {
    sourceUrl: file.url,
    sourceLastModified: file.lastModified,
    bytes: file.bytes,
    sha256: file.sha256,
  });

  try {
    const parsed = parseMlOffers(file.text, file.snapshotDate);
    const existingRows = await fetchAllRows<ExistingRow>(
      client,
      "po_ml_offerte_e",
      "id, cod_offerta, content_hash, is_listed",
    );
    const byKey = new Map(
      existingRows.map((row) => [`${row.cod_offerta}::${row.content_hash}`, row]),
    );

    const toInsert = parsed.filter((item) => !byKey.has(`${item.cod}::${item.hash}`));
    const relisted = parsed.filter((item) => {
      const prev = byKey.get(`${item.cod}::${item.hash}`);
      return prev != null && !prev.is_listed;
    }).length;

    for (const group of chunk(toInsert, 80)) {
      const { data: inserted, error } = await client
        .from("po_ml_offerte_e")
        .insert(
          group.map((item) => ({
            ...item.row,
            is_current: false,
            is_listed: true,
            first_seen_on: file.snapshotDate,
            last_seen_on: file.snapshotDate,
            meta: { import_run_id: runId, source_last_modified: file.lastModified },
          })),
        )
        .select("id, content_hash");
      if (error) throw new Error(error.message);
      const idByHash = new Map(
        (inserted ?? []).map((row) => [row.content_hash as string, row.id as number]),
      );
      await insertChildren(client, "po_ml_e_copertura", group.flatMap((item) => {
        const offerId = idByHash.get(item.hash);
        if (!offerId) return [];
        return item.coverage.map((hit) => ({
          offer_id: offerId,
          livello: hit.livello,
          codice: hit.codice,
        }));
      }));
      await insertChildren(
        client,
        "po_ml_e_componenti",
        attach(group, idByHash, (item) => item.componenti),
      );
      await insertChildren(
        client,
        "po_ml_e_dispacciamento",
        attach(group, idByHash, (item) => item.dispacciamento),
      );
      await insertChildren(
        client,
        "po_ml_e_indici",
        attach(group, idByHash, (item) => item.indici),
      );
      await insertChildren(
        client,
        "po_ml_e_sconti",
        attach(group, idByHash, (item) => item.sconti),
      );
      await insertChildren(
        client,
        "po_ml_e_condizioni",
        attach(group, idByHash, (item) => item.condizioni),
      );
    }

    const currentByCod = new Map<string, ParsedMl>();
    for (const item of parsed) {
      const prev = currentByCod.get(item.cod);
      if (!prev || item.validFrom > prev.validFrom) currentByCod.set(item.cod, item);
    }

    const { error: markError } = await client.rpc("po_mark_current_ml_e", {
      pairs: [...currentByCod.values()].map((item) => ({
        cod: item.cod,
        hash: item.hash,
      })),
    });
    if (markError) throw new Error(markError.message);

    const { data: delisted, error: syncError } = await client.rpc("po_sync_listed_ml_e", {
      p_keys: parsed.map((item) => ({ cod: item.cod, hash: item.hash })),
      p_date: file.snapshotDate,
    });
    if (syncError) throw new Error(syncError.message);

    const summary: IngestSummary = {
      kind: "ml_e",
      snapshotDate: file.snapshotDate,
      sourceUrl: file.url,
      seen: parsed.length,
      inserted: toInsert.length,
      unchanged: parsed.length - toInsert.length,
      superseded: toInsert.filter((item) =>
        existingRows.some((row) => row.cod_offerta === item.cod),
      ).length,
      delisted: typeof delisted === "number" ? delisted : 0,
      relisted,
    };
    await finishImportRun(client, runId, { status: "ok", ...summary });
    return summary;
  } catch (error) {
    const message = error instanceof Error ? error.message : "ml ingest failed";
    await finishImportRun(client, runId, { status: "failed", error: message });
    throw error;
  }
}

function attach(
  group: ParsedMl[],
  idByHash: Map<string, number>,
  pick: (item: ParsedMl) => Record<string, unknown>[],
) {
  return group.flatMap((item) => {
    const offerId = idByHash.get(item.hash);
    if (!offerId) return [];
    return pick(item).map((row) => ({ ...row, offer_id: offerId }));
  });
}

async function insertChildren(
  client: ReturnType<typeof offerteClient>,
  table: string,
  rows: Record<string, unknown>[],
) {
  for (const group of chunk(rows, 400)) {
    if (group.length === 0) continue;
    const { error } = await client.from(table).insert(group);
    if (error) throw new Error(`${table}: ${error.message}`);
  }
}

export function parseMlOffers(xml: string, fallbackDate: string) {
  const out: ParsedMl[] = [];
  for (const offer of xmlBlocks(xml, "offerta")) {
    const parsed = parseOneOffer(offer, fallbackDate);
    if (parsed) out.push(parsed);
  }
  return out;
}

function parseOneOffer(offer: string, fallbackDate: string): ParsedMl | null {
  const ident = xmlBlocks(offer, "IdentificativiOfferta")[0] ?? "";
  const dett = xmlBlocks(offer, "DettaglioOfferta")[0] ?? "";
  const valid = xmlBlocks(offer, "ValiditaOfferta")[0] ?? "";
  const caratt = xmlBlocks(offer, "CaratteristicheOfferta")[0] ?? "";
  const contatti = xmlBlocks(dett, "Contatti")[0] ?? dett;
  const tipoPrezzo = xmlBlocks(offer, "TipoPrezzo")[0] ?? "";

  const cod = xmlText(ident, "COD_OFFERTA");
  if (!cod) return null;

  const tipoClienteCodice = xmlText(dett, "TIPO_CLIENTE");
  const tipoOffertaCodice = xmlText(dett, "TIPO_OFFERTA");
  const validFrom = parsePortalDate(xmlText(valid, "DATA_INIZIO")) ?? fallbackDate;
  const validTo = parsePortalDate(xmlText(valid, "DATA_FINE")) ?? "9999-12-31";

  const zoneXml = xmlBlocks(offer, "ZoneOfferta").join("\n");
  const coverageAll = mergeCoverage([
    splitCodes(xmlTexts(zoneXml, "REGIONE").join(";"), "regione"),
    splitCodes(xmlTexts(zoneXml, "PROVINCIA").join(";"), "provincia"),
    splitCodes(xmlTexts(zoneXml, "COMUNE").join(";"), "comune"),
  ]);

  const indici = xmlBlocks(offer, "RiferimentiPrezzoEnergia").map((block) => ({
    idx_prezzo_energia: xmlText(block, "IDX_PREZZO_ENERGIA"),
    coefficiente: parseNumber(xmlText(block, "COEFFICIENTE")),
    fascia_prezzo: xmlText(block, "FASCIA_PREZZO"),
  }));

  const componenti = xmlBlocks(offer, "ComponenteImpresa").flatMap((block) => {
    const base = {
      nome: xmlText(block, "NOME"),
      descrizione: xmlText(block, "DESCRIZIONE"),
      tipologia: xmlText(block, "TIPOLOGIA"),
      macroarea: xmlText(block, "MACROAREA"),
    };
    const intervals = xmlBlocks(block, "IntervalloPrezzi");
    if (intervals.length === 0) return [{ ...base, fascia: null, prezzo: null, unita_misura: null, tipo_prezzo: null, consumo_min: null, consumo_max: null }];
    return intervals.map((interval) => ({
      ...base,
      fascia: xmlText(interval, "FASCIA_COMPONENTE"),
      prezzo: parseNumber(xmlText(interval, "PREZZO")),
      unita_misura: xmlText(interval, "UNITA_MISURA"),
      tipo_prezzo: xmlText(interval, "TIPO_PREZZO"),
      consumo_min: parseNumber(xmlText(interval, "CONSUMO_MIN")),
      consumo_max: parseNumber(xmlText(interval, "CONSUMO_MAX")),
    }));
  });

  const dispacciamento = xmlBlocks(offer, "Dispacciamento").map((block) => ({
    tipo: xmlText(block, "TIPO_DISPACCIAMENTO"),
    nome: xmlText(block, "NOME"),
    valore: parseNumber(xmlText(block, "VALORE_DISP")),
  }));

  const condizioni = xmlBlocks(offer, "CondizioniContrattuali").map((block) => ({
    tipologia: padCode(xmlText(block, "TIPOLOGIA_CONDIZIONE")),
    altro: xmlText(block, "ALTRO"),
    descrizione: xmlText(block, "DESCRIZIONE"),
    limitante: padCode(xmlText(block, "LIMITANTE")),
  }));

  const sconti = xmlBlocks(offer, "Sconto").flatMap((block) => {
    const condizione = xmlBlocks(block, "Condizione")[0] ?? "";
    const head = {
      nome: xmlText(block, "NOME"),
      tipo_sconto: xmlText(block, "TIPO_SCONTO"),
      descrizione: xmlText(block, "DESCRIZIONE"),
      validita: xmlText(block, "VALIDITA"),
      iva_sconto: xmlText(block, "IVA_SCONTO"),
      condizione_applicazione: xmlText(condizione, "CONDIZIONE_APPLICAZIONE"),
      descrizione_condizione: xmlText(condizione, "DESCRIZIONE_CONDIZIONE"),
    };
    const prices = xmlBlocks(block, "PrezziSconto");
    if (prices.length === 0) {
      return [{ ...head, tipologia_prezzo: null, valore: null, unita_misura: null }];
    }
    return prices.map((price) => ({
      ...head,
      tipologia_prezzo: xmlText(price, "TIPOLOGIA"),
      valore: parseNumber(xmlText(price, "PREZZO")),
      unita_misura: xmlText(price, "UNITA_MISURA"),
    }));
  });

  const business = {
    p_iva: xmlText(ident, "PIVA_UTENTE"),
    nome_offerta: xmlText(dett, "NOME_OFFERTA"),
    descrizione: xmlText(dett, "DESCRIZIONE"),
    tipo_mercato: xmlText(dett, "TIPO_MERCATO"),
    tipo_cliente_codice: tipoClienteCodice,
    tipo_cliente: tipoClienteCodice ? TIPO_CLIENTE[tipoClienteCodice] ?? tipoClienteCodice : null,
    tipo_offerta_codice: tipoOffertaCodice,
    tipo_offerta: tipoOffertaCodice ? TIPO_OFFERTA[tipoOffertaCodice] ?? tipoOffertaCodice : null,
    domestico_residente: xmlText(dett, "DOMESTICO_RESIDENTE"),
    offerta_singola: xmlText(dett, "OFFERTA_SINGOLA"),
    offerta_onnicomprensiva: xmlText(dett, "OFFERTA_ONNICOMPRENSIVA"),
    consumo_canone: parseNumber(xmlText(dett, "CONSUMO_CANONE")),
    durata: parseIntLoose(xmlText(dett, "DURATA")),
    garanzie: xmlText(dett, "GARANZIE"),
    tipologia_att_contr: xmlTexts(dett, "TIPOLOGIA_ATT_CONTR"),
    modalita_attivazione: xmlTexts(dett, "MODALITA"),
    modalita_pagamento: xmlTexts(offer, "MODALITA_PAGAMENTO"),
    telefono: xmlText(contatti, "TELEFONO"),
    url_sito_venditore: xmlText(contatti, "URL_SITO_VENDITORE"),
    url_offerta: xmlText(contatti, "URL_OFFERTA"),
    idx_prezzo_energia: indici[0]?.idx_prezzo_energia ?? null,
    coefficiente: indici[0]?.coefficiente ?? null,
    tipologia_fasce: xmlText(tipoPrezzo, "TIPOLOGIA_FASCE"),
    consumo_min: parseNumber(xmlText(caratt, "CONSUMO_MIN")),
    consumo_max: parseNumber(xmlText(caratt, "CONSUMO_MAX")),
    potenza_min: parseNumber(xmlText(caratt, "POTENZA_MIN")),
    potenza_max: parseNumber(xmlText(caratt, "POTENZA_MAX")),
    valid_from: validFrom,
    valid_to: validTo,
    coverage: coverageAll.length > 0 ? "selettiva" : "nazionale",
  };

  const hash = contentHash({
    cod,
    ...business,
    coverage: coverageAll,
    componenti,
    dispacciamento,
    indici,
    sconti,
    condizioni,
  });

  return {
    cod,
    hash,
    validFrom,
    coverage: coverageAll,
    componenti,
    dispacciamento,
    indici,
    sconti,
    condizioni,
    row: {
      ...business,
      cod_offerta: cod,
      content_hash: hash,
    },
  };
}

function padCode(value: string | null) {
  const raw = value?.trim();
  if (!raw) return null;
  return /^\d+$/.test(raw) ? raw.padStart(2, "0") : raw;
}
