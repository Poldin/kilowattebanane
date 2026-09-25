import type {
  OfferteParetoCarousel,
  OfferteParetoCliente,
  OfferteParetoHit,
  OfferteParetoPlan,
  OfferteParetoPrezzo,
  OfferteParetoResidenza,
  OfferteParetoSconti,
  OfferteParetoStats,
  OfferteSuggestItem,
} from "@/lib/offerte/public-types";

export const PARETO_PLANS_FISSO = ["monoraria", "bioraria", "fasce"] as const satisfies readonly OfferteParetoPlan[];
export const PARETO_PLANS = ["monoraria", "bioraria", "fasce", "dinamica"] as const satisfies readonly OfferteParetoPlan[];
export const PARETO_CAROUSEL_CLUSTERS = [
  { cliente: "domestico", residenza: "residente", prezzo: "variabile", plan: "monoraria" },
  { cliente: "domestico", residenza: "residente", prezzo: "fisso", plan: "monoraria" },
  { cliente: "non domestico", residenza: null, prezzo: "variabile", plan: "monoraria" },
] as const satisfies ReadonlyArray<{
  cliente: OfferteParetoCliente;
  residenza: OfferteParetoResidenza | null;
  prezzo: OfferteParetoPrezzo;
  plan: OfferteParetoPlan;
}>;

export function findParetoBoard(
  stats: OfferteParetoStats,
  query: {
    cliente: OfferteParetoCliente;
    residenza?: OfferteParetoResidenza | null;
    prezzo: OfferteParetoPrezzo;
    plan: OfferteParetoPlan;
    sconti: OfferteParetoSconti;
  },
) {
  const residenza = query.cliente === "domestico" ? (query.residenza ?? "residente") : null;
  return stats.boards.find(
    (board) =>
      board.cliente === query.cliente &&
      board.residenza === residenza &&
      board.prezzo === query.prezzo &&
      board.plan === query.plan &&
      board.sconti === query.sconti,
  );
}

export function paretoCarouselFromStats(stats: OfferteParetoStats): OfferteParetoCarousel {
  const sconti = "primoAnno";
  const featured = PARETO_CAROUSEL_CLUSTERS.flatMap((cluster) => {
    const board = findParetoBoard(stats, { ...cluster, sconti });
    if (!board || board.hull <= 0) return [];
    return [
      {
        cliente: cluster.cliente,
        residenza: cluster.residenza,
        prezzo: cluster.prezzo,
        plan: cluster.plan,
        hull: board.hull,
        compared: board.compared,
        offers: board.hits.map((hit) => suggestFromParetoHit(hit, cluster.cliente, cluster.prezzo)),
      },
    ];
  });

  const convenienti = new Set<string>();
  for (const board of stats.boards) {
    if (board.sconti !== sconti) continue;
    for (const hit of board.hits) convenienti.add(hit.key);
  }

  return { convenienti: convenienti.size, featured };
}

function suggestFromParetoHit(
  hit: OfferteParetoHit,
  cliente: OfferteParetoCliente,
  prezzo: OfferteParetoPrezzo,
): OfferteSuggestItem {
  return {
    id: `nome:${hit.source}:${hit.codOfferta}`,
    category: "nome",
    label: hit.nome,
    detail: `${hit.venditore} · ${hit.codOfferta}`,
    codOfferta: hit.codOfferta,
    venditoreKey: null,
    venditore: hit.venditore,
    source: hit.source,
    tipoCliente: cliente,
    tipoOfferta: prezzo === "variabile" ? "prezzo variabile" : "prezzo fisso",
    plan: hit.plan,
  };
}
