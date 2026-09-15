import {
  fasciaSharesFor,
  hourShares,
  monthKwhShares,
  parseConsumoProfilo,
} from "@/lib/offerte/consumo-profile";
import { formatMonthShortIt } from "@/lib/offerte/dates";
import { splitConsumo } from "@/lib/offerte/fasce";
import type { PunForwardBlend } from "@/lib/offerte/forward";
import { FORWARD_MONTH_HORIZON } from "@/lib/offerte/forward";
import type { OfferKernel } from "@/lib/offerte/kernel";
import type { OfferteConsumoProfilo } from "@/lib/offerte/public-types";
import type { RegulatedStack } from "@/lib/offerte/regulated";
import { scontoByMonth, type ScontoInput } from "@/lib/offerte/sconto";
import { fasciaFactors, type PunShape } from "@/lib/offerte/shape";

export type BillBreakdown = {
  energia: number;
  rete: number;
  oneri: number;
  imposte: number;
  sconti: number;
};

export type BillMonth = {
  index: number;
  start: string;
  label: string;
  eur: number;
  punEurKwh: number | null;
};

export type BillEstimate = {
  annualEur: number;
  firstMonthEur: number | null;
  months: BillMonth[];
  breakdown: BillBreakdown;
  punEurKwh: number | null;
};

export function billHorizon(durataMesi: number | null | undefined) {
  const n =
    durataMesi == null || !Number.isFinite(durataMesi) ? 12 : Math.round(durataMesi);
  if (n >= 24) return FORWARD_MONTH_HORIZON;
  return 12;
}

function firstNumber(...values: Array<number | null | undefined>) {
  for (const value of values) {
    if (value != null && Number.isFinite(value)) return value;
  }
  return 0;
}

function energyForBand(
  kernel: OfferKernel,
  band: "f0" | "f1" | "f2" | "f3" | "f23",
  punByBand: Record<"f0" | "f1" | "f2" | "f3" | "f23", number | null>,
  lambda: number,
) {
  const spread =
    band === "f0"
      ? firstNumber(kernel.spreadF0, kernel.spreadF1, kernel.spreadF23)
      : band === "f1"
        ? firstNumber(kernel.spreadF1, kernel.spreadF0)
        : band === "f2"
          ? firstNumber(kernel.spreadF2, kernel.spreadF23, kernel.spreadF0)
          : band === "f3"
            ? firstNumber(kernel.spreadF3, kernel.spreadF23, kernel.spreadF0)
            : firstNumber(kernel.spreadF23, kernel.spreadF0);
  const fisso =
    band === "f0"
      ? firstNumber(kernel.energyFissoF0, kernel.energyFissoF1, kernel.energyFissoF23)
      : band === "f1"
        ? firstNumber(kernel.energyFissoF1, kernel.energyFissoF0)
        : band === "f2"
          ? firstNumber(kernel.energyFissoF2, kernel.energyFissoF23, kernel.energyFissoF0)
          : band === "f3"
            ? firstNumber(kernel.energyFissoF3, kernel.energyFissoF23, kernel.energyFissoF0)
            : firstNumber(kernel.energyFissoF23, kernel.energyFissoF0);

  const loss = 1 + lambda;
  if (!kernel.variabile) return fisso * loss;

  const pun = punByBand[band] ?? punByBand.f0;
  const forward = pun == null ? 0 : pun * kernel.punCoeff;
  return (forward + spread + fisso) * loss;
}

function punByBandFrom(pun0: number | null, factors: ReturnType<typeof fasciaFactors>) {
  return {
    f0: pun0,
    f1: pun0 == null ? null : pun0 * factors.factorF1,
    f2: pun0 == null ? null : pun0 * factors.factorF2,
    f3: pun0 == null ? null : pun0 * factors.factorF3,
    f23: pun0 == null ? null : pun0 * factors.factorF23,
  };
}

function annualEnergyAtPun(
  kernel: OfferKernel,
  consumoKwh: number,
  shares: { f1?: number; f2?: number; f3?: number } | undefined,
  pun0: number | null,
  shape: PunShape | null,
  lambda: number,
  hourShare?: number[],
) {
  const kwh = splitConsumo(consumoKwh, shares);
  const factors = fasciaFactors(shape);
  const punByBand = punByBandFrom(pun0, factors);
  const loss = 1 + lambda;

  if (kernel.plan === "dinamica" && shape && pun0 != null) {
    const rel = shape.hourlyRel.length === 24 ? shape.hourlyRel : Array.from({ length: 24 }, () => 1);
    const hours =
      hourShare && hourShare.length === 24 ? hourShare : Array.from({ length: 24 }, () => 1 / 24);
    const spread = firstNumber(kernel.spreadF0, kernel.spreadF1);
    let energyKwh = 0;
    for (let h = 0; h < 24; h++) {
      const punHour = pun0 * (rel[h] ?? 1) * kernel.punCoeff;
      energyKwh += (punHour + spread) * loss * consumoKwh * (hours[h] ?? 1 / 24);
    }
    energyKwh += firstNumber(kernel.energyFissoF0) * loss * consumoKwh;
    return energyKwh;
  }
  if (kernel.plan === "fasce") {
    return (
      energyForBand(kernel, "f1", punByBand, lambda) * kwh.f1 +
      energyForBand(kernel, "f2", punByBand, lambda) * kwh.f2 +
      energyForBand(kernel, "f3", punByBand, lambda) * kwh.f3
    );
  }
  if (kernel.plan === "bioraria") {
    return (
      energyForBand(kernel, "f1", punByBand, lambda) * kwh.f1 +
      energyForBand(kernel, "f23", punByBand, lambda) * kwh.f23
    );
  }
  return energyForBand(kernel, "f0", punByBand, lambda) * kwh.f0;
}

