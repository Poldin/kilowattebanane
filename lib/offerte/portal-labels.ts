import type { OfferteHitDettaglio, OfferteSconto } from "@/lib/offerte/public-types";

const ATTIVAZIONE: Record<string, string> = {
  "01": "Solo da web",
  "02": "Qualsiasi canale",
  "03": "Punto vendita",
  "04": "Teleselling",
  "05": "Agenzia",
  "06": "Altro",
  "99": "Altro",
};

const PAGAMENTO: Record<string, string> = {
  "01": "Domiciliazione bancaria",
  "02": "Domiciliazione postale",
  "03": "Domiciliazione su carta di credito",
  "04": "Bollettino precompilato",
  "05": "Altro",
  "99": "Altro",
};

const TIPOLOGIA_CONTRATTO: Record<string, string> = {
  "01": "Cambio fornitore",
  "02": "Prima attivazione",
  "03": "Riattivazione",
  "04": "Voltura",
  "99": "Qualsiasi attivazione",
};

const RESIDENTE: Record<string, string> = {
  "01": "Domestico residente",
  "02": "Domestico non residente",
  "03": "Residente e non residente",
};

const ONNICOMPRENSIVA: Record<string, string> = {
  "01": "Onnicomprensiva",
  "02": "Onnicomprensiva a canone",
};

const INDICE_PREZZO: Record<string, string> = {
  "01": "PUN Index GME (trimestrale)",
  "02": "TTF (trimestrale)",
  "03": "PSV (trimestrale)",
  "04": "Psbil (trimestrale)",
  "05": "PE",
  "06": "Cmem",
  "07": "Pfor",
  "08": "PUN Index GME (bimestrale)",
  "09": "TTF (bimestrale)",
  "10": "PSV (bimestrale)",
  "11": "Psbil (bimestrale)",
  "12": "PUN Index GME (mensile)",
  "13": "TTF (mensile)",
  "14": "PSV (mensile)",
  "15": "Psbil (mensile)",
  "99": "Altro indice",
};

const UNITA_SCONTO: Record<string, string> = {
  "01": "€/anno",
  "02": "€/kW",
  "03": "€/kWh",
  "04": "€/Smc",
  "05": "€",
  "06": "%",
};

export type MlDettaglioRow = {
  descrizione: string | null;
  garanzie: string | null;
  telefono: string | null;
  tipologia_att_contr: string[] | string | null;
  modalita_attivazione: string[] | string | null;
  modalita_pagamento: string[] | string | null;
  domestico_residente: string | null;
  offerta_singola: string | null;
  offerta_onnicomprensiva: string | null;
  consumo_min: number | string | null;
  consumo_max: number | string | null;
  potenza_min: number | string | null;
  potenza_max: number | string | null;
  idx_prezzo_energia: string | null;
  coefficiente: number | string | null;
  coverage: string | null;
};

export type PlacetDettaglioRow = {
  telefono: string | null;
  modalita_attivazione: string | null;
  modalita_pagamento: string | null;
  coverage: string | null;
};

export function mlOfferDettaglio(row: MlDettaglioRow, sconti: OfferteSconto[] = []): OfferteHitDettaglio {
  const singola = yesNo(row.offerta_singola);
  return {
    descrizione: cleanText(row.descrizione),
    garanzie: cleanGaranzie(row.garanzie),
    telefono: cleanText(row.telefono),
    attivazione: decodeList(row.modalita_attivazione, ATTIVAZIONE),
    pagamento: decodeList(row.modalita_pagamento, PAGAMENTO),
    tipologiaContratto: decodeTipologiaContratto(row.tipologia_att_contr),
    residente: labelOf(row.domestico_residente, RESIDENTE),
    offertaSingola: singola,
    onnicomprensiva: labelOf(row.offerta_onnicomprensiva, ONNICOMPRENSIVA),
    consumoMin: asNum(row.consumo_min),
    consumoMax: asNum(row.consumo_max),
    potenzaMin: asNum(row.potenza_min),
    potenzaMax: asNum(row.potenza_max),
    indicePrezzo: labelOf(row.idx_prezzo_energia, INDICE_PREZZO),
    coefficiente: asNum(row.coefficiente),
    coverage: coverageLabel(row.coverage),
    sconti,
  };
}

