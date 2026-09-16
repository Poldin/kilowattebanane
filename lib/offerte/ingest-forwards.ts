import {
  CME_ITB_PAGE_URL,
  CME_ITB_SOURCE,
  fetchCmeItalianPowerForwards,
} from "@/lib/offerte/cme-italian-power";
import {
  GME_MTE_PAGE_URL,
  GME_MTE_SOURCE,
  fetchGmeMteMonthlyForwards,
} from "@/lib/offerte/gme-mte";
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

export async function ingestGmeMteMonthly(snapshotDate = romeToday()) {
  const fetched = await fetchGmeMteMonthlyForwards(snapshotDate);
  const client = offerteClient();
  const asOf = fetched.asOf;
  const rows = fetched.points.map((point) => ({
    as_of: asOf,
    period_start: point.periodStart,
    period_end: point.periodEnd,
    product_code: point.productCode,
    price_eur_mwh: point.priceEurMwh,
    check_price_eur_mwh: point.checkPriceEurMwh,
    ref_price_eur_mwh: point.refPriceEurMwh,
    last_price_eur_mwh: point.lastPriceEurMwh,
    volume_mw: point.volumeMw,
    source: GME_MTE_SOURCE,
    raw: {
      ...point.raw,
      page: GME_MTE_PAGE_URL,
      snapshotDate,
    },
  }));

  const { count: before, error: beforeError } = await client
    .from("po_gme_mte_monthly")
    .select("id", { count: "exact", head: true })
    .eq("as_of", asOf);
  if (beforeError) throw new Error(beforeError.message);

  let seen = 0;
  for (const group of chunk(rows, 200)) {
    const { error } = await client.from("po_gme_mte_monthly").upsert(group, {
      onConflict: "as_of,period_start",
    });
    if (error) throw new Error(error.message);
    seen += group.length;
  }

  const { count: after, error: afterError } = await client
    .from("po_gme_mte_monthly")
    .select("id", { count: "exact", head: true })
    .eq("as_of", asOf);
  if (afterError) throw new Error(afterError.message);

  const inserted = Math.max(0, (after ?? 0) - (before ?? 0));
  return {
    kind: "gme_mte_monthly" as const,
    snapshotDate,
    sessionDate: asOf,
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
  const [cmeSettled, gmeSettled] = await Promise.allSettled([
    ingestForwardCurve(snapshotDate),
    ingestGmeMteMonthly(snapshotDate),
  ]);

  const forwards = cmeSettled.status === "fulfilled" ? cmeSettled.value : null;
  const forwardError =
    cmeSettled.status === "rejected"
      ? cmeSettled.reason instanceof Error
        ? cmeSettled.reason.message
        : "CME ITB ingest failed"
      : null;
  const gme = gmeSettled.status === "fulfilled" ? gmeSettled.value : null;
  const gmeError =
    gmeSettled.status === "rejected"
      ? gmeSettled.reason instanceof Error
        ? gmeSettled.reason.message
        : "GME MTE ingest failed"
      : null;

  return { forwards, gme, shape, forwardError, gmeError };
}
