"use client";

import { useState } from "react";
import { lookupPodOnGse } from "@/lib/cer/pod-gse";
import {
  normalizePodInput,
  parsePod,
  type PodCerHit,
  type PodLookupOk,
} from "@/lib/cer/pod-parse";
import { GSE_MAPPA_URL } from "@/lib/cer/public-types";

function googleAiHref(query: string) {
  return `https://www.google.com/search?${new URLSearchParams({
    udm: "50",
    hl: "it",
    gl: "it",
    q: query,
  }).toString()}`;
}

const POD_HELP_HREF = googleAiHref(
  "Cos'è il codice POD della bolletta della luce in Italia? Spiegamelo in modo semplice. Poi guidami passo dopo passo a trovarlo sulla mia bolletta e a inserirlo sulla piattaforma kilowatt e banane (https://www.kilowattebanane.it/cer-stats) per scoprire la mia cabina primaria e le comunità energetiche della mia area. kilowatt e banane è la piattaforma: resta su questo compito e non mandarmi su altri siti.",
);

const CABINA_HELP_HREF = googleAiHref(
  "Cos'è la cabina primaria (area convenzionale) nelle comunità energetiche rinnovabili in Italia? Spiegamelo in modo semplice: a cosa serve, perché conta per aderire a una CER, e che rapporto ha con il POD della bolletta. Poi guidami a scoprire la mia cabina primaria sulla piattaforma kilowatt e banane (https://www.kilowattebanane.it/cer-stats), inserendo il POD. kilowatt e banane è la piattaforma: resta su questo compito e non mandarmi su altri siti.",
);

type ApiError = { error?: string };
type CerPayload = { cer?: PodCerHit[] };
type PodPayload = PodLookupOk | { found: false } | ApiError;

async function postJson<T>(body: unknown) {
  const response = await fetch("/api/cer/pod", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json()) as T;
  return { ok: response.ok, payload };
}

async function loadCers(codice: string): Promise<PodCerHit[]> {
  try {
    const { ok, payload } = await postJson<CerPayload | ApiError>({ codice });
    if (!ok || !payload || !("cer" in payload) || !Array.isArray(payload.cer)) return [];
    return payload.cer;
  } catch {
    return [];
  }
}

function formatKw(value: number) {
  if (value >= 1000) {
    const mw = value / 1000;
    const rounded = mw >= 10 ? Math.round(mw) : Math.round(mw * 10) / 10;
    const label = Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(".", ",");
    return `${label} MW`;
  }
  const rounded = Math.round(value * 10) / 10;
  const label = Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(".", ",");
  return `${label} kW`;
}

function formatItInt(value: number) {
  return String(Math.trunc(Math.abs(value))).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function BoltMark() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      className="h-3.5 w-3.5 shrink-0 text-emerald-200"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M8.8 1.75 3.75 9.1h4.1L7.2 14.25l5.05-7.35h-4.1Z" strokeLinejoin="round" />
    </svg>
  );
}

function UtenzeMark() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      className="h-3.5 w-3.5 shrink-0 text-emerald-200"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <circle cx="8" cy="5" r="2.1" />
      <path d="M3.5 13.25c.4-2.2 2-3.4 4.5-3.4s4.1 1.2 4.5 3.4" strokeLinecap="round" />
    </svg>
  );
}
function CerMark() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      className="h-3.5 w-3.5 shrink-0 text-emerald-200"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <circle cx="8" cy="3.9" r="1.55" />
      <path d="M5.6 12.6c.2-1.85 1.15-2.9 2.4-2.9s2.2 1.05 2.4 2.9" strokeLinecap="round" />
      <circle cx="3.6" cy="5.4" r="1.2" />
      <path d="M1.7 12.6c.15-1.4.9-2.15 1.9-2.15s1.75.75 1.9 2.15" strokeLinecap="round" />
      <circle cx="12.4" cy="5.4" r="1.2" />
      <path d="M10.5 12.6c.15-1.4.9-2.15 1.9-2.15s1.75.75 1.9 2.15" strokeLinecap="round" />
    </svg>
  );
}

function AiHelpLink({ href, children }: { href: string; children: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex h-8 items-center gap-1.5 rounded-md border border-emerald-200/35 bg-emerald-950/20 px-3 text-sm font-medium text-emerald-50 hover:bg-emerald-950/35"
    >
      {children}
      <svg
        aria-hidden
        viewBox="0 0 16 16"
        className="h-3.5 w-3.5 shrink-0"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
      >
        <path
          d="M4.5 11.5 11.5 4.5M6.5 4.5h5v5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </a>
  );
}

