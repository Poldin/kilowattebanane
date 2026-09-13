import { parseCsv } from "@/lib/offerte/csv";
import {
  chunk,
  fetchAllRows,
  finishImportRun,
  offerteClient,
  startImportRun,
} from "@/lib/offerte/client";
import { coverageFromPortalFields, mergeCoverage } from "@/lib/offerte/coverage";
import { parseNumber, parsePortalDate } from "@/lib/offerte/dates";
import { contentHash } from "@/lib/offerte/hash";
import { downloadOfferteFile } from "@/lib/offerte/source";
import type { CoverageHit, IngestSummary } from "@/lib/offerte/types";

type ExistingRow = {
  id: number;
  cod_offerta: string;
  content_hash: string;
  is_listed: boolean;
};

type ParsedPlacet = {
  cod: string;
  hash: string;
  coverage: CoverageHit[];
  row: Record<string, unknown>;
};

export async function ingestPlacetE(snapshotDate?: string): Promise<IngestSummary> {
  const file = await downloadOfferteFile("placet_e", snapshotDate);
  const client = offerteClient();
  const runId = await startImportRun(client, "placet_e", file.snapshotDate, {
    sourceUrl: file.url,
    sourceLastModified: file.lastModified,
    bytes: file.bytes,
    sha256: file.sha256,
  });

  try {
    const parsed = groupPlacetRows(parseCsv(file.text), file.snapshotDate);
    const existingRows = await fetchAllRows<ExistingRow>(
      client,
      "po_placet_offerte_e",
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
    const unchanged = parsed.length - toInsert.length;

    for (const group of chunk(toInsert, 150)) {
      const { data: inserted, error } = await client
        .from("po_placet_offerte_e")
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
      const coverageRows = group.flatMap((item) => {
        const offerId = idByHash.get(item.hash);
        if (!offerId) return [];
        return item.coverage.map((hit) => ({
          offer_id: offerId,
          livello: hit.livello,
          codice: hit.codice,
        }));
      });
      for (const coverGroup of chunk(coverageRows, 500)) {
        if (coverGroup.length === 0) continue;
        const { error: coverError } = await client
          .from("po_placet_e_copertura")
          .insert(coverGroup);
        if (coverError) throw new Error(coverError.message);
      }
    }

    const currentByCod = new Map<string, string>();
    for (const item of parsed) {
      const prev = currentByCod.get(item.cod);
      if (!prev) {
        currentByCod.set(item.cod, item.hash);
        continue;
      }
      const nextFrom = String(item.row.valid_from);
      const prevItem = parsed.find((p) => p.cod === item.cod && p.hash === prev);
      if (prevItem && nextFrom > String(prevItem.row.valid_from)) {
        currentByCod.set(item.cod, item.hash);
      }
    }

    const { error: markError } = await client.rpc("po_mark_current_placet_e", {
      pairs: [...currentByCod.entries()].map(([cod, hash]) => ({ cod, hash })),
    });
    if (markError) throw new Error(markError.message);

    const { data: delisted, error: syncError } = await client.rpc(
      "po_sync_listed_placet_e",
      {
        p_keys: parsed.map((item) => ({ cod: item.cod, hash: item.hash })),
        p_date: file.snapshotDate,
      },
    );
    if (syncError) throw new Error(syncError.message);

    const summary: IngestSummary = {
      kind: "placet_e",
      snapshotDate: file.snapshotDate,
      sourceUrl: file.url,
      seen: parsed.length,
      inserted: toInsert.length,
      unchanged,
      superseded: toInsert.filter((item) =>
        existingRows.some((row) => row.cod_offerta === item.cod),
      ).length,
      delisted: typeof delisted === "number" ? delisted : 0,
      relisted,
    };
    await finishImportRun(client, runId, { status: "ok", ...summary });
    return summary;
  } catch (error) {
    const message = error instanceof Error ? error.message : "placet ingest failed";
    await finishImportRun(client, runId, { status: "failed", error: message });
    throw error;
  }
}

function groupPlacetRows(rows: Record<string, string>[], fallbackDate: string) {
  const grouped = new Map<string, ParsedPlacet>();
  for (const raw of rows) {
    const cod = raw.cod_offerta?.trim();
    if (!cod) continue;
    const validFrom = parsePortalDate(raw.data_inizio) ?? fallbackDate;
    const validTo = parsePortalDate(raw.data_fine) ?? "9999-12-31";
    const coverage = coverageFromPortalFields({
      regione: raw.regione,
      provincia: raw.provincia,
      comune: raw.comune,
    });
    const business = {
      denominazione: emptyToNull(raw.denominazione),
      codice_fiscale: emptyToNull(raw.codice_fiscale),
      p_iva: emptyToNull(raw.p_iva),
      url_sito_venditore: emptyToNull(raw.url_sito_venditore),
      telefono: emptyToNull(raw.telefono),
      nome_offerta: emptyToNull(raw.nome_offerta),
      url_offerta: emptyToNull(raw.url_offerta),
      modalita_attivazione: emptyToNull(raw.modalita_attivazione),
      modalita_pagamento: emptyToNull(raw.modalita_pagamento),
      tipo_cliente: emptyToNull(raw.tipo_cliente),
      tipo_offerta: emptyToNull(raw.tipo_offerta),
      p_fix_f: parseNumber(raw.p_fix_f),
      p_fix_v: parseNumber(raw.p_fix_v),
      p_vol_f1: parseNumber(raw.p_vol_f1),
      p_vol_f2: parseNumber(raw.p_vol_f2),
      p_vol_f3: parseNumber(raw.p_vol_f3),
      p_vol_bf1: parseNumber(raw.p_vol_bf1),
      p_vol_bf23: parseNumber(raw.p_vol_bf23),
      p_vol_mono: parseNumber(raw.p_vol_mono),
      alpha: parseNumber(raw.alpha),
      valid_from: validFrom,
      valid_to: validTo,
    };
    const hash = contentHash({ cod, ...business, coverage });
    const key = `${cod}::${hash}`;
    const prev = grouped.get(key);
    if (prev) {
      prev.coverage = mergeCoverage([prev.coverage, coverage]);
      prev.row.coverage = prev.coverage.length > 0 ? "selettiva" : "nazionale";
      continue;
    }
    grouped.set(key, {
      cod,
      hash,
      coverage,
      row: {
        ...business,
        cod_offerta: cod,
        content_hash: hash,
        coverage: coverage.length > 0 ? "selettiva" : "nazionale",
      },
    });
  }
  return [...grouped.values()];
}

function emptyToNull(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