function kernelScontoByMonth(
  kernel: OfferKernel,
  options: { consumoKwh: number; potenzaKw: number; months: number },
) {
  const total =
    kernel.scontoEurYear +
    kernel.scontoEurKwh * options.consumoKwh +
    kernel.scontoEurKw * options.potenzaKw;
  const n = options.months;
  const eur = Array.from({ length: n }, () => 0);
  const spreadN = Math.min(12, n);
  if (!(total > 0) || spreadN <= 0) return eur;
  const each = total / spreadN;
  for (let i = 0; i < spreadN; i++) eur[i] = each;
  return eur;
}

export function estimateOfferBill(
  kernel: OfferKernel,
  options: {
    consumoKwh: number;
    potenzaKw: number;
    shares?: { f1?: number; f2?: number; f3?: number };
    profilo?: OfferteConsumoProfilo;
    regulated: RegulatedStack;
    forward: PunForwardBlend;
    shape: PunShape | null;
    sconti?: ScontoInput[];
    durataMesi?: number | null;
  },
): BillEstimate | null {
  if (kernel.needsForward && options.forward.punEurKwh == null) return null;

  const n = billHorizon(options.durataMesi);
  const profilo = parseConsumoProfilo(options.profilo);
  const shares = options.shares ?? fasciaSharesFor(profilo);
  const hours = hourShares(profilo, options.shape?.hourlyRel);
  const pun0 = options.forward.punEurKwh;
  const monthStarts = options.forward.months ?? [];
  const starts = Array.from({ length: n }, (_, i) => monthStarts[i]?.start ?? "");
  const puns = Array.from({ length: n }, (_, i) => monthStarts[i]?.punEurKwh ?? pun0);
  const monthShares = monthKwhShares({ profilo, starts, punEurKwh: puns });
  const kwhByMonth = monthShares.map((share) => options.consumoKwh * share);
  const vendorFixed = kernel.eurYearFixed;
  const dispFromVendor = kernel.dispacciamentoEurKwh > 0;
  const dispKwh = dispFromVendor ? kernel.dispacciamentoEurKwh : options.regulated.cdispPerKwh;
  const dispFixed = dispFromVendor ? 0 : options.regulated.dispbtEurYear;
  const reteFixedM = options.regulated.reteFixedEurYear / 12;
  const reteKwM = (options.regulated.retePerKwYear * options.potenzaKw) / 12;
  const oneriFixedM = options.regulated.oneriFixedEurYear / 12;
  const oneriKwM = (options.regulated.oneriPerKwYear * options.potenzaKw) / 12;

  const valued = options.sconti
    ? scontoByMonth(options.sconti, {
        consumoKwh: options.consumoKwh,
        potenzaKw: options.potenzaKw,
        months: n,
        kwhByMonth,
      })
    : {
        eur: kernelScontoByMonth(kernel, {
          consumoKwh: options.consumoKwh,
          potenzaKw: options.potenzaKw,
          months: n,
        }),
        iva: kernel.scontoIva,
      };
  const scontoIva = valued.iva ?? kernel.scontoIva;
  const energyAt = (pun: number | null) =>
    annualEnergyAtPun(
      kernel,
      options.consumoKwh,
      shares,
      pun,
      options.shape,
      options.regulated.lambda,
      hours,
    );
  const fissoEnergyYear = energyAt(pun0);

  const months: BillMonth[] = [];
  let energia12 = 0;
  let rete12 = 0;
  let oneri12 = 0;
  let accise12 = 0;
  let iva12 = 0;
  let sconti12 = 0;

  for (let i = 0; i < n; i++) {
    const point = monthStarts[i];
    const shareM = monthShares[i] ?? 1 / 12;
    const kwhM = kwhByMonth[i] ?? options.consumoKwh / 12;
    const punMonth = kernel.variabile ? (point?.punEurKwh ?? pun0) : pun0;
    const energyYear = kernel.variabile ? energyAt(punMonth) : fissoEnergyYear;
    const energia =
      vendorFixed / 12 +
      (kernel.eurKwYear * options.potenzaKw) / 12 +
      energyYear * shareM +
      dispKwh * kwhM +
      dispFixed / 12;
    const reteM = reteFixedM + reteKwM + options.regulated.retePerKwh * kwhM;
    const oneriM = oneriFixedM + oneriKwM + options.regulated.oneriPerKwh * kwhM;
    const acciseM = options.regulated.accisaPerKwh * kwhM;
    const sconti = Math.min(valued.eur[i] ?? 0, energia);
    const scontiImponibile = scontoIva === false ? 0 : sconti;
    const scontiDopoIva = scontoIva === false ? sconti : 0;
    const imponibile = Math.max(0, energia + reteM + oneriM + acciseM - scontiImponibile);
    const iva = imponibile * options.regulated.ivaRate;
    const eur = Math.max(0, imponibile + iva - scontiDopoIva);
    const start = point?.start ?? "";
    months.push({
      index: i + 1,
      start,
      label: start ? formatMonthShortIt(start) : `mese ${i + 1}`,
      eur,
      punEurKwh: punMonth,
    });

    if (i < 12) {
      energia12 += energia - (scontoIva === false ? 0 : sconti);
      rete12 += reteM;
      oneri12 += oneriM;
      accise12 += acciseM;
      iva12 += iva;
      sconti12 += sconti;
    }
  }

  const yearMonths = months.slice(0, 12);
  return {
    annualEur: yearMonths.reduce((sum, month) => sum + month.eur, 0),
    firstMonthEur: months[0]?.eur ?? null,
    months,
    punEurKwh: pun0,
    breakdown: {
      energia: energia12,
      rete: rete12,
      oneri: oneri12,
      imposte: accise12 + iva12,
      sconti: sconti12,
    },
  };
}
