import { POTENZA_STANDARD_CASA_KW } from "@/lib/offerte/potenza";
import type { OfferteFasciaPlan } from "@/lib/offerte/metrics";
import type {
  OfferteHitDettaglio,
  OfferteParetoBoard,
  OfferteParetoHit,
  OfferteParetoSpot,
  OfferteParetoStats,
} from "@/lib/offerte/public-types";

export const PARETO_SPOTS_KWH = [1200, 2700, 4000] as const;
const BIN_X = 32;
const BIN_Y = 18;
const MONTHLY_MIN = 3;
const MONTHLY_MAX_CASA = 40;
const MONTHLY_MAX_PIVA = 80;
const FISSO_ENERGY_MIN = 0.05;
const FISSO_ENERGY_MAX = 0.4;
const VARIABILE_ENERGY_MAX = 0.12;

export type ParetoScontoRow = {
  nome: string | null;
  descrizione: string | null;
  tipologia_prezzo: string | null;
  validita: string | null;
  valore: number | string | null;
  unita_misura: string | null;
  condizione_applicazione: string | null;
  descrizione_condizione: string | null;
};

export type ParetoPointInput = {
  key: string;
  source: "placet" | "ml";
  nome: string;
  venditore: string;
  urlVenditore: string | null;
  urlOfferta: string | null;
  cliente: "domestico" | "non domestico";
  prezzo: "fisso" | "variabile";
  coverage: string;
  plan: OfferteFasciaPlan | null;
  monthlyEur: number;
  energyEurKwh: number;
  sconti?: ParetoScontoRow[];
  codOfferta: string;
  validFrom: string | null;
  validTo: string | null;
  durataMesi: number | null;
  dettaglio: OfferteHitDettaglio;
};

type ScontoMode = "listino" | "primoAnno";
type AxisPoint = {
  input: ParetoPointInput;
  monthlyEur: number;
  energyEurKwh: number;
  scontoNota: string | null;
};

export function buildParetoStats(inputs: ParetoPointInput[]): OfferteParetoStats {
  const nazionali = inputs.filter(
    (row) =>
      row.coverage === "nazionale" &&
      (row.cliente === "domestico" || row.cliente === "non domestico") &&
      (row.prezzo === "fisso" || row.prezzo === "variabile"),
  );

  const boards: OfferteParetoBoard[] = [];
  for (const cliente of ["domestico", "non domestico"] as const) {
    for (const prezzo of ["fisso", "variabile"] as const) {
      const subset = nazionali.filter((row) => row.cliente === cliente && row.prezzo === prezzo);
      for (const sconti of ["listino", "primoAnno"] as const) {
        boards.push(boardFor(subset, cliente, prezzo, sconti));
      }
    }
  }

  return { spotsKwh: [...PARETO_SPOTS_KWH], boards };
}

function boardFor(
  inputs: ParetoPointInput[],
  cliente: OfferteParetoBoard["cliente"],
  prezzo: OfferteParetoBoard["prezzo"],
  sconti: ScontoMode,
): OfferteParetoBoard {
  const potenzaKw = cliente === "domestico" ? POTENZA_STANDARD_CASA_KW : 6;
  const axes = inputs
    .filter((input) => isCredible(input, cliente, prezzo))
    .map((input) => withSconti(input, sconti, potenzaKw));

  const hull = convexHull(axes);
  const ranges = consumptionRanges(hull);

  return {
    cliente,
    prezzo,
    sconti,
    compared: axes.length,
    hull: hull.length,
    dominated: Math.max(0, axes.length - hull.length),
    hits: hull.map((point, index) => toHit(point, ranges[index])),
    spots: spotsFor(hull, ranges),
    cloud: cloudFor(axes, prezzo),
  };
}

function withSconti(input: ParetoPointInput, mode: ScontoMode, potenzaKw: number): AxisPoint {
  if (mode === "listino" || !input.sconti?.length) {
    return {
      input,
      monthlyEur: input.monthlyEur,
      energyEurKwh: input.energyEurKwh,
      scontoNota: null,
    };
  }

  let monthlyEur = input.monthlyEur;
  let energyEurKwh = input.energyEurKwh;
  const notes: string[] = [];

  for (const row of input.sconti) {
    const delta = scontoDelta(row, potenzaKw);
    if (!delta) continue;
    monthlyEur -= delta.monthlyEur;
    energyEurKwh -= delta.energyEurKwh;
    if (delta.nota) notes.push(delta.nota);
  }

  return {
    input,
    monthlyEur: Math.max(0, monthlyEur),
    energyEurKwh: Math.max(0, energyEurKwh),
    scontoNota: notes.length > 0 ? notes.join(" · ") : "sconti del primo anno",
  };
}

function isCredible(
  point: ParetoPointInput,
  cliente: OfferteParetoBoard["cliente"],
  prezzo: OfferteParetoBoard["prezzo"],
) {
  const maxMonthly = cliente === "domestico" ? MONTHLY_MAX_CASA : MONTHLY_MAX_PIVA;
  if (!(point.monthlyEur >= MONTHLY_MIN && point.monthlyEur <= maxMonthly)) return false;
  if (!(point.energyEurKwh >= 0) || !Number.isFinite(point.energyEurKwh)) return false;
  if (prezzo === "fisso") {
    return point.energyEurKwh >= FISSO_ENERGY_MIN && point.energyEurKwh <= FISSO_ENERGY_MAX;
  }
  return point.energyEurKwh <= VARIABILE_ENERGY_MAX;
}

