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
        Inserisci il POD della bolletta.
      </p>
      <form
        className="mt-4 flex w-full flex-col gap-2 sm:flex-row sm:items-center"
        onSubmit={(event) => {
          event.preventDefault();
          void search();
        }}
      >
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
      </form>
      {error ? <p className="mt-3 text-sm text-amber-100">{error}</p> : null}
      {result?.found === false ? (
        <p className="mt-3 text-sm text-emerald-100">
          Il GSE non ha questo POD. A volte il gestore di rete non ha ancora inviato i dati.
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
          {result.cer.length > 0 ? (
            <ul className="mt-3 space-y-1 text-sm text-emerald-50">
              {result.cer.map((row, index) => (
                <li key={`${row.denominazione ?? "cer"}-${index}`}>
                  {row.denominazione ?? "CER"}
                  {row.comune ? ` · ${row.comune}` : null}
                  {row.inVetrina ? " · in vetrina" : null}
                </li>
              ))}
            </ul>
          ) : pending ? null : (
            <p className="mt-3 text-sm text-emerald-100">
              Nessuna CER sulla mappa GSE in quest’area, per ora.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
