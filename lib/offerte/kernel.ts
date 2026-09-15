import type { MlComponentInput } from "@/lib/offerte/estimate";
import { isOffertaDinamica } from "@/lib/offerte/codice";
import type { OfferteFasciaPlan } from "@/lib/offerte/metrics";
import { year1ScontoEur } from "@/lib/offerte/sconto";

const PUN_IDX = new Set(["01", "08", "12"]);

export type OfferKernel = {
  source: "placet" | "ml";
  offerId: number;
  codOfferta: string;
  cliente: string | null;
  variabile: boolean;
  plan: OfferteFasciaPlan | null;
  idxPrezzo: string | null;
  coefficiente: number | null;
  needsForward: boolean;
  eurYearFixed: number;
  eurKwYear: number;
  spreadF0: number | null;
  spreadF1: number | null;
  spreadF2: number | null;
  spreadF3: number | null;
  spreadF23: number | null;
  energyFissoF0: number | null;
  energyFissoF1: number | null;
  energyFissoF2: number | null;
  energyFissoF3: number | null;
  energyFissoF23: number | null;
  punCoeff: number;
  applyLambdaOnForward: boolean;
  scontoEurYear: number;
  scontoEurKwh: number;
  scontoEurKw: number;
  scontoIva: boolean | null;
  dispacciamentoEurKwh: number;
};

