"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { FasciaPlanIcon, fasciaPlanLabel } from "@/components/offerte/FasciaPlanIcon";
import {
  NewTabIcon,
  OfferCodeLink,
  OfferDettaglio,
  absoluteHttpUrl,
  formatOfferPeriod,
} from "@/components/offerte/OfferHitDettaglio";
import {
  ClienteIcon,
  MercatoIcon,
  PrezzoIcon,
  clienteKindFromTipo,
  clienteLabel,
  mercatoLabel,
  prezzoKindFromTipo,
  prezzoLabel,
} from "@/components/offerte/OfferteTraitIcons";
import {
  OFFERTE_SEARCH_PAGE_SIZE,
  PORTALE_OFFERTE_URL,
  type CapPlace,
  type OfferteCliente,
  type OfferteFascia,
  type OfferteHeadlineStats,
  type OfferteMercato,
  type OffertePrezzo,
  type OfferteSearchHit,
} from "@/lib/offerte/public-types";
import {
  POTENZA_STANDARD_CASA_KW,
  clampPotenzaKw,
  formatPotenzaKw,
  potenzeImpegnateKw,
} from "@/lib/offerte/potenza";

const PREF_KEY = "kilowattebanane.offerte.v1";
const STATS_HREF = "/offer-stats";

type Prefs = {
  cap: string;
  cliente: OfferteCliente;
  mercato: OfferteMercato;
  prezzo: OffertePrezzo;
  fascia: OfferteFascia;
  consumoKwh: number;
  potenzaKw: number;
};

const DEFAULTS: Prefs = {
  cap: "",
  cliente: "domestico",
  mercato: "tutti",
  prezzo: "tutti",
  fascia: "tutti",
  consumoKwh: 2700,
  potenzaKw: POTENZA_STANDARD_CASA_KW,
};

type SearchPayload = {
  places: CapPlace[];
  punEurKwh: number | null;
  hits: OfferteSearchHit[];
  totalMatched: number;
  error?: string;
};

