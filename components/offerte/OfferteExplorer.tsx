"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { FasciaPlanIcon } from "@/components/offerte/FasciaPlanIcon";
import {
  CanoneIcon,
  ClienteIcon,
  MercatoIcon,
  PlacePinIcon,
  PrezzoIcon,
  ResidenzaIcon,
  TuttiIcon,
  clienteLabel,
  prezzoLabel,
} from "@/components/offerte/OfferteTraitIcons";
import {
  ATTIVAZIONE_FILTERS,
  CONTRATTO_FILTERS,
  PAGAMENTO_FILTERS,
  parsePortalFilterIds,
} from "@/lib/offerte/portal-labels";
import {
  type CapPlace,
  type OfferteCatalogFilters,
  type OfferteCliente,
  type OfferteFascia,
  type OfferteHeadlineStats,
  type OfferteMercato,
  type OffertePrezzo,
} from "@/lib/offerte/public-types";
import { OfferteCompareSearch } from "@/components/offerte/OfferteCompareSearch";

const PREF_KEY = "kilowattebanane.offerte.v1";
const STRIP_ARROW =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-neutral-200 text-lg leading-none text-neutral-700 transition-colors hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-30 dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-900";

type Prefs = {
  cap: string;
  cliente: OfferteCliente;
  mercato: OfferteMercato;
  prezzo: OffertePrezzo;
  fascia: OfferteFascia;
  residente: boolean;
  pagamento: string[];
  attivazione: string[];
  contratto: string[];
};

const DEFAULTS: Prefs = {
  cap: "",
  cliente: "domestico",
  mercato: "ml",
  prezzo: "prezzo variabile",
  fascia: "monoraria",
  residente: true,
  pagamento: [],
  attivazione: [],
  contratto: [],
};

type MockOffer = {
  nome: string;
  venditore: string;
  monthlyEur: number;
  spreadEurKwh: number;
  energyEurKwh: number;
  durataMesi: number;
};

const MOCK_OFFERS: MockOffer[] = [
  {
    nome: "Luce Chiara 24",
    venditore: "Energia Piana",
    monthlyEur: 7.9,
    spreadEurKwh: 0.016,
    energyEurKwh: 0.148,
    durataMesi: 24,
  },
  {
    nome: "Casa PUN",
    venditore: "Voltitalia",
    monthlyEur: 8.2,
    spreadEurKwh: 0.014,
    energyEurKwh: 0.145,
    durataMesi: 12,
  },
  {
    nome: "Monoraria Verde",
    venditore: "Alpe Energia",
    monthlyEur: 9.5,
    spreadEurKwh: 0.011,
    energyEurKwh: 0.141,
    durataMesi: 24,
  },
  {
    nome: "Quota Zero",
    venditore: "Nord Luce",
    monthlyEur: 12,
    spreadEurKwh: 0.008,
    energyEurKwh: 0.138,
    durataMesi: 24,
  },
];

