import { createSecretClient } from "@/lib/supabase/secret";

export function offerteClient() {
  return createSecretClient();
}

function parseHttpDate(raw?: string | null) {
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export async function fetchAllRows<T extends Record<string, unknown>>(
  client: ReturnType<typeof offerteClient>,
  table: string,
  columns: string,
) {
  const pageSize = 1000;
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await client
      .from(table)
      .select(columns)
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const page = (data ?? []) as T[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}

export function chunk<T>(items: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export async function startImportRun(
  client: ReturnType<typeof offerteClient>,
  kind: "geo" | "parametri_e" | "placet_e" | "ml_e",
  snapshotDate: string,
  extra: {
    sourceUrl?: string;
    sourceLastModified?: string | null;
    bytes?: number;
    sha256?: string;
  } = {},
) {
  const { data, error } = await client
    .from("po_import_runs")
    .insert({
      kind,
      snapshot_date: snapshotDate,
      source_url: extra.sourceUrl ?? null,
      source_last_modified: parseHttpDate(extra.sourceLastModified),
      bytes: extra.bytes ?? null,
      sha256: extra.sha256 ?? null,
      status: "running",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as number;
}

export async function finishImportRun(
  client: ReturnType<typeof offerteClient>,
  id: number,
  summary: {
    status: "ok" | "failed";
    seen?: number;
    inserted?: number;
    unchanged?: number;
    superseded?: number;
    delisted?: number;
    relisted?: number;
    error?: string;
    meta?: Record<string, unknown>;
  },
) {
  const { error } = await client
    .from("po_import_runs")
    .update({
      status: summary.status,
      seen: summary.seen ?? 0,
      inserted: summary.inserted ?? 0,
      unchanged: summary.unchanged ?? 0,
      superseded: summary.superseded ?? 0,
      delisted: summary.delisted ?? 0,
      relisted: summary.relisted ?? 0,
      error: summary.error ?? null,
      finished_at: new Date().toISOString(),
      meta: summary.meta ?? {},
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
}