export function OfferteExplorer({
  stats,
  className,
}: {
  stats: OfferteHeadlineStats;
  className?: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const capInputRef = useRef<HTMLInputElement>(null);
  const dialogCapRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);
  const [open, setOpen] = useState(false);
  const [capError, setCapError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SearchPayload | null>(null);
  const [advanced, setAdvanced] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PREF_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<Prefs>;
      setPrefs((prev) => {
        const cliente =
          parsed.cliente === "non domestico" || parsed.cliente === "domestico"
            ? parsed.cliente
            : prev.cliente;
        return {
          ...prev,
          ...parsed,
          cap: String(parsed.cap ?? "").replace(/\D/g, "").slice(0, 5),
          cliente,
          potenzaKw: clampPotenzaKw(Number(parsed.potenzaKw ?? prev.potenzaKw), cliente),
        };
      });
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(PREF_KEY, JSON.stringify(prefs));
  }, [prefs]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
    if (open) queueMicrotask(() => dialogCapRef.current?.focus());
  }, [open]);

  useEffect(() => {
    if (!open || prefs.cap.length !== 5) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          cap: prefs.cap,
          cliente: prefs.cliente,
          mercato: prefs.mercato,
          prezzo: prefs.prezzo,
          fascia: prefs.fascia,
          consumo: String(prefs.consumoKwh),
          potenza: String(prefs.potenzaKw),
        });
        const response = await fetch(`/api/offerte/search?${params}`, {
          signal: controller.signal,
        });
        const payload = (await response.json()) as SearchPayload & { error?: string };
        if (!response.ok) {
          setResult({ places: [], punEurKwh: null, hits: [], totalMatched: 0, error: payload.error });
          return;
        }
        setResult(payload);
        setCapError(payload.places.length === 0 ? "Questo CAP non è in anagrafica." : null);
      } catch (error) {
        if ((error as { name?: string }).name === "AbortError") return;
        setResult({
          places: [],
          punEurKwh: null,
          hits: [],
          totalMatched: 0,
          error: "Non riesco a caricare le offerte. Riprova.",
        });
      } finally {
        setLoading(false);
      }
    }, 220);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [open, prefs]);

  const placeLabel = useMemo(() => {
    const names = [...new Set((result?.places ?? []).map((place) => place.comuneNome))];
    if (names.length === 0) return null;
    const region = result?.places[0]?.regioneNome;
    return region ? `${names.join(", ")} · ${region}` : names.join(", ");
  }, [result]);

  async function submitCap(cap: string) {
    const next = cap.replace(/\D/g, "").slice(0, 5);
    setPrefs((prev) => ({ ...prev, cap: next }));
    if (next.length !== 5) {
      setCapError(null);
      return;
    }
    try {
      const response = await fetch(`/api/offerte/search?lookup=1&cap=${next}`);
      const payload = (await response.json()) as { places?: CapPlace[]; error?: string };
      if (!payload.places?.length) {
        setCapError("Questo CAP non è in anagrafica.");
        return;
      }
      setCapError(null);
      setResult({ places: payload.places, punEurKwh: null, hits: [], totalMatched: 0 });
      setOpen(true);
    } catch {
      setCapError("Non riesco a verificare il CAP. Riprova.");
    }
  }

  function closeDialog() {
    setOpen(false);
    queueMicrotask(() => capInputRef.current?.focus());
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
          void submitCap(prefs.cap);
        }}
      >
        <label htmlFor="offerte-cap" className="text-sm text-neutral-600 dark:text-neutral-400">
          inserisci il CAP
        </label>
        <div className="flex gap-2">
          <input
            ref={capInputRef}
            id="offerte-cap"
            name="cap"
            inputMode="numeric"
            autoComplete="postal-code"
            maxLength={5}
            placeholder="20121"
            value={prefs.cap}
            onChange={(event) => {
              const next = event.target.value.replace(/\D/g, "").slice(0, 5);
              setPrefs((prev) => ({ ...prev, cap: next }));
              setCapError(null);
              if (next.length === 5) void submitCap(next);
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
      </form>

      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        className="offerte-dialog"
        onClose={closeDialog}
      >
        <div className="flex h-full min-h-0 flex-col">
          <header className="shrink-0 bg-background">
            <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
              <div className="min-w-0 flex-1">
                <h2 id={titleId} className="sr-only">
                  Offerte nel CAP {prefs.cap || ""}
                </h2>
                <label htmlFor="offerte-cap-dialog" className="sr-only">
                  CAP della fornitura
                </label>
                <input
                  ref={dialogCapRef}
                  id="offerte-cap-dialog"
                  inputMode="numeric"
                  autoComplete="postal-code"
                  maxLength={5}
                  value={prefs.cap}
                  onChange={(event) => {
                    const next = event.target.value.replace(/\D/g, "").slice(0, 5);
                    setPrefs((prev) => ({ ...prev, cap: next }));
                  }}
                  className="w-full border-0 bg-transparent p-0 text-3xl font-semibold tracking-[0.14em] text-foreground outline-none sm:text-4xl"
                />
                {placeLabel ? (
                  <p className="mt-0.5 truncate text-sm text-neutral-600 dark:text-neutral-400">
                    {placeLabel}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={closeDialog}
                className="shrink-0 rounded-md border border-neutral-200 px-3 py-1.5 text-sm text-neutral-700 transition-colors hover:bg-neutral-100 dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-900"
              >
                Chiudi
              </button>
            </div>
          </header>

          <div className="offerte-dialog-scroll min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-3xl px-4 pb-6 pt-4 sm:px-6">
            <div className="flex flex-col gap-6">
              <fieldset>
                <legend className="text-sm text-neutral-500 dark:text-neutral-400">Chi sei</legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Chip
                    active={prefs.cliente === "domestico"}
                    onClick={() =>
                      setPrefs((prev) => ({
                        ...prev,
                        cliente: "domestico",
                        potenzaKw: clampPotenzaKw(prev.potenzaKw, "domestico"),
                      }))
                    }
                    icon={<ClienteIcon kind="domestico" />}
                  >
                    Casa
                  </Chip>
                  <Chip
                    active={prefs.cliente === "non domestico"}
                    onClick={() =>
                      setPrefs((prev) => ({
                        ...prev,
                        cliente: "non domestico",
                        potenzaKw: clampPotenzaKw(prev.potenzaKw, "non domestico"),
                      }))
                    }
                    icon={<ClienteIcon kind="non domestico" />}
                  >
                    Partita IVA
                  </Chip>
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-sm text-neutral-500 dark:text-neutral-400">Prezzo</legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Chip
                    active={prefs.prezzo === "tutti"}
                    onClick={() => setPrefs((prev) => ({ ...prev, prezzo: "tutti" }))}
                    icon={<PrezzoIcon kind="tutti" />}
                  >
                    Tutti
                  </Chip>
                  <Chip
                    active={prefs.prezzo === "prezzo fisso"}
                    onClick={() => setPrefs((prev) => ({ ...prev, prezzo: "prezzo fisso" }))}
                    icon={<PrezzoIcon kind="prezzo fisso" />}
                  >
                    Fisso
                  </Chip>
                  <Chip
                    active={prefs.prezzo === "prezzo variabile"}
                    onClick={() => setPrefs((prev) => ({ ...prev, prezzo: "prezzo variabile" }))}
                    icon={<PrezzoIcon kind="prezzo variabile" />}
                  >
                    Variabile
                  </Chip>
                </div>
              </fieldset>

              <PotenzaSelect
                cliente={prefs.cliente}
                value={prefs.potenzaKw}
                onChange={(potenzaKw) => setPrefs((prev) => ({ ...prev, potenzaKw }))}
              />

              <label className="flex flex-col gap-2">
                <span className="flex items-baseline justify-between text-sm text-neutral-500 dark:text-neutral-400">
                  Consumo annuo
                  <strong className="font-medium text-foreground">
                    {formatIt(prefs.consumoKwh)} kWh
                  </strong>
                </span>
                <input
                  type="range"
                  min={800}
                  max={8000}
                  step={50}
                  value={prefs.consumoKwh}
                  onChange={(event) =>
                    setPrefs((prev) => ({ ...prev, consumoKwh: Number(event.target.value) }))
                  }
                  className="w-full accent-neutral-800 dark:accent-neutral-200"
                />
                <span className="text-xs text-neutral-500 dark:text-neutral-400">
                  Media famiglia italiana ~2.700 kWh.
                </span>
              </label>

              <div>
                <button
                  type="button"
                  aria-expanded={advanced}
                  onClick={() => setAdvanced((open) => !open)}
                  className={
                    advanced
                      ? "rounded-md border border-neutral-900 bg-neutral-900 px-3 py-1.5 text-sm text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900"
                      : "rounded-md border border-neutral-200 bg-transparent px-3 py-1.5 text-sm text-neutral-700 transition-colors hover:bg-neutral-100 dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-900"
                  }
                >
                  {advanced ? "Nascondi filtri avanzati" : "Usa tutti i filtri"}
                </button>
              </div>

              {advanced ? (
                <div className="grid gap-6 sm:grid-cols-2">
                  <fieldset>
                    <legend className="text-sm text-neutral-500 dark:text-neutral-400">Mercato</legend>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Chip
                        active={prefs.mercato === "tutti"}
                        onClick={() => setPrefs((prev) => ({ ...prev, mercato: "tutti" }))}
                        icon={<MercatoIcon kind="tutti" />}
                      >
                        Tutti
                      </Chip>
                      <Chip
                        active={prefs.mercato === "placet"}
                        onClick={() => setPrefs((prev) => ({ ...prev, mercato: "placet" }))}
                        icon={<MercatoIcon kind="placet" />}
                      >
                        PLACET
                      </Chip>
                      <Chip
                        active={prefs.mercato === "ml"}
                        onClick={() => setPrefs((prev) => ({ ...prev, mercato: "ml" }))}
                        icon={<MercatoIcon kind="ml" />}
                      >
                        Mercato libero
                      </Chip>
                    </div>
                  </fieldset>
                  <fieldset className="sm:col-span-2">
                    <legend className="text-sm text-neutral-500 dark:text-neutral-400">
                      Profilo orario
                    </legend>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Chip
                        active={prefs.fascia === "tutti"}
                        onClick={() => setPrefs((prev) => ({ ...prev, fascia: "tutti" }))}
                        icon={<MercatoIcon kind="tutti" />}
                        title="Tutti i profili"
                      >
                        Tutte
                      </Chip>
                      <Chip
                        active={prefs.fascia === "monoraria"}
                        onClick={() => setPrefs((prev) => ({ ...prev, fascia: "monoraria" }))}
                        icon={<FasciaPlanIcon plan="monoraria" />}
                        title="Un prezzo tutte le ore (fisso o PUN del mese)"
                      >
                        Monoraria
                      </Chip>
                      <Chip
                        active={prefs.fascia === "bioraria"}
                        onClick={() => setPrefs((prev) => ({ ...prev, fascia: "bioraria" }))}
                        icon={<FasciaPlanIcon plan="bioraria" />}
                        title="Due fasce: F1 e F23"
                      >
                        Bioraria
                      </Chip>
                      <Chip
                        active={prefs.fascia === "fasce"}
                        onClick={() => setPrefs((prev) => ({ ...prev, fascia: "fasce" }))}
                        icon={<FasciaPlanIcon plan="fasce" />}
                        title="Tre fasce: F1, F2 e F3"
                      >
                        Trioraria
                      </Chip>
                      <Chip
                        active={prefs.fascia === "dinamica"}
                        onClick={() =>
                          setPrefs((prev) => ({
                            ...prev,
                            fascia: "dinamica",
                            prezzo: prev.prezzo === "prezzo fisso" ? "prezzo variabile" : prev.prezzo,
                            mercato: prev.mercato === "placet" ? "ml" : prev.mercato,
                          }))
                        }
                        icon={<FasciaPlanIcon plan="dinamica" />}
                        title="PUN ora per ora + spread e/o quota fissa del fornitore"
                      >
                        Dinamica
                      </Chip>
                    </div>
                    {fasciaHint(prefs.fascia) ? (
                      <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
                        {fasciaHint(prefs.fascia)}
                      </p>
                    ) : null}
                  </fieldset>
                </div>
              ) : null}
            </div>

            <div className="mt-8 min-h-40">
              {loading && !result?.hits.length ? (
                <p className="text-sm text-neutral-500">Carico le offerte…</p>
              ) : result?.error ? (
                <p className="text-sm text-red-600 dark:text-red-400">{result.error}</p>
              ) : result && result.places.length === 0 && prefs.cap.length === 5 ? (
                <p className="text-sm text-neutral-500">Nessun comune per questo CAP.</p>
              ) : (
                <ResultsList
                  hits={result?.hits ?? []}
                  total={result?.totalMatched ?? 0}
                  loading={loading}
                  fascia={prefs.fascia}
                  prefs={prefs}
                />
              )}
            </div>

            <p className="mt-8 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
              Quota fissa e spread dalla scheda Portale Offerte. La stima di bolletta arriverà
              quando avremo anche i prezzi futuri dell&apos;energia. Fonte:{" "}
              <a
                href={PORTALE_OFFERTE_URL}
                target="_blank"
                rel="noreferrer"
                className="underline decoration-neutral-300 underline-offset-2 hover:text-foreground dark:decoration-neutral-600"
              >
                open data Portale Offerte
              </a>
              , elaborazione kilowatt e banane.
            </p>
            </div>
          </div>
        </div>
      </dialog>
    </section>
  );
}

function Chip({
  active,
  onClick,
  icon,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon?: ReactNode;
  title?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
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

function PotenzaSelect({
  cliente,
  value,
  onChange,
}: {
  cliente: OfferteCliente;
  value: number;
  onChange: (value: number) => void;
}) {
  const options = potenzeImpegnateKw(cliente);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();
  const labelId = useId();
  const selectedIndex = options.indexOf(value);
  const selectedLabel = formatPotenzaKw(value);
  const [menuBox, setMenuBox] = useState<{ top: number; left: number; width: number } | null>(
    null,
  );

  function syncMenuBox() {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    setMenuBox({ top: rect.bottom + 8, left: rect.left, width: rect.width });
  }

  useEffect(() => {
    setOpen(false);
  }, [cliente]);

  useEffect(() => {
    if (!open) return;
    syncMenuBox();
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onScrollOrResize() {
      setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    window.addEventListener("resize", onScrollOrResize);
    const scroller = triggerRef.current?.closest(".offerte-dialog-scroll");
    scroller?.addEventListener("scroll", onScrollOrResize);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("resize", onScrollOrResize);
      scroller?.removeEventListener("scroll", onScrollOrResize);
    };
  }, [open]);

  useEffect(() => {
    if (!open || activeIndex < 0) return;
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  function openList() {
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
    setOpen(true);
  }

  function selectKw(kw: number) {
    onChange(kw);
    setOpen(false);
  }

  function onTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openList();
    }
  }

  function onListKeyDown(event: KeyboardEvent<HTMLUListElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, options.length - 1));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      const kw = options[activeIndex];
      if (kw != null) selectKw(kw);
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      setActiveIndex(0);
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      setActiveIndex(options.length - 1);
    }
  }

  return (
    <div ref={rootRef} className="relative max-w-md">
      <span id={labelId} className="mb-2 block text-sm text-neutral-500 dark:text-neutral-400">
        Potenza impegnata
      </span>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-labelledby={labelId}
        onClick={() => {
          if (open) setOpen(false);
          else openList();
        }}
        onKeyDown={onTriggerKeyDown}
        className={`flex h-11 w-full items-center justify-between gap-2 rounded-md border bg-transparent px-3 text-left text-sm outline-none transition-colors ${
          open
            ? "border-neutral-400 dark:border-neutral-500"
            : "border-neutral-200 hover:border-neutral-300 dark:border-neutral-800 dark:hover:border-neutral-700"
        }`}
      >
        <span className="flex min-w-0 flex-1 items-baseline gap-2">
          <span className="truncate font-medium text-foreground">{selectedLabel}</span>
          {cliente === "domestico" && value === POTENZA_STANDARD_CASA_KW ? (
            <span className="truncate text-xs text-neutral-500 dark:text-neutral-400">
              più diffusa in casa
            </span>
          ) : null}
        </span>
        <svg
          aria-hidden
          viewBox="0 0 16 16"
          className={`h-4 w-4 shrink-0 text-neutral-500 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && menuBox
        ? createPortal(
            <div
              ref={menuRef}
              style={{
                position: "fixed",
                top: menuBox.top,
                left: menuBox.left,
                width: menuBox.width,
                zIndex: 80,
              }}
              className="overflow-hidden rounded-md border border-neutral-200 bg-background shadow-lg dark:border-neutral-800"
            >
              <ul
                ref={listRef}
                id={listId}
                role="listbox"
                tabIndex={-1}
                aria-labelledby={labelId}
                aria-activedescendant={
                  activeIndex >= 0 ? `${listId}-opt-${activeIndex}` : undefined
                }
                onKeyDown={onListKeyDown}
                className="region-select-list max-h-56 overflow-y-auto py-1 outline-none"
              >
                {options.map((kw, index) => {
                  const isSelected = kw === value;
                  const active = index === activeIndex;
                  const hint =
                    cliente === "domestico" && kw === POTENZA_STANDARD_CASA_KW
                      ? "più diffusa in casa"
                      : null;
                  return (
                    <li
                      key={kw}
                      id={`${listId}-opt-${index}`}
                      role="option"
                      aria-selected={isSelected}
                      data-index={index}
                    >
                      <button
                        type="button"
                        onMouseEnter={() => setActiveIndex(index)}
                        onClick={() => selectKw(kw)}
                        className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                          active
                            ? "bg-neutral-100 text-foreground dark:bg-neutral-900"
                            : "text-neutral-700 dark:text-neutral-300"
                        }`}
                      >
                        <span className={`min-w-0 flex-1 ${isSelected ? "font-medium" : ""}`}>
                          {formatPotenzaKw(kw)}
                          {hint ? (
                            <span className="ml-2 font-normal text-neutral-500 dark:text-neutral-400">
                              {hint}
                            </span>
                          ) : null}
                        </span>
                        <svg
                          aria-hidden
                          viewBox="0 0 16 16"
                          className={`h-3.5 w-3.5 shrink-0 text-foreground ${
                            isSelected ? "opacity-100" : "opacity-0"
                          }`}
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.75"
                        >
                          <path
                            d="M3.5 8.5l3 3 6-6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>,
            rootRef.current?.closest("dialog") ?? document.body,
          )
        : null}
    </div>
  );
}

