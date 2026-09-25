import { POTENZA_STANDARD_CASA_KW } from "@/lib/offerte/potenza";
import type { ScontoInput } from "@/lib/offerte/sconto";

export type ScontoAxisShift = {
  monthlyEur: number;
  energyEurKwh: number;
  notes: string[];
};

const EMPTY_SHIFT: ScontoAxisShift = { monthlyEur: 0, energyEurKwh: 0, notes: [] };

/** First-year discount as a cut on the monthly fee and on the energy price. Same axes as the Pareto board. */
export function scontoAxisShift(rows: ScontoInput[] | undefined, potenzaKw: number): ScontoAxisShift {
  if (!rows?.length) return EMPTY_SHIFT;
  let monthlyEur = 0;
  let energyEurKwh = 0;
  const notes: string[] = [];
  for (const row of rows) {
    const delta = scontoDelta(row, potenzaKw);
    if (!delta) continue;
    monthlyEur += delta.monthlyEur;
    energyEurKwh += delta.energyEurKwh;
    if (delta.nota) notes.push(delta.nota);
  }
  return { monthlyEur, energyEurKwh, notes };
}

export function offerPotenzaKw(tipoCliente: string | null | undefined) {
  return tipoCliente?.includes("non domestico") ? 6 : POTENZA_STANDARD_CASA_KW;
}

export function netRecurringEur(monthlyEur: number, shift: ScontoAxisShift, monthIndex: number) {
  if (monthIndex >= 12) return monthlyEur;
  return Math.max(0, monthlyEur - shift.monthlyEur);
}

export function scontoEnergyCut(shift: ScontoAxisShift, monthIndex: number) {
  return monthIndex >= 12 ? 0 : shift.energyEurKwh;
}

function scontoDelta(row: ScontoInput, potenzaKw: number) {
  const validita = padCode(row.validita);
  if (validita === "03") return null;
  const condizione = padCode(row.condizione_applicazione);
  if (condizione && condizione !== "00" && condizione !== "01" && condizione !== "02" && condizione !== "03") {
    return null;
  }

  const text = `${row.nome ?? ""} ${row.descrizione ?? ""} ${row.descrizione_condizione ?? ""}`;
  if (isReferralSconto(text) || isHighPowerOnlySconto(text)) return null;

  const amount = asPositive(row.valore);
  if (amount == null) return null;
  const unit = padCode(row.unita_misura);
  const tipologia = padCode(row.tipologia_prezzo);
  const nota = row.nome?.replace(/\s+/g, " ").trim() || "sconto";

  if (unit === "01" || unit === "05") {
    return { monthlyEur: amount / 12, energyEurKwh: 0, nota };
  }
  if (unit === "02") {
    return { monthlyEur: (amount * potenzaKw) / 12, energyEurKwh: 0, nota };
  }
  if (unit === "03" || tipologia === "03" || tipologia === "04") {
    const yearlyMislabel = amount > 2 ? parseEuroAnno(text) : null;
    if (yearlyMislabel != null) {
      return { monthlyEur: yearlyMislabel / 12, energyEurKwh: 0, nota };
    }
    const eurKwh = amount > 2 ? amount / 1000 : amount;
    if (!(eurKwh > 0) || eurKwh > 0.2) return null;
    const cap = parseKwhCap(text);
    const span = parseMonthSpan(text);
    const hours = parseHourShare(text);
    const fascia = parseFasciaShare(text);
    const monthShare = span ? span.months / 12 : 1;
    const hourShare = hours ? hours.share : 1;
    const fasciaShare = fascia ? fascia.share : 1;
    if (cap != null) {
      return {
        monthlyEur: (eurKwh * cap.kwh * monthShare * hourShare * fasciaShare) / 12,
        energyEurKwh: 0,
        nota,
      };
    }
    return {
      monthlyEur: 0,
      energyEurKwh: eurKwh * monthShare * hourShare * fasciaShare,
      nota,
    };
  }
  return null;
}

const MONTH_WORD: Record<string, number> = {
  primo: 1,
  prima: 1,
  secondo: 2,
  seconda: 2,
  terzo: 3,
  terza: 3,
  quarto: 4,
  quarta: 4,
  quinto: 5,
  quinta: 5,
  sesto: 6,
  sesta: 6,
  settimo: 7,
  settima: 7,
  ottavo: 8,
  ottava: 8,
  nono: 9,
  nona: 9,
  decimo: 10,
  decima: 10,
  undicesimo: 11,
  undicesima: 11,
  dodicesimo: 12,
  dodicesima: 12,
};

