/** Same check as the GSE “Cerca POD 2025” widget on the cabine primarie map. */
const POD_RE = /^IT\d{3}E\d{7}[\dA-Z]$/;

export const POD_FORMAT_HINT = "Formato: IT + XXX + E + XXXXXXXX";

export type PodCerHit = {
  denominazione: string | null;
  comune: string | null;
  inVetrina: boolean;
};

export type PodLookupOk = {
  found: true;
  pod: string;
  codice: string;
  gestore: string | null;
  cer: PodCerHit[];
};

export type PodLookupMiss = {
  found: false;
  pod: string;
};

export type PodLookupResult = PodLookupOk | PodLookupMiss;

export function normalizePodInput(raw: string) {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 15);
}

export function parsePod(raw: string): { ok: true; pod: string } | { ok: false; error: string } {
  let pod = normalizePodInput(raw);
  if (pod.length === 15) pod = pod.slice(0, 14);
  if (!POD_RE.test(pod)) return { ok: false, error: POD_FORMAT_HINT };
  return { ok: true, pod };
}

export function isAreaConvenzionaleCode(value: string) {
  return /^AC\d{3}E\d{5}$/.test(value);
}
