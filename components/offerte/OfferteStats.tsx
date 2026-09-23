import Link from "next/link";
import { FasciaPlanIcon } from "@/components/offerte/FasciaPlanIcon";
import { ScontiRankings } from "@/components/offerte/ScontiRankings";
import { MarketLearnBanner } from "@/components/MarketLearnBanner";
import { ParetoSection } from "@/components/offerte/ParetoSection";
import { PrezziSection } from "@/components/offerte/PrezziSection";
import {
  CanoneIcon,
  ClienteIcon,
  MercatoIcon,
  PrezzoIcon,
} from "@/components/offerte/OfferteTraitIcons";
import { DINAMICA_COLOR, FASCIA_COLOR, FASCIA_LEGEND_COLOR } from "@/lib/fasce";
import type {
  OfferteClusterBucket,
  OfferteClusterStats,
  OfferteFasciaBucket,
  OfferteScontoStats,
  OfferteVendorRank,
  OfferteVendorStats,
} from "@/lib/offerte/public-types";
import type { OfferteFasciaPlan } from "@/lib/offerte/metrics";

const BAR_FILL = [
  "bg-neutral-900 dark:bg-neutral-100",
  "bg-neutral-600 dark:bg-neutral-400",
  "bg-neutral-400 dark:bg-neutral-600",
  "bg-neutral-300 dark:bg-neutral-700",
  "bg-neutral-200 dark:bg-neutral-800",
];

const CLUSTERS: {
  key: keyof Pick<
    OfferteClusterStats,
    "cliente" | "prezzo" | "mercato" | "copertura" | "durata"
  >;
  title: string;
  lead: string;
}[] = [
  {
    key: "cliente",
    title: "Chi sei",
    lead: "Casa o partita IVA. Le offerte sono scritte per l’uno o per l’altro.",
  },
  {
    key: "prezzo",
    title: "Che prezzo",
    lead: "Fisso inchioda il kWh. Variabile segue il PUN.",
  },
  {
    key: "mercato",
    title: "Che mercato",
    lead: "PLACET ha condizioni standard ARERA. Il libero no.",
  },
  {
    key: "copertura",
    title: "Dove vale",
    lead: "Le selettive le vedi col CAP.",
  },
  {
    key: "durata",
    title: "Quanto dura",
    lead: "I mesi del contratto, come arrivano. Senza scadenza è il −1 del tracciato. Le PLACET durano 12 mesi.",
  },
];

export function OfferteStats({ stats }: { stats: OfferteClusterStats }) {
  return (
    <>
      <p className="mt-4 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
        <strong className="font-medium text-foreground">{formatIt(stats.total)} offerte</strong>
        {" · "}
        {formatIt(stats.venditori)} venditori
        {" · "}
        {formatItDate(stats.snapshotDate)}. 
      </p>

      <div className="mt-8 flex flex-col gap-4">
        {CLUSTERS.map((cluster) => (
          <section
            key={cluster.key}
            aria-label={cluster.title}
          >
            <p className="sr-only">{cluster.lead}</p>
            <ClusterSplit buckets={stats[cluster.key]} total={stats.total} barSize="thick" />
            {cluster.key === "cliente" ? (
              <ResidenzaSplit buckets={stats.residenza} />
            ) : null}
          </section>
        ))}
        <section aria-label="Che orario">
          <p className="sr-only">
            Stesso prezzo tutte le ore, due fasce, tre fasce, oppure ora per ora. Fisso e
            variabile spezzati per ogni piano, tranne la dinamica.
          </p>
          <FasciaSplit buckets={stats.fascia} total={stats.total} barSize="thick" />
        </section>
      </div>

      {stats.pareto ? (
        <>
          <ParetoSection stats={stats.pareto} />
          <div className="mt-8">
            <MarketLearnBanner />
          </div>
        </>
      ) : null}
      {stats.prezzi ? <PrezziSection stats={stats.prezzi} /> : null}
      {stats.sconti ? <ScontiSection stats={stats.sconti} /> : null}
      <VendorSection stats={stats.fornitori} total={stats.total} venditori={stats.venditori} />
    </>
  );
}

