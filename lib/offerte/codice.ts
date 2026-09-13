import type { OfferteFasciaPlan } from "@/lib/offerte/metrics";

/**
 * Delibera 135/2022/R/com, carattere 10 del codice offerta (1-based):
 * O = orario (PUN ora per ora), F = a fasce, M = monorario.
 */
export function areraPrezzoOrarioKind(
  codOfferta: string,
): "orario" | "fasce" | "monorario" | null {
  const ch = codOfferta.length >= 10 ? codOfferta[9] : "";
  if (ch === "O") return "orario";
  if (ch === "F") return "fasce";
  if (ch === "M") return "monorario";
  return null;
}

/** Offerta a prezzo dinamico: mercato libero, variabile, codice orario. Non PLACET. */
export function isOffertaDinamica(hit: {
  source: "placet" | "ml";
  tipoOfferta: string;
  codOfferta: string;
}) {
  if (hit.source !== "ml") return false;
  if (!hit.tipoOfferta.includes("variabile")) return false;
  return areraPrezzoOrarioKind(hit.codOfferta) === "orario";
}

export function resolveOffertePlan(
  hit: { source: "placet" | "ml"; tipoOfferta: string; codOfferta: string },
  bandPlan: OfferteFasciaPlan | null,
): OfferteFasciaPlan | null {
  if (isOffertaDinamica(hit)) return "dinamica";
  return bandPlan;
}
