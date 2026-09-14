import { unstable_cache } from "next/cache";
import { areraPrezzoOrarioKind, resolveOffertePlan } from "@/lib/offerte/codice";
import { offerteReadClient, paginateSelect } from "@/lib/offerte/db";
import { romeToday } from "@/lib/offerte/dates";
import { mlFacts, placetFacts, type OfferteFasciaPlan } from "@/lib/offerte/metrics";
import { OFFERTE_CACHE_REVALIDATE, OFFERTE_CACHE_TAG } from "@/lib/offerte/revalidate";
import { POTENZA_STANDARD_CASA_KW } from "@/lib/offerte/potenza";
import { formatScontoValore } from "@/lib/offerte/portal-labels";
import type {
  OfferteClusterBucket,
  OfferteClusterStats,
  OfferteFasciaBucket,
  OfferteHeadlineStats,
  OfferteScontoApplicazione,
  OfferteScontoBoard,
  OfferteScontoFascia,
  OfferteScontoPrezzo,
  OfferteScontoRank,
  OfferteScontoStats,
  OfferteVendorRank,
  OfferteVendorStats,
} from "@/lib/offerte/public-types";
import { buildParetoStats, type ParetoPointInput, type ParetoScontoRow } from "@/lib/offerte/pareto";
import type { MlComponentInput } from "@/lib/offerte/estimate";

const SCONTO_RANK_CONSUMO_KWH = 2700;
const SCONTO_RANK_TOP = 5;

export type { OfferteClusterStats, OfferteHeadlineStats } from "@/lib/offerte/public-types";

type HeadlineRow = {
  p_iva: string | null;
  tipo_offerta: string | null;
  last_seen_on: string | null;
};

type PlacetClusterRow = HeadlineRow & {
  tipo_cliente: string | null;
  coverage: string | null;
  denominazione: string | null;
  nome_offerta: string | null;
  url_sito_venditore: string | null;
  url_offerta: string | null;
  cod_offerta: string;
  p_fix_f: number | null;
  p_fix_v: number | null;
  p_vol_f1: number | null;
  p_vol_f2: number | null;
  p_vol_f3: number | null;
  p_vol_bf1: number | null;
  p_vol_bf23: number | null;
  p_vol_mono: number | null;
  alpha: number | null;
};

type MlClusterRow = HeadlineRow & {
  id: number;
  tipo_cliente: string | null;
  coverage: string | null;
  nome_offerta: string | null;
  url_sito_venditore: string | null;
  url_offerta: string | null;
  cod_offerta: string;
  tipologia_fasce: string | null;
};

type MlCompRow = MlComponentInput & { offer_id: number };

type MlScontoStatRow = {
  offer_id: number;
  nome: string | null;
  descrizione: string | null;
  tipologia_prezzo: string | null;
  validita: string | null;
  valore: number | string | null;
  unita_misura: string | null;
  condizione_applicazione: string | null;
  descrizione_condizione: string | null;
};

type ClusterRow = {
  source: "placet" | "ml";
  p_iva: string | null;
  last_seen_on: string | null;
  denominazione: string | null;
  url: string | null;
  cliente: string;
  prezzo: string;
  coverage: string;
  fascia: string;
};

export const loadOfferteHeadlineStats = unstable_cache(
  async (): Promise<OfferteHeadlineStats> => {
    const rows = await loadLiveHeadlineRows();
    return headlineFromRows(rows, romeToday());
  },
  ["offerte-headline-stats"],
  { revalidate: OFFERTE_CACHE_REVALIDATE, tags: [OFFERTE_CACHE_TAG] },
);

