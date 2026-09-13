import Link from "next/link";
import { FasciaPlanIcon } from "@/components/offerte/FasciaPlanIcon";
import {
  ClienteIcon,
  MercatoIcon,
  PrezzoIcon,
} from "@/components/offerte/OfferteTraitIcons";
import { DINAMICA_COLOR, FASCIA_COLOR, FASCIA_LEGEND_COLOR } from "@/lib/fasce";
import type { OfferteClusterBucket, OfferteClusterStats } from "@/lib/offerte/public-types";
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
    "cliente" | "prezzo" | "mercato" | "copertura" | "fascia"
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
    key: "fascia",
    title: "Che orario",
    lead: "Stesso prezzo tutte le ore, due fasce, tre fasce, oppure ora per ora.",
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
        {formatItDate(stats.snapshotDate)}. Confronto col CAP in{" "}
        <Link
          href="/#offerte"
          className="text-foreground underline decoration-neutral-300 underline-offset-2 transition-colors hover:decoration-neutral-500 dark:decoration-neutral-600 dark:hover:decoration-neutral-400"
        >
          home
        </Link>
        .
      </p>

      <div className="mt-8 divide-y divide-neutral-200 border-y border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
        {CLUSTERS.map((cluster) => (
          <section
            key={cluster.key}
            aria-labelledby={`cluster-${cluster.key}`}
            className="grid grid-cols-1 gap-2 py-3 sm:grid-cols-[7.25rem_1fr] sm:items-center sm:gap-x-5"
          >
            <h2
              id={`cluster-${cluster.key}`}
              className="text-sm font-medium tracking-tight"
              title={cluster.lead}
            >
              {cluster.title}
            </h2>
            <p className="sr-only">{cluster.lead}</p>
            <ClusterSplit
              buckets={stats[cluster.key]}
              total={stats.total}
              fascia={cluster.key === "fascia"}
            />
          </section>
        ))}
      </div>
    </>
  );
}

function ClusterSplit({
  buckets,
  total,
  fascia = false,
}: {
  buckets: OfferteClusterBucket[];
  total: number;
  fascia?: boolean;
}) {
  return (
    <div>
      <ul className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        {buckets.map((bucket) => {
          const pct = total > 0 ? (bucket.count / total) * 100 : 0;
          const color = fascia ? fasciaPlanColor(bucket.key) : undefined;
          return (
            <li
              key={bucket.key}
              className="flex items-center gap-1.5 text-sm text-foreground"
            >
              <ClusterIcon bucketKey={bucket.key} />
              <span style={color ? { color } : undefined}>{bucket.label}</span>
              <span className="tabular-nums text-neutral-600 dark:text-neutral-400">
                {formatIt(bucket.count)}
              </span>
              <span className="tabular-nums text-neutral-400 dark:text-neutral-500">
                {formatPct(pct)}
              </span>
            </li>
          );
        })}
      </ul>
      <ClusterBar buckets={buckets} total={total} fascia={fascia} />
    </div>
  );
}

function ClusterBar({
  buckets,
  total,
  fascia,
}: {
  buckets: OfferteClusterBucket[];
  total: number;
  fascia: boolean;
}) {
  const segments = buckets
    .map((bucket, index) => ({
      bucket,
      index,
      pct: total > 0 ? (bucket.count / total) * 100 : 0,
    }))
    .filter((segment) => segment.pct > 0);

  const marks: number[] = [];
  let acc = 0;
  for (const segment of segments.slice(0, -1)) {
    acc += segment.pct;
    marks.push(acc);
  }

  return (
    <div className="relative mt-2 py-1.5" aria-hidden>
      <div className="flex h-1.5 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-900">
        {segments.map((segment) => {
          const color = fascia ? fasciaPlanColor(segment.bucket.key) : undefined;
          return (
            <div
              key={segment.bucket.key}
              className={color ? undefined : (BAR_FILL[segment.index] ?? BAR_FILL[BAR_FILL.length - 1])}
              style={{
                width: `${segment.pct}%`,
                ...(color ? { backgroundColor: color } : {}),
              }}
            />
          );
        })}
      </div>
      {marks.map((left) => (
        <span
          key={left}
          className="absolute top-0 bottom-0 w-0.5 -translate-x-1/2 bg-red-500"
          style={{ left: `${left}%` }}
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

function ClusterIcon({ bucketKey }: { bucketKey: string }) {
  const className = "h-3.5 w-3.5 text-neutral-500 dark:text-neutral-400";
  if (bucketKey === "domestico" || bucketKey === "non domestico" || bucketKey === "condominio") {
    return <ClienteIcon kind={bucketKey} className={className} />;
  }
  if (bucketKey === "fisso") return <PrezzoIcon kind="prezzo fisso" className={className} />;
  if (bucketKey === "variabile") {
    return <PrezzoIcon kind="prezzo variabile" className={className} />;
  }
  if (bucketKey === "placet" || bucketKey === "ml") {
    return <MercatoIcon kind={bucketKey} className={className} />;
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

function formatIt(value: number) {
  const sign = value < 0 ? "−" : "";
  const abs = Math.round(Math.abs(value));
  return sign + String(abs).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
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
