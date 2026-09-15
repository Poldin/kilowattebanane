import { parseConsumoProfilo } from "@/lib/offerte/consumo-profile";
import {
  ATTIVAZIONE_FILTERS,
  CONTRATTO_FILTERS,
  PAGAMENTO_FILTERS,
  parsePortalFilterIds,
} from "@/lib/offerte/portal-labels";
import { OFFERTE_SEARCH_PAGE_SIZE } from "@/lib/offerte/public-types";
import { clampPotenzaKw } from "@/lib/offerte/potenza";
import { lookupCap, searchOfferte, type OfferteSearchQuery } from "@/lib/offerte/search";

export const dynamic = "force-dynamic";

function asQuery(params: URLSearchParams): OfferteSearchQuery | Response {
  const cap = params.get("cap") ?? "";
  if (!/^\d{5}$/.test(cap)) {
    return Response.json({ error: "CAP non valido" }, { status: 400 });
  }
  const cliente = params.get("cliente") === "non domestico" ? "non domestico" : "domestico";
  const mercatoRaw = params.get("mercato") ?? "tutti";
  const mercato =
    mercatoRaw === "placet" || mercatoRaw === "ml" ? mercatoRaw : "tutti";
  const prezzoRaw = params.get("prezzo") ?? "tutti";
  const prezzo =
    prezzoRaw === "prezzo fisso" || prezzoRaw === "prezzo variabile"
      ? prezzoRaw
      : "tutti";
  const fasciaRaw = params.get("fascia") ?? "tutti";
  const fascia =
    fasciaRaw === "monoraria" ||
    fasciaRaw === "bioraria" ||
    fasciaRaw === "fasce" ||
    fasciaRaw === "dinamica"
      ? fasciaRaw
      : "tutti";
  const consumoKwh = Number(params.get("consumo") ?? "2700");
  const potenzaKw = Number(params.get("potenza") ?? "3");
  const offsetRaw = Number(params.get("offset") ?? "0");
  const limitRaw = Number(params.get("limit") ?? String(OFFERTE_SEARCH_PAGE_SIZE));
  const shareF1 = Number(params.get("f1") ?? "");
  const shareF2 = Number(params.get("f2") ?? "");
  const shareF3 = Number(params.get("f3") ?? "");
  return {
    cap,
    cliente,
    mercato,
    prezzo,
    fascia,
    consumoKwh: Number.isFinite(consumoKwh) ? Math.min(20000, Math.max(500, consumoKwh)) : 2700,
    potenzaKw: clampPotenzaKw(potenzaKw, cliente),
    residente: params.get("residente") !== "0",
    profilo: parseConsumoProfilo(params.get("profilo")),
    pagamento: parsePortalFilterIds(params.get("pagamento"), PAGAMENTO_FILTERS),
    attivazione: parsePortalFilterIds(params.get("attivazione"), ATTIVAZIONE_FILTERS),
    contratto: parsePortalFilterIds(params.get("contratto"), CONTRATTO_FILTERS),
    shareF1: Number.isFinite(shareF1) ? shareF1 : undefined,
    shareF2: Number.isFinite(shareF2) ? shareF2 : undefined,
    shareF3: Number.isFinite(shareF3) ? shareF3 : undefined,
    offset: Number.isFinite(offsetRaw) ? Math.max(0, Math.floor(offsetRaw)) : 0,
    limit: Number.isFinite(limitRaw)
      ? Math.min(OFFERTE_SEARCH_PAGE_SIZE, Math.max(1, Math.floor(limitRaw)))
      : OFFERTE_SEARCH_PAGE_SIZE,
  };
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  if (params.get("lookup") === "1") {
    const cap = params.get("cap") ?? "";
    try {
      const places = await lookupCap(cap);
      return Response.json({ cap, places });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Lookup failed";
      return Response.json({ error: message }, { status: 500 });
    }
  }

  const parsed = asQuery(params);
  if (parsed instanceof Response) return parsed;
  try {
    const result = await searchOfferte(parsed);
    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Search failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
