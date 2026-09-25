import { isCredibleParetoPoint, type ParetoPointInput } from "@/lib/offerte/pareto";
import type {
  OfferteParetoCliente,
  OfferteParetoPrezzo,
  OffertePrezziBoard,
  OffertePrezziClusterRow,
  OffertePrezziQuartiles,
  OffertePrezziStats,
} from "@/lib/offerte/public-types";

const MERCATO: Array<["placet" | "ml", string]> = [
  ["placet", "PLACET"],
  ["ml", "Mercato libero"],
];

const ORARIO: Array<["monoraria" | "bioraria" | "fasce" | "dinamica", string]> = [
  ["monoraria", "Monoraria"],
  ["bioraria", "Bioraria"],
  ["fasce", "A fasce"],
  ["dinamica", "Dinamica"],
];

export function buildPrezziStats(inputs: ParetoPointInput[]): OffertePrezziStats {
  const boards: OffertePrezziBoard[] = [];
  for (const cliente of ["domestico", "non domestico"] as const) {
    for (const prezzo of ["fisso", "variabile"] as const) {
      const subset = inputs.filter(
        (row) =>
          row.coverage === "nazionale" &&
          row.cliente === cliente &&
          row.prezzo === prezzo &&
          isCredibleParetoPoint(row, cliente, prezzo),
      );
      boards.push(boardFor(subset, cliente, prezzo));
    }
  }
  return { boards };
}

function boardFor(
  points: ParetoPointInput[],
  cliente: OfferteParetoCliente,
  prezzo: OfferteParetoPrezzo,
): OffertePrezziBoard {
  return {
    cliente,
    prezzo,
    n: points.length,
    monthly: quartiles(points.map((row) => row.monthlyEur)),
    energy: quartiles(points.map((row) => row.energyEurKwh)),
    mercato: clusterRows(points, MERCATO, (row) => row.source),
    orario: clusterRows(points, ORARIO, (row) => row.plan),
  };
}

function clusterRows<K extends string>(
  points: ParetoPointInput[],
  order: Array<[K, string]>,
  pick: (row: ParetoPointInput) => string | null,
): OffertePrezziClusterRow[] {
  return order.flatMap(([key, label]) => {
    const subset = points.filter((row) => pick(row) === key);
    const monthly = quartiles(subset.map((row) => row.monthlyEur));
    const energy = quartiles(subset.map((row) => row.energyEurKwh));
    if (!monthly || !energy) return [];
    return [{ key, label, n: subset.length, monthly, energy }];
  });
}

function quartiles(values: number[]): OffertePrezziQuartiles | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return {
    p10: quantile(sorted, 0.1),
    p25: quantile(sorted, 0.25),
    p50: quantile(sorted, 0.5),
    p75: quantile(sorted, 0.75),
    p90: quantile(sorted, 0.9),
    mean: sorted.reduce((sum, value) => sum + value, 0) / sorted.length,
  };
}

function quantile(sorted: number[], p: number) {
  if (sorted.length === 1) return sorted[0]!;
  const index = (sorted.length - 1) * p;
  const lo = Math.floor(index);
  const hi = Math.ceil(index);
  if (lo === hi) return sorted[lo]!;
  const weight = index - lo;
  return sorted[lo]! * (1 - weight) + sorted[hi]! * weight;
}
