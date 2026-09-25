import { billHorizon } from "@/lib/offerte/bill";
import { netRecurringEur, offerPotenzaKw, scontoAxisShift, scontoEnergyCut } from "@/lib/offerte/sconto-axis";
import type { OfferteCompareProfile } from "@/lib/offerte/compare-profile";
import {
  pricedMonth,
  type CompareCaricoRates,
  type ComparePunShape,
} from "@/lib/offerte/compare-spend";
import { hourShares, monthKwhShares, STANDARD_MONTH_WEIGHT } from "@/lib/offerte/consumo-profile";
import { addDaysIso, fasciaForHour } from "@/lib/offerte/fasce";
import type { OfferteConsumoProfilo } from "@/lib/offerte/public-types";

export type CompareSpan = { start: string; end: string };

export type CompareSpendInput = {
  monthKwh: number[];
  dayFractions: number[];
  hoursByMonth: number[][];
  sharesByMonth: Array<{ f1: number; f2: number; f3: number }>;
  shape: ComparePunShape | null;
  includeMarket: boolean;
};

export type CompareOfferRef = {
  id: string;
  label: string;
  profile: OfferteCompareProfile;
};

export type CompareSynthesisInput = {
  offers: CompareOfferRef[];
  spans: CompareSpan[];
  punBySpan: Array<number | null>;
  carico: CompareCaricoRates | null;
  shape: ComparePunShape | null;
  includeMarket: boolean;
  prezzo: "fisso" | "variabile";
  includeEnergy: boolean;
  annualKwh: number;
  profileMode: "standard" | "oculato" | "custom";
  spend: CompareSpendInput | null;
};

export type SynthesisPart =
  | { kind: "text"; value: string }
  | { kind: "offer"; id: string; label: string };

export type SynthesisLine = {
  id: string;
  tone: "strong" | "note" | "final";
  parts: SynthesisPart[];
};

function t(value: string): SynthesisPart {
  return { kind: "text", value };
}

function o(offer: { id: string; label: string }): SynthesisPart {
  return { kind: "offer", id: offer.id, label: offer.label };
}

function line(id: string, tone: SynthesisLine["tone"], parts: SynthesisPart[]): SynthesisLine {
  return { id, tone, parts };
}

export type CompareSynthesisPick = { id: string; label: string };

export type CompareSynthesisResult = {
  sure: SynthesisLine[];
  conditional: SynthesisLine[];
  showConditional: boolean;
  pick: CompareSynthesisPick | null;
};

const MIN_ANNUAL_KWH = 800;
const MAX_ANNUAL_KWH = 20000;
const KWH_SWEEP_STEP = 200;
const EPS = 1e-6;

