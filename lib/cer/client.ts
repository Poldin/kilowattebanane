import { createSecretClient } from "@/lib/supabase/secret";
import { createAdminClient } from "@/lib/supabase/admin";

export function cerWriteClient() {
  return createSecretClient();
}

export function cerReadClient() {
  return createAdminClient();
}

export async function fetchAllRows<T extends Record<string, unknown>>(
  client: ReturnType<typeof cerWriteClient>,
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
    const page = (data ?? []) as unknown as T[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}

export function chunk<T>(items: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, size + i));
  return out;
}

export async function startCerImportRun(
  extra: {
    sourceUrl?: string | null;
    sourceItemId?: string | null;
    sourceLastModified?: string | null;
    snapshotDate?: string | null;
    bytes?: number | null;
    sha256?: string | null;
  } = {},
) {
  const client = cerWriteClient();
  const { data, error } = await client
    .from("cer_import_runs")
    .insert({
      snapshot_date: extra.snapshotDate ?? null,
      source_url: extra.sourceUrl ?? null,
      source_item_id: extra.sourceItemId ?? null,
      source_last_modified: extra.sourceLastModified ?? null,
      bytes: extra.bytes ?? null,
      sha256: extra.sha256 ?? null,
      status: "running",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as number;
}

export async function finishCerImportRun(
  id: number,
  summary: {
    status: "ok" | "failed";
    snapshotDate?: string | null;
    sourceUrl?: string | null;
    sourceItemId?: string | null;
    seen?: number;
    inserted?: number;
    updated?: number;
    unchanged?: number;
    delisted?: number;
    relisted?: number;
    skipped?: number;
    error?: string;
    meta?: Record<string, unknown>;
  },
) {
  const client = cerWriteClient();
  const { error } = await client
    .from("cer_import_runs")
    .update({
      status: summary.status,
      snapshot_date: summary.snapshotDate ?? null,
      source_url: summary.sourceUrl ?? null,
      source_item_id: summary.sourceItemId ?? null,
      seen: summary.seen ?? 0,
      inserted: summary.inserted ?? 0,
      updated: summary.updated ?? 0,
      unchanged: summary.unchanged ?? 0,
      delisted: summary.delisted ?? 0,
      relisted: summary.relisted ?? 0,
      skipped: summary.skipped ?? 0,
      error: summary.error ?? null,
      finished_at: new Date().toISOString(),
      meta: summary.meta ?? {},
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
}
