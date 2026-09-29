import type { ItalianRegion } from "@/lib/market-zones";

export type RegionPhoto = {
  src: string;
  place: string;
  alt: string;
};

const photo = (file: string, place: string, alt: string): RegionPhoto => ({
  src: `/cer/regioni/${file}.webp?v=2`,
  place,
  alt,
});

export const REGION_PHOTOS: Record<ItalianRegion, RegionPhoto> = {
  Abruzzo: photo(
    "abruzzo",
    "Collemaggio",
    "La facciata di Santa Maria di Collemaggio, all’Aquila",
  ),
  Basilicata: photo("basilicata", "Matera", "I sassi di Matera"),
  Calabria: photo("calabria", "Tropea", "Il borgo di Tropea sulla rupe"),
  Campania: photo("campania", "Vesuvio", "Il Vesuvio sul golfo di Napoli"),
  "Emilia-Romagna": photo("emilia-romagna", "Due Torri", "Le Due Torri di Bologna"),
  "Friuli-Venezia Giulia": photo(
    "friuli-venezia-giulia",
    "Piazza Unità",
    "Piazza Unità d’Italia a Trieste",
  ),
  Lazio: photo("lazio", "Colosseo", "Il Colosseo a Roma"),
  Liguria: photo("liguria", "Manarola", "Manarola, nelle Cinque Terre"),
  Lombardia: photo("lombardia", "Duomo di Milano", "Il Duomo di Milano"),
  Marche: photo("marche", "Urbino", "Il Palazzo Ducale di Urbino"),
  Molise: photo("molise", "Termoli", "Il borgo antico di Termoli"),
  Piemonte: photo("piemonte", "Mole Antonelliana", "La Mole Antonelliana a Torino"),
  Puglia: photo("puglia", "Alberobello", "I trulli di Alberobello"),
  Sardegna: photo("sardegna", "Su Nuraxi", "Il nuraghe Su Nuraxi a Barumini"),
  Sicilia: photo("sicilia", "Valle dei Templi", "Il tempio della Concordia ad Agrigento"),
  Toscana: photo("toscana", "Duomo di Firenze", "La cupola del Duomo di Firenze"),
  "Trentino-Alto Adige": photo(
    "trentino-alto-adige",
    "Tre Cime",
    "Le Tre Cime di Lavaredo",
  ),
  Umbria: photo("umbria", "Assisi", "La basilica di San Francesco ad Assisi"),
  "Valle d'Aosta": photo("valle-d-aosta", "Cervino", "Il Cervino, in Valle d’Aosta"),
  Veneto: photo("veneto", "Piazza San Marco", "Piazza San Marco a Venezia"),
};

export function regionPhoto(key: string) {
  if (key in REGION_PHOTOS) return REGION_PHOTOS[key as ItalianRegion];
  return undefined;
}