function daysInCalendarMonth(iso: string) {
  const [year, month] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function inclusiveDays(start: string, end: string) {
  const [ys, ms, ds] = start.split("-").map(Number);
  const [ye, me, de] = end.split("-").map(Number);
  return Math.round((Date.UTC(ye, me - 1, de) - Date.UTC(ys, ms - 1, ds)) / 86_400_000) + 1;
}

function spanSeasonWeight(start: string, end: string) {
  let weight = 0;
  let date = start;
  const stop = addDaysIso(end, 1);
  for (let guard = 0; date < stop && guard < 40; guard++) {
    const month = Number(date.slice(5, 7)) - 1;
    weight += (STANDARD_MONTH_WEIGHT[month] ?? 1) / daysInCalendarMonth(date);
    date = addDaysIso(date, 1);
  }
  return weight;
}

function allocateYear(weights: number[], annual: number) {
  const sum = weights.reduce((total, value) => total + value, 0);
  const out = weights.map((weight) => Math.round(annual * (sum > 0 ? weight / sum : 0)));
  const drift = annual - out.reduce((total, value) => total + value, 0);
  if (out.length > 0) out[out.length - 1] = Math.max(0, (out[out.length - 1] ?? 0) + drift);
  return out;
}

function defaultSpanKwhFromWeights(weights: number[], annual: number) {
  const out: number[] = [];
  for (let start = 0; start < weights.length; start += 12) {
    out.push(...allocateYear(weights.slice(start, start + 12), annual));
  }
  return out;
}

function oculatoSpanKwh(spans: CompareSpan[], annual: number, punBySpan: Array<number | null>) {
  const out: number[] = [];
  for (let start = 0; start < spans.length; start += 12) {
    const yearSpans = spans.slice(start, start + 12);
    const starts = yearSpans.map((span) => span.start);
    const shares = monthKwhShares({
      profilo: "oculato",
      starts,
      punEurKwh: punBySpan.slice(start, start + 12),
    });
    const year = shares.map((share) => Math.round(annual * share));
    const drift = annual - year.reduce((total, value) => total + value, 0);
    if (year.length > 0) year[year.length - 1] = Math.max(0, (year[year.length - 1] ?? 0) + drift);
    out.push(...year);
  }
  return out;
}

function fasciaSharesForSpan(start: string, end: string, hours: number[]) {
  const acc = { f1: 0, f2: 0, f3: 0 };
  if (hours.length !== 24) return { f1: 1 / 3, f2: 1 / 3, f3: 1 / 3 };
  let date = start;
  const stop = addDaysIso(end, 1);
  for (let guard = 0; date < stop && guard < 40; guard++) {
    for (let hour = 0; hour < 24; hour++) acc[fasciaForHour(date, hour)] += hours[hour] ?? 0;
    date = addDaysIso(date, 1);
  }
  const sum = acc.f1 + acc.f2 + acc.f3;
  if (!(sum > 0)) return { f1: 1 / 3, f2: 1 / 3, f3: 1 / 3 };
  return { f1: acc.f1 / sum, f2: acc.f2 / sum, f3: acc.f3 / sum };
}

function splitKwh(total: number, shares: { f1: number; f2: number; f3: number }) {
  const rounded = Math.max(0, Math.round(total));
  const f1 = Math.min(rounded, Math.max(0, Math.round(rounded * shares.f1)));
  const f2 = Math.min(rounded - f1, Math.max(0, Math.round(rounded * shares.f2)));
  return { f1, f2, f3: Math.max(0, rounded - f1 - f2) };
}

type SpendSkeleton = {
  dayFractions: number[];
  hoursByMonth: number[][];
  calendarShares: Array<{ f1: number; f2: number; f3: number }>;
  seasonWeights: number[];
};

function buildSpendSkeleton(spans: CompareSpan[], hoursBase: number[]): SpendSkeleton | null {
  if (spans.length === 0) return null;
  const dayFractions: number[] = [];
  const hoursByMonth: number[][] = [];
  const calendarShares: Array<{ f1: number; f2: number; f3: number }> = [];
  const seasonWeights: number[] = [];
  for (const span of spans) {
    calendarShares.push(fasciaSharesForSpan(span.start, span.end, hoursBase));
    const dim = daysInCalendarMonth(span.start);
    dayFractions.push(dim > 0 ? inclusiveDays(span.start, span.end) / dim : 1);
    hoursByMonth.push(hoursBase);
    seasonWeights.push(spanSeasonWeight(span.start, span.end));
  }
  return { dayFractions, hoursByMonth, calendarShares, seasonWeights };
}

function spendFromSkeleton(
  skeleton: SpendSkeleton,
  spans: CompareSpan[],
  annualKwh: number,
  profile: OfferteConsumoProfilo,
  punBySpan: Array<number | null>,
  shape: ComparePunShape | null,
  includeMarket: boolean,
): CompareSpendInput {
  const totals =
    profile === "oculato"
      ? oculatoSpanKwh(spans, annualKwh, punBySpan)
      : defaultSpanKwhFromWeights(skeleton.seasonWeights, annualKwh);
  const monthKwh: number[] = [];
  const sharesByMonth: Array<{ f1: number; f2: number; f3: number }> = [];
  for (let index = 0; index < spans.length; index++) {
    const shares = skeleton.calendarShares[index]!;
    const fascia = splitKwh(totals[index] ?? 0, shares);
    const kwh = fascia.f1 + fascia.f2 + fascia.f3;
    monthKwh.push(kwh);
    sharesByMonth.push(
      kwh > 0
        ? { f1: fascia.f1 / kwh, f2: fascia.f2 / kwh, f3: fascia.f3 / kwh }
        : shares,
    );
  }
  return {
    monthKwh,
    dayFractions: skeleton.dayFractions,
    hoursByMonth: skeleton.hoursByMonth,
    sharesByMonth,
    shape,
    includeMarket,
  };
}


function recurringQuotaEur(profile: OfferteCompareProfile) {
  return (
    profile.monthlyEur ??
    (profile.scheda.quotaFissaEurAnno != null ? profile.scheda.quotaFissaEurAnno / 12 : null)
  );
}

function profileShift(profile: OfferteCompareProfile) {
  return scontoAxisShift(profile.scheda.scontiRighe, offerPotenzaKw(profile.tipoCliente));
}

function monthCanoneEur(
  profile: OfferteCompareProfile,
  monthIndex: number,
  dayFraction: number,
) {
  if (monthIndex >= billHorizon(profile.durataMesi)) return null;
  const monthly = recurringQuotaEur(profile);
  if (monthly == null) return null;
  const net = netRecurringEur(monthly, profileShift(profile), monthIndex);
  return net * dayFraction + (monthIndex === 0 ? (profile.scheda.unaTantumEur ?? 0) : 0);
}

function offerBands(profile: OfferteCompareProfile) {
  if (profile.scheda.energia.length > 0) return profile.scheda.energia;
  if (profile.spreadEurKwh == null) return [];
  return [{ label: null, eurKwh: profile.spreadEurKwh }];
}

function commodityEurKwh(
  profile: OfferteCompareProfile,
  monthIndex: number,
  punEurKwh: number | null,
  carico: CompareCaricoRates | null,
  spend: CompareSpendInput,
) {
  if (monthIndex >= billHorizon(profile.durataMesi)) return null;
  const monthKwh = spend.monthKwh[monthIndex];
  const hours = spend.hoursByMonth[monthIndex];
  const shares = spend.sharesByMonth[monthIndex];
  const recurring = recurringQuotaEur(profile);
  if (monthKwh == null || !hours || !shares || recurring == null) return null;
  const shift = profileShift(profile);
  const priced = pricedMonth({
    bands: offerBands(profile),
    variabile: profile.scheda.variabile,
    plan: profile.plan,
    coefficiente: profile.scheda.coefficiente,
    punEurKwh: spend.includeMarket ? punEurKwh : null,
    hours,
    shares,
    shape: spend.shape,
    quotaMonthEur: netRecurringEur(recurring, shift, monthIndex) * (spend.dayFractions[monthIndex] ?? 1),
    consumoKwh: monthKwh,
    monthShare: 1,
    carico: spend.includeMarket ? carico : null,
    scontoEurKwh: scontoEnergyCut(shift, monthIndex),
  });
  return priced?.eurKwh ?? null;
}

function offerSpendEur(
  profile: OfferteCompareProfile,
  monthIndex: number,
  punEurKwh: number | null,
  carico: CompareCaricoRates | null,
  spend: CompareSpendInput,
) {
  if (monthIndex >= billHorizon(profile.durataMesi)) return null;
  const monthKwh = spend.monthKwh[monthIndex];
  const hours = spend.hoursByMonth[monthIndex];
  const shares = spend.sharesByMonth[monthIndex];
  const recurring = recurringQuotaEur(profile);
  if (monthKwh == null || !hours || !shares || recurring == null) return null;
  const shift = profileShift(profile);
  return (
    pricedMonth({
      bands: offerBands(profile),
      variabile: profile.scheda.variabile,
      plan: profile.plan,
      coefficiente: profile.scheda.coefficiente,
      punEurKwh: spend.includeMarket ? punEurKwh : null,
      hours,
      shares,
      shape: spend.shape,
      quotaMonthEur: netRecurringEur(recurring, shift, monthIndex) * (spend.dayFractions[monthIndex] ?? 1),
      consumoKwh: monthKwh,
      monthShare: 1,
      carico: spend.includeMarket ? carico : null,
      scontoEurKwh: scontoEnergyCut(shift, monthIndex),
    })?.spendEur ?? null
  );
}

function activeMonths(profile: OfferteCompareProfile, horizon: number) {
  return Math.min(billHorizon(profile.durataMesi), horizon);
}

function formatIt(value: number) {
  return new Intl.NumberFormat("it-IT", { maximumFractionDigits: 0 }).format(Math.round(value));
}

function formatEuro(value: number) {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: value >= 100 ? 0 : 2,
  }).format(value);
}