export const loadOfferteClusterStats = unstable_cache(
  async (): Promise<OfferteClusterStats> => {
    const today = romeToday();
    const [placetRows, mlRows] = await Promise.all([
      paginateSelect<PlacetClusterRow>((from, to) =>
        offerteReadClient()
          .from("po_placet_e_live")
          .select(
            "p_iva, tipo_offerta, tipo_cliente, coverage, denominazione, nome_offerta, url_sito_venditore, url_offerta, last_seen_on, cod_offerta, p_fix_f, p_fix_v, p_vol_f1, p_vol_f2, p_vol_f3, p_vol_bf1, p_vol_bf23, p_vol_mono, alpha",
          )
          .lte("valid_from", today)
          .gte("valid_to", today)
          .range(from, to),
      ),
      paginateSelect<MlClusterRow>((from, to) =>
        offerteReadClient()
          .from("po_ml_e_live")
          .select(
            "id, p_iva, tipo_offerta, tipo_cliente, coverage, nome_offerta, url_sito_venditore, url_offerta, last_seen_on, cod_offerta, tipologia_fasce",
          )
          .lte("valid_from", today)
          .gte("valid_to", today)
          .range(from, to),
      ),
    ]);

    const rows: ClusterRow[] = [
      ...placetRows.map((row) => ({
        source: "placet" as const,
        p_iva: row.p_iva,
        last_seen_on: row.last_seen_on,
        denominazione: row.denominazione,
        url: row.url_sito_venditore,
        cliente: clienteKey(row.tipo_cliente),
        prezzo: prezzoKey(row.tipo_offerta),
        coverage: coverageKey(row.coverage),
        fascia: fasciaKey({
          source: "placet",
          tipoOfferta: row.tipo_offerta ?? "",
          codOfferta: row.cod_offerta,
          plan: placetFacts(row).plan,
        }),
      })),
      ...mlRows.map((row) => ({
        source: "ml" as const,
        p_iva: row.p_iva,
        last_seen_on: row.last_seen_on,
        denominazione: null,
        url: row.url_sito_venditore,
        cliente: clienteKey(row.tipo_cliente),
        prezzo: prezzoKey(row.tipo_offerta),
        coverage: coverageKey(row.coverage),
        fascia: fasciaKey({
          source: "ml",
          tipoOfferta: row.tipo_offerta ?? "",
          codOfferta: row.cod_offerta,
          plan: mlBandPlan(row.tipologia_fasce, row.cod_offerta),
        }),
      })),
    ];

    const headline = headlineFromRows(rows, today);
    const scontoRows = await loadLiveSconti(mlRows.map((row) => row.id));
    const sconti = scontoStats(mlRows, scontoRows);
    const componenti = await loadLiveComponenti(mlRows.map((row) => row.id));
    const pareto = buildParetoStats(
      paretoInputs(placetRows, mlRows, componenti, scontoRows),
    );

    return {
      ...headline,
      sconti,
      pareto,
      cliente: buckets(
        rows,
        (row) => row.cliente,
        [
          ["domestico", "Casa"],
          ["non domestico", "Partita IVA"],
          ["condominio", "Condominio"],
          ["altro", "Altro"],
        ],
      ),
      prezzo: buckets(
        rows,
        (row) => row.prezzo,
        [
          ["fisso", "Fisso"],
          ["variabile", "Variabile"],
          ["altro", "Altro"],
        ],
      ),
      mercato: buckets(
        rows,
        (row) => row.source,
        [
          ["placet", "PLACET"],
          ["ml", "Mercato libero"],
        ],
      ),
      copertura: buckets(
        rows,
        (row) => row.coverage,
        [
          ["nazionale", "Tutta Italia"],
          ["selettiva", "Solo alcuni territori"],
          ["altro", "Altro"],
        ],
      ),
      fascia: fasciaBuckets(rows),
      fornitori: vendorStats(rows),
    };
  },
  ["offerte-cluster-stats-v12"],
  { revalidate: OFFERTE_CACHE_REVALIDATE, tags: [OFFERTE_CACHE_TAG] },
);

async function loadLiveHeadlineRows() {
  const client = offerteReadClient();
  const today = romeToday();
  const [placetRows, mlRows] = await Promise.all([
    paginateSelect<HeadlineRow>((from, to) =>
      client
        .from("po_placet_e_live")
        .select("p_iva, tipo_offerta, last_seen_on")
        .lte("valid_from", today)
        .gte("valid_to", today)
        .range(from, to),
    ),
    paginateSelect<HeadlineRow>((from, to) =>
      client
        .from("po_ml_e_live")
        .select("p_iva, tipo_offerta, last_seen_on")
        .lte("valid_from", today)
        .gte("valid_to", today)
        .range(from, to),
    ),
  ]);
  return [
    ...placetRows.map((row) => ({ ...row, source: "placet" as const })),
    ...mlRows.map((row) => ({ ...row, source: "ml" as const })),
  ];
}

