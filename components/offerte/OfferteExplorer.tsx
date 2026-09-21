"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { FasciaPlanIcon } from "@/components/offerte/FasciaPlanIcon";
import {
  CanoneIcon,
  ClienteIcon,
  MercatoIcon,
  PlacePinIcon,
  PrezzoIcon,
  clienteLabel,
  mercatoLabel,
  prezzoLabel,
} from "@/components/offerte/OfferteTraitIcons";
import {
  ATTIVAZIONE_FILTERS,
  CONTRATTO_FILTERS,
  PAGAMENTO_FILTERS,
  parsePortalFilterIds,
} from "@/lib/offerte/portal-labels";
import {
  PORTALE_OFFERTE_URL,
  type CapPlace,
  type OfferteCliente,
  type OfferteConsumoProfilo,
  type OfferteFascia,
  type OfferteHeadlineStats,
  type OfferteMercato,
  type OffertePrezzo,
} from "@/lib/offerte/public-types";
import {
  POTENZA_STANDARD_CASA_KW,
  clampPotenzaKw,
  formatPotenzaKw,
  potenzeImpegnateKw,
} from "@/lib/offerte/potenza";

const PREF_KEY = "kilowattebanane.offerte.v1";
const STATS_HREF = "/offer-stats";
const CONSUMO_PRESETS = [1200, 1800, 2700, 3500, 4500] as const;
const STRIP_ARROW =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-neutral-200 text-lg leading-none text-neutral-700 transition-colors hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-30 dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-900";

type LockableId =
  | "cliente"
  | "residente"
  | "prezzo"
  | "fascia"
  | "potenza"
  | "consumo"
  | "mercato";

const LOCKABLE_IDS: LockableId[] = [
  "cliente",
  "residente",
  "prezzo",
  "fascia",
  "potenza",
  "consumo",
  "mercato",
];

const DEFAULT_LOCKED: LockableId[] = [
  "cliente",
  "residente",
  "prezzo",
  "potenza",
  "consumo",
];

type Prefs = {
  cap: string;
  cliente: OfferteCliente;
  mercato: OfferteMercato;
  prezzo: OffertePrezzo;
  fascia: OfferteFascia;
  consumoKwh: number;
  potenzaKw: number;
  residente: boolean;
  profilo: OfferteConsumoProfilo;
  pagamento: string[];
  attivazione: string[];
  contratto: string[];
  locked: LockableId[];
};

