import { unstable_cache } from "next/cache";
import { offerteReadClient, paginateSelect } from "@/lib/offerte/db";
import { romeToday } from "@/lib/offerte/dates";
import { OFFERTE_CACHE_REVALIDATE, OFFERTE_CACHE_TAG } from "@/lib/offerte/revalidate";
import type {
  OfferteExploreHit,
  OfferteSuggestCategory,
  OfferteSuggestItem,
  OfferteSuggestResult,
} from "@/lib/offerte/public-types";

type PlacetSuggestRow = {
  cod_offerta: string;
  nome_offerta: string | null;
  denominazione: string | null;
  p_iva: string | null;
  url_sito_venditore: string | null;
};

type MlSuggestRow = {
  cod_offerta: string;
  nome_offerta: string | null;
  p_iva: string | null;
  url_sito_venditore: string | null;
};

type IndexOffer = {
  source: "placet" | "ml";
  codOfferta: string;
  nome: string;
  venditore: string;
  venditoreKey: string;
};

const CATEGORY_LIMITS: Record<OfferteSuggestCategory, number> = {
  fornitore: 5,
  codice: 5,
  nome: 8,
};

const VENDOR_OFFER_LIMIT = 40;

const loadSuggestIndex = unstable_cache(
  async (): Promise<IndexOffer[]> => {
    const today = romeToday();
    const client = offerteReadClient();
    const [placetRows, mlRows] = await Promise.all([
      paginateSelect<PlacetSuggestRow>((from, to) =>
        client
          .from("po_placet_e_live")
          .select("cod_offerta, nome_offerta, denominazione, p_iva, url_sito_venditore")
          .lte("valid_from", today)
          .gte("valid_to", today)
          .range(from, to),
      ),
      paginateSelect<MlSuggestRow>((from, to) =>
        client
          .from("po_ml_e_live")
          .select("cod_offerta, nome_offerta, p_iva, url_sito_venditore")
          .lte("valid_from", today)
          .gte("valid_to", today)
          .range(from, to),
      ),
    ]);

    return [
      ...placetRows.map((row) => toPlacetIndexOffer(row)),
      ...mlRows.map((row) => toMlIndexOffer(row)),
    ];
  },
  ["offerte-suggest-index"],
  { revalidate: OFFERTE_CACHE_REVALIDATE, tags: [OFFERTE_CACHE_TAG] },
);

function toPlacetIndexOffer(row: PlacetSuggestRow): IndexOffer {
  const venditoreKey = vendorKey(row.p_iva, row.url_sito_venditore);
  const venditore =
    row.denominazione?.replace(/\s+/g, " ").trim() ||
    vendorFromUrl(row.url_sito_venditore, row.p_iva) ||
    "Venditore";
  const nome = row.nome_offerta?.replace(/\s+/g, " ").trim() || row.cod_offerta;
  return {
    source: "placet",
    codOfferta: row.cod_offerta,
    nome,
    venditore,
    venditoreKey,
  };
}

function toMlIndexOffer(row: MlSuggestRow): IndexOffer {
  const venditoreKey = vendorKey(row.p_iva, row.url_sito_venditore);
  const venditore = vendorFromUrl(row.url_sito_venditore, row.p_iva) || "Venditore";
  const nome = row.nome_offerta?.replace(/\s+/g, " ").trim() || row.cod_offerta;
  return {
    source: "ml",
    codOfferta: row.cod_offerta,
    nome,
    venditore,
    venditoreKey,
  };
}

function vendorKey(piva: string | null, url: string | null) {
  return piva || hostnameFromUrl(url) || "sconosciuto";
}

function vendorFromUrl(url: string | null, piva: string | null) {
  return hostnameFromUrl(url) ?? (piva ? `P.IVA ${piva}` : null);
}

function hostnameFromUrl(url: string | null) {
  const href = absoluteVendorUrl(url);
  if (!href) return null;
  try {
    return new URL(href).hostname.replace(/^www\./, "") || null;
  } catch {
    return null;
  }
}