function headlineFromRows(
  rows: Array<{
    source: "placet" | "ml";
    p_iva: string | null;
    tipo_offerta?: string | null;
    prezzo?: string;
    last_seen_on: string | null;
  }>,
  today: string,
): OfferteHeadlineStats {
  const vendors = new Set(
    rows.map((row) => row.p_iva).filter((value): value is string => Boolean(value)),
  );
  const snapshotDate =
    rows.reduce<string | null>((latest, row) => {
      if (!row.last_seen_on) return latest;
      if (!latest || row.last_seen_on > latest) return row.last_seen_on;
      return latest;
    }, null) ?? today;

  return {
    snapshotDate,
    placet: rows.filter((row) => row.source === "placet").length,
    ml: rows.filter((row) => row.source === "ml").length,
    total: rows.length,
    venditori: vendors.size,
    fisso: rows.filter((row) =>
      row.prezzo ? row.prezzo === "fisso" : (row.tipo_offerta ?? "").includes("fisso"),
    ).length,
    variabile: rows.filter((row) =>
      row.prezzo
        ? row.prezzo === "variabile"
        : (row.tipo_offerta ?? "").includes("variabile"),
    ).length,
  };
}

function fasciaBuckets(rows: ClusterRow[]): OfferteFasciaBucket[] {
  return (
    [
      ["monoraria", "Monoraria"],
      ["bioraria", "Bioraria"],
      ["fasce", "A fasce"],
      ["dinamica", "Dinamica"],
      ["altro", "Non classificata"],
    ] as const
  )
    .map(([key, label]) => {
      const subset = rows.filter((row) => row.fascia === key);
      const fisso = subset.filter((row) => row.prezzo === "fisso").length;
      const variabile = subset.filter((row) => row.prezzo === "variabile").length;
      return {
        key,
        label,
        count: subset.length,
        fisso: key === "dinamica" ? null : fisso,
        variabile,
      };
    })
    .filter((bucket) => bucket.count > 0);
}

function buckets(
  rows: ClusterRow[],
  pick: (row: ClusterRow) => string,
  order: [string, string][],
): OfferteClusterBucket[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = pick(row);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return order
    .map(([key, label]) => ({ key, label, count: counts.get(key) ?? 0 }))
    .filter((bucket) => bucket.count > 0);
}

async function loadLiveSconti(offerIds: number[]) {
  const rows: MlScontoStatRow[] = [];
  if (offerIds.length === 0) return rows;
  const client = offerteReadClient();
  for (let i = 0; i < offerIds.length; i += 200) {
    const slice = offerIds.slice(i, i + 200);
    const page = await paginateSelect<MlScontoStatRow>((from, to) =>
      client
        .from("po_ml_e_sconti")
        .select(
          "offer_id, nome, descrizione, tipologia_prezzo, validita, valore, unita_misura, condizione_applicazione, descrizione_condizione",
        )
        .in("offer_id", slice)
        .range(from, to),
    );
    rows.push(...page);
  }
  return rows;
}

async function loadLiveComponenti(offerIds: number[]) {
  const rows: MlCompRow[] = [];
  if (offerIds.length === 0) return rows;
  const client = offerteReadClient();
  for (let i = 0; i < offerIds.length; i += 200) {
    const slice = offerIds.slice(i, i + 200);
    const page = await paginateSelect<MlCompRow>((from, to) =>
      client
        .from("po_ml_e_componenti")
        .select("offer_id, macroarea, unita_misura, fascia, prezzo, nome")
        .in("offer_id", slice)
        .range(from, to),
    );
    rows.push(...page);
  }
  return rows;
}

