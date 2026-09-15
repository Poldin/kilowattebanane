import { offerteReadClient } from "@/lib/offerte/db";
import type { OfferteCliente } from "@/lib/offerte/public-types";

export type RegulatedStack = {
  reteFixedEurYear: number;
  retePerKwYear: number;
  retePerKwh: number;
  oneriFixedEurYear: number;
  oneriPerKwYear: number;
  oneriPerKwh: number;
  accisaPerKwh: number;
  ivaRate: number;
  lambda: number;
  pcvEurYear: number;
  dispbtEurYear: number;
  cdispPerKwh: number;
  bta: string | null;
};

function n(value: number | string | null | undefined) {
  if (value == null || value === "") return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function btaBand(potenzaKw: number) {
  if (potenzaKw <= 1.5) return "b1";
  if (potenzaKw <= 3) return "b2";
  if (potenzaKw <= 6) return "b3";
  if (potenzaKw <= 10) return "b4";
  if (potenzaKw <= 16.5) return "b5";
  return "b6";
}

export async function loadParametriMap() {
  const client = offerteReadClient();
  const { data, error } = await client
    .from("po_parametri_e")
    .select("nome_parametro, valore")
    .eq("is_current", true);
  if (error) throw new Error(error.message);
  const map = new Map<string, number>();
  for (const row of data ?? []) {
    const nome = String(row.nome_parametro ?? "");
    const valore = Number(row.valore);
    if (!nome || !Number.isFinite(valore)) continue;
    map.set(nome, valore);
  }
  return map;
}

export function regulatedStack(
  params: Map<string, number>,
  options: {
    cliente: OfferteCliente;
    residente: boolean;
    potenzaKw: number;
  },
): RegulatedStack {
  const p = (key: string) => n(params.get(key));
  const domestico = options.cliente === "domestico";
  const residente = domestico && options.residente;
  const bta = domestico ? null : btaBand(options.potenzaKw);

  if (domestico) {
    const accisa = residente
      ? options.potenzaKw <= 3
        ? p("acc_c_r_l")
        : p("acc_c_r_h")
      : p("acc_c_nr");
    return {
      reteFixedEurYear: p("sigma1"),
      retePerKwYear: p("sigma2") + p("uc6s_d"),
      retePerKwh: p("sigma3") + p("uc3") + p("uc6p_d"),
      oneriFixedEurYear: residente ? 0 : p("asos_dnr_f") + p("arim_dnr_f"),
      oneriPerKwYear: 0,
      oneriPerKwh: residente
        ? p("asos_dr") + p("arim_dr")
        : p("asos_dnr_v") + p("arim_dnr_v"),
      accisaPerKwh: accisa,
      ivaRate: p("iva_c") || 0.1,
      lambda: p("lambda") || 0.1,
      pcvEurYear: p("pcv_c"),
      dispbtEurYear: p("dispbt_d"),
      cdispPerKwh: p("cdispd"),
      bta,
    };
  }

  const band = bta ?? "b3";
  return {
    reteFixedEurYear: p(`dis_${band}_f`) + p("mis") + p("uc6s_nd"),
    retePerKwYear: p(`dis_${band}_p`),
    retePerKwh: p(`dis_${band}_c`) + p("tras") + p("uc3") + p("uc6p_nd"),
    oneriFixedEurYear: p(`asos_nd_${band}_f`) + p(`arim_nd_${band}_f`),
    oneriPerKwYear: p(`asos_nd_${band}_p`) + p(`arim_nd_${band}_p`),
    oneriPerKwh: p(`asos_nd_${band}_c`) + p(`arim_nd_${band}_c`),
    accisaPerKwh: p("acc_a_l_l"),
    ivaRate: p("iva_a") || 0.22,
    lambda: p("lambda") || 0.1,
    pcvEurYear: p("pcv_a"),
    dispbtEurYear: p("dispbt_nd"),
    cdispPerKwh: p("cdispd"),
    bta,
  };
}