export function OfferteExplorer({
  stats,
  className,
}: {
  stats: OfferteHeadlineStats;
  className?: string;
}) {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);
  const [capError, setCapError] = useState<string | null>(null);
  const [places, setPlaces] = useState<CapPlace[]>([]);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [prefsHydrated, setPrefsHydrated] = useState(false);

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
        const prezzo =
          parsed.prezzo === "prezzo fisso" ||
          parsed.prezzo === "prezzo variabile" ||
          parsed.prezzo === "tutti"
            ? parsed.prezzo
            : DEFAULTS.prezzo;
        const fascia =
          parsed.fascia === "monoraria" ||
          parsed.fascia === "bioraria" ||
          parsed.fascia === "fasce" ||
          parsed.fascia === "dinamica" ||
          parsed.fascia === "tutti"
            ? parsed.fascia
            : DEFAULTS.fascia;
        const mercato =
          parsed.mercato === "placet" || parsed.mercato === "ml" || parsed.mercato === "tutti"
            ? parsed.mercato
            : DEFAULTS.mercato;
        const fasciaResolved =
          prezzo === "prezzo fisso" && fascia === "dinamica" ? "monoraria" : fascia;
        return {
          ...prev,
          cap: String(parsed.cap ?? "").replace(/\D/g, "").slice(0, 5),
          cliente,
          residente: parsed.residente !== false,
          prezzo,
          fascia: fasciaResolved,
          mercato,
          pagamento: parsePortalFilterIds(parsed.pagamento, PAGAMENTO_FILTERS),
          attivazione: parsePortalFilterIds(parsed.attivazione, ATTIVAZIONE_FILTERS),
          contratto: parsePortalFilterIds(parsed.contratto, CONTRATTO_FILTERS),
        };
      });
    } catch {
      /* ignore */
    } finally {
      setPrefsHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!prefsHydrated) return;
    localStorage.setItem(PREF_KEY, JSON.stringify(prefs));
  }, [prefs, prefsHydrated]);

  useEffect(() => {
    if (prefs.cap.length !== 5) {
      setPlaces([]);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLookupLoading(true);
      try {
        const response = await fetch(
          `/api/offerte/search?lookup=1&cap=${prefs.cap}`,
          { signal: controller.signal },
        );
        const payload = (await response.json()) as {
          places?: CapPlace[];
          error?: string;
        };
        if (!response.ok) {
          setPlaces([]);
          setCapError(payload.error ?? "Non riesco a leggere questo CAP.");
          return;
        }
        const nextPlaces = payload.places ?? [];
        setPlaces(nextPlaces);
        setCapError(nextPlaces.length === 0 ? "Questo CAP non è in anagrafica." : null);
      } catch (error) {
        if ((error as { name?: string }).name === "AbortError") return;
        setPlaces([]);
        setCapError("Non riesco a leggere questo CAP. Riprova.");
      } finally {
        setLookupLoading(false);
      }
    }, 180);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [prefs.cap]);

  const placeLabel = useMemo(() => {
    const names = [...new Set(places.map((place) => place.comuneNome))];
    if (names.length === 0) return null;
    const region = places[0]?.regioneNome;
    return region ? `${names.join(", ")} · ${region}` : names.join(", ");
  }, [places]);

  const filterQuery = useMemo<OfferteCatalogFilters>(
    () => ({
      cliente: prefs.cliente,
      mercato: prefs.mercato,
      prezzo: prefs.prezzo,
      fascia: prefs.fascia,
      residente: prefs.cliente === "domestico" ? prefs.residente : undefined,
      pagamento: prefs.pagamento,
      attivazione: prefs.attivazione,
      contratto: prefs.contratto,
    }),
    [
      prefs.attivazione,
      prefs.cliente,
      prefs.contratto,
      prefs.fascia,
      prefs.mercato,
      prefs.pagamento,
      prefs.prezzo,
      prefs.residente,
    ],
  );

  return (
    <section className={className ? `min-w-0 ${className}` : "min-w-0"}>
      <OfferteCompareSearch
        headlineTotal={stats.total}
        filterQuery={filterQuery}
        filtersReady={prefsHydrated}
        filters={
          <FilterBar
            prefs={prefs}
            setPrefs={setPrefs}
            showCap
            placeLabel={placeLabel}
            capError={capError}
            capLookupLoading={lookupLoading}
            onCapChange={(cap) => {
              setPrefs((prev) => ({ ...prev, cap }));
              setCapError(null);
            }}
            className="mb-4"
          />
        }
      />
    </section>
  );
}

