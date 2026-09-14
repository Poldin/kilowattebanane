"use client";

import { useMemo, useState, type ReactNode } from "react";
import { FasciaPlanIcon } from "@/components/offerte/FasciaPlanIcon";
import {
  ClienteIcon,
  MercatoIcon,
  PrezzoIcon,
} from "@/components/offerte/OfferteTraitIcons";
import type {
  OfferteParetoBoard,
  OfferteParetoCliente,
  OfferteParetoHit,
  OfferteParetoPrezzo,
  OfferteParetoSconti,
  OfferteParetoStats,
} from "@/lib/offerte/public-types";

export function ParetoSection({ stats }: { stats: OfferteParetoStats }) {
  if (!stats.boards.length) return null;
  return <ParetoBody stats={stats} />;
}

function ParetoBody({ stats }: { stats: OfferteParetoStats }) {
  const [cliente, setCliente] = useState<OfferteParetoCliente>("domestico");
  const [prezzo, setPrezzo] = useState<OfferteParetoPrezzo>("variabile");
  const [sconti, setSconti] = useState<OfferteParetoSconti>("primoAnno");

  const board = useMemo(
    () =>
      stats.boards.find(
        (item) => item.cliente === cliente && item.prezzo === prezzo && item.sconti === sconti,
      ) ?? emptyBoard(cliente, prezzo, sconti),
    [stats.boards, cliente, prezzo, sconti],
  );

  const dominatedPct = board.compared > 0 ? (board.dominated / board.compared) * 100 : 0;

  return (
    <section className="mt-16 border-t border-neutral-200 pt-10 dark:border-neutral-800" aria-labelledby="pareto">
      <h2 id="pareto" className="text-xl font-semibold tracking-tight sm:text-2xl">
        Il fronte di Pareto
      </h2>
      <p className="mt-5 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
        Due numeri rendono le offerte confrontabili: il canone e il prezzo dell’energia
        {prezzo === "variabile" ? " (lo spread sul PUN)" : ""}. Se un’altra è più bassa su tutti e
        due, questa costa solo di più. Restano quelle sul fronte: per ogni consumo ce n’è una sola
        che vince.
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
      <fieldset className="mt-3">
        <legend className="sr-only">Sconti</legend>
        <div className="flex flex-wrap gap-2">
          <ModeChip active={sconti === "primoAnno"} onClick={() => setSconti("primoAnno")}>
            Primo anno
          </ModeChip>
          <ModeChip active={sconti === "listino"} onClick={() => setSconti("listino")}>
            Listino
          </ModeChip>
        </div>
      </fieldset>

      {board.compared === 0 ? (
        <p className="mt-6 text-sm text-neutral-500 dark:text-neutral-400">
          Nessuna offerta confrontabile in questo taglio.
        </p>
      ) : (
        <>
          <p className="mt-6 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
            <strong className="font-medium text-foreground">
              {formatIt(board.hull)} sul fronte
            </strong>
            {" · "}
            {formatIt(board.dominated)} su {formatIt(board.compared)} non vincono per nessun consumo
            {` (${formatPct(dominatedPct)})`}
          </p>

          <ParetoCloud board={board} />

          <ol className="mt-8 divide-y divide-neutral-200 border-y border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
            {board.hits.map((hit, index) => (
              <ParetoHitRow key={hit.key} hit={hit} index={index} prezzo={prezzo} />
            ))}
          </ol>
        </>
      )}
      <p className="mt-6 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
        Primo anno include gli sconti automatici e quelli per SDD, bolletta web o fattura
        elettronica, se valgono all’ingresso o entro 12 mesi — sul canone o sull’energia. A tempo,
        sui primi kWh o solo a certe ore sono ricalcolati. Restano fuori porta-un-amico, sconti dopo
        i 12 mesi, utenze ad alta potenza e condizioni non classificate.
      </p>
    </section>
  );
}

function ParetoCloud({ board }: { board: OfferteParetoBoard }) {
  const width = 320;
  const height = 176;
  const padL = 48;
  const padR = 8;
  const padT = 8;
  const padB = 28;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const { cloud } = board;
  const maxCount = Math.max(0, ...cloud.counts);
  const cellW = innerW / cloud.cols;
  const cellH = innerH / cloud.rows;

  const xOf = (monthly: number) =>
    padL + ((monthly - cloud.xMin) / Math.max(cloud.xMax - cloud.xMin, 0.01)) * innerW;
  const yOf = (energy: number) =>
    padT + (1 - (energy - cloud.yMin) / Math.max(cloud.yMax - cloud.yMin, 0.0001)) * innerH;

  const hullPath = board.hits
    .map((hit, index) => `${index === 0 ? "M" : "L"}${xOf(hit.monthlyEur)} ${yOf(hit.energyEurKwh)}`)
    .join(" ");

  return (
    <figure className="mt-6">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full text-neutral-900 dark:text-neutral-100"
        role="img"
        aria-label="Grafico canone contro prezzo energia. I punti chiari sono le offerte dominate; la linea è il fronte."
      >
        {cloud.counts.map((count, index) => {
          if (count <= 0 || maxCount <= 0) return null;
          const col = index % cloud.cols;
          const row = Math.floor(index / cloud.cols);
          const opacity = 0.08 + (count / maxCount) * 0.34;
          return (
            <rect
              key={index}
              x={padL + col * cellW}
              y={padT + (cloud.rows - 1 - row) * cellH}
              width={Math.max(cellW - 0.4, 0.8)}
              height={Math.max(cellH - 0.4, 0.8)}
              className="fill-neutral-900 dark:fill-neutral-100"
              opacity={opacity}
            />
          );
        })}
        {hullPath ? (
          <path
            d={hullPath}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ) : null}
        {board.hits.map((hit) => (
          <circle
            key={hit.key}
            cx={xOf(hit.monthlyEur)}
            cy={yOf(hit.energyEurKwh)}
            r="3"
            className="fill-neutral-900 dark:fill-neutral-100"
          />
        ))}
        <text
          x={padL + innerW / 2}
          y={height - 6}
          textAnchor="middle"
          className="fill-neutral-500 dark:fill-neutral-400"
          fontSize="10"
        >
          Canone, €/mese
        </text>
        <text
          x={14}
          y={padT + innerH / 2}
          textAnchor="middle"
          transform={`rotate(-90 14 ${padT + innerH / 2})`}
          className="fill-neutral-500 dark:fill-neutral-400"
          fontSize="10"
        >
          {board.prezzo === "variabile" ? "Spread, c€/kWh" : "Energia, c€/kWh"}
        </text>
      </svg>
      <figcaption className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
        La nuvola sono le dominate. La linea è il fronte: basso a sinistra, alto canone e kWh basso
        a destra.
      </figcaption>
    </figure>
  );
}

