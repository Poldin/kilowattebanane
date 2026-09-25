import { PARETO_PLANS, PARETO_PLANS_FISSO } from "@/lib/offerte/pareto-cluster";
import { POTENZA_STANDARD_CASA_KW } from "@/lib/offerte/potenza";
import { scontoAxisShift } from "@/lib/offerte/sconto-axis";
import type { OfferteFasciaPlan } from "@/lib/offerte/metrics";
import type {
  OfferteHitDettaglio,
  OfferteParetoBoard,
  OfferteParetoCliente,
  OfferteParetoHit,
  OfferteParetoPlan,
  OfferteParetoPrezzo,
  OfferteParetoResidenza,
  OfferteParetoSpot,
  OfferteParetoStats,
} from "@/lib/offerte/public-types";

export const PARETO_SPOTS_KWH = [1200, 2700, 4000] as const;
export {
  PARETO_PLANS,
  PARETO_PLANS_FISSO,
  findParetoBoard,
  paretoCarouselFromStats,
} from "@/lib/offerte/pareto-cluster";

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
  residenza: "residente" | "non residente" | "entrambe" | "altro";
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
type HullPoint = {
  nome: string;
  monthlyEur: number;
  energyEurKwh: number;
};
type AxisPoint = HullPoint & {
  input: ParetoPointInput;
  scontoNota: string | null;
};

export type ParetoHotAxis = {
  source: "placet" | "ml";
  codOfferta: string;
  nome: string;
  venditore: string;
  venditoreKey: string;
  cliente: OfferteParetoCliente;
  residenza: ParetoPointInput["residenza"];
  prezzo: OfferteParetoPrezzo;
  plan: NonNullable<ParetoPointInput["plan"]>;
  monthlyEur: number;
  energyEurKwh: number;
  pagamento: string[];
  attivazione: string[];
  tipologiaContratto: string[];
};

export function buildParetoStats(inputs: ParetoPointInput[]): OfferteParetoStats {
  const nazionali = inputs.filter(
    (row) =>
      row.coverage === "nazionale" &&
      (row.cliente === "domestico" || row.cliente === "non domestico") &&
      (row.prezzo === "fisso" || row.prezzo === "variabile") &&
      row.plan != null,
  );

  const boards: OfferteParetoBoard[] = [];
  for (const cliente of ["domestico", "non domestico"] as const) {
    const residences: Array<OfferteParetoResidenza | null> =
      cliente === "domestico" ? ["residente", "non residente"] : [null];
    for (const residenza of residences) {
      for (const prezzo of ["fisso", "variabile"] as const) {
        const plans = prezzo === "variabile" ? PARETO_PLANS : PARETO_PLANS_FISSO;
        for (const plan of plans) {
          const subset = nazionali.filter(
            (row) =>
              row.cliente === cliente &&
              row.prezzo === prezzo &&
              row.plan === plan &&
              matchesParetoResidenza(row, residenza),
          );
          for (const sconti of ["listino", "primoAnno"] as const) {
            boards.push(boardFor(subset, { cliente, residenza, prezzo, plan, sconti }));
          }
        }
      }
    }
  }

  return { spotsKwh: [...PARETO_SPOTS_KWH], boards };
}

function matchesParetoResidenza(
  row: Pick<ParetoPointInput, "residenza">,
  residenza: OfferteParetoResidenza | null,
) {
  if (residenza == null) return true;
  return row.residenza === residenza || row.residenza === "entrambe";
}

function boardFor(
  inputs: ParetoPointInput[],
  cluster: {
    cliente: OfferteParetoCliente;
    residenza: OfferteParetoResidenza | null;
    prezzo: OfferteParetoPrezzo;
    plan: OfferteParetoPlan;
    sconti: ScontoMode;
  },
): OfferteParetoBoard {
  const potenzaKw = cluster.cliente === "domestico" ? POTENZA_STANDARD_CASA_KW : 6;
  const axes = inputs
    .filter((input) => isCredibleParetoPoint(input, cluster.cliente, cluster.prezzo))
    .map((input) => withSconti(input, cluster.sconti, potenzaKw));

  const hull = convexHull(axes);
  const ranges = consumptionRanges(hull);

  return {
    cliente: cluster.cliente,
    residenza: cluster.residenza,
    prezzo: cluster.prezzo,
    plan: cluster.plan,
    sconti: cluster.sconti,
    compared: axes.length,
    hull: hull.length,
    dominated: Math.max(0, axes.length - hull.length),
    hits: hull.map((point, index) => toHit(point, ranges[index])),
    spots: spotsFor(hull, ranges),
    cloud: cloudFor(axes, cluster.prezzo),
  };
}

