import type { OfferteCliente } from "@/lib/offerte/public-types";

/** ARERA, da 0,5 a 6 kW a scatti di 0,5 (utenza domestica più diffusa). */
export const POTENZA_FINO_6_KW = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6] as const;

/** ARERA: 1 kW da 6 a 10, poi 5 kW. */
export const POTENZA_OLTRE_6_KW = [7, 8, 9, 10, 15, 20, 25, 30] as const;

export const POTENZA_STANDARD_CASA_KW = 3;

export function potenzeImpegnateKw(cliente: OfferteCliente): number[] {
  if (cliente === "non domestico") return [...POTENZA_FINO_6_KW, ...POTENZA_OLTRE_6_KW];
  return [...POTENZA_FINO_6_KW];
}

export function clampPotenzaKw(value: number, cliente: OfferteCliente): number {
  if (!Number.isFinite(value)) return POTENZA_STANDARD_CASA_KW;
  const allowed = potenzeImpegnateKw(cliente);
  return allowed.reduce((best, kw) =>
    Math.abs(kw - value) < Math.abs(best - value) ? kw : best,
  );
}

export function formatPotenzaKw(kw: number) {
  return `${String(kw).replace(".", ",")} kW`;
}