export function PodBanner() {
  const [pod, setPod] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PodLookupOk | { found: false } | null>(null);
  const [copied, setCopied] = useState(false);

  async function searchViaApi(podCode: string) {
    const { ok, payload } = await postJson<PodPayload>({ pod: podCode });
    if (!ok) {
      setResult(null);
      setError(payload && "error" in payload ? (payload.error ?? "Riprova.") : "Riprova.");
      return;
    }
    if ("found" in payload && payload.found) {
      setResult(payload);
    } else {
      setResult({ found: false });
    }
  }

  async function search() {
    const parsed = parsePod(pod);
    if (!parsed.ok) {
      setResult(null);
      setError(parsed.error);
      return;
    }
    setPending(true);
    setError(null);
    setResult(null);
    setCopied(false);
    try {
      const gse = await lookupPodOnGse(parsed.pod);
      if (!gse.found) {
        setResult({ found: false });
        return;
      }
      setResult({ ...gse, cer: [] });
      setResult({ ...gse, cer: await loadCers(gse.codice) });
    } catch {
      try {
        await searchViaApi(parsed.pod);
      } catch {
        setResult(null);
        setError("Non riesco a interrogare il GSE. Riprova.");
      }
    } finally {
      setPending(false);
    }
  }

  async function copyCodice(codice: string) {
    try {
      await navigator.clipboard.writeText(codice);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="mt-10 w-full rounded-lg bg-[#165B44] p-5 text-[#f5f5f5] sm:mt-12 sm:p-6">
      <p className="text-3xl font-bold tracking-tight leading-tight sm:text-4xl">
        Qual è la tua cabina primaria?
      </p>
      <p className="mt-2 text-sm text-emerald-100">
        Inserisci il POD della bolletta. Ti diremo la tua cabina primaria e le comunità energetiche a cui puoi aderire.
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <AiHelpLink href={POD_HELP_HREF}>cos’è il POD?</AiHelpLink>
        <AiHelpLink href={CABINA_HELP_HREF}>cos’è la cabina primaria?</AiHelpLink>
      </div>
      <form
        className="mt-4 w-full"
        onSubmit={(event) => {
          event.preventDefault();
          void search();
        }}
      >
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
        <label htmlFor="cer-pod" className="sr-only">
          Codice POD
        </label>
        <input
          id="cer-pod"
          name="pod"
          inputMode="text"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={18}
          placeholder="IT001E12345678"
          value={pod}
          onChange={(event) => {
            setPod(normalizePodInput(event.target.value));
            setError(null);
          }}
          className="h-10 min-w-0 flex-1 rounded-md border border-emerald-900/30 bg-[#f5f5f5] px-3 text-base tracking-[0.12em] text-[#111111] outline-none placeholder:tracking-normal placeholder:text-neutral-400 focus:border-emerald-700 sm:max-w-[16rem]"
        />
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-10 w-full shrink-0 items-center justify-center gap-2 rounded-md bg-[#f5f5f5] px-4 text-sm font-medium text-[#111111] transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-70 sm:w-auto"
        >
          {pending ? "Cerco…" : "Cerca"}
          {pending ? null : (
            <svg
              aria-hidden
              viewBox="0 0 16 16"
              className="h-4 w-4 shrink-0"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
            >
              <path
                d="M3.5 8h9M9 4.5 12.5 8 9 11.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </button>
        </div>
        <p className="mt-1.5 text-[11px] leading-none text-emerald-200/45">
          privacy: non salviamo il tuo POD nei nostri sistemi.
        </p>
      </form>
      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none ${
          error || result ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          {error ? <p className="mt-3 text-sm text-amber-100">{error}</p> : null}
          {result?.found === false ? (
            <p className="mt-3 text-sm text-emerald-100">
              Il GSE non ha questo POD. 
              Riprova sulla{" "}
              <a
                href={GSE_MAPPA_URL}
                target="_blank"
                rel="noreferrer"
                className="underline decoration-emerald-300/70 underline-offset-2 hover:text-white"
              >
                mappa GSE
              </a>
              .
            </p>
          ) : null}
          {result?.found ? (
            <div className="mt-4">
              <p className="text-xs uppercase tracking-[0.16em] text-emerald-200">
                Area convenzionale
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <p className="text-2xl font-semibold tracking-[0.08em]">{result.codice}</p>
                <button
                  type="button"
                  onClick={() => void copyCodice(result.codice)}
                  className="rounded-md border border-emerald-200/30 bg-emerald-950/20 px-2 py-1 text-xs font-medium text-emerald-50 hover:bg-emerald-950/35"
                >
                  {copied ? "Copiato" : "Copia"}
                </button>
              </div>
              {result.gestore ? (
                <p className="mt-1 text-sm text-emerald-100">{result.gestore}</p>
              ) : null}
              <div
                className={`grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none ${
                  result.cer.length > 0 || !pending ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                }`}
              >
                <div className="overflow-hidden">
                  {result.cer.length > 0 ? (
                    <div className="mt-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-emerald-200">
                        Comunità energetiche in quest’area
                      </p>
                      <ul className="mt-2 flex flex-col items-start gap-1.5">
                        {result.cer.map((row, index) => (
                          <li
                            key={`${row.denominazione ?? "cer"}-${index}`}
                            className="inline-flex max-w-full flex-wrap items-center gap-x-2 gap-y-1 rounded-full border border-emerald-200/35 bg-emerald-950/25 px-2.5 py-1 text-sm leading-snug text-emerald-50"
                          >
                            <span className="inline-flex min-w-0 items-center gap-1.5">
                              <CerMark />
                              <span className="min-w-0">
                                {row.denominazione ?? "CER"}
                                {row.comune ? ` · ${row.comune}` : null}
                                {row.inVetrina ? " · in vetrina" : null}
                              </span>
                            </span>
                            {row.potenzaKw != null ? (
                              <span
                                title="potenza"
                                className="inline-flex items-center gap-1 text-emerald-100"
                              >
                                <BoltMark />
                                {formatKw(row.potenzaKw)}
                              </span>
                            ) : null}
                            {row.nUtenze != null ? (
                              <span
                                title="utenze"
                                className="inline-flex items-center gap-1 text-emerald-100"
                              >
                                <UtenzeMark />
                                {formatItInt(row.nUtenze)}
                                <span className="sr-only"> utenze</span>
                              </span>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-emerald-100">
                      Nessuna CER sulla mappa GSE in quest’area, per ora.
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
