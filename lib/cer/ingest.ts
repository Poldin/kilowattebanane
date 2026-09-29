import {
  cerWriteClient,
  chunk,
  fetchAllRows,
  finishCerImportRun,
  startCerImportRun,
} from "@/lib/cer/client";
import { dedupeCerConfigs, parseCerFeature, type ParsedCerConfig } from "@/lib/cer/parse";
import { romeToday } from "@/lib/offerte/dates";
import {
  discoverCerFeatureServer,
  fetchCerFeatures,
  gseDateFromAttributes,
} from "@/lib/cer/source";

type ExistingRow = {
  codice_richiesta: string;
  content_hash: string;
  is_listed: boolean;
  first_seen_on: string | null;
};

export type CerIngestSummary = {
  status: "ok" | "failed";
  snapshotDate: string | null;
  sourceUrl: string | null;
  seen: number;
  inserted: number;
  updated: number;
  unchanged: number;
  delisted: number;
  relisted: number;
  skipped: number;
  error?: string;
};

function dbRow(
  row: ParsedCerConfig,
  extra: {
    is_listed: boolean;
    first_seen_on?: string | null;
    last_seen_on: string | null;
    import_run_id: number;
    source_url: string;
  },
) {
  return {
    codice_richiesta: row.codice_richiesta,
    tipologia: row.tipologia,
    tipologia_kind: row.tipologia_kind,
    denominazione: row.denominazione,
    potenza_kw: row.potenza_kw,
    n_impianti: row.n_impianti,
    n_utenze: row.n_utenze,
    comune: row.comune,
    provincia: row.provincia,
    regione: row.regione,
    lat: row.lat,
    lon: row.lon,
    area_convenzionale: row.area_convenzionale,
    gestore_rete: row.gestore_rete,
    gse_aggiornato_il: row.gse_aggiornato_il,
    in_vetrina: row.in_vetrina,
    layer_id: row.layer_id,
    layer_name: row.layer_name,
    source_objectid: row.source_objectid,
    content_hash: row.content_hash,
    is_listed: extra.is_listed,
    first_seen_on: extra.first_seen_on ?? extra.last_seen_on,
    last_seen_on: extra.last_seen_on,
    import_run_id: extra.import_run_id,
    source_url: extra.source_url,
    updated_at: new Date().toISOString(),
  };
}

export async function ingestCerMap(): Promise<CerIngestSummary> {
  const source = await discoverCerFeatureServer();
  const { features, contentSha256 } = await fetchCerFeatures(source);
  const parsedAll = features.map(parseCerFeature);
  const skipped = parsedAll.filter((row) => row == null).length;
  const parsed = dedupeCerConfigs(parsedAll.filter((row) => row != null));
  const snapshotDate =
    source.snapshotDate ??
    parsed.map((row) => row.gse_aggiornato_il).find((value) => value != null) ??
    gseDateFromAttributes(features[0]?.attributes ?? {}) ??
    romeToday();

  const runId = await startCerImportRun({
    sourceUrl: source.featureServerUrl,
    sourceItemId: source.sourceItemId,
    snapshotDate,
    sha256: contentSha256,
  });

  const client = cerWriteClient();

  try {
    const existing = await fetchAllRows<ExistingRow>(
      client,
      "cer_configurazioni",
      "codice_richiesta, content_hash, is_listed, first_seen_on",
    );
    const byCode = new Map(existing.map((row) => [row.codice_richiesta, row]));
    const seenCodes = new Set(parsed.map((row) => row.codice_richiesta));

    const toInsert: ReturnType<typeof dbRow>[] = [];
    const toUpdate: ReturnType<typeof dbRow>[] = [];
    let updated = 0;
    let unchanged = 0;
    let relisted = 0;

    for (const row of parsed) {
      const prev = byCode.get(row.codice_richiesta);
      if (!prev) {
        toInsert.push(
          dbRow(row, {
            is_listed: true,
            first_seen_on: snapshotDate,
            last_seen_on: snapshotDate,
            import_run_id: runId,
            source_url: source.featureServerUrl,
          }),
        );
        continue;
      }
      if (prev.content_hash !== row.content_hash) updated += 1;
      else unchanged += 1;
      if (!prev.is_listed) relisted += 1;
      toUpdate.push(
        dbRow(row, {
          is_listed: true,
          first_seen_on: prev.first_seen_on ?? snapshotDate,
          last_seen_on: snapshotDate,
          import_run_id: runId,
          source_url: source.featureServerUrl,
        }),
      );
    }

    for (const group of chunk(toInsert, 150)) {
      const { error } = await client.from("cer_configurazioni").insert(group);
      if (error) throw new Error(error.message);
    }
    for (const group of chunk(toUpdate, 150)) {
      const { error } = await client.from("cer_configurazioni").upsert(group, {
        onConflict: "codice_richiesta",
      });
      if (error) throw new Error(error.message);
    }

    const toDelist = existing.filter(
      (row) => row.is_listed && !seenCodes.has(row.codice_richiesta),
    );
    for (const group of chunk(toDelist, 200)) {
      if (group.length === 0) continue;
      const { error } = await client
        .from("cer_configurazioni")
        .update({
          is_listed: false,
          import_run_id: runId,
          updated_at: new Date().toISOString(),
        })
        .in(
          "codice_richiesta",
          group.map((row) => row.codice_richiesta),
        );
      if (error) throw new Error(error.message);
    }

    const { error: stateError } = await client
      .from("cer_source_state")
      .update({
        feature_server_url: source.featureServerUrl,
        source_item_id: source.sourceItemId,
        snapshot_date: snapshotDate,
        last_ok_run_id: runId,
        last_seen_count: parsed.length,
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1);
    if (stateError) throw new Error(stateError.message);

    const summary: CerIngestSummary = {
      status: "ok",
      snapshotDate,
      sourceUrl: source.featureServerUrl,
      seen: parsed.length,
      inserted: toInsert.length,
      updated,
      unchanged,
      delisted: toDelist.length,
      relisted,
      skipped,
    };

    await finishCerImportRun(runId, {
      ...summary,
      sourceItemId: source.sourceItemId,
      meta: {
        serviceName: source.name,
        layers: source.layers.map((layer) => ({
          id: layer.id,
          name: layer.name,
          kind: layer.kind,
          inVetrina: layer.inVetrina,
        })),
        fetched: features.length,
      },
    });

    return summary;
  } catch (error) {
    const message = error instanceof Error ? error.message : "CER ingest failed";
    await finishCerImportRun(runId, { status: "failed", error: message }).catch(
      () => undefined,
    );
    throw error instanceof Error ? error : new Error(message);
  }
}