const DEFAULTS: Prefs = {
  cap: "",
  cliente: "domestico",
  mercato: "ml",
  prezzo: "prezzo variabile",
  fascia: "monoraria",
  consumoKwh: 2700,
  potenzaKw: POTENZA_STANDARD_CASA_KW,
  residente: true,
  profilo: "standard",
  pagamento: [],
  attivazione: [],
  contratto: [],
  locked: DEFAULT_LOCKED,
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
  initialCap = "",
  className,
}: {
  stats: OfferteHeadlineStats;
  initialCap?: string;
  className?: string;
}) {
  const router = useRouter();
  const capInputRef = useRef<HTMLInputElement>(null);
  const [prefs, setPrefs] = useState<Prefs>({
    ...DEFAULTS,
    cap: initialCap.replace(/\D/g, "").slice(0, 5),
  });
  const [capError, setCapError] = useState<string | null>(null);
  const [places, setPlaces] = useState<CapPlace[]>([]);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

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
          parsed.prezzo === "prezzo fisso" || parsed.prezzo === "prezzo variabile"
            ? parsed.prezzo
            : DEFAULTS.prezzo;
        const fascia =
          parsed.fascia === "monoraria" ||
          parsed.fascia === "bioraria" ||
          parsed.fascia === "fasce" ||
          parsed.fascia === "dinamica"
            ? parsed.fascia
            : DEFAULTS.fascia;
        const mercato =
          parsed.mercato === "placet" || parsed.mercato === "ml" || parsed.mercato === "tutti"
            ? parsed.mercato === "tutti"
              ? DEFAULTS.mercato
              : parsed.mercato
            : DEFAULTS.mercato;
        return {
          ...prev,
          cap: (initialCap || String(parsed.cap ?? "")).replace(/\D/g, "").slice(0, 5),
          cliente,
          residente: parsed.residente !== false,
          profilo: parsed.profilo === "oculato" ? "oculato" : "standard",
          prezzo,
          fascia,
          mercato,
          pagamento: parsePortalFilterIds(parsed.pagamento, PAGAMENTO_FILTERS),
          attivazione: parsePortalFilterIds(parsed.attivazione, ATTIVAZIONE_FILTERS),
          contratto: parsePortalFilterIds(parsed.contratto, CONTRATTO_FILTERS),
          consumoKwh: Number.isFinite(Number(parsed.consumoKwh))
            ? Math.min(8000, Math.max(800, Number(parsed.consumoKwh)))
            : prev.consumoKwh,
          potenzaKw: clampPotenzaKw(Number(parsed.potenzaKw ?? prev.potenzaKw), cliente),
          locked: parseLocked(parsed.locked),
        };
      });
    } catch {
      /* ignore */
    }
  }, [initialCap]);

  useEffect(() => {
    localStorage.setItem(PREF_KEY, JSON.stringify(prefs));
  }, [prefs]);

  useEffect(() => {
    if (prefs.cap.length !== 5) {
      if (initialCap) router.replace("/offer-compare", { scroll: false });
      return;
    }
    if (prefs.cap === initialCap) return;
    router.replace(`/offer-compare?cap=${prefs.cap}`, { scroll: false });
  }, [initialCap, prefs.cap, router]);

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

  useEffect(() => {
    if (prefs.cap.length === 5) return;
    capInputRef.current?.focus();
  }, [prefs.cap.length]);

  const placeLabel = useMemo(() => {
    const names = [...new Set(places.map((place) => place.comuneNome))];
    if (names.length === 0) return null;
    const region = places[0]?.regioneNome;
    return region ? `${names.join(", ")} · ${region}` : names.join(", ");
  }, [places]);

  const capReady = prefs.cap.length === 5 && places.length > 0 && !capError;
  const clusterCount = useMemo(() => mockClusterCount(stats.total, prefs), [prefs, stats.total]);
  const kept = MOCK_OFFERS.length;
  const energyName = prefs.prezzo === "prezzo fisso" ? "prezzo dell’energia" : "spread sul PUN";

  return (
    <section className={className ? `${className} mt-5` : "mt-5"}>
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
      <p className="mt-2 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
        <strong className="font-medium text-foreground">{formatIt(stats.total)} offerte</strong>
        {" · "}
        {formatIt(stats.venditori)} venditori
        {" · "}
        <a
          href={STATS_HREF}
          className="underline decoration-neutral-300 underline-offset-2 hover:text-foreground dark:decoration-neutral-600"
        >
          statistiche
        </a>
      </p>

      <div className="mt-8">
        <label htmlFor="offerte-cap" className="sr-only">
          CAP della fornitura
        </label>
        <input
          ref={capInputRef}
          id="offerte-cap"
          inputMode="numeric"
          autoComplete="postal-code"
          maxLength={5}
          placeholder="CAP"
          value={prefs.cap}
          onChange={(event) => {
            const next = event.target.value.replace(/\D/g, "").slice(0, 5);
            setPrefs((prev) => ({ ...prev, cap: next }));
            setCapError(null);
            setFiltersOpen(false);
          }}
          className="w-full border-0 bg-transparent p-0 text-3xl font-semibold tracking-[0.14em] text-foreground outline-none placeholder:tracking-normal placeholder:text-neutral-400 sm:text-4xl"
        />
        {placeLabel ? (
          <p className="mt-1.5 flex min-w-0 items-center gap-1.5 text-sm text-neutral-600 dark:text-neutral-400">
            <PlacePinIcon className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{placeLabel}</span>
          </p>
        ) : capError ? (
          <p className="mt-0.5 text-sm text-red-600 dark:text-red-400">{capError}</p>
        ) : lookupLoading && prefs.cap.length === 5 ? (
          <p className="mt-0.5 text-sm text-neutral-500 dark:text-neutral-400">Cerco il comune…</p>
        ) : (
          <p className="mt-0.5 text-sm text-neutral-500 dark:text-neutral-400">
            Inserisci il CAP qui sopra👆
          </p>
        )}
      </div>

      {prefs.cap.length === 5 ? (
        <FilterBar
          prefs={prefs}
          setPrefs={setPrefs}
          open={filtersOpen}
          setOpen={setFiltersOpen}
        />
      ) : null}
    </section>
  );
}