function fasciaHint(fascia: OfferteFascia) {
  if (fascia === "monoraria") return "Un prezzo tutte le ore: fisso, o PUN medio del mese più spread.";
  if (fascia === "bioraria") return "Il prezzo cambia tra F1 e F23.";
  if (fascia === "fasce") return "Il prezzo cambia tra F1, F2 e F3.";
  if (fascia === "dinamica") {
    return "PUN ora per ora, più spread e/o quota fissa del fornitore. Non è il PUN del mese, né le fasce.";
  }
  return "";
}

function buildSearchParams(prefs: Prefs, offset = 0) {
  return new URLSearchParams({
    cap: prefs.cap,
    cliente: prefs.cliente,
    mercato: prefs.mercato,
    prezzo: prefs.prezzo,
    fascia: prefs.fascia,
    consumo: String(prefs.consumoKwh),
    potenza: String(prefs.potenzaKw),
    offset: String(offset),
    limit: String(OFFERTE_SEARCH_PAGE_SIZE),
  });
}

function ResultsList({
  hits,
  total,
  loading,
  fascia,
  prefs,
}: {
  hits: OfferteSearchHit[];
  total: number;
  loading: boolean;
  fascia: OfferteFascia;
  prefs: Prefs;
}) {
  const [displayedHits, setDisplayedHits] = useState(hits);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);

  useEffect(() => {
    setDisplayedHits(hits);
    setLoadMoreError(null);
  }, [hits]);

  async function loadMore() {
    setLoadingMore(true);
    setLoadMoreError(null);
    try {
      const response = await fetch(
        `/api/offerte/search?${buildSearchParams(prefs, displayedHits.length)}`,
      );
      const payload = (await response.json()) as SearchPayload;
      if (!response.ok) {
        setLoadMoreError(payload.error ?? "Non riesco a caricare altre offerte.");
        return;
      }
      setDisplayedHits((prev) => [...prev, ...payload.hits]);
    } catch {
      setLoadMoreError("Non riesco a caricare altre offerte. Riprova.");
    } finally {
      setLoadingMore(false);
    }
  }

  if (displayedHits.length === 0 && hits.length === 0) {
    return (
      <p className="text-sm text-neutral-500">
        {fascia === "dinamica"
          ? "Nessuna offerta a PUN orario con questi filtri. Le dinamiche sono mercato libero e prezzo variabile."
          : "Nessuna offerta con questi filtri. Prova mercato, prezzo o consumo."}
      </p>
    );
  }

  return (
    <div>
      <p className="text-sm text-neutral-500 dark:text-neutral-400">
        {formatIt(total)} offerte
        {total > displayedHits.length ? ` · prime ${displayedHits.length}` : ""}
        {loading ? " · aggiorno…" : ""}
      </p>
      <ul className="mt-3 divide-y divide-neutral-200 dark:divide-neutral-800">
        {displayedHits.map((hit) => {
          const clienteKind = clienteKindFromTipo(hit.tipoCliente);
          const prezzoKind = prezzoKindFromTipo(hit.tipoOfferta);
          const mercatoKind = hit.source === "placet" ? "placet" : "ml";

          return (
          <li key={`${hit.source}-${hit.codOfferta}`}>
            <details className="group offerte-hit">
              <summary className="flex cursor-pointer list-none items-start gap-3 py-3 marker:content-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 dark:focus-visible:ring-neutral-500 [&::-webkit-details-marker]:hidden">
                <div className="min-w-0 flex-1">
                  <p className="min-w-0 font-medium">
                    <span className="truncate">{hit.nome}</span>
                    <span className="offerte-hit-muted font-normal text-neutral-500 dark:text-neutral-400">
                      {" · "}
                      <OfferCodeLink hit={hit} />
                    </span>
                  </p>
                  {formatOfferPeriod(hit) ? (
                    <p className="offerte-hit-muted mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                      {formatOfferPeriod(hit)}
                    </p>
                  ) : null}
                  <p className="offerte-hit-muted mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm text-neutral-500 dark:text-neutral-400">
                    <VendorName hit={hit} />
                    {clienteKind ? (
                      <TraitPill
                        icon={<ClienteIcon kind={clienteKind} />}
                        label={clienteLabel(clienteKind)}
                      />
                    ) : null}
                    <TraitPill
                      icon={<MercatoIcon kind={mercatoKind} />}
                      label={mercatoLabel(mercatoKind)}
                    />
                    {prezzoKind ? (
                      <TraitPill
                        icon={<PrezzoIcon kind={prezzoKind} />}
                        label={prezzoLabel(prezzoKind)}
                      />
                    ) : null}
                  </p>
                  <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <dt className="offerte-hit-muted text-xs text-neutral-500 dark:text-neutral-400">
                        Fisso
                      </dt>
                      <dd className="mt-0.5 font-medium">{formatMonthly(hit.monthlyEur)}</dd>
                    </div>
                    <div>
                      <dt className="offerte-hit-muted flex items-center gap-1 text-xs text-neutral-500 dark:text-neutral-400">
                        {prezzoKind ? <PrezzoIcon kind={prezzoKind} className="h-3 w-3" /> : null}
                        {hit.tipoOfferta.includes("variabile") ? "Spread" : "Energia"}
                      </dt>
                      <dd className="mt-0.5 font-medium">{formatSpread(hit)}</dd>
                    </div>
                    <div>
                      <dt className="offerte-hit-muted text-xs text-neutral-500 dark:text-neutral-400">
                        Profilo
                      </dt>
                      <dd className="mt-0.5 flex items-center gap-1.5 font-medium">
                        {hit.plan ? (
                          <>
                            <FasciaPlanIcon plan={hit.plan} />
                            <span>{fasciaPlanLabel(hit.plan)}</span>
                          </>
                        ) : (
                          "n.d."
                        )}
                      </dd>
                    </div>
                  </dl>
                </div>
                <ChevronIcon />
              </summary>
              <OfferDettaglio dettaglio={hit.dettaglio} />
            </details>
          </li>
          );
        })}
      </ul>
      {displayedHits.length < total ? (
        <div className="mt-4 flex flex-col items-start gap-2">
          <button
            type="button"
            disabled={loadingMore}
            onClick={() => void loadMore()}
            className="h-10 rounded-md border border-neutral-200 bg-transparent px-4 text-sm text-neutral-700 transition-colors hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-900"
          >
            {loadingMore ? "Carico altre offerte…" : "Carica altro"}
          </button>
          {loadMoreError ? (
            <p className="text-sm text-red-600 dark:text-red-400">{loadMoreError}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ChevronIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="offerte-hit-chevron mt-1 h-4 w-4 shrink-0 text-neutral-400 transition-transform duration-200 group-open:rotate-180 dark:text-neutral-500"
      aria-hidden
    >
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 6.5 8 10.5 12 6.5"
      />
    </svg>
  );
}

function TraitPill({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <span className="offerte-hit-pill inline-flex max-w-full items-center gap-1 rounded-md border border-neutral-200 px-2 py-0.5 text-sm text-neutral-700 dark:border-neutral-800 dark:text-neutral-300">
      {icon}
      <span className="truncate">{label}</span>
    </span>
  );
}

function VendorName({ hit }: { hit: OfferteSearchHit }) {
  const href = absoluteHttpUrl(hit.urlOfferta ?? hit.urlVenditore);
  if (!href) {
    return <span className="truncate">{hit.venditore}</span>;
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      title={`${hit.venditore} — si apre in una nuova scheda`}
      onClick={(event) => event.stopPropagation()}
      className="offerte-hit-pill inline-flex max-w-full items-center gap-1 rounded-md border border-neutral-200 px-2 py-0.5 text-sm text-neutral-700 transition-colors hover:bg-neutral-100 dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-900"
    >
      <span className="truncate">{hit.venditore}</span>
      <NewTabIcon />
      <span className="sr-only"> (si apre in una nuova scheda)</span>
    </a>
  );
}

function formatMonthly(value: number | null) {
  if (value == null) return "n.d.";
  return `${new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
  }).format(value)}/mese`;
}

function formatSpread(hit: OfferteSearchHit) {
  if (hit.spreadMinEurKwh == null || hit.spreadMaxEurKwh == null) return "n.d.";
  const min = hit.spreadMinEurKwh * 100;
  const max = hit.spreadMaxEurKwh * 100;
  const fmt = (value: number) =>
    new Intl.NumberFormat("it-IT", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 2,
    }).format(value);
  if (Math.abs(min - max) < 0.05) return `${fmt(min)} c€/kWh`;
  return `${fmt(min)}–${fmt(max)} c€/kWh`;
}

function formatIt(value: number) {
  return new Intl.NumberFormat("it-IT").format(value);
}