function FilterBar({
  prefs,
  setPrefs,
  showCap = false,
  placeLabel = null,
  capError = null,
  capLookupLoading = false,
  onCapChange,
  className,
}: {
  prefs: Prefs;
  setPrefs: (update: Prefs | ((prev: Prefs) => Prefs)) => void;
  showCap?: boolean;
  placeLabel?: string | null;
  capError?: string | null;
  capLookupLoading?: boolean;
  onCapChange?: (cap: string) => void;
  className?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const capFieldRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [focusCap, setFocusCap] = useState(false);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [setOpen]);

  useEffect(() => {
    if (!open || !focusCap) return;
    capFieldRef.current?.focus();
    setFocusCap(false);
  }, [open, focusCap]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    function sync() {
      const node = scrollerRef.current;
      if (!node) return;
      const max = node.scrollWidth - node.clientWidth;
      setCanLeft(node.scrollLeft > 1);
      setCanRight(max > 1 && node.scrollLeft < max - 1);
    }
    sync();
    el.addEventListener("scroll", sync, { passive: true });
    const observer = new ResizeObserver(sync);
    observer.observe(el);
    if (el.firstElementChild) observer.observe(el.firstElementChild);
    return () => {
      el.removeEventListener("scroll", sync);
      observer.disconnect();
    };
  }, [
    open,
    prefs.attivazione,
    prefs.cap,
    prefs.cliente,
    prefs.contratto,
    prefs.fascia,
    prefs.mercato,
    prefs.pagamento,
    prefs.prezzo,
    showCap,
  ]);

  function scrollStrip(dir: -1 | 1) {
    scrollerRef.current?.scrollBy({ left: dir * 200, behavior: "smooth" });
  }

  return (
    <div ref={rootRef} className={`min-w-0 max-w-full ${className ?? "mt-5"}`}>
      {open ? null : (
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            disabled={!canLeft}
            aria-label="Scorri i filtri a sinistra"
            onClick={() => scrollStrip(-1)}
            className={`${STRIP_ARROW} hidden sm:inline-flex`}
          >
            ‹
          </button>
          <div
            ref={scrollerRef}
            className="min-w-0 flex-1 overflow-x-auto scrollbar-none"
          >
            <div className="flex w-max items-center gap-1.5 pr-1">
              {showCap ? (
                <BarChip
                  onClick={() => {
                    setOpen(true);
                    setFocusCap(true);
                  }}
                  ariaLabel={prefs.cap ? `CAP ${prefs.cap}` : "CAP della fornitura"}
                  icon={<PlacePinIcon />}
                >
                  <span className={capError ? "text-red-600 dark:text-red-400" : undefined}>
                    {prefs.cap || "CAP"}
                  </span>
                </BarChip>
              ) : null}
              <BarChip
                onClick={() => setOpen(true)}
                icon={<ClienteIcon kind={prefs.cliente} />}
              >
                {clienteLabel(prefs.cliente)}
              </BarChip>
              {prefs.cliente === "domestico" ? (
                <BarChip
                  onClick={() => setOpen(true)}
                  icon={<ResidenzaIcon residente={prefs.residente} />}
                >
                  {prefs.residente ? "Residente" : "Non residente"}
                </BarChip>
              ) : null}
              <BarChip
                onClick={() => setOpen(true)}
                icon={<PrezzoIcon kind={prefs.prezzo} />}
              >
                {prezzoBarLabel(prefs.prezzo)}
              </BarChip>
              <BarChip
                onClick={() => setOpen(true)}
                icon={
                  prefs.fascia === "tutti" ? (
                    <TuttiIcon />
                  ) : (
                    <FasciaPlanIcon plan={prefs.fascia} />
                  )
                }
              >
                {fasciaBarLabel(prefs.fascia)}
              </BarChip>
              <BarChip
                onClick={() => setOpen(true)}
                icon={<MercatoIcon kind={prefs.mercato} />}
              >
                {mercatoBarLabel(prefs.mercato)}
              </BarChip>
              <BarChip
                onClick={() => setOpen(true)}
                icon={prefs.pagamento.length === 0 ? <TuttiIcon /> : undefined}
              >
                {multiFilterBarLabel("Pagamento", prefs.pagamento, PAGAMENTO_FILTERS)}
              </BarChip>
              <BarChip
                onClick={() => setOpen(true)}
                icon={prefs.attivazione.length === 0 ? <TuttiIcon /> : undefined}
              >
                {multiFilterBarLabel("Attivazione", prefs.attivazione, ATTIVAZIONE_FILTERS)}
              </BarChip>
              <BarChip
                onClick={() => setOpen(true)}
                icon={prefs.contratto.length === 0 ? <TuttiIcon /> : undefined}
              >
                {multiFilterBarLabel("Quando si attiva", prefs.contratto, CONTRATTO_FILTERS)}
              </BarChip>
            </div>
          </div>
          <button
            type="button"
            disabled={!canRight}
            aria-label="Scorri i filtri a destra"
            onClick={() => scrollStrip(1)}
            className={`${STRIP_ARROW} hidden sm:inline-flex`}
          >
            ›
          </button>
        </div>
      )}

      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none ${
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="min-h-0 overflow-hidden">
          <div
            id="offerte-filtri"
            className={`grid gap-4 pt-3 transition-opacity duration-200 ease-out motion-reduce:transition-none ${
              open ? "opacity-100" : "opacity-0"
            }`}
          >
            <button
              type="button"
              aria-label="Chiudi filtri"
              onClick={() => setOpen(false)}
              className="inline-flex w-fit items-center gap-1.5 rounded-full border border-neutral-200 px-2.5 py-1 text-sm text-neutral-700 transition-colors hover:bg-neutral-100 dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-900"
            >
              <span aria-hidden className="text-base leading-none">
                ×
              </span>
              Chiudi
            </button>
            {showCap ? (
              <div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">CAP</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <input
                    ref={capFieldRef}
                    id="offerte-compare-cap"
                    inputMode="numeric"
                    autoComplete="postal-code"
                    maxLength={5}
                    placeholder="CAP"
                    aria-label="CAP della fornitura"
                    value={prefs.cap}
                    onChange={(event) => {
                      const next = event.target.value.replace(/\D/g, "").slice(0, 5);
                      if (onCapChange) onCapChange(next);
                      else setPrefs((prev) => ({ ...prev, cap: next }));
                    }}
                    className="w-[5.5rem] rounded-md border border-neutral-200 bg-transparent px-2.5 py-1.5 text-sm tracking-[0.12em] text-foreground outline-none focus:border-neutral-400 dark:border-neutral-800 dark:focus:border-neutral-600"
                  />
                  {placeLabel ? (
                    <p className="flex min-w-0 items-center gap-1.5 text-sm text-neutral-600 dark:text-neutral-400">
                      <PlacePinIcon className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{placeLabel}</span>
                    </p>
                  ) : capError ? (
                    <p className="text-sm text-red-600 dark:text-red-400">{capError}</p>
                  ) : capLookupLoading && prefs.cap.length === 5 ? (
                    <p className="text-sm text-neutral-500 dark:text-neutral-400">Cerco il comune…</p>
                  ) : (
                    <p className="text-sm text-neutral-500 dark:text-neutral-400">
                      Cinque cifre del comune di fornitura
                    </p>
                  )}
                </div>
              </div>
            ) : null}
            <MenuPanel legend="Chi sei">
              <Chip
                active={prefs.cliente === "domestico"}
                icon={<ClienteIcon kind="domestico" />}
                onClick={() => setPrefs((prev) => ({ ...prev, cliente: "domestico" }))}
              >
                Casa
              </Chip>
              <Chip
                active={prefs.cliente === "non domestico"}
                icon={<ClienteIcon kind="non domestico" />}
                onClick={() => setPrefs((prev) => ({ ...prev, cliente: "non domestico" }))}
              >
                Partita IVA
              </Chip>
            </MenuPanel>
            {prefs.cliente === "domestico" ? (
              <MenuPanel legend="Residenza">
                <Chip
                  active={prefs.residente}
                  icon={<ResidenzaIcon residente />}
                  onClick={() => setPrefs((prev) => ({ ...prev, residente: true }))}
                >
                  Residente
                </Chip>
                <Chip
                  active={!prefs.residente}
                  icon={<ResidenzaIcon residente={false} />}
                  onClick={() => setPrefs((prev) => ({ ...prev, residente: false }))}
                >
                  Non residente
                </Chip>
              </MenuPanel>
            ) : null}
            <MenuPanel legend="Prezzo">
              <Chip
                active={prefs.prezzo === "tutti"}
                icon={<PrezzoIcon kind="tutti" />}
                onClick={() => setPrefs((prev) => ({ ...prev, prezzo: "tutti" }))}
              >
                Tutti
              </Chip>
              <Chip
                active={prefs.prezzo === "prezzo variabile"}
                icon={<PrezzoIcon kind="prezzo variabile" />}
                onClick={() => setPrefs((prev) => ({ ...prev, prezzo: "prezzo variabile" }))}
              >
                Variabile
              </Chip>
              <Chip
                active={prefs.prezzo === "prezzo fisso"}
                icon={<PrezzoIcon kind="prezzo fisso" />}
                onClick={() =>
                  setPrefs((prev) => ({
                    ...prev,
                    prezzo: "prezzo fisso",
                    fascia: prev.fascia === "dinamica" ? "monoraria" : prev.fascia,
                  }))
                }
              >
                Fisso
              </Chip>
            </MenuPanel>
            <MenuPanel legend="Profilo orario">
              <Chip
                active={prefs.fascia === "tutti"}
                icon={<TuttiIcon />}
                onClick={() => setPrefs((prev) => ({ ...prev, fascia: "tutti" }))}
              >
                Tutti
              </Chip>
              <Chip
                active={prefs.fascia === "monoraria"}
                icon={<FasciaPlanIcon plan="monoraria" />}
                onClick={() => setPrefs((prev) => ({ ...prev, fascia: "monoraria" }))}
              >
                Monoraria
              </Chip>
              <Chip
                active={prefs.fascia === "bioraria"}
                icon={<FasciaPlanIcon plan="bioraria" />}
                onClick={() => setPrefs((prev) => ({ ...prev, fascia: "bioraria" }))}
              >
                Bioraria
              </Chip>
              <Chip
                active={prefs.fascia === "fasce"}
                icon={<FasciaPlanIcon plan="fasce" />}
                onClick={() => setPrefs((prev) => ({ ...prev, fascia: "fasce" }))}
              >
                Trioraria
              </Chip>
              {prefs.prezzo !== "prezzo fisso" ? (
                <Chip
                  active={prefs.fascia === "dinamica"}
                  icon={<FasciaPlanIcon plan="dinamica" />}
                  onClick={() =>
                    setPrefs((prev) => ({
                      ...prev,
                      fascia: "dinamica",
                      mercato: prev.mercato === "placet" ? "ml" : prev.mercato,
                    }))
                  }
                >
                  Dinamica
                </Chip>
              ) : null}
            </MenuPanel>
            <MenuPanel legend="Mercato">
              <Chip
                active={prefs.mercato === "tutti"}
                icon={<MercatoIcon kind="tutti" />}
                onClick={() => setPrefs((prev) => ({ ...prev, mercato: "tutti" }))}
              >
                Tutti
              </Chip>
              <Chip
                active={prefs.mercato === "ml"}
                icon={<MercatoIcon kind="ml" />}
                onClick={() => setPrefs((prev) => ({ ...prev, mercato: "ml" }))}
              >
                Mercato libero
              </Chip>
              <Chip
                active={prefs.mercato === "placet"}
                icon={<MercatoIcon kind="placet" />}
                onClick={() =>
                  setPrefs((prev) => ({
                    ...prev,
                    mercato: "placet",
                    fascia: prev.fascia === "dinamica" ? "monoraria" : prev.fascia,
                  }))
                }
              >
                PLACET
              </Chip>
            </MenuPanel>
            <MenuPanel legend="Pagamento">
              <FilterChips
                options={PAGAMENTO_FILTERS}
                selected={prefs.pagamento}
                onChange={(pagamento) => setPrefs((prev) => ({ ...prev, pagamento }))}
              />
            </MenuPanel>
            <MenuPanel legend="Attivazione">
              <FilterChips
                options={ATTIVAZIONE_FILTERS}
                selected={prefs.attivazione}
                onChange={(attivazione) => setPrefs((prev) => ({ ...prev, attivazione }))}
              />
            </MenuPanel>
            <MenuPanel legend="Quando si attiva">
              <FilterChips
                options={CONTRATTO_FILTERS}
                selected={prefs.contratto}
                onChange={(contratto) => setPrefs((prev) => ({ ...prev, contratto }))}
              />
            </MenuPanel>
          </div>
        </div>
      </div>
    </div>
  );
}

