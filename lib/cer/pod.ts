import { cerReadClient } from "@/lib/cer/client";
import {
  isAreaConvenzionaleCode,
  type PodCerHit,
  type PodLookupResult,
  parseLookupInput,
} from "@/lib/cer/pod-parse";
import { lookupCabinaOnGse, lookupComuniOnGse, lookupPodOnGse } from "@/lib/cer/pod-gse";

export {
  POD_FORMAT_HINT,
  normalizePodInput,
  parseLookupInput,
  parsePod,
  type PodCerHit,
  type PodLookupMiss,
  type PodLookupOk,
  type PodLookupResult,
} from "@/lib/cer/pod-parse";

const UA = "kilowattebanane/cer-pod (informational reuse; https://kilowattebanane.it)";

function text(value: unknown) {
  if (value == null) return null;
  const s = String(value).trim();
  return s.length > 0 ? s : null;
}

function num(value: unknown) {
  if (value == null) return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export async function lookupCersInArea(codice: string): Promise<PodCerHit[]> {
  if (!isAreaConvenzionaleCode(codice)) return [];
  try {
    const { data, error } = await cerReadClient()
      .from("cer_configurazioni_live")
      .select("denominazione, in_vetrina, potenza_kw, n_utenze")
      .eq("area_convenzionale", codice)
      .eq("tipologia_kind", "cer")
      .order("in_vetrina", { ascending: false })
      .limit(8);
    if (error) return [];
    return (data ?? []).map((row) => {
      const nUtenze = num(row.n_utenze);
      return {
        denominazione: text(row.denominazione),
        inVetrina: Boolean(row.in_vetrina),
        potenzaKw: num(row.potenza_kw),
        nUtenze: nUtenze != null ? Math.trunc(nUtenze) : null,
      };
    });
  } catch {
    return [];
  }
}

export async function lookupPod(raw: string): Promise<PodLookupResult> {
  const parsed = parseLookupInput(raw);
  if (!parsed.ok) {
    throw new Error(parsed.error);
  }

  const gse =
    parsed.kind === "cabina"
      ? await lookupCabinaOnGse(parsed.codice, { userAgent: UA })
      : await lookupPodOnGse(parsed.pod, { userAgent: UA });
  if (!gse.found) return gse;

  const [cer, comuni] = await Promise.all([
    lookupCersInArea(gse.codice),
    lookupComuniOnGse(gse.codice, { userAgent: UA }).catch(() => []),
  ]);
  return {
    ...gse,
    cer,
    comuni,
  };
}
