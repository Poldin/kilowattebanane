"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  PORTALE_OFFERTE_URL,
  type OfferteHeadlineStats,
} from "@/lib/offerte/public-types";

const PREF_KEY = "kilowattebanane.offerte.v1";
const STATS_HREF = "/offer-stats";

export function OfferteLanding({
  stats,
  className,
}: {
  stats: OfferteHeadlineStats;
  className?: string;
}) {
  const router = useRouter();
  const [cap, setCap] = useState("");
  const [capError, setCapError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PREF_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { cap?: string };
      const next = String(parsed.cap ?? "").replace(/\D/g, "").slice(0, 5);
      if (next) setCap(next);
    } catch {
      /* ignore */
    }
  }, []);

  function go(nextCap: string) {
    const next = nextCap.replace(/\D/g, "").slice(0, 5);
    setCap(next);
    if (next.length !== 5) {
      setCapError("Inserisci un CAP di 5 cifre.");
      return;
    }
    setCapError(null);
    try {
      const raw = localStorage.getItem(PREF_KEY);
      const parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      localStorage.setItem(PREF_KEY, JSON.stringify({ ...parsed, cap: next }));
    } catch {
      /* ignore */
    }
    router.push("/offer-compare");
  }

  return (
    <section
      id="offerte"
      className={className ? `${className} scroll-mt-20` : "scroll-mt-20"}
    >
      <p className="text-[11px] uppercase tracking-[0.16em] text-neutral-500 dark:text-neutral-400">
        Dati{" "}
        <a
          href={PORTALE_OFFERTE_URL}
          target="_blank"
          rel="noreferrer"
          className="underline decoration-neutral-300 underline-offset-2 transition-colors hover:text-foreground dark:decoration-neutral-600"
        >
          Portale Offerte
        </a>
        <span className="normal-case tracking-normal"> · open data CC-BY</span>
      </p>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
        Trova l&apos;offerta luce
      </h2>
      <p className="mt-5 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
        {" "}
        <strong className="font-medium text-foreground">{formatIt(stats.total)} offerte</strong>
        {" · "}
        {formatIt(stats.venditori)} venditori
        {" · "}
        {formatIt(stats.placet)} PLACET e {formatIt(stats.ml)} mercato libero.
        Apri le{" "}
        <a
          href={STATS_HREF}
          target="_blank"
          rel="noreferrer"
          className="rounded-md border border-neutral-200 bg-transparent px-2 py-0.5 text-sm text-foreground transition-colors hover:bg-neutral-100 dark:border-neutral-800 dark:hover:bg-neutral-900"
        >
          statistiche
        </a>
        .
      </p>
      <form
        className="mt-6 flex max-w-md flex-col gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          go(cap);
        }}
      >
        <label htmlFor="offerte-cap" className="text-sm text-neutral-600 dark:text-neutral-400">
          inserisci il CAP
        </label>
        <div className="flex gap-2">
          <input
            id="offerte-cap"
            name="cap"
            inputMode="numeric"
            autoComplete="postal-code"
            maxLength={5}
            placeholder="20121"
            value={cap}
            onChange={(event) => {
              const next = event.target.value.replace(/\D/g, "").slice(0, 5);
              setCap(next);
              setCapError(null);
            }}
            className="h-11 min-w-0 flex-1 rounded-md border border-neutral-200 bg-transparent px-3 text-lg tracking-[0.2em] text-foreground outline-none placeholder:tracking-normal placeholder:text-neutral-400 focus:border-neutral-400 dark:border-neutral-800 dark:focus:border-neutral-600"
          />
          <button
            type="submit"
            className="h-11 shrink-0 rounded-md border border-neutral-200 bg-transparent px-4 text-sm text-neutral-700 transition-colors hover:bg-neutral-100 dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-900"
          >
            Confronta
          </button>
        </div>
        {capError ? <p className="text-sm text-red-600 dark:text-red-400">{capError}</p> : null}
      </form>
    </section>
  );
}

function formatIt(value: number) {
  return new Intl.NumberFormat("it-IT").format(value);
}
