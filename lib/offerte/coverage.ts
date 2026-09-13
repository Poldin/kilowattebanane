import type { CoverageHit } from "@/lib/offerte/types";

const WIDTH = { regione: 2, provincia: 3, comune: 6 } as const;

export function coverageFromPortalFields(fields: {
  regione?: string | null;
  provincia?: string | null;
  comune?: string | null;
}): CoverageHit[] {
  return [
    ...splitCodes(fields.regione, "regione"),
    ...splitCodes(fields.provincia, "provincia"),
    ...splitCodes(fields.comune, "comune"),
  ];
}

export function splitCodes(
  raw: string | null | undefined,
  livello: CoverageHit["livello"],
) {
  if (!raw) return [] as CoverageHit[];
  const width = WIDTH[livello];
  const seen = new Set<string>();
  const out: CoverageHit[] = [];
  for (const part of raw.split(";")) {
    const digits = part.replace(/\D/g, "");
    if (!digits) continue;
    const codice = digits.padStart(width, "0");
    if (codice.length !== width) continue;
    if (seen.has(codice)) continue;
    seen.add(codice);
    out.push({ livello, codice });
  }
  return out;
}

export function mergeCoverage(groups: CoverageHit[][]) {
  const seen = new Set<string>();
  const out: CoverageHit[] = [];
  for (const group of groups) {
    for (const hit of group) {
      const key = `${hit.livello}:${hit.codice}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(hit);
    }
  }
  return out;
}
