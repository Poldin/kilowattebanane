import { contentHash } from "@/lib/offerte/hash";
import { parseNumber, parsePortalDate } from "@/lib/offerte/dates";
import type { CerTipologiaKind } from "@/lib/cer/public-types";
import type { CerSourceFeature } from "@/lib/cer/source";

export type ParsedCerConfig = {
  codice_richiesta: string;
  tipologia: string | null;
  tipologia_kind: CerTipologiaKind;
  denominazione: string | null;
  potenza_kw: number | null;
  n_impianti: number | null;
  n_utenze: number | null;
  comune: string | null;
  provincia: string | null;
  regione: string | null;
  lat: number | null;
  lon: number | null;
  area_convenzionale: string | null;
  gestore_rete: string | null;
  gse_aggiornato_il: string | null;
  in_vetrina: boolean;
  layer_id: number;
  layer_name: string;
  source_objectid: number | null;
  content_hash: string;
};

function text(value: unknown) {
  if (value == null) return null;
  const s = String(value).trim();
  return s.length > 0 ? s : null;
}

function intish(value: unknown) {
  const n = parseNumber(typeof value === "number" ? String(value) : text(value));
  if (n == null) return null;
  return Math.trunc(n);
}

function coord(value: unknown, fallback: number | null) {
  if (typeof fallback === "number" && Number.isFinite(fallback)) return fallback;
  const n = parseNumber(text(value));
  return n != null && Number.isFinite(n) ? n : null;
}

function objectId(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  const n = intish(value);
  return n;
}

export function parseCerFeature(feature: CerSourceFeature): ParsedCerConfig | null {
  const attrs = feature.attributes;
  if (attrs.BOZZA === 1 || attrs.BOZZA === "1") return null;

  const codice = text(attrs.CODICE_RICHIESTA)?.toUpperCase();
  if (!codice) return null;

  const lat = coord(attrs.Latitudine, feature.y);
  const lon = coord(attrs.Longitudine, feature.x);
  const tipologia = text(attrs.Tipologia_configurazione);
  const denominazione = text(attrs.Denominazione_Comunita);
  const potenza_kw = parseNumber(
    typeof attrs.Potenza_totale__kW === "number"
      ? String(attrs.Potenza_totale__kW)
      : text(attrs.Potenza_totale__kW),
  );
  const n_impianti = intish(attrs.Numero_impianti);
  const n_utenze = intish(attrs.Numero_utenze);
  const comune = text(attrs.Comune);
  const provincia = text(attrs.Provincia);
  const regione = text(attrs.Regione);
  const area_convenzionale = text(attrs.Area_Convenzionale);
  const gestore_rete = text(attrs.Ragione_Sociale_GdR);
  const gse_aggiornato_il =
    parsePortalDate(text(attrs.Data_Aggiornamento) ?? undefined) ?? null;

  const hash = contentHash({
    codice,
    tipologia,
    kind: feature.kind,
    denominazione,
    potenza_kw,
    n_impianti,
    n_utenze,
    comune,
    provincia,
    regione,
    lat,
    lon,
    area_convenzionale,
    gestore_rete,
    gse_aggiornato_il,
    in_vetrina: feature.inVetrina,
  });

  return {
    codice_richiesta: codice,
    tipologia,
    tipologia_kind: feature.kind,
    denominazione,
    potenza_kw,
    n_impianti,
    n_utenze,
    comune,
    provincia,
    regione,
    lat,
    lon,
    area_convenzionale,
    gestore_rete,
    gse_aggiornato_il,
    in_vetrina: feature.inVetrina,
    layer_id: feature.layerId,
    layer_name: feature.layerName,
    source_objectid: objectId(attrs.OBJECTID),
    content_hash: hash,
  };
}

const KIND_RANK: Record<CerTipologiaKind, number> = {
  cer: 0,
  auc: 1,
  individuale: 2,
  gruppo_clienti: 3,
  cliente_attivo: 4,
};

export function dedupeCerConfigs(parsed: ParsedCerConfig[]) {
  const byCode = new Map<string, ParsedCerConfig>();
  for (const row of parsed) {
    const prev = byCode.get(row.codice_richiesta);
    if (!prev) {
      byCode.set(row.codice_richiesta, row);
      continue;
    }
    if (prev.in_vetrina !== row.in_vetrina) {
      byCode.set(row.codice_richiesta, row.in_vetrina ? row : prev);
      continue;
    }
    if (KIND_RANK[row.tipologia_kind] < KIND_RANK[prev.tipologia_kind]) {
      byCode.set(row.codice_richiesta, row);
    }
  }
  return [...byCode.values()];
}