function pairDominates(
  winner: CompareOfferRef,
  loser: CompareOfferRef,
  spans: CompareSpan[],
  punBySpan: Array<number | null>,
  spend: CompareSpendInput | null,
) {
  if (!spend) return false;
  const horizon = spans.length;
  let strict = false;
  for (let monthIndex = 0; monthIndex < horizon; monthIndex++) {
    const wActive = monthIndex < activeMonths(winner.profile, horizon);
    const lActive = monthIndex < activeMonths(loser.profile, horizon);
    if (!wActive || !lActive) continue;
    const canoneW = monthCanoneEur(winner.profile, monthIndex, spend.dayFractions[monthIndex] ?? 1);
    const canoneL = monthCanoneEur(loser.profile, monthIndex, spend.dayFractions[monthIndex] ?? 1);
    const spreadW = commodityEurKwh(winner.profile, monthIndex, punBySpan[monthIndex] ?? null, null, spend);
    const spreadL = commodityEurKwh(loser.profile, monthIndex, punBySpan[monthIndex] ?? null, null, spend);
    if (canoneW == null || canoneL == null || spreadW == null || spreadL == null) return false;
    if (canoneW > canoneL + EPS || spreadW > spreadL + EPS) return false;
    if (canoneW < canoneL - EPS || spreadW < spreadL - EPS) strict = true;
  }
  return strict;
}


