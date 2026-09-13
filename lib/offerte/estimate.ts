const PUN_IDX = new Set(["01", "08", "12"]);

function n(value: number | string | null | undefined) {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export type PlacetPriceInput = {
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

export type MlComponentInput = {
  macroarea: string | null;
  unita_misura: string | null;
  fascia: string | null;
  prezzo: number | null;
  nome: string | null;
};

export function estimatePlacetYearly(
  offer: PlacetPriceInput,
  consumoKwh: number,
  punEurKwh: number,
) {
  const variabile = (offer.tipo_offerta ?? "").includes("variabile");
  const fixed = n(variabile ? offer.p_fix_v : offer.p_fix_f);
  const energyPrice = variabile
    ? punEurKwh + (n(offer.alpha) ?? 0)
    : blendedVolumePrice(offer);
  if (fixed == null && energyPrice == null) return null;
  return (fixed ?? 0) + (energyPrice ?? 0) * consumoKwh;
}

export function estimateMlYearly(
  components: MlComponentInput[],
  options: {
    consumoKwh: number;
    potenzaKw: number;
    variabile: boolean;
    idxPrezzo: string | null;
    coefficiente: number | null;
    punEurKwh: number;
  },
) {
  let yearly = 0;
  let has = false;
  const energyByFascia: number[] = [];

  for (const component of components) {
    const prezzo = n(component.prezzo);
    if (prezzo == null) continue;
    const unit = component.unita_misura;
    if (unit === "01") {
      yearly += prezzo;
      has = true;
      continue;
    }
    if (unit === "02") {
      yearly += prezzo * 12;
      has = true;
      continue;
    }
    if (unit === "05") {
      yearly += prezzo * options.potenzaKw;
      has = true;
      continue;
    }
    if (unit === "03") {
      const perKwh = prezzo > 2 ? prezzo / 1000 : prezzo;
      if (component.macroarea === "04") energyByFascia.push(perKwh);
      else yearly += perKwh * options.consumoKwh;
      has = true;
    }
  }

  if (energyByFascia.length > 0) {
    const avg = energyByFascia.reduce((sum, n) => sum + n, 0) / energyByFascia.length;
    yearly += avg * options.consumoKwh;
  }

  if (options.variabile && options.idxPrezzo && PUN_IDX.has(options.idxPrezzo)) {
    yearly += options.punEurKwh * (options.coefficiente ?? 1) * options.consumoKwh;
    has = true;
  }

  return has ? yearly : null;
}

function blendedVolumePrice(offer: PlacetPriceInput) {
  const mono = n(offer.p_vol_mono);
  if (mono != null) return mono;
  const bf1 = n(offer.p_vol_bf1);
  const bf23 = n(offer.p_vol_bf23);
  if (bf1 != null || bf23 != null) {
    return (bf1 ?? 0) * 0.33 + (bf23 ?? 0) * 0.67;
  }
  const f1 = n(offer.p_vol_f1);
  const f2 = n(offer.p_vol_f2);
  const f3 = n(offer.p_vol_f3);
  if (f1 != null || f2 != null || f3 != null) {
    return (f1 ?? 0) * 0.33 + (f2 ?? 0) * 0.31 + (f3 ?? 0) * 0.36;
  }
  return null;
}

export function formatEuroAnno(value: number) {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}