function ScontiSection({ stats }: { stats: OfferteScontoStats }) {
  const rows: {
    key: string;
    title: string;
    lead: string;
    buckets: OfferteClusterBucket[];
    total: number;
    glossary?: { term: string; meaning: string }[];
  }[] = [
    {
      key: "applicazione",
      title: "Come si applica",
      lead: "Automatico, oppure solo se attivi SDD, bolletta web o un’altra condizione.",
      buckets: stats.applicazione,
      total: stats.offerteConSconto,
      glossary: [
        {
          term: "Sempre",
          meaning:
            "scatta da solo, senza altre condizioni.",        },
        {
          term: "Condizionato",
          meaning:
            "lo ottieni solo se fai qualcosa in più: SDD, fattura via mail, porta un amico, un altro contratto col venditore.",
        },
      ],
    },
    {
      key: "quando",
      title: "Quando vale",
      lead: "All’ingresso, nei primi 12 mesi, o dopo. Solo i primi due possono entrare in stima ARERA.",
      buckets: stats.quando,
      total: stats.righe,
    },
    {
      key: "tipologia",
      title: "Su cosa",
      lead: "Canone fisso, componente energia, o sconto sul prezzo di tutela.",
      buckets: stats.tipologia,
      total: stats.righe,
    },
  ];

  return (
    <section className="mt-16 border-t border-neutral-200 pt-10 dark:border-neutral-800" aria-labelledby="sconti">
      <h2 id="sconti" className="text-xl font-semibold tracking-tight sm:text-2xl">
        Sconti
      </h2>
      <p className="mt-5 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
        <strong className="font-medium text-foreground">
          {formatIt(stats.offerteConSconto)} offerte di mercato libero
        </strong>
        {" su "}
        {formatIt(stats.offerteMl)}
        {` hanno almeno uno sconto.`}
      </p>
      {scontoMedianLine(stats) ? (
        <p className="mt-2 text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">
          {scontoMedianLine(stats)}
        </p>
      ) : null}

      <div className="mt-8 divide-y divide-neutral-200 border-y border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
        {rows.map((row) => (
          <section
            key={row.key}
            aria-labelledby={`sconto-${row.key}`}
            className="grid grid-cols-1 gap-2 py-3 sm:grid-cols-[7.25rem_1fr] sm:items-start sm:gap-x-5"
          >
            <h3
              id={`sconto-${row.key}`}
              className="text-sm font-medium tracking-tight sm:pt-0.5"
              title={row.lead}
            >
              {row.title}
            </h3>
            <p className="sr-only">{row.lead}</p>
            <div>
              <ClusterSplit buckets={row.buckets} total={row.total} />
              {row.glossary ? (
                <dl className="mt-2.5 flex flex-col gap-1 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
                  {row.glossary.map((item) => (
                    <div key={item.term}>
                      <dt className="inline font-medium text-neutral-600 dark:text-neutral-300">
                        {item.term}
                      </dt>
                      <dd className="inline">
                        {": "}
                        {item.meaning}
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : null}
            </div>
          </section>
        ))}
      </div>

      <ScontiRankings stats={stats} />
    </section>
  );
}

function scontoMedianLine(stats: OfferteScontoStats) {
  const parts: string[] = [];
  if (stats.medianaFissoEurAnno != null) {
    parts.push(
      `In metà dei casi lo sconto automatico sul canone fisso vale almeno ${formatEuro(stats.medianaFissoEurAnno)} all’anno`,
    );
  }
  if (stats.medianaVenditaEurKwh != null) {
    parts.push(
      `sull’energia, almeno ${formatCentes(stats.medianaVenditaEurKwh)} c€/kWh`,
    );
  }
  if (parts.length === 0) return null;
  if (parts.length === 1) return `${parts[0]}.`;
  return `${parts[0]}; ${parts[1]}.`;
}

function formatEuro(value: number) {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: value >= 10 ? 0 : 2,
  }).format(value);
}

function formatCentes(eurKwh: number) {
  return new Intl.NumberFormat("it-IT", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  }).format(eurKwh * 100);
}

function VendorSection({
  stats,
  total,
  venditori,
}: {
  stats: OfferteVendorStats;
  total: number;
  venditori: number;
}) {
  const topShare = total > 0 ? (stats.top10Offerte / total) * 100 : 0;
  const maxOfferte = stats.top[0]?.offerte ?? 0;

  return (
    <section className="mt-16 border-t border-neutral-200 pt-10 dark:border-neutral-800" aria-labelledby="fornitori">
      <h2 id="fornitori" className="text-xl font-semibold tracking-tight sm:text-2xl">
        Fornitori
      </h2>
      <p className="mt-5 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
        <strong className="font-medium text-foreground">{formatIt(venditori)} venditori</strong>
        {" · "}
        mediana {formatItNum(stats.mediana)} offerte
        {" · "}
        media {formatItNum(stats.media)}
        {" · "}
        {formatIt(stats.soloUna)} ne hanno una sola
        {" · "}
        i primi 10 coprono il {formatPct(topShare)}
      </p>
      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
        {formatIt(stats.entrambi)} sui due mercati
        {" · "}
        {formatIt(stats.soloPlacet)} solo PLACET
        {" · "}
        {formatIt(stats.soloMl)} solo libero
      </p>

      <ol className="mt-8 divide-y divide-neutral-200 border-y border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
        {stats.top.map((vendor, index) => {
          const width = maxOfferte > 0 ? (vendor.offerte / maxOfferte) * 100 : 0;
          return (
            <li key={vendor.key} className="py-2.5">
              <div className="flex items-baseline gap-3">
                <span className="w-5 shrink-0 text-xs tabular-nums text-neutral-400 dark:text-neutral-500">
                  {index + 1}
                </span>
                <VendorNameLink vendor={vendor} />
                <span className="shrink-0 text-sm tabular-nums text-foreground">
                  {formatIt(vendor.offerte)}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-3 pl-8">
                <p className="min-w-0 flex-1 text-xs text-neutral-500 dark:text-neutral-400">
                  {vendor.placet > 0 ? `${formatIt(vendor.placet)} PLACET` : null}
                  {vendor.placet > 0 && vendor.ml > 0 ? " · " : null}
                  {vendor.ml > 0 ? `${formatIt(vendor.ml)} libero` : null}
                  {" · "}
                  {formatIt(vendor.fisso)} fisse
                  {" · "}
                  {formatIt(vendor.variabile)} variabili
                </p>
              </div>
              <div
                className="mt-2 ml-8 h-1 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-900"
                aria-hidden
              >
                <div
                  className="h-full rounded-full bg-neutral-900 dark:bg-neutral-100"
                  style={{ width: `${Math.max(width, width > 0 ? 1.2 : 0)}%` }}
                />
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function VendorNameLink({ vendor }: { vendor: OfferteVendorRank }) {
  if (!vendor.url) {
    return (
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
        {vendor.nome}
      </span>
    );
  }

  return (
    <a
      href={vendor.url}
      target="_blank"
      rel="noreferrer"
      title={`${vendor.nome} — si apre in una nuova scheda`}
      className="inline-flex min-w-0 flex-1 items-center gap-1 text-sm font-medium text-foreground underline decoration-neutral-300 underline-offset-2 transition-colors hover:decoration-neutral-500 dark:decoration-neutral-600 dark:hover:decoration-neutral-400"
    >
      <span className="truncate">{vendor.nome}</span>
      <NewTabIcon />
      <span className="sr-only"> (si apre in una nuova scheda)</span>
    </a>
  );
}

function NewTabIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0" aria-hidden>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6.5 3.5H3.75A1.25 1.25 0 0 0 2.5 4.75v7.5A1.25 1.25 0 0 0 3.75 13.5h7.5A1.25 1.25 0 0 0 12.5 12.25V9.5M9 3.5h3.5V7M13.5 3.5 8 9"
      />
    </svg>
  );
}

type BarSize = "default" | "thick";

function ClusterBucketLegend({
  bucket,
  total,
  align = "start",
}: {
  bucket: OfferteClusterBucket;
  total: number;
  align?: "start" | "end";
}) {
  const pct = total > 0 ? (bucket.count / total) * 100 : 0;

  return (
    <div
      className={`flex items-center gap-1.5 text-sm text-foreground ${
        align === "end" ? "justify-end text-right" : ""
      }`}
    >
      <ClusterIcon bucketKey={bucket.key} />
      <span>{bucket.label}</span>
      <span className="tabular-nums text-neutral-600 dark:text-neutral-400">
        {formatIt(bucket.count)}
      </span>
      <span className="tabular-nums text-neutral-400 dark:text-neutral-500">
        {formatPct(pct)}
      </span>
    </div>
  );
}

function ResidenzaSplit({ buckets }: { buckets: OfferteClusterBucket[] }) {
  const total = buckets.reduce((sum, bucket) => sum + bucket.count, 0);
  if (total === 0) return null;

  return (
    <div className="mt-4">
      <p className="sr-only">
        Delle offerte casa: dedicate solo a residenti, solo a non residenti, o a entrambe.
      </p>
      <ClusterSplit buckets={buckets} total={total} barSize="thick" />
    </div>
  );
}

function ClusterSplit({
  buckets,
  total,
  barSize = "default",
}: {
  buckets: OfferteClusterBucket[];
  total: number;
  barSize?: BarSize;
}) {
  const visibleBuckets = buckets.filter((bucket) => bucket.count > 0);
  const segments = buckets
    .map((bucket, index) => ({
      key: bucket.key,
      label: bucket.label,
      pct: total > 0 ? (bucket.count / total) * 100 : 0,
      color: undefined,
      fillClass: BAR_FILL[index % BAR_FILL.length] ?? BAR_FILL[BAR_FILL.length - 1],
    }))
    .filter((segment) => segment.pct > 0);
  const dualLegend = barSize !== "default" && visibleBuckets.length === 2;

  return (
    <div>
      {dualLegend ? (
        <div className="flex items-baseline justify-between gap-4">
          <ClusterBucketLegend bucket={visibleBuckets[0]!} total={total} />
          <ClusterBucketLegend bucket={visibleBuckets[1]!} total={total} align="end" />
        </div>
      ) : (
        <ul className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          {buckets.map((bucket) => (
            <li key={bucket.key}>
              <ClusterBucketLegend bucket={bucket} total={total} />
            </li>
          ))}
        </ul>
      )}
      <ClusterBar segments={segments} barSize={barSize} />
    </div>
  );
}

function FasciaSplit({
  buckets,
  total,
  barSize = "default",
}: {
  buckets: OfferteFasciaBucket[];
  total: number;
  barSize?: BarSize;
}) {
  const iconClass = "h-3.5 w-3.5 text-neutral-500 dark:text-neutral-400";
  const segments = fasciaBarSegments(buckets, total);

  return (
    <div>
      <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        {buckets.map((bucket) => {
          const pct = total > 0 ? (bucket.count / total) * 100 : 0;
          const color = fasciaPlanColor(bucket.key);
          return (
            <li
              key={bucket.key}
              className="flex items-center gap-1.5 text-sm text-foreground"
            >
              <ClusterIcon bucketKey={bucket.key} />
              <span style={color ? { color } : undefined}>{bucket.label}</span>
              {bucket.fisso == null ? (
                <span className="tabular-nums text-neutral-600 dark:text-neutral-400">
                  {formatIt(bucket.count)}
                </span>
              ) : (
                <>
                  {bucket.fisso > 0 ? (
                    <span className="inline-flex items-center gap-1">
                      <PrezzoIcon kind="prezzo fisso" className={iconClass} />
                      <span className="sr-only">fisso </span>
                      <span className="tabular-nums text-neutral-600 dark:text-neutral-400">
                        {formatIt(bucket.fisso)}
                      </span>
                    </span>
                  ) : null}
                  {bucket.variabile > 0 ? (
                    <span className="inline-flex items-center gap-1">
                      <PrezzoIcon kind="prezzo variabile" className={iconClass} />
                      <span className="sr-only">variabile </span>
                      <span className="tabular-nums text-neutral-600 dark:text-neutral-400">
                        {formatIt(bucket.variabile)}
                      </span>
                    </span>
                  ) : null}
                </>
              )}
              <span className="tabular-nums text-neutral-400 dark:text-neutral-500">
                {formatPct(pct)}
              </span>
            </li>
          );
        })}
      </ul>
      <ClusterBar segments={segments} barSize={barSize} />
    </div>
  );
}

function fasciaBarSegments(buckets: OfferteFasciaBucket[], total: number) {
  return buckets.flatMap((bucket) => {
    const color = fasciaPlanColor(bucket.key);
    const fillClass = color ? undefined : "bg-neutral-400 dark:bg-neutral-600";
    if (bucket.fisso == null) {
      const pct = total > 0 ? (bucket.count / total) * 100 : 0;
      return pct > 0
        ? [{ key: bucket.key, group: bucket.key, pct, color, fillClass, opacity: 1 }]
        : [];
    }
    const parts: {
      key: string;
      group: string;
      pct: number;
      color: string | undefined;
      fillClass?: string;
      opacity: number;
    }[] = [];
    if (bucket.fisso > 0) {
      parts.push({
        key: `${bucket.key}-fisso`,
        group: bucket.key,
        pct: total > 0 ? (bucket.fisso / total) * 100 : 0,
        color,
        fillClass,
        opacity: 1,
      });
    }
    if (bucket.variabile > 0) {
      parts.push({
        key: `${bucket.key}-variabile`,
        group: bucket.key,
        pct: total > 0 ? (bucket.variabile / total) * 100 : 0,
        color,
        fillClass,
        opacity: 0.55,
      });
    }
    return parts;
  });
}

function barHeightClass(barSize: BarSize) {
  if (barSize === "thick") return "h-[1.375rem] rounded-lg sm:h-6";
  return "h-1.5 rounded-full";
}

function ClusterBar({
  segments,
  barSize = "default",
}: {
  segments: {
    key: string;
    group?: string;
    pct: number;
    color?: string;
    fillClass?: string;
    opacity?: number;
  }[];
  barSize?: BarSize;
}) {
  const marks: number[] = [];
  let acc = 0;
  for (let i = 0; i < segments.length - 1; i++) {
    const current = segments[i]!;
    const next = segments[i + 1]!;
    acc += current.pct;
    const currentGroup = current.group ?? current.key;
    const nextGroup = next.group ?? next.key;
    if (currentGroup !== nextGroup) marks.push(acc);
  }

  const tall = barSize !== "default";

  return (
    <div className={tall ? "relative mt-2" : "relative mt-2 py-1.5"} aria-hidden>
      <div
        className={`flex overflow-hidden bg-neutral-100 dark:bg-neutral-900 ${barHeightClass(barSize)}`}
      >
        {segments.map((segment) => (
          <div
            key={segment.key}
            className={`h-full ${segment.color ? "" : segment.fillClass ?? ""}`}
            style={{
              width: `${segment.pct}%`,
              ...(segment.color ? { backgroundColor: segment.color } : {}),
              opacity: segment.opacity,
            }}
          />
        ))}
      </div>
      {marks.map((left) => (
        <span
          key={left}
          className="absolute -inset-y-1 w-0.5 -translate-x-1/2 bg-red-500"
          style={{ left: `${left}%` }}
          aria-hidden
        />
      ))}
    </div>
  );
}

function fasciaPlanColor(key: string) {
  if (key === "monoraria") return FASCIA_LEGEND_COLOR.Fmonoraria;
  if (key === "bioraria") return FASCIA_LEGEND_COLOR.F23;
  if (key === "fasce") return FASCIA_COLOR.F1;
  if (key === "dinamica") return DINAMICA_COLOR;
  return undefined;
}

function ClusterIcon({
  bucketKey,
  className = "h-3.5 w-3.5 text-neutral-500 dark:text-neutral-400",
}: {
  bucketKey: string;
  className?: string;
}) {
  if (bucketKey === "domestico" || bucketKey === "non domestico" || bucketKey === "condominio") {
    return <ClienteIcon kind={bucketKey} className={className} />;
  }
  if (bucketKey === "residente") {
    return <ClienteIcon kind="domestico" className={className} />;
  }
  if (bucketKey === "non residente") {
    return <NonResidenteIcon className={className} />;
  }
  if (bucketKey === "entrambe") {
    return <EntrambeResidenzaIcon className={className} />;
  }
  if (bucketKey === "fisso") return <PrezzoIcon kind="prezzo fisso" className={className} />;
  if (bucketKey === "canone") return <CanoneIcon className={className} />;
  if (bucketKey === "variabile") {
    return <PrezzoIcon kind="prezzo variabile" className={className} />;
  }
  if (bucketKey === "placet" || bucketKey === "ml") {
    return <MercatoIcon kind={bucketKey} className={className} />;
  }
  if (bucketKey === "nazionale") {
    return <CoperturaNazionaleIcon className={className} />;
  }
  if (bucketKey === "selettiva") {
    return <CoperturaSelettivaIcon className={className} />;
  }
  if (bucketKey === "altro" || bucketKey === "altre") {
    return <AltroIcon className={className} />;
  }
  if (bucketKey === "indeterminata" || bucketKey === "mancante" || /^\d+$/.test(bucketKey)) {
    return <DurataIcon className={className} />;
  }
  if (
    bucketKey === "monoraria" ||
    bucketKey === "bioraria" ||
    bucketKey === "fasce" ||
    bucketKey === "dinamica"
  ) {
    return <FasciaPlanIcon plan={bucketKey as OfferteFasciaPlan} />;
  }
  return null;
}

function CoperturaNazionaleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden fill="none">
      <circle cx="8" cy="8" r="5.25" stroke="currentColor" strokeWidth="1.35" />
      <path
        d="M3.5 8h9M8 3.5v9"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CoperturaSelettivaIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden fill="none">
      <path
        d="M8 2.75a3.25 3.25 0 0 0-3.25 3.25c0 2.45 3.25 5.75 3.25 5.75s3.25-3.3 3.25-5.75A3.25 3.25 0 0 0 8 2.75Z"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinejoin="round"
      />
      <circle cx="8" cy="6" r="1" fill="currentColor" />
    </svg>
  );
}

function NonResidenteIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden fill="none">
      <path
        d="M3 7.5 8 3.5l5 4V13H10v-3.5H6V13H3V7.5Z"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinejoin="round"
      />
      <path
        d="M4.2 12.6 11.8 5"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
      />
    </svg>
  );
}

function EntrambeResidenzaIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden fill="none">
      <path
        d="M2.4 8 5.8 5.2 9.2 8v4.2H7.2V9.6H4.4v2.6H2.4V8Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path
        d="M7.1 7.2 10.4 4.5 13.7 7.2v4.2h-2V8.9H9.1"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DurataIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden fill="none">
      <circle cx="8" cy="8" r="5.25" stroke="currentColor" strokeWidth="1.35" />
      <path
        d="M8 5.1V8.2l2.1 1.3"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function AltroIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden fill="none">
      <circle cx="4.25" cy="8" r="1.1" fill="currentColor" />
      <circle cx="8" cy="8" r="1.1" fill="currentColor" />
      <circle cx="11.75" cy="8" r="1.1" fill="currentColor" />
    </svg>
  );
}

function formatIt(value: number) {
  const sign = value < 0 ? "−" : "";
  const abs = Math.round(Math.abs(value));
  return sign + String(abs).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function formatItNum(value: number) {
  const rounded = Math.round(value * 10) / 10;
  if (Number.isInteger(rounded)) return formatIt(rounded);
  const [int, dec] = rounded.toFixed(1).split(".");
  return `${formatIt(Number(int))},${dec}`;
}

function formatPct(value: number) {
  const rounded = value >= 10 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${new Intl.NumberFormat("it-IT", { maximumFractionDigits: 1 }).format(rounded)}%`;
}

function formatItDate(value: string) {
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("it-IT", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}