function convexHull(points: AxisPoint[]): AxisPoint[] {
  const sorted = [...points].sort(
    (a, b) =>
      a.monthlyEur - b.monthlyEur ||
      a.energyEurKwh - b.energyEurKwh ||
      a.input.nome.localeCompare(b.input.nome, "it"),
  );

  const pareto: AxisPoint[] = [];
  let bestEnergy = Infinity;
  for (const point of sorted) {
    if (point.energyEurKwh < bestEnergy - 1e-12) {
      pareto.push(point);
      bestEnergy = point.energyEurKwh;
    }
  }

  const hull: AxisPoint[] = [];
  for (const point of pareto) {
    while (hull.length >= 2 && !isLowerCorner(hull[hull.length - 2], hull[hull.length - 1], point)) {
      hull.pop();
    }
    hull.push(point);
  }
  return hull;
}

function isLowerCorner(a: AxisPoint, b: AxisPoint, c: AxisPoint) {
  const span = c.monthlyEur - a.monthlyEur;
  if (span <= 1e-12) return b.energyEurKwh <= a.energyEurKwh;
  const interp =
    a.energyEurKwh + ((c.energyEurKwh - a.energyEurKwh) * (b.monthlyEur - a.monthlyEur)) / span;
  return b.energyEurKwh < interp - 1e-12;
}

function consumptionRanges(hull: AxisPoint[]) {
  const cuts: number[] = [];
  for (let i = 0; i < hull.length - 1; i++) {
    const a = hull[i];
    const b = hull[i + 1];
    const dEnergy = a.energyEurKwh - b.energyEurKwh;
    if (dEnergy <= 1e-12) {
      cuts.push(Number.POSITIVE_INFINITY);
      continue;
    }
    cuts.push((12 * (b.monthlyEur - a.monthlyEur)) / dEnergy);
  }

  return hull.map((_, index) => ({
    daKwh: index === 0 ? 0 : cuts[index - 1] ?? 0,
    finoAKwh: index === hull.length - 1 ? null : (cuts[index] ?? null),
  }));
}

function spotsFor(
  hull: AxisPoint[],
  ranges: { daKwh: number; finoAKwh: number | null }[],
): OfferteParetoSpot[] {
  return PARETO_SPOTS_KWH.map((kwh) => {
    const index = hull.findIndex((_, i) => inRange(kwh, ranges[i]));
    const hit = index >= 0 ? hull[index] : hull[hull.length - 1];
    if (!hit) return { kwh, key: "", nome: "" };
    return { kwh, key: hit.input.key, nome: hit.input.nome };
  });
}

function inRange(kwh: number, range: { daKwh: number; finoAKwh: number | null } | undefined) {
  if (!range) return false;
  if (kwh < range.daKwh) return false;
  if (range.finoAKwh == null) return true;
  return kwh < range.finoAKwh;
}

function toHit(
  point: AxisPoint,
  range: { daKwh: number; finoAKwh: number | null } | undefined,
): OfferteParetoHit {
  return {
    key: point.input.key,
    source: point.input.source,
    nome: point.input.nome,
    venditore: point.input.venditore,
    urlVenditore: point.input.urlVenditore,
    urlOfferta: point.input.urlOfferta,
    plan: point.input.plan,
    monthlyEur: point.monthlyEur,
    energyEurKwh: point.energyEurKwh,
    scontoNota: point.scontoNota,
    daKwh: range?.daKwh ?? 0,
    finoAKwh: range?.finoAKwh ?? null,
    codOfferta: point.input.codOfferta,
    validFrom: point.input.validFrom,
    validTo: point.input.validTo,
    durataMesi: point.input.durataMesi,
    dettaglio: point.input.dettaglio,
  };
}

function cloudFor(points: AxisPoint[], prezzo: OfferteParetoBoard["prezzo"]): OfferteParetoBoard["cloud"] {
  if (points.length === 0) {
    return {
      xMin: MONTHLY_MIN,
      xMax: MONTHLY_MAX_CASA,
      yMin: 0,
      yMax: prezzo === "fisso" ? FISSO_ENERGY_MAX : VARIABILE_ENERGY_MAX,
      cols: BIN_X,
      rows: BIN_Y,
      counts: Array.from({ length: BIN_X * BIN_Y }, () => 0),
    };
  }

  const monthlies = points.map((p) => p.monthlyEur);
  const energies = points.map((p) => p.energyEurKwh);
  const xMin = Math.min(...monthlies);
  const xMax = Math.max(Math.max(...monthlies), xMin + 0.01);
  const yMin = Math.min(...energies);
  const yMax = Math.max(Math.max(...energies), yMin + 0.0001);
  const counts = Array.from({ length: BIN_X * BIN_Y }, () => 0);

  for (const point of points) {
    const col = Math.min(BIN_X - 1, Math.max(0, Math.floor(((point.monthlyEur - xMin) / (xMax - xMin)) * BIN_X)));
    const row = Math.min(
      BIN_Y - 1,
      Math.max(0, Math.floor(((point.energyEurKwh - yMin) / (yMax - yMin)) * BIN_Y)),
    );
    counts[row * BIN_X + col] += 1;
  }

  return { xMin, xMax, yMin, yMax, cols: BIN_X, rows: BIN_Y, counts };
}

function scontoDelta(row: ParetoScontoRow, potenzaKw: number) {
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
    const yearly = unit === "05" ? amount : amount;
    return { monthlyEur: yearly / 12, energyEurKwh: 0, nota };
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

function padCode(value: string | null) {
  const raw = value?.trim();
  if (!raw) return null;
  return /^\d+$/.test(raw) ? raw.padStart(2, "0") : raw;
}

function asPositive(value: number | string | null) {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(String(value).replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}