function parseMonthSpan(text: string) {
  const t = text.toLowerCase();
  const range = t.match(/dal\s+([a-zà]+)\s+al\s+([a-zà]+)\s+mese/);
  if (range) {
    const from = MONTH_WORD[range[1] ?? ""];
    const to = MONTH_WORD[range[2] ?? ""];
    if (from && to && to >= from) return { months: to - from + 1 };
  }
  const nthMark = t.match(/(\d+)\s*[°º]\s*mese/);
  if (nthMark) return { months: 1 };
  const nthBare = t.match(/\b(\d+)\s+mese\b(?!i)/);
  if (nthBare) return { months: 1 };
  const nthWord = t.match(
    /\b(prim[oa]|second[oa]|terz[oa]|quart[oa]|quint[oa]|sest[oa]|settim[oa]|ottav[oa]|non[oa]|decim[oa]|undicesim[oa]|dodicesim[oa])\s+mese/,
  );
  if (nthWord?.[1]) {
    const n = MONTH_WORD[nthWord[1]];
    if (n) return { months: 1 };
  }
  return null;
}

function parseKwhCap(text: string) {
  const t = text.toLowerCase().replace(",", ".");
  const annual = t.match(/primi\s+(\d+(?:\.\d+)?)\s*kwh\s*\/\s*a/);
  if (annual) return { kwh: Number(annual[1]) };
  const monthly = t.match(/primi\s+(\d+(?:\.\d+)?)\s*kwh\s*mensil/);
  if (monthly) return { kwh: Number(monthly[1]) * 12 };
  const sogliaMese = t.match(/soglia di\s+(\d+(?:\.\d+)?)\s*kwh di consumo me/);
  if (sogliaMese) return { kwh: Number(sogliaMese[1]) * 12 };
  const first = t.match(/primi\s+(\d+(?:\.\d+)?)\s*kwh/);
  if (first) return { kwh: Number(first[1]) };
  return null;
}

function parseFasciaShare(text: string) {
  const t = text.toLowerCase();
  if (t.includes("f23") || t.includes("fuori punta") || /\bf2\s+e\s+f3\b/.test(t)) {
    return { share: 0.67 };
  }
  const f1 = /\bf1\b|fascia\s*1/.test(t);
  const f2 = /\bf2\b|fascia\s*2/.test(t);
  const f3 = /\bf3\b|fascia\s*3/.test(t);
  if (f1 && !f2 && !f3) return { share: 0.33 };
  if (f2 && !f1 && !f3) return { share: 0.31 };
  if (f3 && !f1 && !f2) return { share: 0.36 };
  return null;
}

function parseHourShare(text: string) {
  const match = text.match(
    /(\d{1,2})[:.](\d{2})\s*(?:a|alle|e|-|–|—)\s*(?:le\s*)?(\d{1,2})[:.](\d{2})/i,
  );
  if (!match) return null;
  const start = Number(match[1]) + Number(match[2]) / 60;
  let end = Number(match[3]) + Number(match[4]) / 60;
  if (end <= start) end += 24;
  const hours = end - start;
  if (!(hours > 0 && hours < 24)) return null;
  return { share: hours / 24 };
}

function parseEuroAnno(text: string) {
  const match = text.match(/(\d+(?:[.,]\d+)?)\s*€\s*\/\s*anno/i);
  if (!match?.[1]) return null;
  const n = Number(match[1].replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function isReferralSconto(text: string) {
  return /segnalator|green club|porta un amico|sconto amico/i.test(text);
}

function isHighPowerOnlySconto(text: string) {
  const match = text.match(/potenza superiore a\s*([\d.,]+)\s*kw/i);
  if (!match?.[1]) return /utenze con potenza/i.test(text);
  const kw = Number(match[1].replace(",", "."));
  return Number.isFinite(kw) && kw > POTENZA_STANDARD_CASA_KW;
}

function padCode(value: string | null | undefined) {
  const raw = value?.trim();
  if (!raw) return null;
  return /^\d+$/.test(raw) ? raw.padStart(2, "0") : raw;
}

function asPositive(value: number | string | null | undefined) {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(String(value).replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}