function MockResults({
  catalogo,
  cluster,
  kept,
  prezzo,
}: {
  catalogo: number;
  cluster: number;
  kept: number;
  prezzo: OffertePrezzo;
}) {
  const variabile = prezzo !== "prezzo fisso";

  return (
    <div>
      <div
        className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-x-1 sm:gap-x-2"
        aria-label={`${formatIt(catalogo)} offerte totali, ${formatIt(cluster)} con questi filtri, ${formatIt(kept)} davvero convenienti`}
      >
        <p className="text-2xl font-semibold tabular-nums tracking-tight text-neutral-400 sm:text-3xl dark:text-neutral-500">
          {formatIt(catalogo)}
        </p>
        <FunnelArrow />
        <p className="text-2xl font-semibold tabular-nums tracking-tight text-neutral-500 sm:text-3xl dark:text-neutral-400">
          {formatIt(cluster)}
        </p>
        <FunnelArrow />
        <p className="text-2xl font-semibold tabular-nums tracking-tight text-foreground sm:text-3xl">
          {formatIt(kept)}
        </p>
        <p className="col-start-1 mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
          offerte totali
        </p>
        <p className="col-start-3 mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
          con questi filtri
        </p>
        <p className="col-start-5 mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
          da guardare
        </p>
      </div>

      <ol className="mt-6 grid gap-3 sm:grid-cols-2">
        {MOCK_OFFERS.map((offer, index) => (
          <li
            key={offer.nome}
            className="rounded-md border border-neutral-200 p-4 dark:border-neutral-800"
          >
            <p className="flex items-baseline gap-2">
              <span className="text-xs tabular-nums text-neutral-400 dark:text-neutral-500">
                {index + 1}
              </span>
              <span className="min-w-0 truncate font-medium">{offer.nome}</span>
            </p>
            <p className="mt-0.5 truncate pl-5 text-xs text-neutral-500 dark:text-neutral-400">
              {offer.venditore}
              {" · "}
              {offer.durataMesi} mesi
            </p>
            <dl className="mt-4 grid grid-cols-2 gap-3">
              <div>
                <dt className="flex items-center gap-1 text-xs text-neutral-500 dark:text-neutral-400">
                  <CanoneIcon className="h-3.5 w-3.5" />
                  Canone
                </dt>
                <dd className="mt-0.5 text-lg font-semibold tabular-nums tracking-tight">
                  {formatMonthly(offer.monthlyEur)}
                </dd>
              </div>
              <div>
                <dt className="flex items-center gap-1 text-xs text-neutral-500 dark:text-neutral-400">
                  <PrezzoIcon
                    kind={variabile ? "prezzo variabile" : "prezzo fisso"}
                    className="h-3.5 w-3.5"
                  />
                  {variabile ? "Spread" : "Energia"}
                </dt>
                <dd className="mt-0.5 text-lg font-semibold tabular-nums tracking-tight">
                  {formatCentes(variabile ? offer.spreadEurKwh : offer.energyEurKwh)}
                </dd>
              </div>
            </dl>
          </li>
        ))}
      </ol>
    </div>
  );
}

