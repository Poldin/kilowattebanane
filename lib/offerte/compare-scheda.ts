import { indicePrezzoLabel, formatScontoValore } from "@/lib/offerte/portal-labels";
import { formatPotenzaKw } from "@/lib/offerte/potenza";
import type { OfferteHitDettaglio } from "@/lib/offerte/public-types";

export type CompareEnergyBand = {
  label: string | null;
  eurKwh: number;
};

export type CompareScontoView = {
  nome: string;
  valore: string | null;
  meta: string | null;
  nota: string | null;
};

export type CompareScheda = {
  descrizione: string | null;
  variabile: boolean;
  indice: string | null;
  coefficiente: number | null;
  quotaFissaEurAnno: number | null;
  quotaPotenzaEurKw: number | null;
  unaTantumEur: number | null;
  energia: CompareEnergyBand[];
  verde: string | null;
  dispacciamento: string;
  sconti: CompareScontoView[];
  cliente: string | null;
  residente: string | null;
  consumo: string | null;
  potenza: string | null;
  copertura: string;
  soloAbbinamento: boolean;
  onnicomprensiva: string | null;
  pluriennale: string | null;
  onereRecesso: string | null;
  garanzie: string | null;
};

type ComponentRow = {
  nome: string | null;
  tipologia: string | null;
  macroarea: string | null;
  fascia: string | null;
  prezzo: number | string | null;
  unita_misura: string | null;
};

type DispRow = {
  tipo: string | null;
  valore: number | string | null;
};

type ScontoRow = {
  nome: string | null;
  descrizione: string | null;
  valore: number | string | null;
  unita_misura: string | null;
  tipologia_prezzo: string | null;
  validita: string | null;
  condizione_applicazione: string | null;
  descrizione_condizione: string | null;
};

type PriceRow = {
  p_fix_f: number | string | null;
  p_fix_v: number | string | null;
  p_vol_f1: number | string | null;
  p_vol_f2: number | string | null;
  p_vol_f3: number | string | null;
  p_vol_bf1: number | string | null;
  p_vol_bf23: number | string | null;
  p_vol_mono: number | string | null;
  alpha: number | string | null;
};

const SHORT_INDEX: Record<string, string> = {
  "01": "PUN trimestrale",
  "08": "PUN bimestrale",
  "12": "PUN mensile",
};

const FASCIA_LABEL: Record<string, string> = {
  "01": "F1",
  "02": "F2",
  "03": "F3",
  "07": "Peak",
  "08": "Off-peak",
  "91": "F2+F3",
  "92": "F1+F3",
  "93": "F1+F2",
};

const FASCIA_ORDER = ["01", "02", "03", "91", "92", "93", "07", "08"];

const SU_COSA: Record<string, string> = {
  "01": "sul canone",
  "02": "sulla potenza",
  "03": "sull’energia",
  "04": "sulla tutela",
};

const QUANDO: Record<string, string> = {
  "01": "all’ingresso",
  "02": "entro 12 mesi",
  "03": "oltre 12 mesi",
};

const CONDIZIONE_CORTA: Record<string, string> = {
  "00": "sempre",
  "01": "fattura elettronica",
  "02": "bolletta web",
  "03": "fattura elettronica e addebito",
};

