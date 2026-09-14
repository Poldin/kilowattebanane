"use client";

import { useMemo, useState, type ReactNode } from "react";
import { FasciaPlanIcon } from "@/components/offerte/FasciaPlanIcon";
import { PrezzoIcon } from "@/components/offerte/OfferteTraitIcons";
import type {
  OfferteScontoBoard,
  OfferteScontoFascia,
  OfferteScontoPrezzo,
  OfferteScontoRank,
  OfferteScontoStats,
} from "@/lib/offerte/public-types";

const FASCE: OfferteScontoFascia[] = ["monoraria", "bioraria", "fasce", "dinamica"];

export function ScontiRankings({ stats }: { stats: OfferteScontoStats }) {
  if (!stats.boards?.length) return null;
  return <ScontiRankingsBody stats={stats} />;
}

function ScontiRankingsBody({ stats }: { stats: OfferteScontoStats }) {
  const [fascia, setFascia] = useState<OfferteScontoFascia>("monoraria");
  const [prezzo, setPrezzo] = useState<OfferteScontoPrezzo>("variabile");
  const resolvedPrezzo = fascia === "dinamica" ? "variabile" : prezzo;

  const board = useMemo(
    () =>
      stats.boards.find((item) => item.fascia === fascia && item.prezzo === resolvedPrezzo) ??
      emptyBoard(fascia, resolvedPrezzo),
    [stats.boards, fascia, resolvedPrezzo],
  );

  const maxEur = board.top[0]?.annualEur ?? 0;

  return (
    <div className="mt-10">
      <h3 className="text-sm font-medium tracking-tight">I più golosi</h3>
      <p className="mt-1 text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">
        I cinque sconti più alti per tipo di contratto, stimati in euro sul primo anno
        {"("}
        {formatIt(stats.rankingConsumoKwh)} kWh, {formatKw(stats.rankingPotenzaKw)}
        {"). "}
        A tempo, a fascia oraria o sui primi kWh sono ricalcolati, non presi per tutto
        l’anno.
      </p>

      <fieldset className="mt-4">
        <legend className="sr-only">Profilo orario</legend>
        <div className="flex flex-wrap gap-2">
          {FASCE.map((key) => (
            <ModeChip
              key={key}
              active={fascia === key}
              onClick={() => {
                setFascia(key);
                if (key === "dinamica") setPrezzo("variabile");
              }}
              icon={<FasciaPlanIcon plan={key} />}
            >
              {fasciaChipLabel(key)}
            </ModeChip>
          ))}
        </div>
      </fieldset>

      <fieldset className="mt-3">
        <legend className="sr-only">Tipo di prezzo</legend>
        <div className="flex flex-wrap gap-2">
          <ModeChip
            active={resolvedPrezzo === "fisso"}
            disabled={fascia === "dinamica"}
            onClick={() => setPrezzo("fisso")}
            icon={<PrezzoIcon kind="prezzo fisso" />}
          >
            Fisso
          </ModeChip>
          <ModeChip
            active={resolvedPrezzo === "variabile"}
            onClick={() => setPrezzo("variabile")}
            icon={<PrezzoIcon kind="prezzo variabile" />}
          >
            Variabile
          </ModeChip>
        </div>
      </fieldset>

      {board.top.length === 0 ? (
        <p className="mt-5 text-sm text-neutral-500 dark:text-neutral-400">
          Nessuno sconto confrontabile in euro per {fasciaChipLabel(fascia).toLowerCase()}{" "}
          {resolvedPrezzo}.
        </p>
      ) : (
        <ol className="mt-5 divide-y divide-neutral-200 border-y border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
          {board.top.map((item, index) => (
            <ScontoRankRow key={item.key} item={item} index={index} maxEur={maxEur} />
          ))}
        </ol>
      )}
    </div>
  );
}

function ScontoRankRow({
  item,
  index,
  maxEur,
}: {
  item: OfferteScontoRank;
  index: number;
  maxEur: number;
}) {
  const width = maxEur > 0 ? (item.annualEur / maxEur) * 100 : 0;
  return (
    <li className="py-2.5">
      <div className="flex items-baseline gap-3">
        <span className="w-5 shrink-0 text-xs tabular-nums text-neutral-400 dark:text-neutral-500">
          {index + 1}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
          {item.nome}
        </span>
        <span className="shrink-0 text-sm tabular-nums text-foreground">
          ~{formatEuro(item.annualEur)}
        </span>
      </div>
      <p className="mt-1 pl-8 text-xs text-neutral-500 dark:text-neutral-400">
        <span className="font-medium text-neutral-600 dark:text-neutral-300">
          {applicazioneLabel(item.applicazione)}
        </span>
        {item.valoreLabel ? ` · ${item.valoreLabel}` : ""}
        {item.quando ? ` · ${item.quando}` : ""}
        {item.suCosa ? ` · ${item.suCosa}` : ""}
        {item.nota ? ` · ${item.nota}` : ""}
        {item.venditore ? ` · ${item.venditore}` : ""}
        {item.offerte > 1 ? ` · ${formatIt(item.offerte)} offerte` : ""}
      </p>
      {item.applicazione === "condizionato" && item.condizione ? (
        <p className="mt-0.5 pl-8 text-xs text-neutral-500 dark:text-neutral-400">
          {item.condizione}
        </p>
      ) : null}
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
}

function ModeChip({
  active,
  disabled,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={
        disabled
          ? "inline-flex items-center gap-1.5 rounded-full border border-neutral-200 px-3 py-1.5 text-sm text-neutral-400 dark:border-neutral-800 dark:text-neutral-600"
          : active
            ? "inline-flex items-center gap-1.5 rounded-full border border-neutral-900 bg-neutral-900 px-3 py-1.5 text-sm text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900"
            : "inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-transparent px-3 py-1.5 text-sm text-neutral-700 transition-colors hover:bg-neutral-100 dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-900"
      }
    >
      {icon}
      {children}
    </button>
  );
}

function emptyBoard(fascia: OfferteScontoFascia, prezzo: OfferteScontoPrezzo): OfferteScontoBoard {
  return { fascia, prezzo, top: [] };
}

function fasciaChipLabel(fascia: OfferteScontoFascia) {
  if (fascia === "monoraria") return "Monoraria";
  if (fascia === "bioraria") return "Bioraria";
  if (fascia === "fasce") return "Trioraria";
  return "Dinamica";
}

function applicazioneLabel(value: OfferteScontoRank["applicazione"]) {
  if (value === "sempre") return "Sempre";
  if (value === "condizionato") return "Condizionato";
  return "Non classificato";
}

function formatIt(value: number) {
  return String(Math.round(Math.abs(value))).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function formatKw(value: number) {
  return `${String(value).replace(".", ",")} kW`;
}

function formatEuro(value: number) {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: value >= 10 ? 0 : 2,
  }).format(value);
}

