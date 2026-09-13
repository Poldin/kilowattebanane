import { parseCsv } from "@/lib/offerte/csv";
import {
  chunk,
  finishImportRun,
  offerteClient,
  startImportRun,
} from "@/lib/offerte/client";
import { contentHash } from "@/lib/offerte/hash";
import { downloadOfferteFile } from "@/lib/offerte/source";
import type { IngestSummary } from "@/lib/offerte/types";

export async function ingestParametriE(snapshotDate?: string): Promise<IngestSummary> {
  const file = await downloadOfferteFile("parametri_e", snapshotDate);
  const client = offerteClient();
  const runId = await startImportRun(client, "parametri_e", file.snapshotDate, {
    sourceUrl: file.url,
    sourceLastModified: file.lastModified,
    bytes: file.bytes,
    sha256: file.sha256,
  });

  try {
    const rows = parseCsv(file.text);
    const parsed = rows
      .map((row) => {
        const nome = row.nome_parametro?.trim();
        if (!nome) return null;
        const descrizione = row.descrizione?.trim() || null;
        const valoreRaw = row.valore?.trim() || null;
        const valore = valoreRaw == null ? null : Number(valoreRaw);
        const hash = contentHash({ nome, valore: valoreRaw, descrizione });
        return { nome, valore: Number.isFinite(valore) ? valore : null, descrizione, hash };
      })
      .filter((row): row is NonNullable<typeof row> => row != null);

    const { data: existing, error: existingError } = await client
      .from("po_parametri_e")
      .select("id, nome_parametro, content_hash");
    if (existingError) throw new Error(existingError.message);

    const known = new Set(
      (existing ?? []).map((row) => `${row.nome_parametro}::${row.content_hash}`),
    );
    const toInsert = parsed.filter((row) => !known.has(`${row.nome}::${row.hash}`));

    for (const group of chunk(toInsert, 200)) {
      const { error } = await client.from("po_parametri_e").insert(
        group.map((row) => ({
          nome_parametro: row.nome,
          valore: row.valore,
          descrizione: row.descrizione,
          content_hash: row.hash,
          is_current: false,
          first_seen_on: file.snapshotDate,
          last_seen_on: file.snapshotDate,
          meta: { import_run_id: runId, source_last_modified: file.lastModified },
        })),
      );
      if (error) throw new Error(error.message);
    }

    const currentPairs = parsed.map((row) => ({ nome: row.nome, hash: row.hash }));
    const keys = parsed.map((row) => ({ nome: row.nome, hash: row.hash }));
    const { error: markError } = await client.rpc("po_mark_current_parametri_e", {
      pairs: currentPairs,
    });
    if (markError) throw new Error(markError.message);
    const { error: syncError } = await client.rpc("po_sync_listed_parametri_e", {
      p_keys: keys,
      p_date: file.snapshotDate,
    });
    if (syncError) throw new Error(syncError.message);

    const summary: IngestSummary = {
      kind: "parametri_e",
      snapshotDate: file.snapshotDate,
      sourceUrl: file.url,
      seen: parsed.length,
      inserted: toInsert.length,
      unchanged: parsed.length - toInsert.length,
      superseded: 0,
      delisted: 0,
      relisted: 0,
    };
    await finishImportRun(client, runId, { status: "ok", ...summary });
    return summary;
  } catch (error) {
    const message = error instanceof Error ? error.message : "parametri ingest failed";
    await finishImportRun(client, runId, { status: "failed", error: message });
    throw error;
  }
}
