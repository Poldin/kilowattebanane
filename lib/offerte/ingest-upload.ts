import { ingestMlE } from "@/lib/offerte/ingest-ml";
import { ingestParametriE } from "@/lib/offerte/ingest-parametri";
import { ingestPlacetE } from "@/lib/offerte/ingest-placet";
import { rebuildOfferKernels } from "@/lib/offerte/ingest-kernels";
import { revalidateOfferte } from "@/lib/offerte/revalidate";
import type { DownloadedFile } from "@/lib/offerte/source";
import type { IngestSummary } from "@/lib/offerte/types";

const ORDER: DownloadedFile["kind"][] = ["parametri_e", "placet_e", "ml_e"];

export async function ingestUploadedOfferteFiles(files: DownloadedFile[]) {
  const byKind = new Map(files.map((file) => [file.kind, file]));
  const summaries: IngestSummary[] = [];

  for (const kind of ORDER) {
    const file = byKind.get(kind);
    if (!file) continue;
    if (kind === "parametri_e") summaries.push(await ingestParametriE(undefined, file));
    if (kind === "placet_e") summaries.push(await ingestPlacetE(undefined, file));
    if (kind === "ml_e") summaries.push(await ingestMlE(undefined, file));
  }

  if (
    summaries.some(
      (summary) =>
        summary.kind === "placet_e" || summary.kind === "ml_e" || summary.kind === "parametri_e",
    )
  ) {
    await rebuildOfferKernels();
    revalidateOfferte();
  }

  return summaries;
}