function absoluteVendorUrl(url: string | null) {
  const raw = url?.trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw.replace(/^\/\//, "")}`;
}

function normalizeQuery(q: string) {
  return q.trim().toLowerCase().replace(/\s+/g, " ");
}

function scoreMatch(haystack: string, needle: string) {
  const value = haystack.toLowerCase();
  if (value === needle) return 0;
  if (value.startsWith(needle)) return 1;
  const index = value.indexOf(needle);
  return index >= 0 ? 2 + index / 100 : 99;
}

export async function suggestOfferte(
  rawQuery: string,
  vendorKey?: string | null,
): Promise<OfferteSuggestResult> {
  const q = normalizeQuery(rawQuery);
  const scopedVendor = vendorKey?.trim() || null;
  if (!scopedVendor && q.length < 2) return { q: rawQuery.trim(), items: [] };

  const index = await loadSuggestIndex();

  if (scopedVendor) {
    const offers = index
      .filter((offer) => offer.venditoreKey === scopedVendor)
      .sort((a, b) => a.nome.localeCompare(b.nome, "it") || a.codOfferta.localeCompare(b.codOfferta));
    return {
      q: rawQuery.trim(),
      items: offers.slice(0, VENDOR_OFFER_LIMIT).map((offer) => toNomeItem(offer, offer.codOfferta)),
    };
  }

  const items: OfferteSuggestItem[] = [];

  const vendorMap = new Map<
    string,
    { venditore: string; offerte: number; placet: number; ml: number }
  >();
  for (const offer of index) {
    const acc = vendorMap.get(offer.venditoreKey) ?? {
      venditore: offer.venditore,
      offerte: 0,
      placet: 0,
      ml: 0,
    };
    acc.offerte += 1;
    if (offer.source === "placet") acc.placet += 1;
    else acc.ml += 1;
    vendorMap.set(offer.venditoreKey, acc);
  }

  const vendors = [...vendorMap.entries()]
    .filter(([, acc]) => acc.venditore.toLowerCase().includes(q))
    .sort(
      (a, b) =>
        scoreMatch(a[1].venditore, q) - scoreMatch(b[1].venditore, q) ||
        b[1].offerte - a[1].offerte ||
        a[1].venditore.localeCompare(b[1].venditore, "it"),
    )
    .slice(0, CATEGORY_LIMITS.fornitore);

  for (const [key, acc] of vendors) {
    items.push({
      id: `fornitore:${key}`,
      category: "fornitore",
      label: acc.venditore,
      detail: `${acc.offerte} offerte`,
      codOfferta: null,
      venditoreKey: key,
      venditore: acc.venditore,
      source: acc.placet > 0 && acc.ml > 0 ? null : acc.placet > 0 ? "placet" : "ml",
    });
  }

  const codes = index
    .filter((offer) => offer.codOfferta.toLowerCase().includes(q))
    .sort(
      (a, b) =>
        scoreMatch(a.codOfferta, q) - scoreMatch(b.codOfferta, q) ||
        a.nome.localeCompare(b.nome, "it"),
    )
    .slice(0, CATEGORY_LIMITS.codice);

  for (const offer of codes) {
    items.push({
      id: `codice:${offer.source}:${offer.codOfferta}`,
      category: "codice",
      label: offer.codOfferta,
      detail: offer.nome,
      codOfferta: offer.codOfferta,
      venditoreKey: offer.venditoreKey,
      venditore: offer.venditore,
      source: offer.source,
    });
  }

  const names = index
    .filter((offer) => offer.nome.toLowerCase().includes(q))
    .sort(
      (a, b) =>
        scoreMatch(a.nome, q) - scoreMatch(b.nome, q) ||
        a.venditore.localeCompare(b.venditore, "it"),
    )
    .slice(0, CATEGORY_LIMITS.nome);

  for (const offer of names) {
    items.push(toNomeItem(offer, `${offer.venditore} · ${offer.codOfferta}`));
  }

  return { q: rawQuery.trim(), items };
}

function toNomeItem(offer: IndexOffer, detail: string): OfferteSuggestItem {
  return {
    id: `nome:${offer.source}:${offer.codOfferta}`,
    category: "nome",
    label: offer.nome,
    detail,
    codOfferta: offer.codOfferta,
    venditoreKey: offer.venditoreKey,
    venditore: offer.venditore,
    source: offer.source,
  };
}

const EXPLORE_DEFAULT_LIMIT = 10;

export async function exploreRandomOffers(limit = EXPLORE_DEFAULT_LIMIT): Promise<OfferteExploreHit[]> {
  const index = await loadSuggestIndex();
  if (index.length === 0) return [];

  const capped = Math.max(1, Math.min(limit, 20));
  const picked = new Map<string, IndexOffer>();
  const maxAttempts = Math.max(capped * 30, 100);

  for (let attempt = 0; picked.size < capped && attempt < maxAttempts; attempt++) {
    const offer = index[Math.floor(Math.random() * index.length)]!;
    picked.set(`${offer.source}:${offer.codOfferta}`, offer);
  }

  return [...picked.values()].map((offer) => ({
    source: offer.source,
    codOfferta: offer.codOfferta,
    nome: offer.nome,
    venditore: offer.venditore,
    venditoreKey: offer.venditoreKey,
  }));
}
