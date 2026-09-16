"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
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
  ATTIVAZIONE_FILTERS,
  CONTRATTO_FILTERS,
  PAGAMENTO_FILTERS,
  parsePortalFilterIds,
} from "@/lib/offerte/portal-labels";
import {
  OFFERTE_SEARCH_PAGE_SIZE,
  CME_ITB_PAGE_URL,
  GME_MTE_PAGE_URL,
  PORTALE_OFFERTE_URL,
  type CapPlace,
  type OfferteCliente,
  type OfferteConsumoProfilo,
  type OfferteFascia,
  type OfferteHeadlineStats,
  type OfferteMercato,
  type OffertePrezzo,
  type OfferteMonthPoint,
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
  residente: boolean;
  profilo: OfferteConsumoProfilo;
  pagamento: string[];
  attivazione: string[];
  contratto: string[];
};

const DEFAULTS: Prefs = {
  cap: "",
  cliente: "domestico",
  mercato: "tutti",
  prezzo: "tutti",
  fascia: "tutti",
  consumoKwh: 2700,
  potenzaKw: POTENZA_STANDARD_CASA_KW,
  residente: true,
  profilo: "standard",
  pagamento: [],
  attivazione: [],
  contratto: [],
};

type SearchPayload = {
  places: CapPlace[];
  punEurKwh: number | null;
  forwardAsOf: string | null;
  forwardSource: string | null;
  hits: OfferteSearchHit[];
  totalMatched: number;
  error?: string;
};

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
  const titleId = useId();
  const [prefs, setPrefs] = useState<Prefs>({
    ...DEFAULTS,
    cap: initialCap.replace(/\D/g, "").slice(0, 5),
  });
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
        const pagamento = parsePortalFilterIds(parsed.pagamento, PAGAMENTO_FILTERS);
        const attivazione = parsePortalFilterIds(parsed.attivazione, ATTIVAZIONE_FILTERS);
        const contratto = parsePortalFilterIds(parsed.contratto, CONTRATTO_FILTERS);
        if (pagamento.length > 0 || attivazione.length > 0 || contratto.length > 0) {
          setAdvanced(true);
        }
        return {
          ...prev,
          ...parsed,
          cap: (initialCap || String(parsed.cap ?? "")).replace(/\D/g, "").slice(0, 5),
          cliente,
          residente: parsed.residente !== false,
          profilo: parsed.profilo === "oculato" ? "oculato" : "standard",
          pagamento,
          attivazione,
          contratto,
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
    if (prefs.cap.length !== 5) return;
    const params = new URLSearchParams({
      cap: prefs.cap,
      cliente: prefs.cliente,
      potenza: String(prefs.potenzaKw),
      consumo: String(prefs.consumoKwh),
      residente: prefs.residente ? "1" : "0",
    });
    router.replace(`/offer-compare?${params}`, { scroll: false });
  }, [prefs, router]);

  useEffect(() => {
    if (prefs.cap.length !== 5) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/offerte/search?${buildSearchParams(prefs)}`, {
          signal: controller.signal,
        });
        const payload = (await response.json()) as SearchPayload & { error?: string };
        if (!response.ok) {
          setResult({
            places: [],
            punEurKwh: null,
            forwardAsOf: null,
            forwardSource: null,
            hits: [],
            totalMatched: 0,
            error: payload.error,
          });
          return;
        }
        setResult(payload);
        setCapError(payload.places.length === 0 ? "Questo CAP non è in anagrafica." : null);
      } catch (error) {
        if ((error as { name?: string }).name === "AbortError") return;
        setResult({
          places: [],
          punEurKwh: null,
          forwardAsOf: null,
          forwardSource: null,
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
  }, [prefs]);

  const placeLabel = useMemo(() => {
    const names = [...new Set((result?.places ?? []).map((place) => place.comuneNome))];
    if (names.length === 0) return null;
    const region = result?.places[0]?.regioneNome;
    return region ? `${names.join(", ")} · ${region}` : names.join(", ");
  }, [result]);

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
      <h1 id={titleId} className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
        Confronta offerte luce
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
        <strong className="font-medium text-foreground">{formatIt(stats.total)} offerte</strong>
        {" · "}
        {formatIt(stats.venditori)} venditori
        {" · "}
        <a href={STATS_HREF} className="underline decoration-neutral-300 underline-offset-2 hover:text-foreground dark:decoration-neutral-600">
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
          }}
          className="w-full border-0 bg-transparent p-0 text-3xl font-semibold tracking-[0.14em] text-foreground outline-none placeholder:tracking-normal placeholder:text-neutral-400 sm:text-4xl"
        />
        {placeLabel ? (
          <p className="mt-0.5 truncate text-sm text-neutral-600 dark:text-neutral-400">
            {placeLabel}
          </p>
        ) : capError ? (
          <p className="mt-0.5 text-sm text-red-600 dark:text-red-400">{capError}</p>
        ) : (
          <p className="mt-0.5 text-sm text-neutral-500 dark:text-neutral-400">
            Inserisci il CAP della fornitura.
          </p>
        )}
      </div>

      <div className="mt-8 flex flex-col gap-6">
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

        {prefs.cliente === "domestico" ? (
          <fieldset>
            <legend className="text-sm text-neutral-500 dark:text-neutral-400">Residenza</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              <Chip active={prefs.residente} onClick={() => setPrefs((prev) => ({ ...prev, residente: true }))}>
                Residente
              </Chip>
              <Chip
                active={!prefs.residente}
                onClick={() => setPrefs((prev) => ({ ...prev, residente: false }))}
              >
                Non residente
              </Chip>
            </div>
          </fieldset>
        ) : null}

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

        <fieldset>
          <legend className="text-sm text-neutral-500 dark:text-neutral-400">Come consumi</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            <Chip
              active={prefs.profilo === "standard"}
              onClick={() => setPrefs((prev) => ({ ...prev, profilo: "standard" }))}
              title="Inverno più alto, primavera più basso, un po’ di clima d’estate"
            >
              Standard
            </Chip>
            <Chip
              active={prefs.profilo === "oculato"}
              onClick={() => setPrefs((prev) => ({ ...prev, profilo: "oculato" }))}
              title="Sposti la parte flessibile su ore e mesi più convenienti"
            >
              Oculato
            </Chip>
          </div>
          <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
            {prefs.profilo === "oculato"
              ? "Lavatrice, boiler e ricariche sulle fasce e i mesi più bassi; il resto della casa resta com’è. Il totale kWh non cambia."
              : "Come una casa media: più prelievo in inverno, un po’ di clima a luglio–agosto, primavera più leggera. Il totale kWh non cambia."}
          </p>
        </fieldset>

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
            <fieldset className="sm:col-span-2">
              <legend className="text-sm text-neutral-500 dark:text-neutral-400">Pagamento</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                <FilterChips
                  options={PAGAMENTO_FILTERS}
                  selected={prefs.pagamento}
                  onChange={(pagamento) => setPrefs((prev) => ({ ...prev, pagamento }))}
                />
              </div>
            </fieldset>
            <fieldset className="sm:col-span-2">
              <legend className="text-sm text-neutral-500 dark:text-neutral-400">Attivazione</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                <FilterChips
                  options={ATTIVAZIONE_FILTERS}
                  selected={prefs.attivazione}
                  onChange={(attivazione) => setPrefs((prev) => ({ ...prev, attivazione }))}
                />
              </div>
              <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
                Come sottoscrivi. «Qualsiasi canale» vale anche se filtri solo web.
              </p>
            </fieldset>
            <fieldset className="sm:col-span-2">
              <legend className="text-sm text-neutral-500 dark:text-neutral-400">
                Quando si attiva
              </legend>
              <div className="mt-2 flex flex-wrap gap-2">
                <FilterChips
                  options={CONTRATTO_FILTERS}
                  selected={prefs.contratto}
                  onChange={(contratto) => setPrefs((prev) => ({ ...prev, contratto }))}
                />
              </div>
              <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
                Cambio fornitore, prima volta, riattivazione o voltura. Se la scheda non lo dice,
                l’offerta resta in lista.
              </p>
            </fieldset>
          </div>
        ) : null}
      </div>

      <div className="mt-8 min-h-40">
        {prefs.cap.length !== 5 ? (
          <p className="text-sm text-neutral-500">Inserisci un CAP di 5 cifre per vedere le offerte.</p>
        ) : loading && !result?.hits.length ? (
          <p className="text-sm text-neutral-500">Carico le offerte…</p>
        ) : result?.error ? (
          <p className="text-sm text-red-600 dark:text-red-400">{result.error}</p>
        ) : result && result.places.length === 0 ? (
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
        Il prezzo in grande è la stima del primo anno: materia energia con perdite di rete
        (~10%), rete, oneri, accise e IVA, sul consumo e la potenza che hai messo. Standard
        segue le stagioni di una casa media; oculato sposta circa un quarto del consumo sui
        mesi e le ore più convenienti (F3, notti, weekend). Sotto, la media al mese sulla
        durata in scheda. La curva è mese per mese (12 o 24 mesi); il secondo anno è più
        chiaro. Non interpoliamo il rinnovo dopo la durata. Per le variabili usiamo, mese per
        mese, i
        {" "}
        <a
          href={GME_MTE_PAGE_URL}
          target="_blank"
          rel="noreferrer"
          className="underline decoration-neutral-300 underline-offset-2 hover:text-foreground dark:decoration-neutral-600"
        >
          forward GME MTE mensili
        </a>
        {" "}
        dove ci sono, e i
        {" "}
        <a
          href={CME_ITB_PAGE_URL}
          target="_blank"
          rel="noreferrer"
          className="underline decoration-neutral-300 underline-offset-2 hover:text-foreground dark:decoration-neutral-600"
        >
          futures CME Italian Power
        </a>
        {" "}
        per i mesi successivi
        {result?.forwardAsOf ? ` al ${formatIsoDate(result.forwardAsOf)}` : ""}
        {result?.punEurKwh != null
          ? ` (PUN atteso ${formatCen(result.punEurKwh)} c€/kWh)`
          : " — curva non ancora disponibile"}
        . Ogni giorno salviamo uno snapshot nuovo, senza sovrascrivere i precedenti. Non è il
        numero del Portale Offerte: loro usano forward Acquirente Unico non pubblici. Fonte
        schede:{" "}
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
    </section>
  );
}

function toggleFilterId(list: string[], id: string) {
  return list.includes(id) ? list.filter((value) => value !== id) : [...list, id];
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
          onClick={() => onChange(toggleFilterId(selected, option.id))}
        >
          {option.label}
        </Chip>
      ))}
    </>
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
    const scroller = triggerRef.current?.closest(".offerte-compare-scroll");
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
            rootRef.current ?? document.body,
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
  const params = new URLSearchParams({
    cap: prefs.cap,
    cliente: prefs.cliente,
    mercato: prefs.mercato,
    prezzo: prefs.prezzo,
    fascia: prefs.fascia,
    consumo: String(prefs.consumoKwh),
    potenza: String(prefs.potenzaKw),
    residente: prefs.residente ? "1" : "0",
    profilo: prefs.profilo,
    offset: String(offset),
    limit: String(OFFERTE_SEARCH_PAGE_SIZE),
  });
  if (prefs.pagamento.length) params.set("pagamento", prefs.pagamento.join(","));
  if (prefs.attivazione.length) params.set("attivazione", prefs.attivazione.join(","));
  if (prefs.contratto.length) params.set("contratto", prefs.contratto.join(","));
  return params;
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
                  {hit.breakdown ? (
                    <p className="offerte-hit-muted mt-2 text-xs text-neutral-500 dark:text-neutral-400">
                      {formatEuro(hit.breakdown.energia)} energia
                      {" · "}
                      {formatEuro(hit.breakdown.rete)} rete
                      {" · "}
                      {formatEuro(hit.breakdown.oneri)} oneri
                      {" · "}
                      {formatEuro(hit.breakdown.imposte)} imposte
                      {hit.breakdown.sconti > 0 ? ` · −${formatEuro(hit.breakdown.sconti)} sconti` : ""}
                    </p>
                  ) : null}
                </div>
                <YearPrice annualEur={hit.annualEur} months={hit.months} />
                <ChevronIcon />
              </summary>
              {hit.months && hit.months.length > 1 ? (
                <MonthBillChart months={hit.months} />
              ) : null}
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

function curveHorizonLabel(months: OfferteMonthPoint[]) {
  return `${months.length} mesi`;
}

function monthAverageEur(months: OfferteMonthPoint[] | null) {
  if (!months || months.length === 0) return null;
  return months.reduce((sum, month) => sum + month.eur, 0) / months.length;
}

function YearPrice({
  annualEur,
  months,
}: {
  annualEur: number | null;
  months: OfferteMonthPoint[] | null;
}) {
  const longCurve = (months?.length ?? 0) > 12;
  const avgMonthEur = monthAverageEur(months);
  const label =
    annualEur == null
      ? "Stima del primo anno non disponibile"
      : avgMonthEur != null
        ? `Stima primo anno ${formatEuro(annualEur)}, media ${formatEuro(avgMonthEur)} al mese su ${months!.length} mesi`
        : `Stima primo anno ${formatEuro(annualEur)}`;
  return (
    <div className="shrink-0 text-right" aria-label={label}>
      <p>
        <span
          className={`block font-semibold tabular-nums tracking-tight ${
            annualEur == null ? "text-lg text-neutral-400 dark:text-neutral-500" : "text-2xl sm:text-3xl"
          }`}
        >
          {annualEur == null ? "n.d." : formatEuro(annualEur)}
        </span>
        <span className="offerte-hit-muted mt-0.5 block text-xs text-neutral-500 dark:text-neutral-400">
          primo anno
        </span>
      </p>
      {avgMonthEur != null ? (
        <p className="mt-1 text-xs tabular-nums">
          {formatEuro(avgMonthEur)}
          <span className="offerte-hit-muted"> / mese</span>
        </p>
      ) : null}
      {months && months.length > 1 ? (
        <div className="mt-1.5">
          <MonthBars months={months} height={32} className="ml-auto w-19 sm:w-23" />
          {longCurve ? (
            <p className="offerte-hit-muted mt-1 text-[0.65rem] leading-none text-neutral-500 dark:text-neutral-400">
              {curveHorizonLabel(months)}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function monthBarClass(index: number, count: number) {
  if (index === 0) return "bg-current";
  if (count > 12 && index >= 12) return "bg-current/22";
  return "bg-current/40";
}

function MonthBars({
  months,
  height,
  className,
}: {
  months: OfferteMonthPoint[];
  height: number;
  className?: string;
}) {
  const values = months.map((month) => month.eur);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const minBar =
    span === 0 ? Math.round(height * 0.72) : Math.max(6, Math.round(height * 0.22));
  const minEur = months.reduce((best, month) => Math.min(best, month.eur), months[0]!.eur);
  const maxEur = months.reduce((best, month) => Math.max(best, month.eur), months[0]!.eur);
  return (
    <div
      className={`flex items-end gap-px ${className ?? ""}`}
      style={{ height }}
      role="img"
      aria-label={`Andamento su ${months.length} mesi, da ${formatEuro(minEur)} a ${formatEuro(maxEur)} al mese`}
    >
      {months.map((month, i) => (
        <span
          key={month.index}
          title={`${month.label}: ${formatEuro(month.eur)}`}
          className={monthBarClass(i, months.length)}
          style={{
            height: `${minBar + ((month.eur - min) / span) * (height - minBar)}px`,
            flex: "1 1 0%",
            minWidth: 1,
          }}
        />
      ))}
    </div>
  );
}

function MonthBillChart({ months }: { months: OfferteMonthPoint[] }) {
  const values = months.map((month) => month.eur);
  const minEur = Math.min(...values);
  const maxEur = Math.max(...values);
  const avgEur = monthAverageEur(months);
  const first = months[0]!;
  const last = months[months.length - 1]!;
  const yearMark = months.length > 12 ? months[11] : null;
  const splitPct = months.length > 12 ? (12 / months.length) * 100 : null;
  return (
    <div className="pt-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-medium">Andamento su {curveHorizonLabel(months)}</p>
        <p className="offerte-hit-muted text-xs tabular-nums text-neutral-500 dark:text-neutral-400">
          {avgEur != null ? `media ${formatEuro(avgEur)}/mese` : `${formatEuro(minEur)}–${formatEuro(maxEur)}/mese`}
        </p>
      </div>
      <div className="relative mt-2">
        <MonthBars months={months} height={112} className="w-full" />
        {splitPct != null ? (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 border-l border-current/25"
            style={{ left: `${splitPct}%` }}
          />
        ) : null}
      </div>
      <div className="offerte-hit-muted mt-1.5 flex justify-between gap-2 text-xs text-neutral-500 dark:text-neutral-400">
        <span>{first.label}</span>
        {yearMark ? <span className="hidden sm:inline">fine 1° anno · {yearMark.label}</span> : null}
        <span>{last.label}</span>
      </div>
    </div>
  );
}

function formatEuro(value: number) {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCen(value: number) {
  return new Intl.NumberFormat("it-IT", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  }).format(value * 100);
}

function formatIsoDate(iso: string) {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

function formatIt(value: number) {
  return new Intl.NumberFormat("it-IT").format(value);
}

