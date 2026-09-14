import type { MlComponentInput, PlacetPriceInput } from "@/lib/offerte/estimate";

export type OfferteBandPlan = "monoraria" | "bioraria" | "fasce";
export type OfferteFasciaPlan = OfferteBandPlan | "dinamica";

export type OfferPriceFacts = {
  monthlyEur: number | null;
  spreadEurKwh: number | null;
  spreadMinEurKwh: number | null;
  spreadMaxEurKwh: number | null;
  spreadMeanEurKwh?: number | null;
  plan: OfferteFasciaPlan | null;
};

function n(value: number | string | null | undefined) {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function approx(a: number, b: number) {
  return Math.abs(a - b) < 1e-6;
}

function allApproxEqual(values: number[]) {
  if (values.length <= 1) return true;
  return values.every((value) => approx(value, values[0]));
}

function yearlyToMonthly(value: number) {
  return Math.abs(value) >= 20 ? value / 12 : value;
}

function perKwh(prezzo: number) {
  return prezzo > 2 ? prezzo / 1000 : prezzo;
}

function fromValues(monthlyEur: number | null, spreads: number[], plan: OfferteFasciaPlan | null): OfferPriceFacts {
  if (spreads.length === 0) {
    return {
      monthlyEur,
      spreadEurKwh: null,
      spreadMinEurKwh: null,
      spreadMaxEurKwh: null,
      spreadMeanEurKwh: null,
      plan,
    };
  }
  const min = Math.min(...spreads);
  const max = Math.max(...spreads);
  return {
    monthlyEur,
    spreadEurKwh: min,
    spreadMinEurKwh: min,
    spreadMaxEurKwh: max,
    spreadMeanEurKwh: mean(spreads),
    plan,
  };
}

export function placetFacts(offer: PlacetPriceInput): OfferPriceFacts {
  const variabile = (offer.tipo_offerta ?? "").includes("variabile");
  const fixed = n(variabile ? offer.p_fix_v : offer.p_fix_f);
  const monthlyEur = fixed == null ? null : yearlyToMonthly(fixed);

  if (variabile) {
    const alpha = n(offer.alpha);
    return fromValues(monthlyEur, alpha == null ? [] : [alpha], "monoraria");
  }

  const mono = n(offer.p_vol_mono);
  const bf1 = n(offer.p_vol_bf1);
  const bf23 = n(offer.p_vol_bf23);
  const f1 = n(offer.p_vol_f1);
  const f2 = n(offer.p_vol_f2);
  const f3 = n(offer.p_vol_f3);
  const tri = [f1, f2, f3].filter((value): value is number => value != null);
  const bi = [bf1, bf23].filter((value): value is number => value != null);

  let plan: OfferteFasciaPlan = "monoraria";
  if (f1 != null && f2 != null && f3 != null && approx(f2, f3) && !approx(f1, f2)) {
    plan = "bioraria";
  } else if (tri.length >= 2 && !allApproxEqual(tri)) {
    plan = "fasce";
  } else if (bf1 != null && bf23 != null && !approx(bf1, bf23)) {
    plan = "bioraria";
  }

  const spreads = tri.length > 0 ? tri : bi.length > 0 ? bi : mono == null ? [] : [mono];
  return fromValues(monthlyEur, spreads, plan);
}

export type MlFactsInput = {
  tipo_offerta: string | null;
  tipologia_fasce: string | null;
  components: MlComponentInput[];
};

function planFromTipologia(tipologia: string | null): OfferteBandPlan | null {
  if (tipologia === "01") return "monoraria";
  if (tipologia === "91" || tipologia === "92" || tipologia === "93") return "bioraria";
  return null;
}

function isSpreadComponent(component: MlComponentInput) {
  return /spread/i.test(component.nome ?? "");
}

function isGreenEnergyComponent(component: MlComponentInput) {
  return /verde|rinnovab|cgo|prezzo_ev|\bfer\b|gdo/i.test(component.nome ?? "");
}

function isMlEnergyComponent(component: MlComponentInput, variabile: boolean) {
  if (component.unita_misura !== "03" || isGreenEnergyComponent(component)) return false;
  if (component.macroarea === "04") return true;
  if (variabile) {
    return (
      (component.macroarea === "06" || component.macroarea === "02") && isSpreadComponent(component)
    );
  }
  return component.macroarea === "06" && !isSpreadComponent(component);
}

function mlEnergyComponents(components: MlComponentInput[], variabile: boolean) {
  const energy: { fascia: string | null; prezzo: number }[] = [];

  for (const component of components) {
    if (!isMlEnergyComponent(component, variabile)) continue;
    const prezzo = n(component.prezzo);
    if (prezzo == null) continue;
    energy.push({ fascia: component.fascia, prezzo: perKwh(prezzo) });
  }

  return energy;
}

function bandMeans(energy: { fascia: string | null; prezzo: number }[]) {
  const byFascia = new Map<string, number[]>();
  for (const row of energy) {
    const key = row.fascia ?? "01";
    const list = byFascia.get(key) ?? [];
    list.push(row.prezzo);
    byFascia.set(key, list);
  }
  return [...byFascia.values()]
    .map((values) => mean(values))
    .filter((value): value is number => value != null);
}

export function mlFacts({ tipo_offerta, tipologia_fasce, components }: MlFactsInput): OfferPriceFacts {
  let monthly = 0;
  let hasMonthly = false;
  const variabile = (tipo_offerta ?? "").includes("variabile");
  const energy = mlEnergyComponents(components, variabile);

  for (const component of components) {
    const prezzo = n(component.prezzo);
    if (prezzo == null) continue;
    if (component.unita_misura === "01") {
      monthly += yearlyToMonthly(prezzo);
      hasMonthly = true;
      continue;
    }
    if (component.unita_misura === "02") {
      monthly += prezzo;
      hasMonthly = true;
    }
  }

  const bands = bandMeans(energy);
  const tipologiaPlan = planFromTipologia(tipologia_fasce);

  let plan: OfferteFasciaPlan | null = energy.length === 0 ? tipologiaPlan : "monoraria";
  if (tipologiaPlan === "bioraria") {
    plan = "bioraria";
  } else if (bands.length >= 2 && !allApproxEqual(bands)) {
    plan = bands.length === 2 ? "bioraria" : "fasce";
  } else if (plan == null && tipologia_fasce === "01") {
    plan = "monoraria";
  }

  const spreads = bands.length > 0 ? bands : energy.map((row) => row.prezzo);
  return fromValues(hasMonthly ? monthly : null, spreads, plan);
}

function mean(values: number[]) {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function compareOfferFacts(a: OfferPriceFacts, b: OfferPriceFacts) {
  if (a.monthlyEur == null && b.monthlyEur == null) {
    if (a.spreadEurKwh == null && b.spreadEurKwh == null) return 0;
    if (a.spreadEurKwh == null) return 1;
    if (b.spreadEurKwh == null) return -1;
    return a.spreadEurKwh - b.spreadEurKwh;
  }
  if (a.monthlyEur == null) return 1;
  if (b.monthlyEur == null) return -1;
  if (a.monthlyEur !== b.monthlyEur) return a.monthlyEur - b.monthlyEur;
  if (a.spreadEurKwh == null && b.spreadEurKwh == null) return 0;
  if (a.spreadEurKwh == null) return 1;
  if (b.spreadEurKwh == null) return -1;
  return a.spreadEurKwh - b.spreadEurKwh;
}
