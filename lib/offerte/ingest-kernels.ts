import { chunk, offerteClient } from "@/lib/offerte/client";
import { paginateSelect } from "@/lib/offerte/db";
import { resolveOffertePlan } from "@/lib/offerte/codice";
import { romeToday } from "@/lib/offerte/dates";
import { mlFacts, placetFacts } from "@/lib/offerte/metrics";
import {
  kernelToRow,
  mlKernel,
  placetKernel,
  type MlKernelInput,
} from "@/lib/offerte/kernel";
import type { MlComponentInput } from "@/lib/offerte/estimate";

type PlacetLive = {
  id: number;
  cod_offerta: string;
  tipo_cliente: string | null;
  tipo_offerta: string | null;
  p_fix_f: number | null;
  p_fix_v: number | null;
  p_vol_f1: number | null;
  p_vol_f2: number | null;
  p_vol_f3: number | null;
  p_vol_bf1: number | null;
  p_vol_bf23: number | null;
  p_vol_mono: number | null;
  alpha: number | null;
};

type MlLive = {
  id: number;
  cod_offerta: string;
  tipo_cliente: string | null;
  tipo_offerta: string | null;
  idx_prezzo_energia: string | null;
  coefficiente: number | null;
  tipologia_fasce: string | null;
};

type CompRow = MlComponentInput & { offer_id: number };
type DispRow = { offer_id: number; valore: number | string | null; nome: string | null };
type ScontoRow = MlKernelInput["sconti"][number] & { offer_id: number };

async function loadByIds<T>(
  table: string,
  columns: string,
  ids: number[],
) {
  const client = offerteClient();
  const rows: T[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    const slice = ids.slice(i, i + 200);
    const page = await paginateSelect<T>(
      (from, to) =>
        client.from(table).select(columns).in("offer_id", slice).range(from, to) as PromiseLike<{
          data: T[] | null;
          error: { message: string } | null;
        }>,
    );
    rows.push(...page);
  }
  return rows;
}

function dedupeKernelRows<T extends { source: string; offer_id: number }>(rows: T[]) {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const row of rows) {
    const key = `${row.source}:${row.offer_id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

function groupByOffer<T extends { offer_id: number }>(rows: T[]) {
  const map = new Map<number, T[]>();
  for (const row of rows) {
    const list = map.get(row.offer_id) ?? [];
    list.push(row);
    map.set(row.offer_id, list);
  }
  return map;
}

export async function rebuildOfferKernels() {
  const today = romeToday();
  const client = offerteClient();

  const placet = await paginateSelect<PlacetLive>((from, to) =>
    client
      .from("po_placet_e_live")
      .select(
        "id, cod_offerta, tipo_cliente, tipo_offerta, p_fix_f, p_fix_v, p_vol_f1, p_vol_f2, p_vol_f3, p_vol_bf1, p_vol_bf23, p_vol_mono, alpha",
      )
      .lte("valid_from", today)
      .gte("valid_to", today)
      .order("id")
      .range(from, to),
  );
  const ml = await paginateSelect<MlLive>((from, to) =>
    client
      .from("po_ml_e_live")
      .select("id, cod_offerta, tipo_cliente, tipo_offerta, idx_prezzo_energia, coefficiente, tipologia_fasce")
      .lte("valid_from", today)
      .gte("valid_to", today)
      .order("id")
      .range(from, to),
  );

  const mlIds = ml.map((row) => row.id);
  const [componenti, dispacciamento, sconti] = await Promise.all([
    loadByIds<CompRow>(
      "po_ml_e_componenti",
      "offer_id, macroarea, unita_misura, fascia, prezzo, nome",
      mlIds,
    ),
    loadByIds<DispRow>("po_ml_e_dispacciamento", "offer_id, valore, nome", mlIds),
    loadByIds<ScontoRow>(
      "po_ml_e_sconti",
      "offer_id, nome, descrizione, valore, unita_misura, tipologia_prezzo, validita, condizione_applicazione, descrizione_condizione, iva_sconto",
      mlIds,
    ),
  ]);

  const byComp = groupByOffer(componenti);
  const byDisp = groupByOffer(dispacciamento);
  const bySconto = groupByOffer(sconti);

  const kernels = [
    ...placet.map((row) => {
      const facts = placetFacts(row);
      return placetKernel({
        ...row,
        plan: resolveOffertePlan(
          { source: "placet", tipoOfferta: row.tipo_offerta ?? "", codOfferta: row.cod_offerta },
          facts.plan,
        ),
      });
    }),
    ...ml.map((row) => {
      const components = byComp.get(row.id) ?? [];
      const facts = mlFacts({
        tipo_offerta: row.tipo_offerta,
        tipologia_fasce: row.tipologia_fasce,
        components,
      });
      return mlKernel({
        ...row,
        plan: resolveOffertePlan(
          { source: "ml", tipoOfferta: row.tipo_offerta ?? "", codOfferta: row.cod_offerta },
          facts.plan,
        ),
        components,
        dispacciamento: byDisp.get(row.id) ?? [],
        sconti: bySconto.get(row.id) ?? [],
      });
    }),
  ];

  const rows = dedupeKernelRows(kernels.map(kernelToRow));
  const { error: deleteError } = await client
    .from("po_offer_kernel")
    .delete()
    .in("source", ["placet", "ml"]);
  if (deleteError) throw new Error(deleteError.message);

  for (const group of chunk(rows, 200)) {
    const { error } = await client.from("po_offer_kernel").insert(group);
    if (error) throw new Error(error.message);
  }

  return { rebuilt: rows.length, placet: placet.length, ml: ml.length };
}
