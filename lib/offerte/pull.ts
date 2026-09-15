import { ingestGeo } from "@/lib/offerte/ingest-geo";
import { ingestMlE } from "@/lib/offerte/ingest-ml";
import { ingestParametriE } from "@/lib/offerte/ingest-parametri";
import { ingestPlacetE } from "@/lib/offerte/ingest-placet";
import { rebuildOfferKernels } from "@/lib/offerte/ingest-kernels";
import type { ImportKind, IngestSummary } from "@/lib/offerte/types";

export type PullOfferteOptions = {
  sources?: Array<ImportKind | "all">;
  snapshotDate?: string;
  refreshGeo?: boolean;
};

export async function pullOfferte(options: PullOfferteOptions = {}) {
  const requested = new Set(options.sources ?? ["all"]);
  const all = requested.has("all");
  const summaries: IngestSummary[] = [];

  if (all || requested.has("geo")) {
    summaries.push(await ingestGeo({ force: options.refreshGeo }));
  }
  if (all || requested.has("parametri_e")) {
    summaries.push(await ingestParametriE(options.snapshotDate));
  }
  if (all || requested.has("placet_e")) {
    summaries.push(await ingestPlacetE(options.snapshotDate));
  }
  if (all || requested.has("ml_e")) {
    summaries.push(await ingestMlE(options.snapshotDate));
  }

  if (summaries.some((summary) => summary.kind === "placet_e" || summary.kind === "ml_e" || summary.kind === "parametri_e")) {
    await rebuildOfferKernels();
  }

  return { summaries };
}