export function buildMlScheda(input: {
  tipoOfferta: string;
  tipoCliente: string | null;
  coefficiente: number | string | null;
  idxPrezzo: string | null;
  dettaglio: OfferteHitDettaglio;
  copertura: string;
  pluriennale: string | null;
  components: ComponentRow[];
  dispacciamento: DispRow[];
  sconti: ScontoRow[];
}): CompareScheda {
  const variabile = input.tipoOfferta.includes("variabile");
  const greens = input.components.filter(isGreen);
  const energySource = input.components.filter((row) => !isGreen(row));
  let energia = energyBands(energySource, variabile);
  const promoted = energia.length === 0 && greens.some((row) => pad(row.unita_misura) === "03");
  if (promoted) energia = energyBands(greens, variabile, true);

  return {
    ...identity(input.dettaglio, input.tipoCliente, input.copertura),
    variabile,
    indice: variabile ? indexLabel(input.idxPrezzo) : null,
    coefficiente: variabile ? num(input.coefficiente) : null,
    quotaFissaEurAnno: sumWhere(
      input.components,
      (row) => pad(row.unita_misura) === "01" && pad(row.macroarea) === "01",
    ),
    quotaPotenzaEurKw: sumWhere(
      input.components,
      (row) => pad(row.unita_misura) === "02" && pad(row.macroarea) === "01",
    ),
    unaTantumEur: sumWhere(input.components, (row) => {
      const unit = pad(row.unita_misura);
      const area = pad(row.macroarea);
      return unit === "05" || (area === "05" && unit === "01");
    }),
    energia,
    verde: verdeLabel(greens, promoted),
    dispacciamento: dispacciamentoLabel(input.dispacciamento),
    sconti: scontoViews(input.sconti),
    pluriennale: clean(input.pluriennale),
  };
}

export function buildPlacetScheda(input: {
  tipoOfferta: string;
  tipoCliente: string | null;
  dettaglio: OfferteHitDettaglio;
  copertura: string;
  prices: PriceRow;
}): CompareScheda {
  const variabile = input.tipoOfferta.includes("variabile");
  const quota = num(variabile ? input.prices.p_fix_v : input.prices.p_fix_f);
  return {
    ...identity(input.dettaglio, input.tipoCliente, input.copertura),
    variabile,
    indice: variabile ? "PUN mensile" : null,
    coefficiente: null,
    quotaFissaEurAnno: quota != null && quota > 0 ? quota : null,
    quotaPotenzaEurKw: null,
    unaTantumEur: null,
    energia: placetBands(input.prices, variabile),
    verde: null,
    dispacciamento: "Regolato",
    sconti: [],
    pluriennale: null,
  };
}

function identity(dettaglio: OfferteHitDettaglio, tipoCliente: string | null, copertura: string) {
  return {
    descrizione: dettaglio.descrizione,
    cliente: clienteLabel(tipoCliente),
    residente: dettaglio.residente,
    consumo: boundLabel(dettaglio.consumoMin, dettaglio.consumoMax, "kWh/anno"),
    potenza: boundLabel(dettaglio.potenzaMin, dettaglio.potenzaMax, "kW", formatPotenzaKw),
    copertura,
    soloAbbinamento: dettaglio.offertaSingola === false,
    onnicomprensiva: dettaglio.onnicomprensiva,
    onereRecesso: dettaglio.onereRecesso,
    garanzie: dettaglio.garanzie,
  };
}

function energyBands(rows: ComponentRow[], variabile: boolean, anyArea = false): CompareEnergyBand[] {
  const byFascia = new Map<string, number>();
  for (const row of rows) {
    if (pad(row.unita_misura) !== "03") continue;
    const area = pad(row.macroarea);
    if (!anyArea && area !== "02" && area !== "04" && area != null) continue;
    const prezzo = perKwh(num(row.prezzo));
    if (prezzo == null) continue;
    if (!variabile && Math.abs(prezzo) < 1e-9) continue;
    const code = pad(row.fascia) ?? "01";
    byFascia.set(code, (byFascia.get(code) ?? 0) + prezzo);
  }
  const entries = [...byFascia.entries()].sort(
    (a, b) => fasciaRank(a[0]) - fasciaRank(b[0]),
  );
  if (entries.length === 0) return [];
  if (entries.length > 1 && allApproxEqual(entries.map((entry) => entry[1]))) {
    return [{ label: null, eurKwh: entries[0]![1] }];
  }
  return entries.map(([code, eurKwh]) => ({
    label: entries.length === 1 && code === "01" ? null : (FASCIA_LABEL[code] ?? null),
    eurKwh,
  }));
}

