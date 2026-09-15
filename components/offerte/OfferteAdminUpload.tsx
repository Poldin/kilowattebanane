"use client";

import { useCallback, useEffect, useState } from "react";
import { OFFERTE_ADMIN_TOKEN_KEY } from "@/lib/offerte/admin-constants";

type ImportRow = {
  kind: string;
  label: string;
  snapshotDate: string | null;
  finishedAt: string | null;
  status: string | null;
};

type FileHint = {
  kind: string;
  label: string;
  filename: string;
  url: string;
};

type StatusPayload = {
  imports: ImportRow[];
  snapshotDate: string | null;
  portaleUrl: string;
  files: FileHint[];
};

type Summary = {
  kind: string;
  snapshotDate: string;
  seen: number;
  inserted: number;
  unchanged: number;
  delisted: number;
  relisted: number;
};

function authHeaders(): HeadersInit {
  const token = localStorage.getItem(OFFERTE_ADMIN_TOKEN_KEY);
  if (!token) return {};
  return { "x-offerte-admin-token": token };
}

function formatItDate(iso: string | null) {
  if (!iso) return "—";
  const [year, month, day] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("it-IT", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function formatItDateTime(iso: string | null) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("it-IT", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Rome",
  }).format(new Date(iso));
}

export function OfferteAdminUpload() {
  const [configured, setConfigured] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [summaries, setSummaries] = useState<Summary[] | null>(null);

  const loadStatus = useCallback(async () => {
    const response = await fetch("/api/admin/offerte/status", {
      headers: authHeaders(),
    });
    if (response.status === 401) {
      setAuthenticated(false);
      localStorage.removeItem(OFFERTE_ADMIN_TOKEN_KEY);
      return;
    }
    if (!response.ok) {
      throw new Error("Non riesco a caricare lo stato.");
    }
    setStatus((await response.json()) as StatusPayload);
  }, []);

  const bootstrap = useCallback(async () => {
    setLoading(true);
    setAuthError(null);
    try {
      const sessionRes = await fetch("/api/admin/offerte/session");
      const session = (await sessionRes.json()) as {
        configured?: boolean;
        authenticated?: boolean;
      };
      if (!sessionRes.ok || session.configured === false) {
        setConfigured(false);
        setAuthenticated(false);
        return;
      }
      setConfigured(true);
      setAuthenticated(Boolean(session.authenticated));
      if (session.authenticated) {
        await loadStatus();
      }
    } catch {
      setAuthError("Non riesco a verificare la sessione.");
    } finally {
      setLoading(false);
    }
  }, [loadStatus]);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  async function handleLogin(event: React.FormEvent) {
    event.preventDefault();
    setAuthError(null);
    const response = await fetch("/api/admin/offerte/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const payload = (await response.json()) as { error?: string; token?: string };
    if (!response.ok) {
      setAuthError(payload.error ?? "Password errata.");
      return;
    }
    if (payload.token) {
      localStorage.setItem(OFFERTE_ADMIN_TOKEN_KEY, payload.token);
    }
    setPassword("");
    setAuthenticated(true);
    await loadStatus();
  }

  async function handleLogout() {
    await fetch("/api/admin/offerte/session", { method: "DELETE" });
    localStorage.removeItem(OFFERTE_ADMIN_TOKEN_KEY);
    setAuthenticated(false);
    setStatus(null);
    setSummaries(null);
  }

  async function handleUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUploadError(null);
    setSummaries(null);
    setUploading(true);
    try {
      const form = new FormData(event.currentTarget);
      const response = await fetch("/api/admin/offerte/upload", {
        method: "POST",
        headers: authHeaders(),
        body: form,
      });
      const payload = (await response.json()) as {
        error?: string;
        summaries?: Summary[];
      };
      if (!response.ok) {
        setUploadError(payload.error ?? "Import fallito.");
        return;
      }
      setSummaries(payload.summaries ?? []);
      event.currentTarget.reset();
      await loadStatus();
    } catch {
      setUploadError("Import fallito. Riprova.");
    } finally {
      setUploading(false);
    }
  }

  if (loading) {
    return <p className="mt-6 text-sm text-neutral-500 dark:text-neutral-400">Carico…</p>;
  }

  if (!configured) {
    return (
      <p className="mt-6 text-sm text-red-600 dark:text-red-400">
        Imposta <code className="text-xs">OFFERTE_ADMIN_PASSWORD</code> su Vercel per abilitare
        questa pagina.
      </p>
    );
  }

  if (!authenticated) {
    return (
      <form className="mt-8 max-w-sm" onSubmit={handleLogin}>
        <label htmlFor="offerte-admin-password" className="text-sm text-neutral-600 dark:text-neutral-400">
          Password
        </label>
        <input
          id="offerte-admin-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="mt-2 h-11 w-full rounded-md border border-neutral-200 bg-transparent px-3 text-sm outline-none focus:border-neutral-400 dark:border-neutral-800 dark:focus:border-neutral-600"
        />
        {authError ? (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">{authError}</p>
        ) : null}
        <button
          type="submit"
          className="mt-4 h-11 rounded-md border border-neutral-200 bg-neutral-900 px-4 text-sm text-white transition-colors hover:bg-neutral-800 dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white"
        >
          Entra
        </button>
      </form>
    );
  }

  return (
    <div className="mt-8 space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Ultimo snapshot importato:{" "}
            <strong className="font-medium text-foreground">
              {formatItDate(status?.snapshotDate ?? null)}
            </strong>
          </p>
          <ul className="mt-3 space-y-1 text-sm text-neutral-600 dark:text-neutral-400">
            {(status?.imports ?? []).map((row) => (
              <li key={row.kind}>
                {row.label}:{" "}
                <span className="text-foreground">{formatItDate(row.snapshotDate)}</span>
                {row.finishedAt ? (
                  <span className="text-neutral-500 dark:text-neutral-500">
                    {" "}
                    · caricato {formatItDateTime(row.finishedAt)}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
        <button
          type="button"
          onClick={() => void handleLogout()}
          className="rounded-md border border-neutral-200 px-3 py-1.5 text-sm text-neutral-700 transition-colors hover:bg-neutral-100 dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-900"
        >
          Esci
        </button>
      </div>

      <section className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
        <h2 className="text-sm font-medium tracking-tight">Come scaricare i file</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
          <li>
            Apri la pagina open data del{" "}
            <a
              href={status?.portaleUrl}
              target="_blank"
              rel="noreferrer"
              className="underline decoration-neutral-300 underline-offset-2 hover:text-foreground dark:decoration-neutral-600"
            >
              Portale Offerte
            </a>
            .
          </li>
          <li>Scarica i tre file del giorno (di solito disponibili dopo la mezzanotte).</li>
          <li>Caricali qui sotto: almeno PLACET e mercato libero per aggiornare le offerte.</li>
        </ol>
        <ul className="mt-4 space-y-2 text-sm">
          {(status?.files ?? []).map((file) => (
            <li key={file.kind}>
              <span className="font-medium text-foreground">{file.label}</span>
              {" · "}
              <a
                href={file.url}
                target="_blank"
                rel="noreferrer"
                className="break-all underline decoration-neutral-300 underline-offset-2 hover:text-foreground dark:decoration-neutral-600"
              >
                {file.filename}
              </a>
            </li>
          ))}
        </ul>
      </section>

      <form className="space-y-4" onSubmit={handleUpload}>
        <div>
          <label htmlFor="offerte-upload" className="text-sm font-medium tracking-tight">
            Carica i file
          </label>
          <input
            id="offerte-upload"
            name="files"
            type="file"
            multiple
            accept=".csv,.xml,text/csv,text/xml,application/xml"
            className="mt-2 block w-full max-w-lg text-sm text-neutral-600 file:mr-3 file:rounded-md file:border-0 file:bg-neutral-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-foreground hover:file:bg-neutral-200 dark:text-neutral-400 dark:file:bg-neutral-900 dark:hover:file:bg-neutral-800"
          />
          <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
            Accetta i nomi standard ARERA: PLACET CSV, ML XML, Parametri CSV.
          </p>
        </div>
        <button
          type="submit"
          disabled={uploading}
          className="h-11 rounded-md border border-neutral-200 bg-neutral-900 px-4 text-sm text-white transition-colors hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white"
        >
          {uploading ? "Import in corso…" : "Importa"}
        </button>
        {uploadError ? (
          <p className="text-sm text-red-600 dark:text-red-400">{uploadError}</p>
        ) : null}
        {summaries && summaries.length > 0 ? (
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm dark:border-neutral-800 dark:bg-neutral-900">
            <p className="font-medium text-foreground">Import completato</p>
            <ul className="mt-2 space-y-1 text-neutral-600 dark:text-neutral-400">
              {summaries.map((summary) => (
                <li key={summary.kind}>
                  {summary.kind}: snapshot {formatItDate(summary.snapshotDate)} · viste{" "}
                  {summary.seen} · nuove {summary.inserted} · invariate {summary.unchanged}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </form>
    </div>
  );
}
