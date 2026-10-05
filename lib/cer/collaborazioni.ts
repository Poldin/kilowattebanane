import { cerReadClient } from "@/lib/cer/client";
import { createSecretClient } from "@/lib/supabase/secret";
import { isAreaConvenzionaleCode, type CerCollaborazioneHit } from "@/lib/cer/pod-parse";

type PartnerRow = {
  id: string;
  denominazione: string;
  denominazione_key: string;
};

function nameKey(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function num(value: unknown) {
  if (value == null) return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export async function loadActiveCollaborazioni() {
  const supabase = createSecretClient();
  const { data, error } = await supabase
    .from("cer_collaborazioni")
    .select("id, denominazione, denominazione_key")
    .eq("active", true);
  if (error) throw new Error(error.message);
  return (data ?? []) as PartnerRow[];
}

export async function lookupCollaborazioniInArea(
  codice: string,
): Promise<CerCollaborazioneHit[]> {
  if (!isAreaConvenzionaleCode(codice)) return [];
  const partners = await loadActiveCollaborazioni();
  if (partners.length === 0) return [];

  const { data, error } = await cerReadClient()
    .from("cer_configurazioni_live")
    .select("denominazione, potenza_kw, n_utenze")
    .eq("area_convenzionale", codice)
    .eq("tipologia_kind", "cer");
  if (error) return [];

  const byKey = new Map(partners.map((row) => [row.denominazione_key, row]));
  const hits: CerCollaborazioneHit[] = [];
  const seen = new Set<string>();
  for (const row of data ?? []) {
    const key = nameKey(typeof row.denominazione === "string" ? row.denominazione : null);
    const partner = key ? byKey.get(key) : undefined;
    if (!partner || seen.has(partner.id)) continue;
    seen.add(partner.id);
    const nUtenze = num(row.n_utenze);
    hits.push({
      id: partner.id,
      denominazione: partner.denominazione,
      potenzaKw: num(row.potenza_kw),
      nUtenze: nUtenze != null ? Math.trunc(nUtenze) : null,
    });
  }
  return hits;
}
