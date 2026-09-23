import { billHorizon } from "@/lib/offerte/bill";
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
  tone: "strong" | "note";
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

export type CompareSynthesisResult = {
  sure: SynthesisLine[];
  conditional: SynthesisLine[];
  showConditional: boolean;
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

function defaultSpanKwhFromWeights(weights: number[], annual: number) {
  const sum = weights.reduce((total, value) => total + value, 0);
  const out = weights.map((weight) => Math.round(annual * (sum > 0 ? weight / sum : 0)));
  const drift = annual - out.reduce((total, value) => total + value, 0);
  if (out.length > 0) out[out.length - 1] = Math.max(0, (out[out.length - 1] ?? 0) + drift);
  return out;
}

function oculatoSpanKwh(spans: CompareSpan[], annual: number, punBySpan: Array<number | null>) {
  const starts = spans.map((span) => span.start);
  const shares = monthKwhShares({ profilo: "oculato", starts, punEurKwh: punBySpan });
  const out = shares.map((share) => Math.round(annual * share));
  const drift = annual - out.reduce((total, value) => total + value, 0);
  if (out.length > 0) out[out.length - 1] = Math.max(0, (out[out.length - 1] ?? 0) + drift);
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

function buildSpendForProfile(
  spans: CompareSpan[],
  annualKwh: number,
  profile: OfferteConsumoProfilo,
  punBySpan: Array<number | null>,
  shape: ComparePunShape | null,
  includeMarket: boolean,
): CompareSpendInput | null {
  const skeleton = buildSpendSkeleton(spans, hourShares(profile, shape?.hourlyRel));
  if (!skeleton) return null;
  return spendFromSkeleton(
    skeleton,
    spans,
    annualKwh,
    profile,
    punBySpan,
    shape,
    includeMarket,
  );
}

function recurringQuotaEur(profile: OfferteCompareProfile) {
  return (
    profile.monthlyEur ??
    (profile.scheda.quotaFissaEurAnno != null ? profile.scheda.quotaFissaEurAnno / 12 : null)
  );
}

function monthCanoneEur(
  profile: OfferteCompareProfile,
  monthIndex: number,
  dayFraction: number,
) {
  if (monthIndex >= billHorizon(profile.durataMesi)) return null;
  const monthly = recurringQuotaEur(profile);
  if (monthly == null) return null;
  return monthly * dayFraction + (monthIndex === 0 ? (profile.scheda.unaTantumEur ?? 0) : 0);
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
  const priced = pricedMonth({
    bands: offerBands(profile),
    variabile: profile.scheda.variabile,
    plan: profile.plan,
    coefficiente: profile.scheda.coefficiente,
    punEurKwh: spend.includeMarket ? punEurKwh : null,
    hours,
    shares,
    shape: spend.shape,
    quotaMonthEur: recurring * (spend.dayFractions[monthIndex] ?? 1),
    consumoKwh: monthKwh,
    monthShare: 1,
    carico: spend.includeMarket ? carico : null,
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
      quotaMonthEur: recurring * (spend.dayFractions[monthIndex] ?? 1),
      consumoKwh: monthKwh,
      monthShare: 1,
      carico: spend.includeMarket ? carico : null,
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

function profileLabel(mode: CompareSynthesisInput["profileMode"]) {
  if (mode === "oculato") return "profilo oculato";
  if (mode === "custom") return "profilo personalizzato";
  return "profilo standard";
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

function axisWinnerEveryMonth(
  offers: CompareOfferRef[],
  spans: CompareSpan[],
  punBySpan: Array<number | null>,
  spend: CompareSpendInput | null,
  axis: "canone" | "spread",
) {
  if (!spend || offers.length < 2) return null;
  const horizon = spans.length;
  let winnerId: string | null = null;
  for (let monthIndex = 0; monthIndex < horizon; monthIndex++) {
    let bestId: string | null = null;
    let bestValue = Infinity;
    for (const offer of offers) {
      if (monthIndex >= activeMonths(offer.profile, horizon)) continue;
      const value =
        axis === "canone"
          ? monthCanoneEur(offer.profile, monthIndex, spend.dayFractions[monthIndex] ?? 1)
          : commodityEurKwh(offer.profile, monthIndex, punBySpan[monthIndex] ?? null, null, spend);
      if (value == null) continue;
      if (value < bestValue - EPS) {
        bestValue = value;
        bestId = offer.id;
      }
    }
    if (!bestId) continue;
    if (winnerId == null) winnerId = bestId;
    else if (winnerId !== bestId) return null;
  }
  return winnerId;
}

function staticKwhThreshold(
  a: CompareOfferRef,
  b: CompareOfferRef,
  spans: CompareSpan[],
  punBySpan: Array<number | null>,
  spend: CompareSpendInput | null,
): { kwh: number; belowId: string; aboveId: string } | null {
  if (!spend || spans.length === 0) return null;
  const horizon = spans.length;
  let canoneA = 0;
  let canoneB = 0;
  let spreadA = 0;
  let spreadB = 0;
  let months = 0;
  for (let monthIndex = 0; monthIndex < horizon; monthIndex++) {
    if (
      monthIndex >= activeMonths(a.profile, horizon) ||
      monthIndex >= activeMonths(b.profile, horizon)
    ) {
      continue;
    }
    const ca = monthCanoneEur(a.profile, monthIndex, spend.dayFractions[monthIndex] ?? 1);
    const cb = monthCanoneEur(b.profile, monthIndex, spend.dayFractions[monthIndex] ?? 1);
    const sa = commodityEurKwh(a.profile, monthIndex, punBySpan[monthIndex] ?? null, null, spend);
    const sb = commodityEurKwh(b.profile, monthIndex, punBySpan[monthIndex] ?? null, null, spend);
    if (ca == null || cb == null || sa == null || sb == null) return null;
    canoneA += ca;
    canoneB += cb;
    spreadA += sa;
    spreadB += sb;
    months++;
  }
  if (months === 0) return null;
  canoneA /= months;
  canoneB /= months;
  spreadA /= months;
  spreadB /= months;
  const dSpread = spreadA - spreadB;
  if (Math.abs(dSpread) <= EPS) return null;
  const kwh = (12 * (canoneB - canoneA)) / dSpread;
  if (!Number.isFinite(kwh) || kwh <= MIN_ANNUAL_KWH || kwh >= MAX_ANNUAL_KWH) return null;
  const belowId = dSpread > 0 ? a.id : b.id;
  const aboveId = dSpread > 0 ? b.id : a.id;
  return { kwh, belowId, aboveId };
}

function totalSpend(
  offer: CompareOfferRef,
  spans: CompareSpan[],
  punBySpan: Array<number | null>,
  carico: CompareCaricoRates | null,
  spend: CompareSpendInput,
) {
  let total = 0;
  for (let monthIndex = 0; monthIndex < spans.length; monthIndex++) {
    const part = offerSpendEur(offer.profile, monthIndex, punBySpan[monthIndex] ?? null, carico, spend);
    if (part != null) total += part;
  }
  return total;
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

function kwhSweepBreakpoints(
  offers: CompareOfferRef[],
  spans: CompareSpan[],
  punBySpan: Array<number | null>,
  carico: CompareCaricoRates | null,
  shape: ComparePunShape | null,
  includeMarket: boolean,
  skeleton: SpendSkeleton | null,
) {
  if (offers.length !== 2 || !skeleton) return [];
  const lines: SynthesisLine[] = [];
  let prevWinner: string | null = null;
  for (let kwh = MIN_ANNUAL_KWH; kwh <= MAX_ANNUAL_KWH; kwh += KWH_SWEEP_STEP) {
    const spend = spendFromSkeleton(
      skeleton,
      spans,
      kwh,
      "standard",
      punBySpan,
      shape,
      includeMarket,
    );
    const winner = winnerAtSpend(offers, spans, punBySpan, carico, spend);
    if (!winner) continue;
    if (prevWinner == null) {
      prevWinner = winner.id;
      continue;
    }
    if (winner.id !== prevWinner) {
      const below = offers.find((offer) => offer.id === prevWinner)!;
      const above = offers.find((offer) => offer.id === winner.id)!;
      lines.push(
        line(`kwh-${kwh}-${prevWinner}-${winner.id}`, "strong", [
          t(`Con profilo standard, sotto ${formatIt(kwh)} kWh/anno conviene `),
          o(below),
          t("; da lì in su conviene "),
          o(above),
          t("."),
        ]),
      );
      prevWinner = winner.id;
    }
  }
  if (lines.length === 0 && prevWinner) {
    const only = offers.find((offer) => offer.id === prevWinner)!;
    lines.push(
      line(`kwh-flat-${only.id}`, "note", [
        t("Con profilo standard, "),
        o(only),
        t(
          ` resta la più conveniente tra ${formatIt(MIN_ANNUAL_KWH)} e ${formatIt(MAX_ANNUAL_KWH)} kWh/anno.`,
        ),
      ]),
    );
  }
  return lines;
}

export function buildCompareSynthesis(input: CompareSynthesisInput): CompareSynthesisResult {
  const {
    offers,
    spans,
    punBySpan,
    carico,
    shape,
    includeMarket,
    prezzo,
    includeEnergy,
    annualKwh,
    profileMode,
    spend,
  } = input;

  const sure: SynthesisLine[] = [];
  const conditional: SynthesisLine[] = [];
  const showConditional = includeMarket && (prezzo === "fisso" || includeEnergy);

  if (offers.length < 2) {
    sure.push(line("need-two", "note", [t("Aggiungi almeno un'altra offerta per trarre conclusioni.")]));
    return { sure, conditional, showConditional };
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

  const universalWinner = offers.find((candidate) =>
    offers.every(
      (other) =>
        other.id === candidate.id ||
        dominancePairs.some(
          (pair) => pair.winner.id === candidate.id && pair.loser.id === other.id,
        ),
    ),
  );
  const twoOfferDecisive =
    offers.length === 2 && dominancePairs.length === 1 ? dominancePairs[0]!.winner : null;
  const decisiveWinner = universalWinner ?? twoOfferDecisive ?? null;

  if (decisiveWinner) {
    if (offers.length === 2) {
      const loser = offers.find((offer) => offer.id !== decisiveWinner.id)!;
      sure.push(
        line(`dom-${decisiveWinner.id}-${loser.id}`, "strong", [
          o(decisiveWinner),
          t(" batte "),
          o(loser),
          t(" su canone e spread in ogni mese attivo — non c'è partita."),
        ]),
      );
    } else {
      sure.push(
        line(`dom-all-${decisiveWinner.id}`, "strong", [
          o(decisiveWinner),
          t(" batte tutte le altre su canone e spread in ogni mese attivo — non c'è partita."),
        ]),
      );
    }
  } else {
    for (const { winner, loser } of dominancePairs) {
      sure.push(
        line(`dom-${winner.id}-${loser.id}`, "strong", [
          o(winner),
          t(" batte "),
          o(loser),
          t(" su canone e spread in ogni mese attivo — non c'è partita."),
        ]),
      );
    }

    const spreadLabel = prezzo === "fisso" ? "prezzo energia" : "spread";
    const canoneWinnerId = axisWinnerEveryMonth(offers, spans, punBySpan, staticSpend, "canone");
    const spreadWinnerId = axisWinnerEveryMonth(offers, spans, punBySpan, staticSpend, "spread");

    if (canoneWinnerId && spreadWinnerId && canoneWinnerId === spreadWinnerId) {
      const winner = offers.find((offer) => offer.id === canoneWinnerId)!;
      sure.push(
        line(`both-${canoneWinnerId}`, "strong", [
          o(winner),
          t(` vince su canone e ${spreadLabel} mese per mese.`),
        ]),
      );
    } else {
      if (canoneWinnerId) {
        const winner = offers.find((offer) => offer.id === canoneWinnerId)!;
        sure.push(
          line(`canone-${canoneWinnerId}`, "strong", [
            o(winner),
            t(" ha il canone mensile più basso in ogni mese del confronto."),
          ]),
        );
      }
      if (spreadWinnerId) {
        const winner = offers.find((offer) => offer.id === spreadWinnerId)!;
        sure.push(
          line(`spread-${spreadWinnerId}`, "strong", [
            o(winner),
            t(` ha lo ${spreadLabel} più basso in ogni mese del confronto.`),
          ]),
        );
      }
    }

    if (offers.length === 2 && dominancePairs.length === 0) {
      const threshold = staticKwhThreshold(offers[0]!, offers[1]!, spans, punBySpan, staticSpend);
      if (threshold) {
        const below = offers.find((offer) => offer.id === threshold.belowId)!;
        const above = offers.find((offer) => offer.id === threshold.aboveId)!;
        sure.push(
          line(`static-kwh-${threshold.kwh}`, "strong", [
            t(`Ignorando il PUN attuale, sotto circa ${formatIt(threshold.kwh)} kWh/anno conviene `),
            o(below),
            t("; sopra conviene "),
            o(above),
            t("."),
          ]),
        );
      }
    }

    if (sure.length === 0) {
      sure.push(
        line("no-sure", "note", [
          t(
            "Nessuna offerta domina l'altra su canone e spread mese per mese: il vincitore dipende da altri fattori.",
          ),
        ]),
      );
    }
  }

  const conditionalEnabled = showConditional && decisiveWinner == null;

  if (!conditionalEnabled) {
    if (prezzo === "variabile" && !includeEnergy && decisiveWinner == null) {
      conditional.push(
        line("toggle-energy", "note", [
          t(
            "Attiva «Includi prezzo energia» per vedere quando conviene davvero in bolletta, in base a consumo e PUN atteso.",
          ),
        ]),
      );
    }
    return { sure, conditional, showConditional: conditionalEnabled };
  }

  if (!spend) {
    return { sure, conditional, showConditional: conditionalEnabled };
  }

  const totals = offers.map((offer) => ({
    offer,
    total: totalSpend(offer, spans, punBySpan, carico, spend),
  }));
  totals.sort((a, b) => a.total - b.total);
  const best = totals[0];
  const second = totals[1];
  if (best && second && best.total < second.total - EPS) {
    conditional.push(
      line(`total-${best.offer.id}`, "strong", [
        t(`Con ${formatIt(annualKwh)} kWh/anno e ${profileLabel(profileMode)}, `),
        o(best.offer),
        t(` costa ${formatEuro(second.total - best.total)} in meno sul periodo considerato.`),
      ]),
    );
  }

  const monthWinners = new Set<string>();
  for (let monthIndex = 0; monthIndex < spans.length; monthIndex++) {
    let bestOffer: CompareOfferRef | null = null;
    let bestSpend = Infinity;
    for (const offer of offers) {
      const part = offerSpendEur(
        offer.profile,
        monthIndex,
        punBySpan[monthIndex] ?? null,
        carico,
        spend,
      );
      if (part == null) continue;
      if (part < bestSpend - EPS) {
        bestSpend = part;
        bestOffer = offer;
      }
    }
    if (bestOffer) monthWinners.add(bestOffer.id);
  }
  if (monthWinners.size > 1) {
    conditional.push(
      line("month-volatile", "note", [
        t(
          "Il vincitore in bolletta cambia mese per mese: dipende anche dal PUN atteso e dal calendario contrattuale.",
        ),
      ]),
    );
  }

  conditional.push(
    ...kwhSweepBreakpoints(
      offers,
      spans,
      punBySpan,
      carico,
      shape,
      includeMarket,
      standardSkeleton,
    ),
  );

  const standardSpend = standardSkeleton
    ? spendFromSkeleton(
        standardSkeleton,
        spans,
        annualKwh,
        "standard",
        punBySpan,
        shape,
        includeMarket,
      )
    : null;
  const oculatoSpend = buildSpendForProfile(
    spans,
    annualKwh,
    "oculato",
    punBySpan,
    shape,
    includeMarket,
  );
  if (standardSpend && oculatoSpend) {
    const standardWinner = winnerAtSpend(offers, spans, punBySpan, carico, standardSpend);
    const oculatoWinner = winnerAtSpend(offers, spans, punBySpan, carico, oculatoSpend);
    if (
      standardWinner &&
      oculatoWinner &&
      standardWinner.id !== oculatoWinner.id
    ) {
      conditional.push(
        line(`profile-${standardWinner.id}-${oculatoWinner.id}`, "strong", [
          t(`Con ${formatIt(annualKwh)} kWh/anno, profilo standard → `),
          o(standardWinner),
          t("; profilo oculato → "),
          o(oculatoWinner),
          t("."),
        ]),
      );
    }
  }

  if (conditional.length === 0) {
    conditional.push(
      line("conditional-open", "note", [
        t(
          "Con i consumi e il PUN attuali non emerge una regola semplice: prova a cambiare kWh o profilo orario.",
        ),
      ]),
    );
  }

  return { sure, conditional, showConditional: conditionalEnabled };
}
