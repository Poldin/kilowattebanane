import type { CompareEnergyBand } from "@/lib/offerte/compare-scheda";
import { hourShares, monthKwhShares } from "@/lib/offerte/consumo-profile";
import { addDaysIso, fasciaForHour } from "@/lib/offerte/fasce";
import type { OfferteFasciaPlan } from "@/lib/offerte/metrics";
import type { OfferteConsumoProfilo } from "@/lib/offerte/public-types";

export type ComparePunShape = {
  hourlyRel: number[];
  factorF1: number;
  factorF2: number;
  factorF3: number;
  factorF23: number;
};

export type CompareCaricoRates = {
  lambda: number;
  accisaPerKwh: number;
  ivaRate: number;
};

export type FasciaKwhShares = { f1: number; f2: number; f3: number };

/** Lay one day-shape on the ARERA calendar so bio, trio and dinamica share the same hours. */
export function fasciaSharesFromHours(hours: number[], year: number): FasciaKwhShares {
  const acc = { f1: 0, f2: 0, f3: 0 };
  if (hours.length !== 24 || !Number.isInteger(year)) return { f1: 1 / 3, f2: 1 / 3, f3: 1 / 3 };
  let date = `${year}-01-01`;
  const end = `${year + 1}-01-01`;
  for (let day = 0; day < 366 && date < end; day++) {
    for (let hour = 0; hour < 24; hour++) acc[fasciaForHour(date, hour)] += hours[hour] ?? 0;
    date = addDaysIso(date, 1);
  }
  const sum = acc.f1 + acc.f2 + acc.f3;
  if (!(sum > 0)) return { f1: 1 / 3, f2: 1 / 3, f3: 1 / 3 };
  return { f1: acc.f1 / sum, f2: acc.f2 / sum, f3: acc.f3 / sum };
}

export function consumptionReading(
  profilo: OfferteConsumoProfilo,
  shape: ComparePunShape | null,
  year: number,
) {
  const hours = hourShares(profilo, shape?.hourlyRel);
  return { hours, shares: fasciaSharesFromHours(hours, year) };
}

/** Heating calendar. The hour profile does not move kWh between months. */
export function standardMonthShares(starts: string[]) {
  return monthKwhShares({ profilo: "standard", starts });
}

export function allInCommodityEurKwh(eurKwh: number, carico: CompareCaricoRates | null) {
  if (!carico) return eurKwh;
  return (eurKwh * (1 + carico.lambda) + carico.accisaPerKwh) * (1 + carico.ivaRate);
}

function weightForLabel(label: string | null, shares: FasciaKwhShares) {
  if (!label) return null;
  const key = label.replace(/\s/g, "").toUpperCase();
  if (key === "F1" || key === "PEAK") return shares.f1;
  if (key === "F2") return shares.f2;
  if (key === "F3") return shares.f3;
  if (key === "F2+F3" || key === "OFF-PEAK") return shares.f2 + shares.f3;
  if (key === "F1+F2") return shares.f1 + shares.f2;
  if (key === "F1+F3") return shares.f1 + shares.f3;
  return null;
}

function factorForLabel(label: string | null, shape: ComparePunShape | null) {
  if (!shape || !label) return 1;
  const key = label.replace(/\s/g, "").toUpperCase();
  if (key === "F1" || key === "PEAK") return shape.factorF1;
  if (key === "F2") return shape.factorF2;
  if (key === "F3") return shape.factorF3;
  if (key === "F2+F3" || key === "OFF-PEAK") return shape.factorF23;
  if (key === "F1+F2") {
    const weight = shape.factorF1 + shape.factorF2;
    return weight > 0 ? weight / 2 : 1;
  }
  if (key === "F1+F3") {
    const weight = shape.factorF1 + shape.factorF3;
    return weight > 0 ? weight / 2 : 1;
  }
  return 1;
}

function weightedMean(
  bands: CompareEnergyBand[],
  shares: FasciaKwhShares,
  priceOf: (band: CompareEnergyBand) => number,
) {
  if (bands.length === 0) return null;
  if (bands.every((band) => band.label == null)) {
    return bands.reduce((sum, band) => sum + priceOf(band), 0) / bands.length;
  }
  let weightSum = 0;
  let valueSum = 0;
  for (const band of bands) {
    const weight = weightForLabel(band.label, shares);
    if (weight == null || !(weight > 0)) continue;
    weightSum += weight;
    valueSum += weight * priceOf(band);
  }
  if (!(weightSum > 0)) return bands.reduce((sum, band) => sum + priceOf(band), 0) / bands.length;
  return valueSum / weightSum;
}

