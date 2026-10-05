import type { CerNameGroup, CerNamesAnalysis } from "@/lib/cer/public-types";

type CerRowLike = {
  codice_richiesta: string;
  denominazione: string | null;
  potenza_kw: number | string | null;
  n_utenze: number | null;
  area_convenzionale: string | null;
  comune: string | null;
};

function num(value: number | string | null | undefined) {
  if (value == null) return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function nameKey(row: CerRowLike) {
  return (row.denominazione ?? row.codice_richiesta).trim().toLowerCase();
}

function displayName(row: CerRowLike) {
  return row.denominazione?.replace(/\s+/g, " ").trim() ?? row.codice_richiesta;
}

function groupFromRows(denominazione: string, rows: CerRowLike[]): CerNameGroup {
  const potenze = rows.map((row) => num(row.potenza_kw)).filter((value): value is number => value != null);
  const utenze = rows
    .map((row) => row.n_utenze)
    .filter((value): value is number => value != null);
  return {
    denominazione,
    configurazioni: rows.length,
    cabinePrimarie: new Set(
      rows.map((row) => row.area_convenzionale?.trim()).filter((value): value is string => Boolean(value)),
    ).size,
    comuni: new Set(
      rows.map((row) => row.comune?.trim()).filter((value): value is string => Boolean(value)),
    ).size,
    potenzaKwTotale: potenze.length > 0 ? potenze.reduce((sum, value) => sum + value, 0) : null,
    utenzeTotale: utenze.length > 0 ? utenze.reduce((sum, value) => sum + value, 0) : null,
  };
}

export function cerNamesAnalysis(cerRows: CerRowLike[]): CerNamesAnalysis | null {
  if (cerRows.length === 0) return null;

  const byName = new Map<string, { denominazione: string; rows: CerRowLike[] }>();
  for (const row of cerRows) {
    const key = nameKey(row);
    const existing = byName.get(key);
    if (existing) {
      existing.rows.push(row);
      continue;
    }
    byName.set(key, { denominazione: displayName(row), rows: [row] });
  }

  const groups = [...byName.values()].map(({ denominazione, rows }) => groupFromRows(denominazione, rows));
  const ripetuti = groups.filter((group) => group.configurazioni > 1);
  const unaVolta = groups.filter((group) => group.configurazioni === 1);
  const configurazioniRipetuti = ripetuti.reduce((sum, group) => sum + group.configurazioni, 0);

  return {
    totaleConfigurazioni: cerRows.length,
    nomiDistinti: groups.length,
    nomiUnaVolta: unaVolta.length,
    nomiRipetuti: ripetuti.length,
    configurazioniNomiUnici: unaVolta.length,
    configurazioniNomiRipetuti: configurazioniRipetuti,
    mediaConfigurazioniPerNomeRipetuto:
      ripetuti.length > 0 ? configurazioniRipetuti / ripetuti.length : null,
    topRipetuti: [...ripetuti]
      .sort(
        (a, b) =>
          b.configurazioni - a.configurazioni ||
          a.denominazione.localeCompare(b.denominazione, "it"),
      )
      .slice(0, 10),
  };
}