export function paretoHotAxes(inputs: ParetoPointInput[]): ParetoHotAxis[] {
  const axes: ParetoHotAxis[] = [];
  for (const input of inputs) {
    if (input.coverage !== "nazionale" || input.plan == null) continue;
    if (!isCredibleParetoPoint(input, input.cliente, input.prezzo)) continue;
    const potenzaKw = input.cliente === "domestico" ? POTENZA_STANDARD_CASA_KW : 6;
    const shifted = withSconti(input, "primoAnno", potenzaKw);
    axes.push({
      source: input.source,
      codOfferta: input.codOfferta,
      nome: input.nome,
      venditore: input.venditore,
      venditoreKey: hostname(input.urlVenditore),
      cliente: input.cliente,
      residenza: input.residenza,
      prezzo: input.prezzo,
      plan: input.plan,
      monthlyEur: shifted.monthlyEur,
      energyEurKwh: shifted.energyEurKwh,
      pagamento: input.dettaglio.pagamento,
      attivazione: input.dettaglio.attivazione,
      tipologiaContratto: input.dettaglio.tipologiaContratto,
    });
  }
  return axes;
}

export function paretoFrontier<T extends HullPoint & { cliente: OfferteParetoCliente; prezzo: OfferteParetoPrezzo }>(
  points: T[],
): T[] {
  const groups = new Map<string, T[]>();
  for (const point of points) {
    const key = `${point.cliente}:${point.prezzo}`;
    const list = groups.get(key);
    if (list) list.push(point);
    else groups.set(key, [point]);
  }
  const hits: T[] = [];
  for (const group of groups.values()) hits.push(...convexHull(group));
  return hits;
}

function hostname(url: string | null) {
  if (!url) return "sconosciuto";
  try {
    return new URL(url).hostname.replace(/^www\./, "") || "sconosciuto";
  } catch {
    return "sconosciuto";
  }
}

function withSconti(input: ParetoPointInput, mode: ScontoMode, potenzaKw: number): AxisPoint {
  if (mode === "listino" || !input.sconti?.length) {
    return {
      nome: input.nome,
      input,
      monthlyEur: input.monthlyEur,
      energyEurKwh: input.energyEurKwh,
      scontoNota: null,
    };
  }

  const shift = scontoAxisShift(input.sconti, potenzaKw);
  return {
    nome: input.nome,
    input,
    monthlyEur: Math.max(0, input.monthlyEur - shift.monthlyEur),
    energyEurKwh: Math.max(0, input.energyEurKwh - shift.energyEurKwh),
    scontoNota: shift.notes.length > 0 ? shift.notes.join(" Â· ") : "sconti del primo anno",
  };
}

export function isCredibleParetoPoint(
  point: Pick<ParetoPointInput, "monthlyEur" | "energyEurKwh">,
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

function convexHull<T extends HullPoint>(points: T[]): T[] {
  const sorted = [...points].sort(
    (a, b) =>
      a.monthlyEur - b.monthlyEur ||
      a.energyEurKwh - b.energyEurKwh ||
      a.nome.localeCompare(b.nome, "it"),
  );

  const pareto: T[] = [];
  let bestEnergy = Infinity;
  for (const point of sorted) {
    if (point.energyEurKwh < bestEnergy - 1e-12) {
      pareto.push(point);
      bestEnergy = point.energyEurKwh;
    }
  }

  const hull: T[] = [];
  for (const point of pareto) {
    while (hull.length >= 2 && !isLowerCorner(hull[hull.length - 2], hull[hull.length - 1], point)) {
      hull.pop();
    }
    hull.push(point);
  }
  return hull;
}

function isLowerCorner(a: HullPoint, b: HullPoint, c: HullPoint) {
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