function ParetoHitRow({
  hit,
  index,
  prezzo,
}: {
  hit: OfferteParetoHit;
  index: number;
  prezzo: OfferteParetoPrezzo;
}) {
  return (
    <li className="py-2.5">
      <div className="flex items-baseline gap-3">
        <span className="w-5 shrink-0 text-xs tabular-nums text-neutral-400 dark:text-neutral-500">
          {index + 1}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
          {hit.urlOfferta ? (
            <a
              href={hit.urlOfferta}
              target="_blank"
              rel="noreferrer"
              className="underline decoration-neutral-300 underline-offset-2 hover:decoration-neutral-500 dark:decoration-neutral-600 dark:hover:decoration-neutral-400"
            >
              {hit.nome}
            </a>
          ) : (
            hit.nome
          )}
        </span>
        <span className="shrink-0 text-sm tabular-nums text-foreground">
          {formatMonthly(hit.monthlyEur)}
          {" · "}
          {formatCentes(hit.energyEurKwh)}
        </span>
      </div>
      <p className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 pl-8 text-xs text-neutral-500 dark:text-neutral-400">
        <span>{rangeLabel(hit)}</span>
        <span aria-hidden>·</span>
        <span className="inline-flex items-center gap-1">
          <MercatoIcon kind={hit.source === "placet" ? "placet" : "ml"} />
          {hit.source === "placet" ? "PLACET" : "libero"}
        </span>
        {hit.plan ? (
          <span className="inline-flex items-center gap-1">
            <FasciaPlanIcon plan={hit.plan} />
            {planLabel(hit.plan)}
          </span>
        ) : null}
        <span className="inline-flex items-center gap-1">
          <PrezzoIcon kind={prezzo === "fisso" ? "prezzo fisso" : "prezzo variabile"} />
          {prezzo === "variabile" ? "spread" : "energia"}
        </span>
        {hit.venditore ? <span>{hit.venditore}</span> : null}
      </p>
      {hit.scontoNota ? (
        <p className="mt-0.5 pl-8 text-xs text-neutral-500 dark:text-neutral-400">{hit.scontoNota}</p>
      ) : null}
    </li>
  );
}

function rangeLabel(hit: OfferteParetoHit) {
  if (hit.finoAKwh == null) {
    if (hit.daKwh <= 0) return "per ogni consumo";
    return `da ${formatIt(Math.round(hit.daKwh))} kWh/anno`;
  }
  if (hit.daKwh <= 0) return `fino a ${formatIt(Math.round(hit.finoAKwh))} kWh/anno`;
  return `${formatIt(Math.round(hit.daKwh))}–${formatIt(Math.round(hit.finoAKwh))} kWh/anno`;
}

function planLabel(plan: NonNullable<OfferteParetoHit["plan"]>) {
  if (plan === "monoraria") return "monoraria";
  if (plan === "bioraria") return "bioraria";
  if (plan === "fasce") return "a fasce";
  return "dinamica";
}

function emptyBoard(
  cliente: OfferteParetoCliente,
  prezzo: OfferteParetoPrezzo,
  sconti: OfferteParetoSconti,
): OfferteParetoBoard {
  return {
    cliente,
    prezzo,
    sconti,
    compared: 0,
    hull: 0,
    dominated: 0,
    hits: [],
    spots: [],
    cloud: {
      xMin: 0,
      xMax: 1,
      yMin: 0,
      yMax: 1,
      cols: 1,
      rows: 1,
      counts: [0],
    },
  };
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

function formatIt(value: number) {
  return String(Math.round(Math.abs(value))).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function formatPct(value: number) {
  return `${new Intl.NumberFormat("it-IT", { maximumFractionDigits: 1 }).format(Math.round(value * 10) / 10)}%`;
}

function formatMonthly(value: number) {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatCentes(eurKwh: number) {
  return `${new Intl.NumberFormat("it-IT", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  }).format(eurKwh * 100)} c€`;
}
