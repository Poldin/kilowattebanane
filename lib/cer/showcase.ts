import { unstable_cache } from "next/cache";
import { cerReadClient } from "@/lib/cer/client";
import type { CerShowcaseCard } from "@/lib/cer/public-types";
import { CER_CACHE_REVALIDATE, CER_CACHE_TAG } from "@/lib/cer/revalidate";

type LiveRow = {
  denominazione: string | null;
  potenza_kw: number | string | null;
  n_utenze: number | null;
};

const TOP_LIMIT = 8;

function num(value: number | string | null | undefined) {
  if (value == null) return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function displayName(raw: string) {
  const collapsed = raw.replace(/\s+/g, " ").trim();
  const stripped = collapsed
    .replace(
      /^(comunità|comunita)['’]?\s+energetic(?:a|he)(?:\s+rinnovabili?e?)?\s*-?\s*/i,
      "",
    )
    .replace(/^c\.?\s*e\.?\s*r\.?\s+/i, "")
    .replace(
      /\s+(comunità|comunita)['’]?\s+energetic(?:a|he)(?:\s+rinnovabili?e?)?\s+(societ[aà]['’]?\s+cooperativa|soc\.?\s*coop\.).*$/i,
      "",
    )
    .replace(/\s+soc\.?\s*coop\..*$/i, "")
    .replace(/\s+societ[aà]['’]?\s+cooperativa.*$/i, "")
    .replace(/\s+-\s*$/, "")
    .trim();
  return stripped.length >= 4 ? stripped : collapsed;
}

async function loadCerNameRows() {
  const client = cerReadClient();
  const page = 1000;
  const rows: LiveRow[] = [];
  for (let from = 0; ; from += page) {
    const { data, error } = await client
      .from("cer_configurazioni_live")
      .select("denominazione, potenza_kw, n_utenze")
      .eq("tipologia_kind", "cer")
      .range(from, from + page - 1);
    if (error) throw new Error(error.message);
    const chunk = (data ?? []) as unknown as LiveRow[];
    rows.push(...chunk);
    if (chunk.length < page) break;
  }
  return rows;
}

function topCersFromRows(rows: LiveRow[]): CerShowcaseCard[] {
  const byName = new Map<
    string,
    { denominazione: string; potenzaKw: number; nUtenze: number }
  >();
  for (const row of rows) {
    const raw = row.denominazione?.replace(/\s+/g, " ").trim();
    if (!raw) continue;
    const key = raw.toLowerCase();
    const existing = byName.get(key);
    const potenza = num(row.potenza_kw) ?? 0;
    const utenze = row.n_utenze != null && Number.isFinite(row.n_utenze) ? row.n_utenze : 0;
    if (!existing) {
      byName.set(key, {
        denominazione: displayName(raw),
        potenzaKw: potenza,
        nUtenze: utenze,
      });
      continue;
    }
    existing.potenzaKw += potenza;
    existing.nUtenze += utenze;
  }
  return [...byName.values()]
    .map((row) => ({
      denominazione: row.denominazione,
      potenzaKw: row.potenzaKw > 0 ? row.potenzaKw : null,
      nUtenze: row.nUtenze > 0 ? row.nUtenze : null,
    }))
    .sort(
      (a, b) =>
        (b.potenzaKw ?? 0) - (a.potenzaKw ?? 0) ||
        (b.nUtenze ?? 0) - (a.nUtenze ?? 0) ||
        a.denominazione.localeCompare(b.denominazione, "it"),
    )
    .slice(0, TOP_LIMIT);
}

export const loadTopCers = unstable_cache(
  async (): Promise<CerShowcaseCard[]> => topCersFromRows(await loadCerNameRows()),
  ["cer-top-v2"],
  { revalidate: CER_CACHE_REVALIDATE, tags: [CER_CACHE_TAG] },
);
