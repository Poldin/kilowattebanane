import { CerItalyMap } from "@/components/cer/CerItalyMap";
import { CerNamesExplorer } from "@/components/cer/CerNamesExplorer";
import { GSE_MAPPA_URL, type CerClusterBucket, type CerStats as CerStatsData } from "@/lib/cer/public-types";

const BAR_FILL = [
  "bg-neutral-900 dark:bg-neutral-100",
  "bg-neutral-600 dark:bg-neutral-400",
  "bg-neutral-400 dark:bg-neutral-600",
  "bg-neutral-300 dark:bg-neutral-700",
  "bg-neutral-200 dark:bg-neutral-800",
];

const SECTIONS: {
  key: keyof Pick<CerStatsData, "tipologia" | "gestore" | "potenza" | "utenze">;
  title: string;
  lead: string;
}[] = [
  {
    key: "tipologia",
    title: "Che tipo",
    lead: "Le cinque configurazioni TIAD sulla mappa GSE. La CER è una di queste.",
  },
  {
    key: "gestore",
    title: "Che rete",
    lead: "Il gestore di rete dell’area convenzionale.",
  },
  {
    key: "potenza",
    title: "Quanti kW",
    lead: "Potenza totale degli impianti nella configurazione.",
  },
  {
    key: "utenze",
    title: "Quante utenze",
    lead: "POD nella configurazione, come li conta il GSE.",
  },
];

function cabinePrimarieItalia(stats: CerStatsData) {
  if (stats.cabinePrimarie != null) return stats.cabinePrimarie;
  if (!stats.regioni.some((region) => region.cabinePrimarie != null)) return null;
  return stats.regioni.reduce((sum, region) => sum + (region.cabinePrimarie ?? 0), 0);
}

export function CerStats({ stats }: { stats: CerStatsData }) {
  const cabinePrimarie = cabinePrimarieItalia(stats);

  if (stats.total === 0) {
    return (
      <p className="mt-4 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
        Ancora nessun dato ingestito dalla{" "}
        <a
          href={GSE_MAPPA_URL}
          target="_blank"
          rel="noreferrer"
          className="underline decoration-neutral-300 underline-offset-2 hover:text-foreground dark:decoration-neutral-600"
        >
          mappa GSE
        </a>
        .
      </p>
    );
  }

  return (
    <>
      <p className="mt-4 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
        <span className="mx-0.5 inline-flex translate-y-px items-center rounded-full bg-[#F5D547] px-2.5 py-0.5 font-semibold tabular-nums text-[#111111]">
          {formatIt(stats.cer)} CER
        </span>
        {cabinePrimarie != null ? ` · ${formatIt(cabinePrimarie)} cabine primarie` : null}
        {stats.potenzaKwTotale != null ? ` · ${formatPower(stats.potenzaKwTotale)}` : null}
        {stats.utenzeTotale != null ? ` · ${formatIt(stats.utenzeTotale)} utenze` : null}
        {stats.snapshotDate ? ` · ${formatItDate(stats.snapshotDate)}` : null}.
      </p>
      {medianLine(stats) ? (
        <p className="mt-2 text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">
          {medianLine(stats)}
        </p>
      ) : null}

      {stats.regioni.length > 0 ? (
        <CerItalyMap regions={stats.regioni} total={stats.total} />
      ) : null}

      {stats.nomi ? <CerNamesExplorer analysis={stats.nomi} /> : null}

      <div className="mt-10 flex flex-col gap-4">
        {SECTIONS.filter((section) => section.key === "tipologia").map((section) => (
          <section key={section.key} aria-label={section.title}>
            <p className="sr-only">{section.lead}</p>
            <ClusterSplit buckets={stats.tipologia} total={stats.total} barSize="thick" />
          </section>
        ))}
        {stats.cer > 0 ? (
          <section aria-label="Vetrina">
            <p className="sr-only">
              Tra le CER, quante sono in vetrina GSE con contatto e quante solo sulla mappa.
            </p>
            <ClusterSplit buckets={stats.vetrina} total={stats.cer} barSize="thick" />
          </section>
        ) : null}
        {SECTIONS.filter((section) => section.key !== "tipologia").map((section) => (
          <section key={section.key} aria-label={section.title}>
            <p className="sr-only">{section.lead}</p>
            <ClusterSplit
              buckets={stats[section.key]}
              total={stats[section.key].reduce((sum, bucket) => sum + bucket.count, 0)}
              barSize="thick"
            />
          </section>
        ))}
      </div>
    </>
  );
}

function medianLine(stats: CerStatsData) {
  const bits: string[] = [];
  if (stats.medianaPotenzaKw != null) {
    bits.push(`mediana ${formatItNum(stats.medianaPotenzaKw)} kW`);
  }
  if (stats.medianaUtenze != null) {
    bits.push(`${formatItNum(stats.medianaUtenze)} utenze`);
  }
  return bits.length > 0 ? bits.join(" · ") : null;
}

function ClusterSplit({
  buckets,
  total,
  barSize = "default",
}: {
  buckets: CerClusterBucket[];
  total: number;
  barSize?: "default" | "thick";
}) {
  const visibleBuckets = buckets.filter((bucket) => bucket.count > 0);
  const segments = buckets
    .map((bucket, index) => ({
      key: bucket.key,
      label: bucket.label,
      pct: total > 0 ? (bucket.count / total) * 100 : 0,
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

function ClusterBucketLegend({
  bucket,
  total,
  align = "start",
}: {
  bucket: CerClusterBucket;
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

function ClusterBar({
  segments,
  barSize = "default",
}: {
  segments: { key: string; pct: number; fillClass?: string }[];
  barSize?: "default" | "thick";
}) {
  const height =
    barSize === "thick" ? "h-[1.375rem] rounded-lg sm:h-6" : "h-1.5 rounded-full";
  return (
    <div className={barSize === "thick" ? "relative mt-2" : "relative mt-2 py-1.5"} aria-hidden>
      <div className={`flex overflow-hidden bg-neutral-100 dark:bg-neutral-900 ${height}`}>
        {segments.map((segment) => (
          <div
            key={segment.key}
            className={segment.fillClass}
            style={{ width: `${segment.pct}%` }}
          />
        ))}
      </div>
    </div>
  );
}

function formatPower(kw: number) {
  if (kw >= 1000) {
    const mw = kw / 1000;
    return `${mw >= 10 ? formatIt(Math.round(mw)) : formatItNum(mw)} MW`;
  }
  return `${formatItNum(kw)} kW`;
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