function paretoInputs(
  placetRows: PlacetClusterRow[],
  mlRows: MlClusterRow[],
  componenti: MlCompRow[],
  sconti: MlScontoStatRow[],
): ParetoPointInput[] {
  const componentsByOffer = new Map<number, MlCompRow[]>();
  for (const row of componenti) {
    const list = componentsByOffer.get(row.offer_id) ?? [];
    list.push(row);
    componentsByOffer.set(row.offer_id, list);
  }
  const scontiByOffer = new Map<number, ParetoScontoRow[]>();
  for (const row of sconti) {
    const list = scontiByOffer.get(row.offer_id) ?? [];
    list.push(row);
    scontiByOffer.set(row.offer_id, list);
  }

  const points: ParetoPointInput[] = [];

  for (const row of placetRows) {
    const cliente = clienteKey(row.tipo_cliente);
    const prezzo = prezzoKey(row.tipo_offerta);
    if (cliente !== "domestico" && cliente !== "non domestico") continue;
    if (prezzo !== "fisso" && prezzo !== "variabile") continue;
    const facts = placetFacts(row);
    const monthlyEur = facts.monthlyEur;
    const energyEurKwh = facts.spreadMeanEurKwh ?? facts.spreadEurKwh;
    if (monthlyEur == null || energyEurKwh == null) continue;
    const planKey = fasciaKey({
      source: "placet",
      tipoOfferta: row.tipo_offerta ?? "",
      codOfferta: row.cod_offerta,
      plan: facts.plan,
    });
    points.push({
      key: `placet:${row.cod_offerta}`,
      source: "placet",
      nome: row.nome_offerta?.replace(/\s+/g, " ").trim() || "Offerta PLACET",
      venditore: row.denominazione?.replace(/\s+/g, " ").trim() || vendorFromUrl(row.url_sito_venditore, row.p_iva) || "Venditore",
      urlVenditore: absoluteVendorUrl(row.url_sito_venditore),
      urlOfferta: absoluteVendorUrl(row.url_offerta),
      cliente,
      prezzo,
      coverage: coverageKey(row.coverage),
      plan: planKey === "altro" ? null : (planKey as NonNullable<ParetoPointInput["plan"]>),
      monthlyEur,
      energyEurKwh,
    });
  }

  for (const row of mlRows) {
    const cliente = clienteKey(row.tipo_cliente);
    const prezzo = prezzoKey(row.tipo_offerta);
    if (cliente !== "domestico" && cliente !== "non domestico") continue;
    if (prezzo !== "fisso" && prezzo !== "variabile") continue;
    const facts = mlFacts({
      tipo_offerta: row.tipo_offerta,
      tipologia_fasce: row.tipologia_fasce,
      components: componentsByOffer.get(row.id) ?? [],
    });
    const monthlyEur = facts.monthlyEur;
    const energyEurKwh = facts.spreadMeanEurKwh ?? facts.spreadEurKwh;
    if (monthlyEur == null || energyEurKwh == null) continue;
    const planKey = fasciaKey({
      source: "ml",
      tipoOfferta: row.tipo_offerta ?? "",
      codOfferta: row.cod_offerta,
      plan: facts.plan,
    });
    points.push({
      key: `ml:${row.cod_offerta}`,
      source: "ml",
      nome: row.nome_offerta?.replace(/\s+/g, " ").trim() || "Offerta mercato libero",
      venditore: vendorFromUrl(row.url_sito_venditore, row.p_iva) || "Venditore",
      urlVenditore: absoluteVendorUrl(row.url_sito_venditore),
      urlOfferta: absoluteVendorUrl(row.url_offerta),
      cliente,
      prezzo,
      coverage: coverageKey(row.coverage),
      plan: planKey === "altro" ? null : (planKey as NonNullable<ParetoPointInput["plan"]>),
      monthlyEur,
      energyEurKwh,
      sconti: scontiByOffer.get(row.id),
    });
  }

  return points;
}

function scontoStats(mlRows: MlClusterRow[], sconti: MlScontoStatRow[]): OfferteScontoStats {
  const liveIds = new Set(mlRows.map((row) => row.id));
  const live = sconti.filter((row) => liveIds.has(row.offer_id));
  const byOffer = new Map<number, MlScontoStatRow[]>();
  for (const row of live) {
    const list = byOffer.get(row.offer_id) ?? [];
    list.push(row);
    byOffer.set(row.offer_id, list);
  }

  let sempre = 0;
  let condizionato = 0;
  let applicazioneAltro = 0;
  for (const rows of byOffer.values()) {
    const codes = rows.map((row) => padCode(row.condizione_applicazione));
    if (codes.some((code) => code === "00")) sempre += 1;
    else if (codes.some((code) => code != null)) condizionato += 1;
    else applicazioneAltro += 1;
  }

  return {
    offerteMl: mlRows.length,
    offerteConSconto: byOffer.size,
    righe: live.length,
    applicazione: namedBuckets(
      [
        ["sempre", "Sempre", sempre],
        ["condizionato", "Condizionato", condizionato],
        ["altro", "Non classificato", applicazioneAltro],
      ],
    ),
    quando: namedBuckets(
      (
        [
          ["ingresso", "All’ingresso", "01"],
          ["anno", "Entro 12 mesi", "02"],
          ["oltre", "Oltre 12 mesi", "03"],
        ] as const
      ).map(([key, label, code]) => [
        key,
        label,
        live.filter((row) => padCode(row.validita) === code).length,
      ]),
    ),
    tipologia: namedBuckets(
      (
        [
          ["canone", "Canone fisso", "01"],
          ["vendita", "Sull’energia", "03"],
          ["tutela", "Sulla tutela", "04"],
          ["potenza", "Sulla potenza", "02"],
        ] as const
      ).map(([key, label, code]) => [
        key,
        label,
        live.filter((row) => padCode(row.tipologia_prezzo) === code).length,
      ]),
    ),
    medianaFissoEurAnno: medianOrNull(
      live
        .filter(
          (row) =>
            padCode(row.condizione_applicazione) === "00" &&
            padCode(row.unita_misura) === "01",
        )
        .map((row) => asPositive(row.valore))
        .filter((value): value is number => value != null),
    ),
    medianaVenditaEurKwh: medianOrNull(
      live
        .filter(
          (row) =>
            padCode(row.tipologia_prezzo) === "03" &&
            padCode(row.unita_misura) === "03",
        )
        .map((row) => asPositive(row.valore))
        .filter((value): value is number => value != null),
    ),
    rankingConsumoKwh: SCONTO_RANK_CONSUMO_KWH,
    rankingPotenzaKw: POTENZA_STANDARD_CASA_KW,
    boards: scontoBoards(mlRows, live),
  };
}

