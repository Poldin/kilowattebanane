export type ScontoInput = {
  nome?: string | null;
  descrizione?: string | null;
  valore?: number | string | null;
  unita_misura?: string | null;
  tipologia_prezzo?: string | null;
  validita?: string | null;
  condizione_applicazione?: string | null;
  descrizione_condizione?: string | null;
  iva_sconto?: string | null;
};

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

const MONTH_WORD_RE =
  "prim[oa]|second[oa]|terz[oa]|quart[oa]|quint[oa]|sest[oa]|settim[oa]|ottav[oa]|non[oa]|decim[oa]|undicesim[oa]|dodicesim[oa]";

function padCode(value: string | null | undefined) {
  const raw = value?.trim();
  if (!raw) return "";
  return raw.length === 1 ? `0${raw}` : raw;
}

function asNumber(raw: unknown) {
  if (raw == null || raw === "") return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function perKwh(prezzo: number) {
  return prezzo > 2 ? prezzo / 1000 : prezzo;
}

function rangeInclusive(from: number, to: number, maxMonth = 12) {
  const cap = Math.max(1, maxMonth);
  const start = Math.max(1, Math.min(cap, from));
  const end = Math.max(start, Math.min(cap, to));
  const out: number[] = [];
  for (let month = start; month <= end; month++) out.push(month);
  return out;
}

export function parseScontoMonths(
  text: string,
  validita?: string | null,
  maxMonth = 12,
) {
  const cap = Math.max(1, maxMonth);
  const t = text.toLowerCase();
  const range = t.match(new RegExp(`dal\\s+(${MONTH_WORD_RE})\\s+al\\s+(${MONTH_WORD_RE})\\s+mese`));
  if (range) {
    const from = MONTH_WORD[range[1] ?? ""];
    const to = MONTH_WORD[range[2] ?? ""];
    if (from && to && to >= from) return rangeInclusive(from, to, cap);
  }
  const primiN = t.match(/prim[oi]\s+(\d+)\s+mesi/);
  if (primiN) return rangeInclusive(1, Number(primiN[1]), cap);
  const nthMark = t.match(/(\d+)\s*[°º]\s*mese/);
  if (nthMark) {
    const month = Number(nthMark[1]);
    if (month >= 1 && month <= cap) return [month];
  }
  const nthBare = t.match(/\b(\d+)\s+mese\b(?!i)/);
  if (nthBare) {
    const month = Number(nthBare[1]);
    if (month >= 1 && month <= cap) return [month];
  }
  const nthWord = t.match(new RegExp(`\\b(${MONTH_WORD_RE})\\s+mese`));
  if (nthWord?.[1]) {
    const month = MONTH_WORD[nthWord[1]];
    if (month && month <= cap) return [month];
  }

  const code = padCode(validita);
  if (code === "03") return [];
  if (code === "01") return [1];
  return rangeInclusive(1, Math.min(12, cap), cap);
}

export function parseKwhCap(text: string) {
  const t = text.toLowerCase().replace(",", ".");
  const annual = t.match(/primi\s+(\d+(?:\.\d+)?)\s*kwh\s*\/\s*a/);
  if (annual) return Number(annual[1]);
  const monthly = t.match(/primi\s+(\d+(?:\.\d+)?)\s*kwh\s*mensil/);
  if (monthly) return Number(monthly[1]) * 12;
  const sogliaMese = t.match(/soglia di\s+(\d+(?:\.\d+)?)\s*kwh di consumo me/);
  if (sogliaMese) return Number(sogliaMese[1]) * 12;
  const oltre = t.match(/oltre\s+(?:i\s+)?(\d+(?:\.\d+)?)\s*kwh/);
  if (oltre) return Number(oltre[1]);
  const first = t.match(/primi\s+(\d+(?:\.\d+)?)\s*kwh/);
  if (first) return Number(first[1]);
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
  return hours / 24;
}

function parseFasciaShare(text: string) {
  const t = text.toLowerCase();
  if (t.includes("f23") || t.includes("fuori punta") || /\bf2\s+e\s+f3\b/.test(t)) return 0.67;
  const f1 = /\bf1\b|fascia\s*1/.test(t);
  const f2 = /\bf2\b|fascia\s*2/.test(t);
  const f3 = /\bf3\b|fascia\s*3/.test(t);
  if (f1 && !f2 && !f3) return 0.33;
  if (f2 && !f1 && !f3) return 0.31;
  if (f3 && !f1 && !f2) return 0.36;
  return null;
}

function parseEuroAnno(text: string) {
  const match = text.match(/(\d+(?:[.,]\d+)?)\s*€\s*\/\s*anno/i);
  if (!match?.[1]) return null;
  const value = Number(match[1].replace(",", "."));
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function isLiquidSconto(row: ScontoInput) {
  const validita = padCode(row.validita);
  if (validita === "03") return false;
  const condizione = padCode(row.condizione_applicazione);
  if (condizione && !["", "00", "01", "02", "03"].includes(condizione)) return false;
  const text = `${row.nome ?? ""} ${row.descrizione ?? ""} ${row.descrizione_condizione ?? ""}`;
  if (/porta un amico|referral|codice amico|segnalator|green club/i.test(text)) return false;
  return true;
}

export function scontoByMonth(
  sconti: ScontoInput[],
  options: {
    consumoKwh: number;
    potenzaKw: number;
    months: number;
    kwhByMonth?: number[];
  },
) {
  const n = Math.max(1, options.months);
  const monthRate = Array.from({ length: n }, () => 0);
  const lumps = Array.from({ length: n }, () => 0);
  let iva: boolean | null = null;
  const consumo = Math.max(0, options.consumoKwh);
  const flatKwh = consumo / 12;
  const kwhAt = (index: number) => options.kwhByMonth?.[index] ?? flatKwh;

  for (const row of sconti) {
    if (!isLiquidSconto(row)) continue;
    const amount = asNumber(row.valore);
    if (amount == null || amount <= 0) continue;
    const text = `${row.nome ?? ""} ${row.descrizione ?? ""} ${row.descrizione_condizione ?? ""}`;
    const months = parseScontoMonths(text, row.validita, n).filter((month) => month >= 1 && month <= n);
    if (months.length === 0) continue;
    const unit = padCode(row.unita_misura);
    if (row.iva_sconto) iva = /si|1|true/i.test(row.iva_sconto);

    if (unit === "01" || unit === "05") {
      const yearlyMislabel = amount > 2 ? parseEuroAnno(text) : null;
      const lump = yearlyMislabel ?? amount;
      const year1 = months.filter((month) => month <= 12);
      const targets = year1.length > 0 ? year1 : months;
      const each = lump / targets.length;
      for (const month of targets) lumps[month - 1] += each;
      continue;
    }
    if (unit === "02") {
      const each = (amount * options.potenzaKw) / 12;
      for (const month of months) lumps[month - 1] += each;
      continue;
    }
    if (unit !== "03") continue;

    const rate = perKwh(amount);
    if (!(rate > 0) || rate > 0.5) continue;
    const cap = parseKwhCap(text);
    const kwhShare = cap != null && consumo > 0 ? Math.min(1, cap / consumo) : 1;
    const hourShare = parseHourShare(text) ?? 1;
    const fasciaShare = parseFasciaShare(text) ?? 1;
    const effective = rate * kwhShare * hourShare * fasciaShare;
    for (const month of months) {
      monthRate[month - 1] = Math.max(monthRate[month - 1], effective);
    }
  }

  const eur = monthRate.map((rate, i) => rate * kwhAt(i) + lumps[i]!);
  return { eur, iva };
}

export function year1ScontoEur(
  sconti: ScontoInput[],
  options: { consumoKwh: number; potenzaKw: number },
) {
  const valued = scontoByMonth(sconti, { ...options, months: 12 });
  const eur = valued.eur.reduce((sum, value) => sum + value, 0);
  return { eur, iva: valued.iva };
}
