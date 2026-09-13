export type CoverageHit = {
  livello: "regione" | "provincia" | "comune";
  codice: string;
};

export type ImportKind = "geo" | "parametri_e" | "placet_e" | "ml_e";

export type IngestSummary = {
  kind: ImportKind;
  snapshotDate: string;
  sourceUrl?: string;
  seen: number;
  inserted: number;
  unchanged: number;
  superseded: number;
  delisted: number;
  relisted: number;
};