export function placetOfferDettaglio(row: PlacetDettaglioRow): OfferteHitDettaglio {
  return {
    descrizione: null,
    garanzie: null,
    telefono: cleanText(row.telefono),
    attivazione: decodeList(row.modalita_attivazione, ATTIVAZIONE),
    pagamento: decodeList(row.modalita_pagamento, PAGAMENTO),
    tipologiaContratto: [],
    residente: null,
    offertaSingola: null,
    onnicomprensiva: null,
    consumoMin: null,
    consumoMax: null,
    potenzaMin: null,
    potenzaMax: null,
    indicePrezzo: null,
    coefficiente: null,
    coverage: coverageLabel(row.coverage),
    sconti: [],
  };
}

export function formatScontoValore(valore: number | string | null, unita: string | null) {
  const amount = asNum(valore);
  if (amount == null) return null;
  const unit = unita ? UNITA_SCONTO[unita.padStart(2, "0")] ?? null : null;
  const formatted = new Intl.NumberFormat("it-IT", {
    maximumFractionDigits: amount >= 1 ? 2 : 4,
  }).format(amount);
  return unit ? `${formatted} ${unit}` : formatted;
}

function decodeTipologiaContratto(value: string[] | string | null | undefined) {
  const codes = splitCodes(value).map((raw) => {
    const key = raw.replace(/\s+/g, "");
    return /^\d+$/.test(key) ? key.padStart(2, "0") : key;
  });
  if (codes.includes("99")) return ["Qualsiasi attivazione"];
  return decodeList(value, TIPOLOGIA_CONTRATTO);
}

function decodeList(value: string[] | string | null | undefined, dict: Record<string, string>) {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of splitCodes(value)) {
    const key = raw.replace(/\s+/g, "");
    const padded = /^\d+$/.test(key) ? key.padStart(2, "0") : key;
    const label = dict[padded] ?? dict[key] ?? (/^\d{1,2}$/.test(padded) ? null : raw);
    if (!label || seen.has(label)) continue;
    seen.add(label);
    out.push(label);
  }
  return out;
}

function splitCodes(value: string[] | string | null | undefined) {
  if (value == null) return [] as string[];
  const parts = Array.isArray(value) ? value : value.split(/[;,]/);
  return parts.map((part) => part.trim()).filter(Boolean);
}

function labelOf(value: string | null | undefined, dict: Record<string, string>) {
  if (!value) return null;
  const key = value.trim();
  const padded = /^\d+$/.test(key) ? key.padStart(2, "0") : key;
  return dict[padded] ?? dict[key] ?? null;
}

function yesNo(value: string | null | undefined) {
  const raw = value?.trim().toUpperCase();
  if (raw === "SI" || raw === "SÌ" || raw === "01") return true;
  if (raw === "NO" || raw === "02") return false;
  return null;
}

function coverageLabel(value: string | null | undefined) {
  if (value === "nazionale") return "Tutta Italia";
  if (value === "selettiva") return "Solo alcuni territori";
  return cleanText(value ?? null);
}

function cleanGaranzie(value: string | null | undefined) {
  const text = cleanText(value);
  if (!text) return null;
  if (/^(no|nessuna|nessuno|nessun[ao]?\s+garanzia)\.?$/i.test(text)) return null;
  return text;
}

function cleanText(value: string | null | undefined) {
  const text = value?.replace(/\s+/g, " ").trim() ?? "";
  return text.length > 0 ? text : null;
}

function asNum(value: number | string | null | undefined) {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(String(value).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}
