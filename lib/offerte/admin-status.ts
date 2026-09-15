import { offerteClient } from "@/lib/offerte/client";
import type { ImportKind } from "@/lib/offerte/types";

export type OfferteImportStatus = {
  kind: ImportKind;
  label: string;
  snapshotDate: string | null;
  finishedAt: string | null;
  status: string | null;
};

const LABELS: Record<ImportKind, string> = {
  geo: "Geo",
  parametri_e: "Parametri",
  placet_e: "PLACET",
  ml_e: "Mercato libero",
};

const TRACKED: ImportKind[] = ["parametri_e", "placet_e", "ml_e"];

export async function loadOfferteImportStatus() {
  const client = offerteClient();
  const { data, error } = await client
    .from("po_import_runs")
    .select("kind, snapshot_date, status, finished_at")
    .in("kind", TRACKED)
    .eq("status", "ok")
    .order("finished_at", { ascending: false })
    .limit(30);

  if (error) throw new Error(error.message);

  const latest = new Map<ImportKind, OfferteImportStatus>();
  for (const row of data ?? []) {
    const kind = row.kind as ImportKind;
    if (!TRACKED.includes(kind) || latest.has(kind)) continue;
    latest.set(kind, {
      kind,
      label: LABELS[kind],
      snapshotDate: row.snapshot_date,
      finishedAt: row.finished_at,
      status: row.status,
    });
  }

  return {
    imports: TRACKED.map((kind) => latest.get(kind) ?? {
      kind,
      label: LABELS[kind],
      snapshotDate: null,
      finishedAt: null,
      status: null,
    }),
    snapshotDate:
      [...latest.values()]
        .map((item) => item.snapshotDate)
        .filter((value): value is string => value != null)
        .sort()
        .at(-1) ?? null,
  };
}
