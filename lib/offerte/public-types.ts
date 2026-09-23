export const PORTALE_OFFERTE_URL =
  "https://www.ilportaleofferte.it/portaleOfferte/it/open-data.page";
export const CME_ITB_PAGE_URL =
  "https://www.cmegroup.com/markets/energy/electricity/italian-power-baseload-gme-calendar-month.html";
export const GME_MTE_PAGE_URL =
  "https://www.mercatoelettrico.org/it-it/Home/Esiti/Elettricita/MTE/Esiti/Baseload";
export const PORTALE_OFFERTE_HOME =
  "https://www.ilportaleofferte.it/portaleOfferte/it/homepage.page";
export const PORTALE_OFFERTE_CERCA =
  "https://www.ilportaleofferte.it/portaleOfferte/it/le-tue-forniture.page";

export type OfferteCliente = "domestico" | "non domestico";
export type OfferteMercato = "tutti" | "placet" | "ml";
export type OffertePrezzo = "tutti" | "prezzo fisso" | "prezzo variabile";
export type OfferteFascia = "tutti" | "monoraria" | "bioraria" | "fasce" | "dinamica";
export type OfferteConsumoProfilo = "standard" | "oculato";

export const OFFERTE_SEARCH_PAGE_SIZE = 40;

export type OfferteSearchQuery = {
  cap: string;
  cliente: OfferteCliente;
  mercato: OfferteMercato;
  prezzo: OffertePrezzo;
  fascia: OfferteFascia;
  consumoKwh: number;
  potenzaKw: number;
  residente?: boolean;
  profilo?: OfferteConsumoProfilo;
  pagamento?: string[];
  attivazione?: string[];
  contratto?: string[];
  shareF1?: number;
  shareF2?: number;
  shareF3?: number;
  offset?: number;
  limit?: number;
};

export type OfferteBillBreakdown = {
  energia: number;
  rete: number;
  oneri: number;
  imposte: number;
  sconti: number;
};

export type OfferteMonthPoint = {
  index: number;
  start: string;
  label: string;
  eur: number;
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
  onereRecesso: string | null;
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
  annualEur: number | null;
  firstMonthEur: number | null;
  months: OfferteMonthPoint[] | null;
  breakdown: OfferteBillBreakdown | null;
  dettaglio: OfferteHitDettaglio;
};

export type OfferteSearchResult = {
  cap: string;
  places: CapPlace[];
  punEurKwh: number | null;
  forwardAsOf: string | null;
  forwardSource: string | null;
  hits: OfferteSearchHit[];
  totalMatched: number;
};

export type OfferteSuggestCategory = "fornitore" | "codice" | "nome";

export const OFFERTE_SUGGEST_CATEGORY_LABELS: Record<OfferteSuggestCategory, string> = {
  fornitore: "Fornitore",
  codice: "Codice offerta",
  nome: "Nome offerta",
};

export type OfferteCatalogFilters = {
  cliente?: OfferteCliente;
  mercato?: OfferteMercato;
  prezzo?: OffertePrezzo;
  fascia?: OfferteFascia;
  residente?: boolean;
  pagamento?: string[];
  attivazione?: string[];
  contratto?: string[];
};

export type OfferteOfferTraits = {
  tipoCliente: string | null;
  tipoOfferta: string;
  plan: "monoraria" | "bioraria" | "fasce" | "dinamica" | null;
};

export type OfferteSuggestItem = {
  id: string;
  category: OfferteSuggestCategory;
  label: string;
  detail: string | null;
  codOfferta: string | null;
  venditoreKey: string | null;
  venditore: string | null;
  source: "placet" | "ml" | null;
  tipoCliente?: string | null;
  tipoOfferta?: string | null;
  plan?: OfferteOfferTraits["plan"];
};

export type OfferteSuggestResult = {
  q: string;
  items: OfferteSuggestItem[];
};

export type OfferteExploreHit = {
  source: "placet" | "ml";
  codOfferta: string;
  nome: string;
  venditore: string;
  venditoreKey: string;
  tipoCliente: string | null;
  tipoOfferta: string;
  plan: OfferteOfferTraits["plan"];
};

