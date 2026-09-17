"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const PREF_KEY = "kilowattebanane.offerte.v1";

export function CapBanner() {
  const [cap, setCap] = useState("");

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

  return (
    <div className="w-full rounded-lg bg-[#165B44] p-5 text-[#f5f5f5] sm:p-6">
      <p className="text-3xl font-bold tracking-tight leading-tight sm:text-4xl">
        Confronta le offerte luce
      </p>
      <p className="mt-2 text-sm text-emerald-100">
        Inserisci il CAP della fornitura e scopri quanto paghi in bolletta
      </p>
      <form
        className="mt-4 flex w-full flex-col gap-2 sm:flex-row sm:items-center"
        onSubmit={(event) => event.preventDefault()}
      >
        <label htmlFor="home-cap" className="sr-only">
          CAP della fornitura
        </label>
        <input
          id="home-cap"
          name="cap"
          inputMode="numeric"
          autoComplete="postal-code"
          maxLength={5}
          placeholder="20121"
          value={cap}
          onChange={(event) => {
            const next = event.target.value.replace(/\D/g, "").slice(0, 5);
            setCap(next);
          }}
          className="h-10 min-w-0 flex-1 rounded-md border border-emerald-900/30 bg-[#f5f5f5] px-3 text-base tracking-[0.2em] text-[#111111] outline-none placeholder:tracking-normal placeholder:text-neutral-400 focus:border-emerald-700 sm:max-w-[9rem]"
        />
        <button
          type="button"
          disabled
          aria-disabled="true"
          className="inline-flex h-10 w-full shrink-0 cursor-not-allowed items-center justify-center gap-2 rounded-md bg-[#f5f5f5] px-4 text-sm font-medium text-[#111111] opacity-50 sm:w-auto"
        >
          Confronta
          <svg
            aria-hidden
            viewBox="0 0 16 16"
            className="h-4 w-4 shrink-0"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
          >
            <path d="M3.5 8h9M9 4.5 12.5 8 9 11.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </form>
      <Link
        href="/offer-stats"
        className="mt-3 inline-block text-sm text-emerald-100 underline decoration-emerald-300/60 underline-offset-2 transition-colors hover:text-white hover:decoration-white/80"
      >
        Vedi le statistiche sulle offerte luce
      </Link>
    </div>
  );
}