function FilterBar({
  prefs,
  setPrefs,
  open,
  setOpen,
}: {
  prefs: Prefs;
  setPrefs: (update: Prefs | ((prev: Prefs) => Prefs)) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
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
  }, [prefs.cliente]);

  function scrollStrip(dir: -1 | 1) {
    scrollerRef.current?.scrollBy({ left: dir * 200, behavior: "smooth" });
  }

  function isLocked(id: LockableId) {
    return prefs.locked.includes(id);
  }

  function toggleLock(id: LockableId) {
    setPrefs((prev) => ({
      ...prev,
      locked: prev.locked.includes(id)
        ? prev.locked.filter((value) => value !== id)
        : [...prev.locked, id],
    }));
  }

  return (
    <div ref={rootRef} className="mt-5">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!canLeft}
            aria-label="Scorri i filtri a sinistra"
            onClick={() => scrollStrip(-1)}
            className={STRIP_ARROW}
          >
            ‹
          </button>
          <button
            type="button"
            disabled={!canRight}
            aria-label="Scorri i filtri a destra"
            onClick={() => scrollStrip(1)}
            className={STRIP_ARROW}
          >
            ›
          </button>
        </div>
        <button
          type="button"
          aria-expanded={open}
          aria-controls="offerte-filtri"
          onClick={() => setOpen(!open)}
          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md bg-neutral-900 px-3 text-sm font-medium text-white transition-opacity hover:opacity-90 dark:bg-neutral-100 dark:text-neutral-900"
        >
          {open ? "chiudi filtri" : "apri filtri"}
          <svg
            aria-hidden
            viewBox="0 0 16 16"
            className={`h-3.5 w-3.5 shrink-0 transition-transform duration-200 ease-out ${
              open ? "rotate-180" : ""
            }`}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
          >
            <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
      <div
        ref={scrollerRef}
        className="overflow-x-auto scrollbar-none"
      >
        <div className="flex w-max items-center gap-1.5 pr-1">
            <BarChip
              onClick={() => setOpen(true)}
              locked={isLocked("cliente")}
              onLock={() => toggleLock("cliente")}
              icon={<ClienteIcon kind={prefs.cliente} />}
            >
              {clienteLabel(prefs.cliente)}
            </BarChip>
            {prefs.cliente === "domestico" ? (
              <BarChip
                onClick={() => setOpen(true)}
                locked={isLocked("residente")}
                onLock={() => toggleLock("residente")}
              >
                {prefs.residente ? "Residente" : "Non residente"}
              </BarChip>
            ) : null}
            <BarChip
              onClick={() => setOpen(true)}
              locked={isLocked("prezzo")}
              onLock={() => toggleLock("prezzo")}
              icon={<PrezzoIcon kind={prefs.prezzo} />}
            >
              {prezzoLabel(prefs.prezzo)}
            </BarChip>
            <BarChip
              onClick={() => setOpen(true)}
              locked={isLocked("fascia")}
              onLock={() => toggleLock("fascia")}
              icon={prefs.fascia === "tutti" ? undefined : <FasciaPlanIcon plan={prefs.fascia} />}
            >
              {fasciaBarLabel(prefs.fascia)}
            </BarChip>
            <BarChip
              onClick={() => setOpen(true)}
              locked={isLocked("potenza")}
              onLock={() => toggleLock("potenza")}
            >
              {formatPotenzaKw(prefs.potenzaKw)}
            </BarChip>
            <BarChip
              onClick={() => setOpen(true)}
              locked={isLocked("consumo")}
              onLock={() => toggleLock("consumo")}
            >
              {formatIt(prefs.consumoKwh)} kWh
            </BarChip>
            <BarChip
              onClick={() => setOpen(true)}
              locked={isLocked("mercato")}
              onLock={() => toggleLock("mercato")}
              icon={<MercatoIcon kind={prefs.mercato} />}
            >
              {mercatoBarLabel(prefs.mercato)}
            </BarChip>
          </div>
        </div>

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
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Lucchetto chiuso: resta così nel confronto. Aperto: proviamo le combinazioni.
            </p>
            <MenuPanel
              legend="Chi sei"
              locked={isLocked("cliente")}
              onLock={() => toggleLock("cliente")}
            >
              <Chip
                active={prefs.cliente === "domestico"}
                icon={<ClienteIcon kind="domestico" />}
                onClick={() =>
                  setPrefs((prev) => ({
                    ...prev,
                    cliente: "domestico",
                    potenzaKw: clampPotenzaKw(prev.potenzaKw, "domestico"),
                  }))
                }
              >
                Casa
              </Chip>
              <Chip
                active={prefs.cliente === "non domestico"}
                icon={<ClienteIcon kind="non domestico" />}
                onClick={() =>
                  setPrefs((prev) => ({
                    ...prev,
                    cliente: "non domestico",
                    potenzaKw: clampPotenzaKw(prev.potenzaKw, "non domestico"),
                  }))
                }
              >
                Partita IVA
              </Chip>
            </MenuPanel>
            {prefs.cliente === "domestico" ? (
              <MenuPanel
                legend="Residenza"
                locked={isLocked("residente")}
                onLock={() => toggleLock("residente")}
              >
                <Chip
                  active={prefs.residente}
                  onClick={() => setPrefs((prev) => ({ ...prev, residente: true }))}
                >
                  Residente
                </Chip>
                <Chip
                  active={!prefs.residente}
                  onClick={() => setPrefs((prev) => ({ ...prev, residente: false }))}
                >
                  Non residente
                </Chip>
              </MenuPanel>
            ) : null}
            <MenuPanel
              legend="Prezzo"
              locked={isLocked("prezzo")}
              onLock={() => toggleLock("prezzo")}
            >
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
            <MenuPanel
              legend="Profilo orario"
              locked={isLocked("fascia")}
              onLock={() => toggleLock("fascia")}
            >
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
              <Chip
                active={prefs.fascia === "dinamica"}
                icon={<FasciaPlanIcon plan="dinamica" />}
                onClick={() =>
                  setPrefs((prev) => ({
                    ...prev,
                    fascia: "dinamica",
                    prezzo: "prezzo variabile",
                    mercato: prev.mercato === "placet" ? "ml" : prev.mercato,
                  }))
                }
              >
                Dinamica
              </Chip>
            </MenuPanel>
            <MenuPanel
              legend="Potenza impegnata"
              locked={isLocked("potenza")}
              onLock={() => toggleLock("potenza")}
            >
              {potenzeImpegnateKw(prefs.cliente).map((kw) => (
                <Chip
                  key={kw}
                  active={prefs.potenzaKw === kw}
                  onClick={() => setPrefs((prev) => ({ ...prev, potenzaKw: kw }))}
                >
                  {formatPotenzaKw(kw)}
                </Chip>
              ))}
            </MenuPanel>
            <MenuPanel
              legend="Consumo annuo"
              locked={isLocked("consumo")}
              onLock={() => toggleLock("consumo")}
            >
              {CONSUMO_PRESETS.map((kwh) => (
                <Chip
                  key={kwh}
                  active={prefs.consumoKwh === kwh}
                  onClick={() => setPrefs((prev) => ({ ...prev, consumoKwh: kwh }))}
                >
                  {formatIt(kwh)} kWh
                </Chip>
              ))}
              <p className="basis-full pt-1 text-xs text-neutral-500 dark:text-neutral-400">
                Media famiglia italiana ~2.700 kWh.
              </p>
            </MenuPanel>
            <MenuPanel
              legend="Mercato"
              locked={isLocked("mercato")}
              onLock={() => toggleLock("mercato")}
            >
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
            <MenuPanel legend="Come consumi">
              <Chip
                active={prefs.profilo === "standard"}
                onClick={() => setPrefs((prev) => ({ ...prev, profilo: "standard" }))}
              >
                Standard
              </Chip>
              <Chip
                active={prefs.profilo === "oculato"}
                onClick={() => setPrefs((prev) => ({ ...prev, profilo: "oculato" }))}
              >
                Oculato
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
  locked,
  onLock,
  children,
}: {
  legend: string;
  locked?: boolean;
  onLock?: () => void;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5">
        <p className="text-xs text-neutral-500 dark:text-neutral-400">{legend}</p>
        {onLock ? (
          <LockButton locked={Boolean(locked)} onClick={onLock} compact />
        ) : null}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function BarChip({
  onClick,
  locked,
  onLock,
  icon,
  children,
}: {
  onClick: () => void;
  locked?: boolean;
  onLock?: () => void;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      className={`inline-flex shrink-0 items-center overflow-hidden rounded-full border ${
        locked
          ? "border-neutral-400 dark:border-neutral-500"
          : "border-neutral-200 dark:border-neutral-800"
      }`}
    >
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-sm text-neutral-700 transition-colors hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-900"
      >
        {icon}
        {children}
      </button>
      {onLock ? (
        <LockButton locked={Boolean(locked)} onClick={onLock} />
      ) : null}
    </div>
  );
}

function LockButton({
  locked,
  onClick,
  compact = false,
}: {
  locked: boolean;
  onClick: () => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={locked}
      title={locked ? "Fermo nel confronto" : "Sblocca: prova le combinazioni"}
      aria-label={locked ? "Fermo nel confronto" : "Sblocca: prova le combinazioni"}
      onClick={onClick}
      className={
        compact
          ? `inline-flex items-center rounded p-0.5 transition-colors ${
              locked
                ? "text-foreground"
                : "text-neutral-400 hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300"
            }`
          : `inline-flex items-center border-l px-1.5 py-1 transition-colors ${
              locked
                ? "border-neutral-400 text-foreground dark:border-neutral-500"
                : "border-neutral-200 text-neutral-400 hover:text-neutral-600 dark:border-neutral-800 dark:text-neutral-500 dark:hover:text-neutral-300"
            }`
      }
    >
      <LockIcon open={!locked} />
    </button>
  );
}

function LockIcon({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0" aria-hidden fill="none">
      <rect
        x="3.5"
        y="7.25"
        width="9"
        height="6.35"
        rx="1.15"
        stroke="currentColor"
        strokeWidth="1.35"
      />
      {open ? (
        <path
          d="M5.6 7.25V5.35a2.45 2.45 0 0 1 4.85-.35"
          stroke="currentColor"
          strokeWidth="1.35"
          strokeLinecap="round"
        />
      ) : (
        <path
          d="M5.6 7.25V5.2a2.4 2.4 0 0 1 4.8 0v2.05"
          stroke="currentColor"
          strokeWidth="1.35"
          strokeLinecap="round"
        />
      )}
    </svg>
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
      <Chip active={selected.length === 0} onClick={() => onChange([])}>
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

function parseLocked(value: unknown): LockableId[] {
  if (!Array.isArray(value)) return DEFAULT_LOCKED;
  const next = value.filter((id): id is LockableId =>
    LOCKABLE_IDS.includes(id as LockableId),
  );
  return next;
}

function fasciaBarLabel(fascia: OfferteFascia) {
  if (fascia === "bioraria") return "Bioraria";
  if (fascia === "fasce") return "Trioraria";
  if (fascia === "dinamica") return "Dinamica";
  return "Monoraria";
}

function mercatoBarLabel(mercato: OfferteMercato) {
  if (mercato === "placet") return "PLACET";
  if (mercato === "tutti") return mercatoLabel("tutti");
  return "Libero";
}

function mockClusterCount(total: number, prefs: Prefs) {
  const key = [
    prefs.cliente,
    prefs.residente ? "1" : "0",
    prefs.prezzo,
    prefs.fascia,
    prefs.mercato,
    String(prefs.potenzaKw),
    String(prefs.consumoKwh),
    prefs.profilo,
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