function placetBands(prices: PriceRow, variabile: boolean): CompareEnergyBand[] {
  if (variabile) {
    const alpha = num(prices.alpha) ?? 0;
    return [{ label: null, eurKwh: alpha }];
  }
  const f1 = positive(prices.p_vol_f1);
  const f2 = positive(prices.p_vol_f2);
  const f3 = positive(prices.p_vol_f3);
  if (f1 != null && f2 != null && f3 != null) {
    if (approx(f1, f2) && approx(f2, f3)) return [{ label: null, eurKwh: f1 }];
    if (approx(f2, f3)) {
      return [
        { label: "F1", eurKwh: f1 },
        { label: "F2+F3", eurKwh: f2 },
      ];
    }
    return [
      { label: "F1", eurKwh: f1 },
      { label: "F2", eurKwh: f2 },
      { label: "F3", eurKwh: f3 },
    ];
  }
  const bf1 = positive(prices.p_vol_bf1);
  const bf23 = positive(prices.p_vol_bf23);
  if (bf1 != null && bf23 != null) {
    if (approx(bf1, bf23)) return [{ label: null, eurKwh: bf1 }];
    return [
      { label: "F1", eurKwh: bf1 },
      { label: "F2+F3", eurKwh: bf23 },
    ];
  }
  const mono = positive(prices.p_vol_mono);
  return mono == null ? [] : [{ label: null, eurKwh: mono }];
}

function verdeLabel(rows: ComponentRow[], promoted: boolean) {
  if (rows.length === 0) return null;
  const optional = rows.some((row) => pad(row.tipologia) === "02");
  const head = optional ? "Opzionale" : "Inclusa";
  if (promoted) return head;
  const bits = [head];
  const kwh = rows
    .filter((row) => pad(row.unita_misura) === "03")
    .map((row) => perKwh(num(row.prezzo)))
    .filter((value): value is number => value != null && Math.abs(value) > 1e-9);
  const year = sumWhere(rows, (row) => pad(row.unita_misura) === "01");
  if (kwh.length > 0) bits.push(centsRange(kwh));
  if (year != null) bits.push(`${formatAmount(year)} €/anno`);
  return bits.join(", ");
}

function dispacciamentoLabel(rows: DispRow[]) {
  let custom = 0;
  let hasCustom = false;
  let hasRegulated = false;
  for (const row of rows) {
    const tipo = pad(row.tipo);
    if (tipo === "99") {
      hasCustom = true;
      const value = perKwh(num(row.valore));
      if (value != null) custom += value;
    } else if (tipo) {
      hasRegulated = true;
    }
  }
  if (!hasCustom || Math.abs(custom) < 1e-9) return "Regolato";
  const cents = `${formatAmount(custom * 100)} c€/kWh`;
  if (hasRegulated) return `Regolato, più ${cents} del venditore`;
  return `${cents}, indicato dal venditore`;
}

function scontoViews(rows: ScontoRow[]): CompareScontoView[] {
  const grouped = new Map<
    string,
    { nome: string; valori: string[]; meta: string | null; nota: string | null }
  >();
  const order: string[] = [];
  for (const row of rows) {
    const nome = clean(row.nome) || "Sconto";
    const key = [
      nome.toLowerCase(),
      pad(row.validita) ?? "",
      pad(row.condizione_applicazione) ?? "",
      clean(row.descrizione_condizione) ?? "",
    ].join("|");
    const valore = formatScontoValore(row.valore, row.unita_misura);
    const existing = grouped.get(key);
    if (existing) {
      if (valore && !existing.valori.includes(valore)) existing.valori.push(valore);
      continue;
    }
    const { meta, nota } = scontoNote(row, nome);
    grouped.set(key, { nome, valori: valore ? [valore] : [], meta, nota });
    order.push(key);
  }
  return order.map((key) => {
    const row = grouped.get(key)!;
    return {
      nome: row.nome,
      valore: row.valori.length > 0 ? row.valori.join(" · ") : null,
      meta: row.meta,
      nota: row.nota,
    };
  });
}