function scontoBoards(mlRows: MlClusterRow[], sconti: MlScontoStatRow[]): OfferteScontoBoard[] {
  const offerById = new Map(
    mlRows.map((row) => [
      row.id,
      {
        fascia: fasciaKey({
          source: "ml",
          tipoOfferta: row.tipo_offerta ?? "",
          codOfferta: row.cod_offerta,
          plan: mlBandPlan(row.tipologia_fasce, row.cod_offerta),
        }),
        prezzo: prezzoKey(row.tipo_offerta),
        p_iva: row.p_iva,
        url: row.url_sito_venditore,
      },
    ]),
  );

  const modes: Array<[OfferteScontoFascia, OfferteScontoPrezzo]> = [
    ["monoraria", "fisso"],
    ["monoraria", "variabile"],
    ["bioraria", "fisso"],
    ["bioraria", "variabile"],
    ["fasce", "fisso"],
    ["fasce", "variabile"],
    ["dinamica", "variabile"],
  ];

  return modes.map(([fascia, prezzo]) => ({
    fascia,
    prezzo,
    top: topScontiFor(sconti, offerById, fascia, prezzo),
  }));
}

function topScontiFor(
  sconti: MlScontoStatRow[],
  offerById: Map<
    number,
    { fascia: string; prezzo: string; p_iva: string | null; url: string | null }
  >,
  fascia: OfferteScontoFascia,
  prezzo: OfferteScontoPrezzo,
): OfferteScontoRank[] {
  const grouped = new Map<
    string,
    {
      nome: string;
      valoreLabel: string;
      annualEur: number;
      applicazione: OfferteScontoApplicazione;
      condizione: string | null;
      quando: string | null;
      suCosa: string | null;
      nota: string | null;
      venditore: string | null;
      offerte: Set<number>;
    }
  >();

  for (const row of sconti) {
    const offer = offerById.get(row.offer_id);
    if (!offer || offer.fascia !== fascia || offer.prezzo !== prezzo) continue;
    if (padCode(row.validita) === "03") continue;
    const nome = row.nome?.replace(/\s+/g, " ").trim() || "Sconto";
    const text = `${nome} ${row.descrizione ?? ""} ${row.descrizione_condizione ?? ""}`;
    if (isReferralSconto(text) || isHighPowerOnlySconto(text)) continue;
    const valued = annualizeSconto(row, text);
    if (valued == null) continue;
    const applicazione = applicazioneKey(row.condizione_applicazione);
    const valoreLabel =
      formatScontoValore(row.valore, row.unita_misura) ?? `${valued.annualEur}`;
    const venditore = vendorFromUrl(offer.url, offer.p_iva);
    const key = [
      offer.p_iva ?? venditore ?? "x",
      nome.toLowerCase(),
      valoreLabel,
      applicazione,
    ].join("|");
    const acc = grouped.get(key);
    if (acc) {
      acc.offerte.add(row.offer_id);
      continue;
    }
    grouped.set(key, {
      nome,
      valoreLabel,
      annualEur: valued.annualEur,
      applicazione,
      condizione: condizioneLabel(row.condizione_applicazione, row.descrizione_condizione),
      quando: quandoLabel(row.validita),
      suCosa: suCosaLabel(row.tipologia_prezzo),
      nota: valued.nota,
      venditore,
      offerte: new Set([row.offer_id]),
    });
  }

  const ranked = [...grouped.entries()]
    .map(([key, acc]) => ({
      key,
      vendorKey: key.split("|")[0] ?? key,
      nome: acc.nome,
      valoreLabel: acc.valoreLabel,
      annualEur: acc.annualEur,
      applicazione: acc.applicazione,
      condizione: acc.condizione,
      quando: acc.quando,
      suCosa: acc.suCosa,
      nota: acc.nota,
      venditore: acc.venditore,
      offerte: acc.offerte.size,
    }))
    .sort((a, b) => b.annualEur - a.annualEur || a.nome.localeCompare(b.nome, "it"));

  const seenVendors = new Set<string>();
  const top: OfferteScontoRank[] = [];
  for (const item of ranked) {
    if (seenVendors.has(item.vendorKey)) continue;
    seenVendors.add(item.vendorKey);
    const { vendorKey: _vendorKey, ...rank } = item;
    top.push(rank);
    if (top.length === SCONTO_RANK_TOP) break;
  }
  return top;
}

