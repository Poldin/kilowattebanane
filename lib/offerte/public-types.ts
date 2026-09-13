export const PORTALE_OFFERTE_URL =
  "https://www.ilportaleofferte.it/portaleOfferte/it/open-data.page";
export const PORTALE_OFFERTE_HOME =
  "https://www.ilportaleofferte.it/portaleOfferte/it/homepage.page";
export const PORTALE_OFFERTE_CERCA =
  "https://www.ilportaleofferte.it/portaleOfferte/it/le-tue-forniture.page";

export type OfferteCliente = "domestico" | "non domestico";
export type OfferteMercato = "tutti" | "placet" | "ml";
export type OffertePrezzo = "tutti" | "prezzo fisso" | "prezzo variabile";
export type OfferteFascia = "tutti" | "monoraria" | "bioraria" | "fasce" | "dinamica";

export type OfferteSearchQuery = {
  cap: string;
  cliente: OfferteCliente;
  mercato: OfferteMercato;
  prezzo: OffertePrezzo;
  fascia: OfferteFascia;
  consumoKwh: number;
  potenzaKw: number;
};

export type CapPlace = {
  cap: string;
  comuneCodice: string;
  comuneNome: string;
  provinciaCodice: string;
  provinciaNome: string;
  regioneCodice: string;
  regioneNome: string;
};

export type OfferteSconto = {
  nome: string;
  descrizione: string | null;
  valore: string | null;
};

export type OfferteHitDettaglio = {
  descrizione: string | null;
  garanzie: string | null;
  telefono: string | null;
  attivazione: string[];
  pagamento: string[];
  tipologiaContratto: string[];
  residente: string | null;
  offertaSingola: boolean | null;
  onnicomprensiva: string | null;
  consumoMin: number | null;
  consumoMax: number | null;
  potenzaMin: number | null;
  potenzaMax: number | null;
  indicePrezzo: string | null;
  coefficiente: number | null;
  coverage: string | null;
  sconti: OfferteSconto[];
};

export type OfferteSearchHit = {
  source: "placet" | "ml";
  codOfferta: string;
  nome: string;
  venditore: string;
  tipoCliente: string | null;
  tipoOfferta: string;
  validFrom: string;
  validTo: string;
  durataMesi: number | null;
  monthlyEur: number | null;
  spreadEurKwh: number | null;
  spreadMinEurKwh: number | null;
  spreadMaxEurKwh: number | null;
  plan: "monoraria" | "bioraria" | "fasce" | "dinamica" | null;
  urlOfferta: string | null;
  urlVenditore: string | null;
  dettaglio: OfferteHitDettaglio;
};

export type OfferteSearchResult = {
  cap: string;
  places: CapPlace[];
  punEurKwh: number | null;
  hits: OfferteSearchHit[];
  totalMatched: number;
};

export type OfferteHeadlineStats = {
  snapshotDate: string;
  placet: number;
  ml: number;
  total: number;
  venditori: number;
  fisso: number;
  variabile: number;
};
