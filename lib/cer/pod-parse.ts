/** Same check as the GSE “Cerca POD 2025” widget on the cabine primarie map. */
const POD_RE = /^IT\d{3}E\d{7}[\dA-Z]$/;
const AC_RE = /^AC\d{3}E\d{5}$/;

export const POD_FORMAT_HINT =
  "mmm.. qualcosa non torna! POD: IT + XXX + E + XXXXXXXX · cabina: AC + XXX + E + XXXXX";

export type PodCerHit = {
  denominazione: string | null;
  inVetrina: boolean;
  potenzaKw: number | null;
  nUtenze: number | null;
};

export type CerCollaborazioneHit = {
  id: string;
  denominazione: string;
  potenzaKw: number | null;
  nUtenze: number | null;
};

export type PodLookupOk = {
  found: true;
  pod: string | null;
  codice: string;
  gestore: string | null;
  comuni: string[];
  cer: PodCerHit[];
  collaborazioni: CerCollaborazioneHit[];
};

export type PodLookupMiss = {
  found: false;
  query: "pod" | "cabina";
};

export type PodLookupResult = PodLookupOk | PodLookupMiss;

export type LookupInput =
  | { ok: true; kind: "pod"; pod: string }
  | { ok: true; kind: "cabina"; codice: string }
  | { ok: false; error: string };

export function normalizePodInput(raw: string) {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 15);
}

export function parseLookupInput(raw: string): LookupInput {
  const value = normalizePodInput(raw);
  if (isAreaConvenzionaleCode(value)) return { ok: true, kind: "cabina", codice: value };
  let pod = value;
  if (pod.length === 15) pod = pod.slice(0, 14);
  if (POD_RE.test(pod)) return { ok: true, kind: "pod", pod };
  return { ok: false, error: POD_FORMAT_HINT };
}

export function parsePod(raw: string): { ok: true; pod: string } | { ok: false; error: string } {
  const parsed = parseLookupInput(raw);
  if (parsed.ok && parsed.kind === "pod") return { ok: true, pod: parsed.pod };
  return { ok: false, error: POD_FORMAT_HINT };
}

export function isAreaConvenzionaleCode(value: string) {
  return AC_RE.test(value);
}
