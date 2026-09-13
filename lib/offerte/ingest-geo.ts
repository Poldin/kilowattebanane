import {
  chunk,
  finishImportRun,
  offerteClient,
  startImportRun,
} from "@/lib/offerte/client";
import { romeToday } from "@/lib/offerte/dates";
import type { IngestSummary } from "@/lib/offerte/types";

const GEO_URLS = [
  "https://cdn.jsdelivr.net/gh/matteocontrini/comuni-json@master/comuni.json",
  "https://raw.githubusercontent.com/matteocontrini/comuni-json/master/comuni.json",
];

type ComuneJson = {
  nome: string;
  codice: string;
  regione: { codice: string; nome: string };
  provincia: { codice: string; nome: string };
  sigla?: string;
  cap?: string | string[];
};

export async function ingestGeo(options: { force?: boolean } = {}): Promise<IngestSummary> {
  const client = offerteClient();
  if (!options.force) {
    const { count, error } = await client
      .from("po_geo_cap")
      .select("cap", { count: "exact", head: true });
    if (error) throw new Error(error.message);
    if ((count ?? 0) > 0) {
      return {
        kind: "geo",
        snapshotDate: romeToday(),
        seen: count ?? 0,
        inserted: 0,
        unchanged: count ?? 0,
        superseded: 0,
        delisted: 0,
        relisted: 0,
      };
    }
  }

  const { url, comuni } = await loadComuni();
  const snapshotDate = romeToday();
  const runId = await startImportRun(client, "geo", snapshotDate, { sourceUrl: url });

  try {
    const regioni = new Map<string, string>();
    const province = new Map<string, { nome: string; sigla: string | null; regione: string }>();
    const comuniRows: { codice: string; nome: string; provincia_codice: string; regione_codice: string }[] = [];
    const capRows: { cap: string; comune_codice: string }[] = [];
    const capSeen = new Set<string>();

    for (const comune of comuni) {
      const regioneCodice = pad(comune.regione.codice, 2);
      const provinciaCodice = pad(comune.provincia.codice, 3);
      const comuneCodice = pad(comune.codice, 6);
      if (!regioneCodice || !provinciaCodice || !comuneCodice) continue;
      regioni.set(regioneCodice, comune.regione.nome);
      province.set(provinciaCodice, {
        nome: comune.provincia.nome,
        sigla: comune.sigla ?? null,
        regione: regioneCodice,
      });
      comuniRows.push({
        codice: comuneCodice,
        nome: comune.nome,
        provincia_codice: provinciaCodice,
        regione_codice: regioneCodice,
      });
      for (const cap of asCaps(comune.cap)) {
        const key = `${cap}::${comuneCodice}`;
        if (capSeen.has(key)) continue;
        capSeen.add(key);
        capRows.push({ cap, comune_codice: comuneCodice });
      }
    }

    const { error: delCap } = await client.from("po_geo_cap").delete().neq("cap", "");
    if (delCap) throw new Error(delCap.message);

    for (const group of chunk(
      [...regioni.entries()].map(([codice, nome]) => ({ codice, nome })),
      200,
    )) {
      const { error } = await client.from("po_geo_regioni").upsert(group, { onConflict: "codice" });
      if (error) throw new Error(error.message);
    }

    for (const group of chunk(
      [...province.entries()].map(([codice, value]) => ({
        codice,
        nome: value.nome,
        sigla: value.sigla,
        regione_codice: value.regione,
      })),
      200,
    )) {
      const { error } = await client.from("po_geo_province").upsert(group, { onConflict: "codice" });
      if (error) throw new Error(error.message);
    }

    for (const group of chunk(comuniRows, 300)) {
      const { error } = await client.from("po_geo_comuni").upsert(group, { onConflict: "codice" });
      if (error) throw new Error(error.message);
    }

    for (const group of chunk(capRows, 500)) {
      const { error } = await client.from("po_geo_cap").insert(group);
      if (error) throw new Error(error.message);
    }

    const summary: IngestSummary = {
      kind: "geo",
      snapshotDate,
      sourceUrl: url,
      seen: comuniRows.length,
      inserted: capRows.length,
      unchanged: 0,
      superseded: 0,
      delisted: 0,
      relisted: 0,
    };
    await finishImportRun(client, runId, {
      status: "ok",
      ...summary,
      meta: { comuni: comuniRows.length, cap: capRows.length, source: url },
    });
    return summary;
  } catch (error) {
    const message = error instanceof Error ? error.message : "geo ingest failed";
    await finishImportRun(client, runId, { status: "failed", error: message });
    throw error;
  }
}

async function loadComuni() {
  let lastError = "unable to download comuni.json";
  for (const url of GEO_URLS) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) {
        lastError = `${url} HTTP ${response.status}`;
        continue;
      }
      const comuni = (await response.json()) as ComuneJson[];
      if (!Array.isArray(comuni) || comuni.length < 7000) {
        lastError = `${url} unexpected payload`;
        continue;
      }
      return { url, comuni };
    } catch (error) {
      lastError = error instanceof Error ? error.message : lastError;
    }
  }
  throw new Error(lastError);
}

function asCaps(value: string | string[] | undefined) {
  const list = Array.isArray(value) ? value : value ? [value] : [];
  return list
    .map((cap) => cap.replace(/\D/g, "").padStart(5, "0"))
    .filter((cap) => /^\d{5}$/.test(cap));
}

function pad(value: string | undefined, width: number) {
  const digits = (value ?? "").replace(/\D/g, "");
  if (!digits) return null;
  return digits.padStart(width, "0");
}