/** Commodity €/kWh before tax: flat, fascia-weighted, or the hour curve dotted with the PUN. */
export function effectiveCommodityEurKwh(options: {
  bands: CompareEnergyBand[];
  variabile: boolean;
  plan: OfferteFasciaPlan | null;
  coefficiente: number | null;
  punEurKwh: number | null;
  hours: number[];
  shares: FasciaKwhShares;
  shape: ComparePunShape | null;
}) {
  const coeff =
    options.coefficiente != null && Number.isFinite(options.coefficiente) ? options.coefficiente : 1;
  const pun = options.punEurKwh;
  const { bands, shares, shape, hours } = options;

  if (
    options.variabile &&
    options.plan === "dinamica" &&
    pun != null &&
    shape != null &&
    shape.hourlyRel.length === 24 &&
    hours.length === 24
  ) {
    let punEff = 0;
    for (let hour = 0; hour < 24; hour++) {
      punEff += (hours[hour] ?? 0) * pun * (shape.hourlyRel[hour] ?? 1);
    }
    const spread = weightedMean(bands, shares, (band) => band.eurKwh);
    if (spread == null) return null;
    return punEff * coeff + spread;
  }

  if (!options.variabile || pun == null) return weightedMean(bands, shares, (band) => band.eurKwh);
  return weightedMean(
    bands,
    shares,
    (band) => pun * factorForLabel(band.label, shape) * coeff + band.eurKwh,
  );
}

export type MonthSpendBreakdown = {
  canoneEur: number;
  energiaEur: number;
  perditeReteEur: number;
  acciseEur: number;
  ivaEur: number;
  totalEur: number;
};

export type PricedMonthOptions = {
  bands: CompareEnergyBand[];
  variabile: boolean;
  plan: OfferteFasciaPlan | null;
  coefficiente: number | null;
  punEurKwh: number | null;
  hours: number[];
  shares: FasciaKwhShares;
  shape: ComparePunShape | null;
  quotaMonthEur: number | null;
  consumoKwh: number;
  monthShare: number;
  carico: CompareCaricoRates | null;
  scontoEurKwh?: number;
};

export function monthSpendBreakdown(options: PricedMonthOptions): MonthSpendBreakdown | null {
  if (options.quotaMonthEur == null) return null;
  const commodity = netCommodityEurKwh(options);
  if (commodity == null || !(options.monthShare >= 0)) return null;
  const kwh = options.consumoKwh * options.monthShare;
  const canoneEur = options.quotaMonthEur;
  const energiaEur = commodity * kwh;
  if (!options.carico) {
    return {
      canoneEur,
      energiaEur,
      perditeReteEur: 0,
      acciseEur: 0,
      ivaEur: 0,
      totalEur: canoneEur + energiaEur,
    };
  }
  const perditeReteEur = commodity * options.carico.lambda * kwh;
  const acciseEur = options.carico.accisaPerKwh * kwh;
  const imponibile = energiaEur + perditeReteEur + acciseEur;
  const ivaEur = imponibile * options.carico.ivaRate;
  return {
    canoneEur,
    energiaEur,
    perditeReteEur,
    acciseEur,
    ivaEur,
    totalEur: canoneEur + imponibile + ivaEur,
  };
}

function netCommodityEurKwh(options: PricedMonthOptions) {
  const commodity = effectiveCommodityEurKwh(options);
  if (commodity == null) return null;
  const cut = options.scontoEurKwh ?? 0;
  if (!(cut > 0)) return commodity;
  return Math.max(0, commodity - cut);
}

export function pricedMonth(options: PricedMonthOptions) {
  const breakdown = monthSpendBreakdown(options);
  if (!breakdown) return null;
  const kwh = options.consumoKwh * options.monthShare;
  if (!(kwh > 0)) {
    return { eurKwh: 0, spendEur: breakdown.totalEur };
  }
  const commodity = netCommodityEurKwh(options);
  if (commodity == null) return null;
  const eurKwh = allInCommodityEurKwh(commodity, options.carico);
  return {
    eurKwh,
    spendEur: breakdown.totalEur,
  };
}