function n(value: number | string | null | undefined) {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function perKwh(prezzo: number) {
  return prezzo > 2 ? prezzo / 1000 : prezzo;
}

function mean(values: number[]) {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function padCode(value: string | null | undefined) {
  const raw = value?.trim();
  if (!raw) return "";
  return raw.length === 1 ? `0${raw}` : raw;
}

export function fasciaBucket(raw: string | null | undefined) {
  const code = padCode(raw).toUpperCase();
  if (!code || code === "00" || code === "04" || code === "F0" || code === "MF0") return "f0";
  if (code === "01" || code === "F1" || code === "91") return "f1";
  if (code === "02" || code === "F2") return "f2";
  if (code === "03" || code === "F3") return "f3";
  if (code === "92" || code === "93" || code === "F23" || code === "BF23") return "f23";
  return "f0";
}

function isSpreadName(name: string | null) {
  return /spread/i.test(name ?? "");
}

function isGreenName(name: string | null) {
  return /verde|rinnovab|cgo|prezzo_ev|\bfer\b|gdo/i.test(name ?? "");
}

function emptyBands() {
  return { f0: [] as number[], f1: [] as number[], f2: [] as number[], f3: [] as number[], f23: [] as number[] };
}

function bandMeans(bands: ReturnType<typeof emptyBands>) {
  return {
    f0: mean(bands.f0),
    f1: mean(bands.f1),
    f2: mean(bands.f2),
    f3: mean(bands.f3),
    f23: mean(bands.f23),
  };
}

export type PlacetKernelInput = {
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
  plan: OfferteFasciaPlan | null;
};

export type MlKernelInput = {
  id: number;
  cod_offerta: string;
  tipo_cliente: string | null;
  tipo_offerta: string | null;
  idx_prezzo_energia: string | null;
  coefficiente: number | null;
  plan: OfferteFasciaPlan | null;
  components: MlComponentInput[];
  dispacciamento: { valore: number | string | null; nome?: string | null }[];
  sconti: {
    nome: string | null;
    descrizione: string | null;
    valore: number | string | null;
    unita_misura: string | null;
    tipologia_prezzo: string | null;
    validita: string | null;
    condizione_applicazione: string | null;
    descrizione_condizione: string | null;
    iva_sconto: string | null;
  }[];
};

export function placetKernel(row: PlacetKernelInput): OfferKernel {
  const variabile = (row.tipo_offerta ?? "").includes("variabile");
  const fixed = n(variabile ? row.p_fix_v : row.p_fix_f) ?? 0;
  const alpha = n(row.alpha);
  const mono = n(row.p_vol_mono);
  const f1 = n(row.p_vol_f1);
  const f2 = n(row.p_vol_f2);
  const f3 = n(row.p_vol_f3);
  const bf1 = n(row.p_vol_bf1);
  const bf23 = n(row.p_vol_bf23);

  return {
    source: "placet",
    offerId: row.id,
    codOfferta: row.cod_offerta,
    cliente: row.tipo_cliente,
    variabile,
    plan: row.plan,
    idxPrezzo: variabile ? "12" : null,
    coefficiente: 1,
    needsForward: variabile,
    eurYearFixed: fixed,
    eurKwYear: 0,
    spreadF0: variabile ? alpha : null,
    spreadF1: variabile ? alpha : null,
    spreadF2: variabile ? alpha : null,
    spreadF3: variabile ? alpha : null,
    spreadF23: variabile ? alpha : null,
    energyFissoF0: variabile ? null : mono,
    energyFissoF1: variabile ? null : (bf1 ?? f1),
    energyFissoF2: variabile ? null : f2,
    energyFissoF3: variabile ? null : f3,
    energyFissoF23: variabile ? null : bf23,
    punCoeff: variabile ? 1 : 0,
    applyLambdaOnForward: true,
    scontoEurYear: 0,
    scontoEurKwh: 0,
    scontoEurKw: 0,
    scontoIva: null,
    dispacciamentoEurKwh: 0,
  };
}

function scontoAmounts(sconti: MlKernelInput["sconti"]) {
  const valued = year1ScontoEur(sconti, { consumoKwh: 2700, potenzaKw: 3.3 });
  return { eurYear: valued.eur, eurKwh: 0, eurKw: 0, iva: valued.iva };
}

export function mlKernel(row: MlKernelInput): OfferKernel {
  const variabile = (row.tipo_offerta ?? "").includes("variabile");
  const dinamica = isOffertaDinamica({
    source: "ml",
    tipoOfferta: row.tipo_offerta ?? "",
    codOfferta: row.cod_offerta,
  });
  const idx = padCode(row.idx_prezzo_energia);
  const punIndexed = PUN_IDX.has(idx) || dinamica;
  let eurYearFixed = 0;
  let eurKwYear = 0;
  const energy = emptyBands();
  const green = emptyBands();

  for (const component of row.components) {
    const prezzo = n(component.prezzo);
    if (prezzo == null) continue;
    const unit = padCode(component.unita_misura);
    if (unit === "01") {
      eurYearFixed += prezzo;
      continue;
    }
    if (unit === "02") {
      eurYearFixed += prezzo * 12;
      continue;
    }
    if (unit === "05") {
      eurKwYear += Math.abs(prezzo) >= 1 ? prezzo : prezzo * 12;
      continue;
    }
    if (unit !== "03") continue;
    const bucket = fasciaBucket(component.fascia);
    const value = perKwh(prezzo);
    if (isGreenName(component.nome) || component.macroarea === "06") {
      green[bucket].push(value);
      continue;
    }
    const qe = component.macroarea === "04";
    const spreadish = variabile && (qe || isSpreadName(component.nome) || component.macroarea === "02");
    const fissoEnergy = !variabile && (qe || component.macroarea === "06");
    if (spreadish || fissoEnergy) energy[bucket].push(value);
  }

  const spreads = bandMeans(energy);
  const greens = bandMeans(green);
  const add = (a: number | null, b: number | null) =>
    a == null && b == null ? null : (a ?? 0) + (b ?? 0);

  let disp = 0;
  for (const rowDisp of row.dispacciamento) {
    const value = n(rowDisp.valore);
    if (value == null) continue;
    disp += perKwh(value);
  }

  const sconti = scontoAmounts(row.sconti);
  const coeff = n(row.coefficiente) ?? 1;

  return {
    source: "ml",
    offerId: row.id,
    codOfferta: row.cod_offerta,
    cliente: row.tipo_cliente,
    variabile,
    plan: dinamica ? "dinamica" : row.plan,
    idxPrezzo: idx || null,
    coefficiente: coeff,
    needsForward: variabile && punIndexed,
    eurYearFixed,
    eurKwYear,
    spreadF0: variabile ? spreads.f0 : null,
    spreadF1: variabile ? spreads.f1 : null,
    spreadF2: variabile ? spreads.f2 : null,
    spreadF3: variabile ? spreads.f3 : null,
    spreadF23: variabile ? spreads.f23 : null,
    energyFissoF0: variabile ? add(greens.f0, null) : add(spreads.f0, greens.f0),
    energyFissoF1: variabile ? add(greens.f1, null) : add(spreads.f1, greens.f1),
    energyFissoF2: variabile ? add(greens.f2, null) : add(spreads.f2, greens.f2),
    energyFissoF3: variabile ? add(greens.f3, null) : add(spreads.f3, greens.f3),
    energyFissoF23: variabile ? add(greens.f23, null) : add(spreads.f23, greens.f23),
    punCoeff: variabile && punIndexed ? coeff : 0,
    applyLambdaOnForward: variabile && punIndexed,
    scontoEurYear: sconti.eurYear,
    scontoEurKwh: sconti.eurKwh,
    scontoEurKw: sconti.eurKw,
    scontoIva: sconti.iva,
    dispacciamentoEurKwh: disp,
  };
}

export function kernelToRow(kernel: OfferKernel) {
  return {
    source: kernel.source,
    offer_id: kernel.offerId,
    cod_offerta: kernel.codOfferta,
    cliente: kernel.cliente,
    variabile: kernel.variabile,
    plan: kernel.plan,
    idx_prezzo: kernel.idxPrezzo,
    coefficiente: kernel.coefficiente,
    needs_forward: kernel.needsForward,
    eur_year_fixed: kernel.eurYearFixed,
    eur_kw_year: kernel.eurKwYear,
    spread_f0: kernel.spreadF0,
    spread_f1: kernel.spreadF1,
    spread_f2: kernel.spreadF2,
    spread_f3: kernel.spreadF3,
    spread_f23: kernel.spreadF23,
    energy_fisso_f0: kernel.energyFissoF0,
    energy_fisso_f1: kernel.energyFissoF1,
    energy_fisso_f2: kernel.energyFissoF2,
    energy_fisso_f3: kernel.energyFissoF3,
    energy_fisso_f23: kernel.energyFissoF23,
    pun_coeff: kernel.punCoeff,
    apply_lambda_on_forward: kernel.applyLambdaOnForward,
    sconto_eur_year: kernel.scontoEurYear,
    sconto_eur_kwh: kernel.scontoEurKwh,
    sconto_eur_kw: kernel.scontoEurKw,
    sconto_iva: kernel.scontoIva,
    dispacciamento_eur_kwh: kernel.dispacciamentoEurKwh,
    rebuilt_at: new Date().toISOString(),
  };
}

export function kernelFromRow(row: Record<string, unknown>): OfferKernel {
  const nOrNull = (key: string) => {
    const value = Number(row[key]);
    return Number.isFinite(value) ? value : null;
  };
  const nOr0 = (key: string) => nOrNull(key) ?? 0;
  const plan = row.plan;
  return {
    source: row.source === "placet" ? "placet" : "ml",
    offerId: Number(row.offer_id),
    codOfferta: String(row.cod_offerta),
    cliente: row.cliente == null ? null : String(row.cliente),
    variabile: Boolean(row.variabile),
    plan:
      plan === "monoraria" || plan === "bioraria" || plan === "fasce" || plan === "dinamica"
        ? plan
        : null,
    idxPrezzo: row.idx_prezzo == null ? null : String(row.idx_prezzo),
    coefficiente: nOrNull("coefficiente"),
    needsForward: Boolean(row.needs_forward),
    eurYearFixed: nOr0("eur_year_fixed"),
    eurKwYear: nOr0("eur_kw_year"),
    spreadF0: nOrNull("spread_f0"),
    spreadF1: nOrNull("spread_f1"),
    spreadF2: nOrNull("spread_f2"),
    spreadF3: nOrNull("spread_f3"),
    spreadF23: nOrNull("spread_f23"),
    energyFissoF0: nOrNull("energy_fisso_f0"),
    energyFissoF1: nOrNull("energy_fisso_f1"),
    energyFissoF2: nOrNull("energy_fisso_f2"),
    energyFissoF3: nOrNull("energy_fisso_f3"),
    energyFissoF23: nOrNull("energy_fisso_f23"),
    punCoeff: nOr0("pun_coeff"),
    applyLambdaOnForward: row.apply_lambda_on_forward !== false,
    scontoEurYear: nOr0("sconto_eur_year"),
    scontoEurKwh: nOr0("sconto_eur_kwh"),
    scontoEurKw: nOr0("sconto_eur_kw"),
    scontoIva: row.sconto_iva == null ? null : Boolean(row.sconto_iva),
    dispacciamentoEurKwh: nOr0("dispacciamento_eur_kwh"),
  };
}
