import {
  CME_ITB_PAGE_URL,
  CME_ITB_SOURCE,
  fetchCmeItalianPowerForwards,
} from "@/lib/offerte/cme-italian-power";
import { chunk, offerteClient } from "@/lib/offerte/client";
import { romeToday } from "@/lib/offerte/dates";
import { rebuildPunShape } from "@/lib/offerte/shape";

export async function ingestForwardCurve(snapshotDate = romeToday()) {
  const fetched = await fetchCmeItalianPowerForwards(snapshotDate);
  const client = offerteClient();
  const rows = fetched.points.map((point) => ({
    as_of: snapshotDate,
    product: point.product,
    tenor: point.tenor,
    period_start: point.periodStart,
    period_end: point.periodEnd,
    price_eur_mwh: point.priceEurMwh,
    check_price_eur_mwh: point.priceEurMwh,
    ref_price_eur_mwh: point.priceEurMwh,
    source: CME_ITB_SOURCE,
    raw: {
      product: `ITB ${point.tenor} ${point.periodStart}`,
      tradeDate: fetched.tradeDate,
      page: CME_ITB_PAGE_URL,
    },
  }));

  const { count: before, error: beforeError } = await client
    .from("po_forward_curve")
    .select("id", { count: "exact", head: true })
    .eq("as_of", snapshotDate)
    .eq("source", CME_ITB_SOURCE);
  if (beforeError) throw new Error(beforeError.message);

  let seen = 0;
  for (const group of chunk(rows, 200)) {
    const { error } = await client.from("po_forward_curve").upsert(group, {
      onConflict: "as_of,product,tenor,period_start",
      ignoreDuplicates: true,
    });
    if (error) throw new Error(error.message);
    seen += group.length;
  }

  const { count: after, error: afterError } = await client
    .from("po_forward_curve")
    .select("id", { count: "exact", head: true })
    .eq("as_of", snapshotDate)
    .eq("source", CME_ITB_SOURCE);
  if (afterError) throw new Error(afterError.message);

  const inserted = (after ?? 0) - (before ?? 0);
  return {
    kind: "cme_itb_forwards" as const,
    snapshotDate,
    tradeDate: fetched.tradeDate,
    sourceUrl: fetched.sourceUrl,
    seen,
    inserted,
    unchanged: seen - inserted,
    superseded: 0,
    delisted: 0,
    relisted: 0,
  };
}

export async function pullForwardStack(snapshotDate = romeToday()) {
  const shape = await rebuildPunShape(snapshotDate);
  let forwards: Awaited<ReturnType<typeof ingestForwardCurve>> | null = null;
  let forwardError: string | null = null;
  try {
    forwards = await ingestForwardCurve(snapshotDate);
  } catch (error) {
    forwardError = error instanceof Error ? error.message : "CME ITB ingest failed";
  }
  return { forwards, shape, forwardError };
}