function FunnelArrow() {
  return (
    <span className="text-neutral-400 dark:text-neutral-600" aria-hidden>
      <svg viewBox="0 0 22 16" className="h-4 w-5 sm:h-5 sm:w-6" fill="none">
        <path
          d="M1.5 2.5 8 8 1.5 13.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M11.5 2.5 18 8 11.5 13.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

function MenuPanel({
  legend,
  children,
}: {
  legend: string;
  children: ReactNode;
}) {
  return (
    <div>
      <p className="text-xs text-neutral-500 dark:text-neutral-400">{legend}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function BarChip({
  onClick,
  icon,
  ariaLabel,
  children,
}: {
  onClick: () => void;
  icon?: ReactNode;
  ariaLabel?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-neutral-200 px-2.5 py-1 text-sm text-neutral-700 transition-colors hover:bg-neutral-100 dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-900"
    >
      {icon}
      {children}
    </button>
  );
}

function Chip({
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

function FilterChips({
  options,
  selected,
  onChange,
}: {
  options: readonly { id: string; label: string }[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <>
      <Chip active={selected.length === 0} icon={<TuttiIcon />} onClick={() => onChange([])}>
        Tutti
      </Chip>
      {options.map((option) => (
        <Chip
          key={option.id}
          active={selected.includes(option.id)}
          onClick={() =>
            onChange(
              selected.includes(option.id)
                ? selected.filter((value) => value !== option.id)
                : [...selected, option.id],
            )
          }
        >
          {option.label}
        </Chip>
      ))}
    </>
  );
}

function tuttiBarLabel(legend: string) {
  return `${legend}: tutti`;
}

function prezzoBarLabel(prezzo: OffertePrezzo) {
  return prezzo === "tutti" ? tuttiBarLabel("Prezzo") : prezzoLabel(prezzo);
}

function fasciaBarLabel(fascia: OfferteFascia) {
  if (fascia === "tutti") return tuttiBarLabel("Profilo orario");
  if (fascia === "bioraria") return "Bioraria";
  if (fascia === "fasce") return "Trioraria";
  if (fascia === "dinamica") return "Dinamica";
  return "Monoraria";
}

function mercatoBarLabel(mercato: OfferteMercato) {
  if (mercato === "placet") return "PLACET";
  if (mercato === "tutti") return tuttiBarLabel("Mercato");
  return "Libero";
}

function multiFilterBarLabel(
  legend: string,
  selected: string[],
  options: readonly { id: string; label: string }[],
) {
  if (selected.length === 0) return tuttiBarLabel(legend);
  return selected
    .map((id) => options.find((option) => option.id === id)?.label)
    .filter((label): label is string => Boolean(label))
    .join(", ");
}

function mockClusterCount(total: number, prefs: Prefs) {
  const key = [
    prefs.cliente,
    prefs.residente ? "1" : "0",
    prefs.prezzo,
    prefs.fascia,
    prefs.mercato,
    prefs.pagamento.join(","),
    prefs.attivazione.join(","),
    prefs.contratto.join(","),
  ].join("|");
  let hash = 2166136261;
  for (let i = 0; i < key.length; i += 1) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const ratio =
    prefs.prezzo === "prezzo variabile" && prefs.fascia === "monoraria" ? 0.075 : 0.045;
  const jitter = 0.72 + ((hash >>> 0) % 37) / 100;
  const n = Math.round(total * ratio * jitter);
  return Math.max(MOCK_OFFERS.length + 12, Math.min(total - 8, n));
}

function formatMonthly(value: number) {
  return `${new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)}/mese`;
}

function formatCentes(eurKwh: number) {
  return `${new Intl.NumberFormat("it-IT", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  }).format(eurKwh * 100)} c€/kWh`;
}

function formatIt(value: number) {
  return new Intl.NumberFormat("it-IT").format(value);
}