function annualizeSconto(row: MlScontoStatRow, text: string) {
  const amount = asPositive(row.valore);
  if (amount == null) return null;
  const unit = padCode(row.unita_misura);
  if (unit === "01" || unit === "05") {
    return { annualEur: amount, nota: null as string | null };
  }
  if (unit === "03") {
    const yearlyMislabel = amount > 2 ? parseEuroAnno(text) : null;
    if (yearlyMislabel != null) return { annualEur: yearlyMislabel, nota: null };
    const eurKwh = amount > 2 ? amount / 1000 : amount;
    let kwh = SCONTO_RANK_CONSUMO_KWH;
    const notes: string[] = [];
    const cap = parseKwhCap(text);
    if (cap != null) {
      kwh = Math.min(kwh, cap.kwh);
      notes.push(cap.nota);
    }
    const span = parseMonthSpan(text);
    if (span != null) {
      kwh *= span.months / 12;
      notes.push(span.nota);
    }
    const hours = parseHourShare(text);
    if (hours != null) {
      kwh *= hours.share;
      notes.push(hours.nota);
    }
    const annualEur = eurKwh * kwh;
    if (!(annualEur > 0)) return null;
    return { annualEur, nota: notes.length > 0 ? notes.join(" · ") : null };
  }
  if (unit === "02") {
    return { annualEur: amount * POTENZA_STANDARD_CASA_KW, nota: null as string | null };
  }
  return null;
}

const MONTH_WORD: Record<string, number> = {
  primo: 1,
  prima: 1,
  secondo: 2,
  seconda: 2,
  terzo: 3,
  terza: 3,
  quarto: 4,
  quarta: 4,
  quinto: 5,
  quinta: 5,
  sesto: 6,
  sesta: 6,
  settimo: 7,
  settima: 7,
  ottavo: 8,
  ottava: 8,
  nono: 9,
  nona: 9,
  decimo: 10,
  decima: 10,
  undicesimo: 11,
  undicesima: 11,
  dodicesimo: 12,
  dodicesima: 12,
};

function parseMonthSpan(text: string) {
  const t = text.toLowerCase();
  const range = t.match(/dal\s+([a-zà]+)\s+al\s+([a-zà]+)\s+mese/);
  if (range) {
    const from = MONTH_WORD[range[1] ?? ""];
    const to = MONTH_WORD[range[2] ?? ""];
    if (from && to && to >= from) {
      return { months: to - from + 1, nota: `mesi ${from}–${to}` };
    }
  }
  const nthMark = t.match(/(\d+)\s*[°º]\s*mese/);
  if (nthMark) {
    return { months: 1, nota: `solo ${nthMark[1]}° mese` };
  }
  const nthBare = t.match(/\b(\d+)\s+mese\b(?!i)/);
  if (nthBare) {
    return { months: 1, nota: `solo ${nthBare[1]}° mese` };
  }
  const nthWord = t.match(
    /\b(prim[oa]|second[oa]|terz[oa]|quart[oa]|quint[oa]|sest[oa]|settim[oa]|ottav[oa]|non[oa]|decim[oa]|undicesim[oa]|dodicesim[oa])\s+mese/,
  );
  if (nthWord?.[1]) {
    const n = MONTH_WORD[nthWord[1]];
    if (n) return { months: 1, nota: `solo ${nthWord[1]} mese` };
  }
  return null;
}