function totalSpend(
  offer: CompareOfferRef,
  spans: CompareSpan[],
  punBySpan: Array<number | null>,
  carico: CompareCaricoRates | null,
  spend: CompareSpendInput,
) {
  let total = 0;
  let months = 0;
  const limit = Math.min(spans.length, billHorizon(offer.profile.durataMesi));
  for (let monthIndex = 0; monthIndex < limit; monthIndex++) {
    const part = offerSpendEur(offer.profile, monthIndex, punBySpan[monthIndex] ?? null, carico, spend);
    if (part == null) continue;
    total += part;
    months++;
  }
  if (months === 0) return Infinity;
  return total / (months / 12);
}

function winnerAtSpend(
  offers: CompareOfferRef[],
  spans: CompareSpan[],
  punBySpan: Array<number | null>,
  carico: CompareCaricoRates | null,
  spend: CompareSpendInput,
) {
  let best: CompareOfferRef | null = null;
  let bestTotal = Infinity;
  for (const offer of offers) {
    const total = totalSpend(offer, spans, punBySpan, carico, spend);
    if (total < bestTotal - EPS) {
      bestTotal = total;
      best = offer;
    }
  }
  return best;
}


function offerList(offers: CompareOfferRef[]): SynthesisPart[] {
  const parts: SynthesisPart[] = [];
  offers.forEach((offer, index) => {
    if (index > 0) parts.push(t(index === offers.length - 1 ? " e " : ", "));
    parts.push(o(offer));
  });
  return parts;
}

function formatPct(value: number) {
  return `${new Intl.NumberFormat("it-IT", {
    maximumFractionDigits: value >= 10 ? 0 : 1,
  }).format(value)}%`;
}

function convenienceBands(
  offers: CompareOfferRef[],
  spans: CompareSpan[],
  punBySpan: Array<number | null>,
  carico: CompareCaricoRates | null,
  shape: ComparePunShape | null,
  includeMarket: boolean,
  skeleton: SpendSkeleton | null,
) {
  if (!skeleton || offers.length === 0) return [];
  const bands: Array<{ id: string; fromKwh: number; toKwh: number }> = [];
  let currentId: string | null = null;
  let fromKwh = MIN_ANNUAL_KWH;
  for (let kwh = MIN_ANNUAL_KWH; kwh <= MAX_ANNUAL_KWH; kwh += KWH_SWEEP_STEP) {
    const spend = spendFromSkeleton(skeleton, spans, kwh, "standard", punBySpan, shape, includeMarket);
    const winner = winnerAtSpend(offers, spans, punBySpan, carico, spend);
    if (!winner) continue;
    if (currentId == null) {
      currentId = winner.id;
      fromKwh = kwh;
      continue;
    }
    if (winner.id !== currentId) {
      bands.push({ id: currentId, fromKwh, toKwh: kwh });
      currentId = winner.id;
      fromKwh = kwh;
    }
  }
  if (currentId != null) bands.push({ id: currentId, fromKwh, toKwh: MAX_ANNUAL_KWH });
  return bands;
}

