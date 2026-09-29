export const GSE_MAPPA_URL =
  "https://www.gse.it/servizi-per-te/autoconsumo/mappa-interattiva-delle-cabine-primarie/";

export type CerTipologiaKind =
  | "cer"
  | "auc"
  | "individuale"
  | "gruppo_clienti"
  | "cliente_attivo";

export type CerClusterBucket = {
  key: string;
  label: string;
  count: number;
};

export type CerRegionStat = {
  key: string;
  label: string;
  total: number;
  cer: number;
  cerUniche: number;
  cerInVetrina: number;
  cabinePrimarie: number | null;
  medianaPotenzaKw: number | null;
  potenzaKwTotale: number | null;
  medianaUtenze: number | null;
  utenzeTotale: number | null;
};

export type CerStats = {
  total: number;
  cer: number;
  cerUniche: number;
  cerInVetrina: number;
  snapshotDate: string | null;
  ingestedOn: string | null;
  tipologia: CerClusterBucket[];
  vetrina: CerClusterBucket[];
  regione: CerClusterBucket[];
  regioni: CerRegionStat[];
  gestore: CerClusterBucket[];
  potenza: CerClusterBucket[];
  utenze: CerClusterBucket[];
  medianaPotenzaKw: number | null;
  medianaUtenze: number | null;
  potenzaKwTotale: number | null;
  utenzeTotale: number | null;
  impiantiTotale: number | null;
};