function parseKwhCap(text: string) {
  const t = text.toLowerCase().replace(",", ".");
  const annual = t.match(/primi\s+(\d+(?:\.\d+)?)\s*kwh\s*\/\s*a/);
  if (annual) return { kwh: Number(annual[1]), nota: `sui primi ${annual[1]} kWh/a` };
  const monthly = t.match(/primi\s+(\d+(?:\.\d+)?)\s*kwh\s*mensil/);
  if (monthly) {
    const year = Number(monthly[1]) * 12;
    return { kwh: year, nota: `sui primi ${monthly[1]} kWh/mese` };
  }
  const sogliaMese = t.match(/soglia di\s+(\d+(?:\.\d+)?)\s*kwh di consumo me/);
  if (sogliaMese) {
    const year = Number(sogliaMese[1]) * 12;
    return { kwh: year, nota: `sui primi ${sogliaMese[1]} kWh/mese` };
  }
  const first = t.match(/primi\s+(\d+(?:\.\d+)?)\s*kwh/);
  if (first) return { kwh: Number(first[1]), nota: `sui primi ${first[1]} kWh` };
  return null;
}

function parseHourShare(text: string) {
  const match = text.match(
    /(\d{1,2})[:.](\d{2})\s*(?:a|alle|e|-|–|—)\s*(?:le\s*)?(\d{1,2})[:.](\d{2})/i,
  );
  if (!match) return null;
  const start = Number(match[1]) + Number(match[2]) / 60;
  let end = Number(match[3]) + Number(match[4]) / 60;
  if (end <= start) end += 24;
  const hours = end - start;
  if (!(hours > 0 && hours < 24)) return null;
  return {
    share: hours / 24,
    nota: `solo ${match[1]}:${match[2]}–${match[3]}:${match[4]}`,
  };
}

