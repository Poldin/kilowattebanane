"use client";

import { useMemo, useState, type ReactNode } from "react";
import { FasciaPlanIcon } from "@/components/offerte/FasciaPlanIcon";
import {
  CanoneIcon,
  ClienteIcon,
  MercatoIcon,
  PrezzoIcon,
} from "@/components/offerte/OfferteTraitIcons";
import type { OfferteFasciaPlan } from "@/lib/offerte/metrics";
import type {
  OfferteParetoCliente,
  OfferteParetoPrezzo,
  OffertePrezziBoard,
  OffertePrezziClusterRow,
  OffertePrezziQuartiles,
  OffertePrezziStats,
} from "@/lib/offerte/public-types";

export function PrezziSection({ stats }: { stats: OffertePrezziStats }) {
  if (!stats.boards.length) return null;
  return <PrezziBody stats={stats} />;
}

function PrezziBody({ stats }: { stats: OffertePrezziStats }) {
  const [cliente, setCliente] = useState<OfferteParetoCliente>("domestico");
  const [prezzo, setPrezzo] = useState<OfferteParetoPrezzo>("variabile");

  const board = useMemo(
    () =>
      stats.boards.find((item) => item.cliente === cliente && item.prezzo === prezzo) ??
      emptyBoard(cliente, prezzo),
    [stats.boards, cliente, prezzo],
  );

  const energyName = prezzo === "variabile" ? "Spread sul PUN" : "Prezzo dell’energia";

  return (
    <section
      className="mt-16 border-t border-neutral-200 pt-10 dark:border-neutral-800"
      aria-labelledby="prezzi"
    >
      <h2 id="prezzi" className="text-xl font-semibold tracking-tight sm:text-2xl">
        Prezzi
      </h2>
      <p className="mt-5 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
        Listino, senza sconti. Due numeri: il canone e{" "}
        {prezzo === "variabile" ? "lo spread sul PUN" : "il prezzo del kWh"}. Fisso e variabile
        non si mischiano. La mediana resiste ai cataloghi gonfiati; metà delle offerte sta tra
        il 25° e il 75° percentile.
      </p>

      <fieldset className="mt-6">
        <legend className="sr-only">Tipo di cliente</legend>
        <div className="flex flex-wrap gap-2">
          <ModeChip
            active={cliente === "domestico"}
            onClick={() => setCliente("domestico")}
            icon={<ClienteIcon kind="domestico" />}
          >
            Casa
          </ModeChip>
          <ModeChip
            active={cliente === "non domestico"}
            onClick={() => setCliente("non domestico")}
            icon={<ClienteIcon kind="non domestico" />}
          >
            Partita IVA
          </ModeChip>
        </div>
      </fieldset>
      <fieldset className="mt-3">
        <legend className="sr-only">Tipo di prezzo</legend>
        <div className="flex flex-wrap gap-2">
          <ModeChip
            active={prezzo === "fisso"}
            onClick={() => setPrezzo("fisso")}
            icon={<PrezzoIcon kind="prezzo fisso" />}
          >
            Fisso
          </ModeChip>
          <ModeChip
            active={prezzo === "variabile"}
            onClick={() => setPrezzo("variabile")}
            icon={<PrezzoIcon kind="prezzo variabile" />}
          >
            Variabile
          </ModeChip>
        </div>
      </fieldset>

      {board.n === 0 || !board.monthly || !board.energy ? (
        <p className="mt-6 text-sm text-neutral-500 dark:text-neutral-400">
          Nessuna offerta confrontabile in questo taglio.
        </p>
      ) : (
        <>
          <p className="mt-6 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
            <strong className="font-medium text-foreground">
              {formatIt(board.n)} offerte
            </strong>
            {". In metà dei casi il canone è almeno "}
            <strong className="font-medium text-foreground">
              {formatMonthly(board.monthly.p50)}
            </strong>
            {prezzo === "variabile" ? "; lo spread, almeno " : "; l’energia, almeno "}
            <strong className="font-medium text-foreground">
              {formatCentes(board.energy.p50)}
            </strong>
            .
          </p>
          <p className="mt-2 text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">
            Metà delle offerte sta tra {formatMonthly(board.monthly.p25)} e{" "}
            {formatMonthly(board.monthly.p75)}, e tra {formatCentes(board.energy.p25)} e{" "}
            {formatCentes(board.energy.p75)}.
          </p>

          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-8">
            <AxisCard
              title="Canone"
              icon={<CanoneIcon />}
              value={formatMonthly(board.monthly.p50)}
              q={board.monthly}
              format={formatMonthly}
              domainMax={axisMax(board.monthly)}
            />
            <AxisCard
              title={energyName}
              icon={
                <PrezzoIcon kind={prezzo === "fisso" ? "prezzo fisso" : "prezzo variabile"} />
              }
              value={formatCentes(board.energy.p50)}
              q={board.energy}
              format={formatCentes}
              domainMax={axisMax(board.energy)}
            />
          </div>

          <div className="mt-8 divide-y divide-neutral-200 border-y border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
            <ClusterPriceRows
              title="Che mercato"
              lead="PLACET ha condizioni standard ARERA. Il libero no."
              rows={board.mercato}
              energyDomain={clusterEnergyMax(board.mercato, board.energy)}
              prezzo={prezzo}
            />
            <ClusterPriceRows
              title="Che orario"
              lead="Stesso prezzo tutte le ore, due fasce, tre fasce, oppure ora per ora."
              rows={board.orario}
              energyDomain={clusterEnergyMax(board.orario, board.energy)}
              prezzo={prezzo}
            />
          </div>
        </>
      )}
    </section>
  );
}