export type OfferteExploreResult = {
  items: OfferteExploreHit[];
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

export type OfferteClusterBucket = {
  key: string;
  label: string;
  count: number;
};

export type OfferteFasciaBucket = OfferteClusterBucket & {
  fisso: number | null;
  variabile: number;
};

export type OfferteVendorRank = {
  key: string;
  nome: string;
  url: string | null;
  offerte: number;
  placet: number;
  ml: number;
  fisso: number;
  variabile: number;
};

export type OfferteVendorStats = {
  media: number;
  mediana: number;
  soloUna: number;
  entrambi: number;
  soloPlacet: number;
  soloMl: number;
  top10Offerte: number;
  top: OfferteVendorRank[];
};

export type OfferteScontoFascia = "monoraria" | "bioraria" | "fasce" | "dinamica";
export type OfferteScontoPrezzo = "fisso" | "variabile";
export type OfferteScontoApplicazione = "sempre" | "condizionato" | "altro";

export type OfferteScontoRank = {
  key: string;
  nome: string;
  valoreLabel: string;
  annualEur: number;
  applicazione: OfferteScontoApplicazione;
  condizione: string | null;
  quando: string | null;
  suCosa: string | null;
  nota: string | null;
  venditore: string | null;
  offerte: number;
};

export type OfferteScontoBoard = {
  fascia: OfferteScontoFascia;
  prezzo: OfferteScontoPrezzo;
  top: OfferteScontoRank[];
};

export type OfferteScontoStats = {
  offerteMl: number;
  offerteConSconto: number;
  righe: number;
  applicazione: OfferteClusterBucket[];
  quando: OfferteClusterBucket[];
  tipologia: OfferteClusterBucket[];
  medianaFissoEurAnno: number | null;
  medianaVenditaEurKwh: number | null;
  rankingConsumoKwh: number;
  rankingPotenzaKw: number;
  boards: OfferteScontoBoard[];
};

export type OfferteParetoCliente = "domestico" | "non domestico";
export type OfferteParetoPrezzo = "fisso" | "variabile";
export type OfferteParetoSconti = "listino" | "primoAnno";

export type OfferteParetoHit = {
  key: string;
  source: "placet" | "ml";
  nome: string;
  venditore: string;
  urlVenditore: string | null;
  urlOfferta: string | null;
  plan: "monoraria" | "bioraria" | "fasce" | "dinamica" | null;
  monthlyEur: number;
  energyEurKwh: number;
  scontoNota: string | null;
  daKwh: number;
  finoAKwh: number | null;
  codOfferta: string;
  validFrom: string | null;
  validTo: string | null;
  durataMesi: number | null;
  dettaglio: OfferteHitDettaglio;
};

export type OfferteParetoSpot = {
  kwh: number;
  key: string;
  nome: string;
};

export type OfferteParetoCloud = {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  cols: number;
  rows: number;
  counts: number[];
};

export type OfferteParetoBoard = {
  cliente: OfferteParetoCliente;
  prezzo: OfferteParetoPrezzo;
  sconti: OfferteParetoSconti;
  compared: number;
  hull: number;
  dominated: number;
  hits: OfferteParetoHit[];
  spots: OfferteParetoSpot[];
  cloud: OfferteParetoCloud;
};

export type OfferteParetoStats = {
  spotsKwh: number[];
  boards: OfferteParetoBoard[];
};

export type OffertePrezziQuartiles = {
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  mean: number;
};

export type OffertePrezziClusterRow = {
  key: string;
  label: string;
  n: number;
  monthly: OffertePrezziQuartiles;
  energy: OffertePrezziQuartiles;
};

export type OffertePrezziBoard = {
  cliente: OfferteParetoCliente;
  prezzo: OfferteParetoPrezzo;
  n: number;
  monthly: OffertePrezziQuartiles | null;
  energy: OffertePrezziQuartiles | null;
  mercato: OffertePrezziClusterRow[];
  orario: OffertePrezziClusterRow[];
};

export type OffertePrezziStats = {
  boards: OffertePrezziBoard[];
};

export type OfferteClusterStats = OfferteHeadlineStats & {
  cliente: OfferteClusterBucket[];
  residenza: OfferteClusterBucket[];
  prezzo: OfferteClusterBucket[];
  mercato: OfferteClusterBucket[];
  copertura: OfferteClusterBucket[];
  durata: OfferteClusterBucket[];
  fascia: OfferteFasciaBucket[];
  sconti: OfferteScontoStats;
  pareto: OfferteParetoStats;
  prezzi: OffertePrezziStats;
  fornitori: OfferteVendorStats;
};