function parseEuroAnno(text: string) {
  const match = text.match(/(\d+(?:[.,]\d+)?)\s*€\s*\/\s*anno/i);
  if (!match?.[1]) return null;
  const n = Number(match[1].replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function isReferralSconto(text: string) {
  return /segnalator|green club|porta un amico|sconto amico/i.test(text);
}

function isHighPowerOnlySconto(text: string) {
  const match = text.match(/potenza superiore a\s*([\d.,]+)\s*kw/i);
  if (!match?.[1]) return /utenze con potenza/i.test(text);
  const kw = Number(match[1].replace(",", "."));
  return Number.isFinite(kw) && kw > POTENZA_STANDARD_CASA_KW;
}

function condizioneLabel(code: string | null, descrizione: string | null) {
  const trimmed = descrizione?.replace(/\s+/g, " ").trim();
  if (trimmed) return trimmed.length > 90 ? `${trimmed.slice(0, 87).trimEnd()}…` : trimmed;
  const padded = padCode(code);
  if (padded === "01") return "fattura elettronica";
  if (padded === "02") return "bolletta web";
  if (padded === "03") return "fattura elettronica e SDD";
  if (padded === "99") return "altra condizione";
  return null;
}

function applicazioneKey(value: string | null): OfferteScontoApplicazione {
  const code = padCode(value);
  if (code === "00") return "sempre";
  if (code != null) return "condizionato";
  return "altro";
}

function quandoLabel(value: string | null) {
  const code = padCode(value);
  if (code === "01") return "all’ingresso";
  if (code === "02") return "entro 12 mesi";
  if (code === "03") return "oltre 12 mesi";
  return null;
}

function suCosaLabel(value: string | null) {
  const code = padCode(value);
  if (code === "01") return "canone fisso";
  if (code === "02") return "potenza";
  if (code === "03") return "energia";
  if (code === "04") return "tutela";
  return null;
}

function vendorFromUrl(url: string | null, piva: string | null) {
  return hostnameFromUrl(url) ?? (piva ? `P.IVA ${piva}` : null);
}

function medianOrNull(values: number[]) {
  return values.length > 0 ? median(values) : null;
}

function namedBuckets(items: Array<[string, string, number]>): OfferteClusterBucket[] {
  return items
    .map(([key, label, count]) => ({ key, label, count }))
    .filter((bucket) => bucket.count > 0);
}

function padCode(value: string | null) {
  const raw = value?.trim();
  if (!raw) return null;
  return /^\d+$/.test(raw) ? raw.padStart(2, "0") : raw;
}

function asPositive(value: number | string | null) {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(String(value).replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function vendorStats(rows: ClusterRow[]): OfferteVendorStats {
  type Acc = {
    key: string;
    denoms: string[];
    hosts: string[];
    urls: string[];
    offerte: number;
    placet: number;
    ml: number;
    fisso: number;
    variabile: number;
  };

  const map = new Map<string, Acc>();
  for (const row of rows) {
    const host = hostnameFromUrl(row.url);
    const key = row.p_iva || host || "sconosciuto";
    const acc = map.get(key) ?? {
      key,
      denoms: [],
      hosts: [],
      urls: [],
      offerte: 0,
      placet: 0,
      ml: 0,
      fisso: 0,
      variabile: 0,
    };
    acc.offerte += 1;
    if (row.source === "placet") acc.placet += 1;
    else acc.ml += 1;
    if (row.prezzo === "fisso") acc.fisso += 1;
    if (row.prezzo === "variabile") acc.variabile += 1;
    const denom = row.denominazione?.replace(/\s+/g, " ").trim();
    if (denom) acc.denoms.push(denom);
    if (host) acc.hosts.push(host);
    const href = absoluteVendorUrl(row.url);
    if (href) acc.urls.push(href);
    map.set(key, acc);
  }

  const ranked: OfferteVendorRank[] = [...map.values()]
    .map((acc) => ({
      key: acc.key,
      nome: mostCommon(acc.denoms) ?? mostCommon(acc.hosts) ?? vendorFallback(acc.key),
      url: mostCommon(acc.urls),
      offerte: acc.offerte,
      placet: acc.placet,
      ml: acc.ml,
      fisso: acc.fisso,
      variabile: acc.variabile,
    }))
    .sort((a, b) => b.offerte - a.offerte || a.nome.localeCompare(b.nome, "it"));

  const counts = ranked.map((row) => row.offerte);
  return {
    media: counts.length ? counts.reduce((sum, n) => sum + n, 0) / counts.length : 0,
    mediana: median(counts),
    soloUna: ranked.filter((row) => row.offerte === 1).length,
    entrambi: ranked.filter((row) => row.placet > 0 && row.ml > 0).length,
    soloPlacet: ranked.filter((row) => row.placet > 0 && row.ml === 0).length,
    soloMl: ranked.filter((row) => row.ml > 0 && row.placet === 0).length,
    top10Offerte: ranked.slice(0, 10).reduce((sum, row) => sum + row.offerte, 0),
    top: ranked.slice(0, 10),
  };
}

function absoluteVendorUrl(url: string | null) {
  if (!url) return null;
  const href = url.startsWith("http") ? url : `https://${url}`;
  try {
    const parsed = new URL(href);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
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

function mostCommon(values: string[]) {
  if (values.length === 0) return null;
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "it"))[0]?.[0] ?? null;
}

function vendorFallback(key: string) {
  if (key === "sconosciuto") return "Venditore";
  if (/^\d+$/.test(key)) return `P.IVA ${key}`;
  return key;
}

function median(values: number[]) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function clienteKey(tipo: string | null) {
  if (tipo?.includes("non domestico")) return "non domestico";
  if (tipo?.includes("condominio")) return "condominio";
  if (tipo?.includes("domestico")) return "domestico";
  return "altro";
}

function prezzoKey(tipo: string | null) {
  if (tipo?.includes("variabile")) return "variabile";
  if (tipo?.includes("fisso")) return "fisso";
  return "altro";
}

function coverageKey(coverage: string | null) {
  if (coverage === "nazionale" || coverage === "selettiva") return coverage;
  return "altro";
}

function mlBandPlan(tipologia: string | null, codOfferta: string): OfferteFasciaPlan | null {
  if (tipologia === "01") return "monoraria";
  if (tipologia === "91" || tipologia === "92" || tipologia === "93") return "bioraria";
  if (tipologia === "03") return "fasce";
  const kind = areraPrezzoOrarioKind(codOfferta);
  if (kind === "fasce") return "fasce";
  if (kind === "monorario") return "monoraria";
  return null;
}

function fasciaKey(hit: {
  source: "placet" | "ml";
  tipoOfferta: string;
  codOfferta: string;
  plan: OfferteFasciaPlan | null;
}) {
  return resolveOffertePlan(hit, hit.plan) ?? "altro";
}