export function buildCompareSynthesis(input: CompareSynthesisInput): CompareSynthesisResult {
  const {
    offers,
    spans,
    punBySpan,
    carico,
    shape,
    includeMarket,
    annualKwh,
  } = input;

  const sure: SynthesisLine[] = [];
  const conditional: SynthesisLine[] = [];

  if (offers.length < 2) {
    sure.push(line("need-two", "note", [t("Aggiungi almeno un'altra offerta per trarre conclusioni.")]));
    return { sure, conditional, showConditional: false, pick: null };
  }

  const standardSkeleton = buildSpendSkeleton(spans, hourShares("standard", shape?.hourlyRel));
  const staticSpend = standardSkeleton
    ? spendFromSkeleton(standardSkeleton, spans, 2700, "standard", punBySpan, shape, false)
    : null;
  const dominancePairs: Array<{ winner: CompareOfferRef; loser: CompareOfferRef }> = [];
  for (let i = 0; i < offers.length; i++) {
    for (let j = 0; j < offers.length; j++) {
      if (i === j) continue;
      const winner = offers[i]!;
      const loser = offers[j]!;
      if (pairDominates(winner, loser, spans, punBySpan, staticSpend)) {
        dominancePairs.push({ winner, loser });
      }
    }
  }

  const dominatedIds = new Set(dominancePairs.map((pair) => pair.loser.id));
  const discarded = offers.filter((offer) => dominatedIds.has(offer.id));
  const contenders = offers.filter((offer) => !dominatedIds.has(offer.id));

  if (discarded.length > 0) {
    sure.push(
      line("never", "strong", [
        ...offerList(discarded),
        t(discarded.length === 1 ? " non è mai conveniente." : " non sono mai convenienti."),
      ]),
    );
  }

  const bands = convenienceBands(
    contenders,
    spans,
    punBySpan,
    carico,
    shape,
    includeMarket,
    standardSkeleton,
  );
  for (const band of bands) {
    const offer = contenders.find((item) => item.id === band.id);
    if (!offer) continue;
    sure.push(
      line(`band-${band.id}-${band.fromKwh}`, "strong", [
        o(offer),
        t(
          ` è conveniente da ⚡${formatIt(band.fromKwh)} a ⚡${formatIt(band.toKwh)} kWh/anno con profilo standard.`,
        ),
      ]),
    );
  }

  let pick: CompareSynthesisPick | null =
    contenders.length === 1 ? { id: contenders[0]!.id, label: contenders[0]!.label } : null;

  const atKwh = standardSkeleton
    ? spendFromSkeleton(standardSkeleton, spans, annualKwh, "standard", punBySpan, shape, includeMarket)
    : null;
  if (atKwh && contenders.length >= 2) {
    const ranked = contenders
      .map((offer) => ({
        offer,
        total: totalSpend(offer, spans, punBySpan, carico, atKwh),
      }))
      .sort((a, b) => a.total - b.total);
    const best = ranked[0];
    const second = ranked[1];
    if (best && second && second.total > best.total + EPS && second.total > EPS) {
      const gap = second.total - best.total;
      const pct = (gap / second.total) * 100;
      pick = { id: best.offer.id, label: best.offer.label };
      sure.push(
        line(`pick-${best.offer.id}`, "final", [
          t(
            `A ⚡${formatIt(annualKwh)} kWh/anno e profilo standard, sui ${formatIt(spans.length)} mesi, ti conviene `,
          ),
          o(best.offer),
          t(` per ${formatEuro(gap)} all'anno in meno di `),
          o(second.offer),
          t(` (${formatPct(pct)}).`),
        ]),
      );
    }
  }

  const headlineIndex = sure.findIndex((item) => item.tone === "final");
  if (headlineIndex > 0) {
    const [headline] = sure.splice(headlineIndex, 1);
    if (headline) sure.unshift(headline);
  }

  return { sure, conditional, showConditional: false, pick };
}
