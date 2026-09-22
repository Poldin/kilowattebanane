"use client";

import { useRotatingPlaceholder } from "@/lib/use-rotating-placeholder";

export const SAMPLE_CAPS = ["20121", "00100", "80121", "50122", "10121"] as const;

const SAMPLE_FORNITORI = [
  "Enel Energia S.p.A.",
  "Luce e Gas Italia S.p.A.",
  "revoluce.it",
  "Energia corrente Srl",
  "BLUE LUCE E GAS SRL",
] as const;

const SAMPLE_CODICI_OFFERTA = [
  "000142ESFFP01XXResECAn0000118737",
  "001233ESVML01XXLUCESPRINTLIFEDOM",
  "044010ESVFL04XXLUCEDOMESUPERNOVA",
  "023840ESFML01XXFIXEE2026VGPDOMCT",
  "000971ESFFP01XXPRDEE136010420261",
] as const;

const SAMPLE_NOMI_OFFERTA = [
  "Enel Digital Luce",
  "Enel Fix Wow Luce",
  "LUCE COMMUNITY",
  "FIX STORE LUCE SCONTO 15%",
  "Enel Energia Placet Fissa Luce Consumer",
] as const;

/** 5 fornitori, 5 codici e 5 nomi — ruotati a rotazione (fornitore → codice → nome). */
export const SAMPLE_COMPARE_QUERIES = SAMPLE_FORNITORI.flatMap((fornitore, index) => [
  fornitore,
  SAMPLE_CODICI_OFFERTA[index]!,
  SAMPLE_NOMI_OFFERTA[index]!,
]);

/** Types in, holds, deletes, then rotates through sample CAP codes. */
export function useRotatingCapPlaceholder(
  caps: readonly string[] = SAMPLE_CAPS,
  cycleMs = 5000,
) {
  return useRotatingPlaceholder(caps, cycleMs);
}

/** Rotates example fornitore, codice offerta and nome offerta queries. */
export function useRotatingComparePlaceholder(
  samples: readonly string[] = SAMPLE_COMPARE_QUERIES,
  cycleMs = 5000,
) {
  return useRotatingPlaceholder(samples, cycleMs);
}
