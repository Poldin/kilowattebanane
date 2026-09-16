export const CME_FORWARD_SOURCE = "cme_itb";
export const GME_FORWARD_SOURCE = "gme_mte";
export const MIXED_FORWARD_SOURCE = "gme_mte+cme_itb";

export function forwardSourceShortLabel(source: string | null) {
  if (source === GME_FORWARD_SOURCE) return "GME";
  if (source === CME_FORWARD_SOURCE) return "CME";
  if (source === MIXED_FORWARD_SOURCE) return "GME + CME";
  return null;
}