function scontoNote(row: ScontoRow, nome: string) {
  const code = pad(row.condizione_applicazione);
  const scritta = clean(row.descrizione_condizione);
  const corta = code ? (CONDIZIONE_CORTA[code] ?? null) : null;
  const lunga = scritta && scritta.length > 48 ? scritta : null;
  const condizione = lunga ? null : (scritta ?? corta);
  const parts = [
    SU_COSA[pad(row.tipologia_prezzo) ?? ""],
    QUANDO[pad(row.validita) ?? ""],
    condizione,
  ].filter((part): part is string => Boolean(part));
  const descrizione = clean(row.descrizione);
  const nota =
    lunga ?? (descrizione && descrizione.toLowerCase() !== nome.toLowerCase() ? descrizione : null);
  return {
    meta: parts.length > 0 ? parts.join(" · ") : null,
    nota,
  };
}

function indexLabel(code: string | null) {
  const padded = pad(code);
  if (!padded) return null;
  return SHORT_INDEX[padded] ?? indicePrezzoLabel(padded);
}

function clienteLabel(tipo: string | null) {
  if (tipo === "domestico") return "Casa";
  if (tipo === "non domestico") return "Partita IVA";
  if (tipo === "condominio") return "Condominio";
  return clean(tipo);
}

function boundLabel(
  min: number | null,
  max: number | null,
  unit: string,
  format: (value: number) => string = (value) => formatAmount(value),
) {
  if (min != null && min > 0 && max != null && max > 0) return `${format(min)}–${format(max)} ${unit}`;
  if (min != null && min > 0) return `da ${format(min)} ${unit}`;
  if (max != null && max > 0) return `fino a ${format(max)} ${unit}`;
  return null;
}

function sumWhere(rows: ComponentRow[], match: (row: ComponentRow) => boolean) {
  let total = 0;
  let any = false;
  for (const row of rows) {
    if (!match(row)) continue;
    const prezzo = num(row.prezzo);
    if (prezzo == null || prezzo === 0) continue;
    total += prezzo;
    any = true;
  }
  return any ? total : null;
}

function centsRange(values: number[]) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const lo = `${formatAmount(min * 100)} c€/kWh`;
  if (approx(min, max)) return lo;
  return `${lo}–${formatAmount(max * 100)} c€/kWh`;
}

function isGreen(row: ComponentRow) {
  if (pad(row.macroarea) === "06") return true;
  return /verde|rinnovab|cgo|prezzo_ev|\bfer\b|gdo/i.test(row.nome ?? "");
}

function positive(value: number | string | null) {
  const parsed = num(value);
  if (parsed == null || parsed <= 0) return null;
  return parsed;
}

function perKwh(prezzo: number | null) {
  if (prezzo == null) return null;
  return prezzo > 2 ? prezzo / 1000 : prezzo;
}

function fasciaRank(code: string) {
  const index = FASCIA_ORDER.indexOf(code);
  return index === -1 ? FASCIA_ORDER.length : index;
}

function allApproxEqual(values: number[]) {
  return values.every((value) => approx(value, values[0]!));
}

function approx(a: number, b: number) {
  return Math.abs(a - b) < 1e-6;
}

function pad(value: string | null | undefined) {
  const raw = value?.trim();
  if (!raw) return null;
  return /^\d+$/.test(raw) ? raw.padStart(2, "0") : raw;
}

function num(value: number | string | null | undefined) {
  if (value == null || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function clean(value: string | null | undefined) {
  const text = value?.replace(/\s+/g, " ").trim() ?? "";
  return text.length > 0 ? text : null;
}

function formatAmount(value: number) {
  return new Intl.NumberFormat("it-IT", {
    maximumFractionDigits: Math.abs(value) >= 10 ? 1 : 2,
  }).format(value);
}