function ClusterPriceRows({
  title,
  lead,
  rows,
  energyDomain,
  prezzo,
}: {
  title: string;
  lead: string;
  rows: OffertePrezziClusterRow[];
  energyDomain: number;
  prezzo: OfferteParetoPrezzo;
}) {
  const headingId = `prezzi-${title === "Che mercato" ? "mercato" : "orario"}`;
  if (rows.length === 0) return null;

  return (
    <section
      aria-labelledby={headingId}
      className="grid grid-cols-1 gap-2 py-3 sm:grid-cols-[7.25rem_1fr] sm:items-start sm:gap-x-5"
    >
      <h3 id={headingId} className="text-sm font-medium tracking-tight sm:pt-0.5" title={lead}>
        {title}
      </h3>
      <p className="sr-only">{lead}</p>
      <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
        {rows.map((row) => (
          <li key={row.key} className="py-2.5 first:pt-0 last:pb-0">
            <div className="flex items-baseline gap-3">
              <span className="inline-flex min-w-0 flex-1 items-center gap-1.5 text-sm font-medium text-foreground">
                <ClusterPriceIcon rowKey={row.key} />
                <span className="truncate">{row.label}</span>
              </span>
              <span className="shrink-0 text-sm tabular-nums text-foreground">
                {formatMonthly(row.monthly.p50)}
                {" · "}
                {formatCentes(row.energy.p50)}
              </span>
            </div>
            <p className="mt-1 pl-5 text-xs text-neutral-500 dark:text-neutral-400">
              {formatIt(row.n)} offerte
              {" · "}
              metà {formatCentes(row.energy.p25)}–{formatCentes(row.energy.p75)}
              {prezzo === "variabile" ? " di spread" : ""}
            </p>
            <div className="ml-5">
              <IqrBar q={row.energy} domainMax={energyDomain} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function AxisCard({
  title,
  icon,
  value,
  q,
  format,
  domainMax,
}: {
  title: string;
  icon: ReactNode;
  value: string;
  q: OffertePrezziQuartiles;
  format: (value: number) => string;
  domainMax: number;
}) {
  return (
    <div>
      <p className="flex items-center gap-1.5 text-sm font-medium tracking-tight">
        <span className="text-neutral-500 dark:text-neutral-400">{icon}</span>
        {title}
      </p>
      <p className="mt-1 text-sm tabular-nums text-foreground">{value}</p>
      <IqrBar q={q} domainMax={domainMax} />
      <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
        metà {format(q.p25)}–{format(q.p75)}
        {" · "}
        10° {format(q.p10)}
      </p>
    </div>
  );
}

function IqrBar({ q, domainMax }: { q: OffertePrezziQuartiles; domainMax: number }) {
  const max = Math.max(domainMax, q.p90, 0.0001);
  const left = (q.p25 / max) * 100;
  const width = Math.max(0, ((q.p75 - q.p25) / max) * 100);
  const mid = (q.p50 / max) * 100;
  const whiskerLeft = (q.p10 / max) * 100;
  const whiskerWidth = Math.max(0, ((q.p90 - q.p10) / max) * 100);

  return (
    <div className="relative mt-2 py-1.5" aria-hidden>
      <div className="relative h-1.5 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-900">
        <div
          className="absolute top-1/2 h-px -translate-y-1/2 bg-neutral-300 dark:bg-neutral-700"
          style={{ left: `${whiskerLeft}%`, width: `${whiskerWidth}%` }}
        />
        <div
          className="absolute inset-y-0 rounded-full bg-neutral-900/40 dark:bg-neutral-100/40"
          style={{ left: `${left}%`, width: `${width}%` }}
        />
      </div>
      <span
        className="absolute top-0 bottom-0 w-0.5 -translate-x-1/2 bg-red-500"
        style={{ left: `${mid}%` }}
      />
    </div>
  );
}

function ClusterPriceIcon({ rowKey }: { rowKey: string }) {
  const className = "h-3.5 w-3.5 text-neutral-500 dark:text-neutral-400";
  if (rowKey === "placet" || rowKey === "ml") {
    return <MercatoIcon kind={rowKey} className={className} />;
  }
  if (rowKey === "monoraria" || rowKey === "bioraria" || rowKey === "fasce" || rowKey === "dinamica") {
    return <FasciaPlanIcon plan={rowKey as OfferteFasciaPlan} />;
  }
  return null;
}

function ModeChip({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "inline-flex items-center gap-1.5 rounded-full border border-neutral-900 bg-neutral-900 px-3 py-1.5 text-sm text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900"
          : "inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-transparent px-3 py-1.5 text-sm text-neutral-700 transition-colors hover:bg-neutral-100 dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-900"
      }
    >
      {icon}
      {children}
    </button>
  );
}

function emptyBoard(cliente: OfferteParetoCliente, prezzo: OfferteParetoPrezzo): OffertePrezziBoard {
  return {
    cliente,
    prezzo,
    n: 0,
    monthly: null,
    energy: null,
    mercato: [],
    orario: [],
  };
}

function axisMax(q: OffertePrezziQuartiles) {
  return Math.max(q.p90 * 1.05, q.p75, 0.0001);
}

function clusterEnergyMax(rows: OffertePrezziClusterRow[], fallback: OffertePrezziQuartiles) {
  const peak = Math.max(fallback.p90, ...rows.map((row) => row.energy.p90));
  return Math.max(peak * 1.05, 0.0001);
}

function formatIt(value: number) {
  return String(Math.round(Math.abs(value))).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function formatMonthly(value: number) {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatCentes(eurKwh: number) {
  if (Math.abs(eurKwh) < 1e-12) return "0 c€/kWh";
  return `${new Intl.NumberFormat("it-IT", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  }).format(eurKwh * 100)} c€/kWh`;
}
