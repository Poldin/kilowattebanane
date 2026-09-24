"use client";

import {
  memo,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import { CompareSynthesis } from "@/components/offerte/CompareSynthesis";
import { FasciaPlanIcon } from "@/components/offerte/FasciaPlanIcon";
import { OfferCodeLink, formatOfferPeriod } from "@/components/offerte/OfferHitDettaglio";
import {
  OwnOfferDialog,
  buildCustomCompareOffer,
  isCustomOfferId,
  type OwnOfferDraft,
} from "@/components/offerte/OwnOfferDialog";
import {
  ClienteIcon,
  MercatoIcon,
  OfferTraitIcons,
  PrezzoIcon,
} from "@/components/offerte/OfferteTraitIcons";
import { FASCIA_COLOR } from "@/lib/fasce";
import { buildCompareSynthesis } from "@/lib/offerte/compare-synthesis";
import { billHorizon } from "@/lib/offerte/bill";
import type { CompareScheda } from "@/lib/offerte/compare-scheda";
import type { OfferteCompareProfile } from "@/lib/offerte/compare-profile";
import {
  monthSpendBreakdown,
  pricedMonth,
  type ComparePunShape,
  type MonthSpendBreakdown,
} from "@/lib/offerte/compare-spend";
import {
  hourShares,
  monthKwhShares,
  STANDARD_MONTH_WEIGHT,
} from "@/lib/offerte/consumo-profile";
import { defaultOfferStartDate } from "@/lib/offerte/dates";
import { addDaysIso, fasciaForHour } from "@/lib/offerte/fasce";
import type { OfferteConsumoProfilo, OfferteHitDettaglio } from "@/lib/offerte/public-types";
import {
  OFFERTE_SUGGEST_CATEGORY_LABELS,
  PORTALE_OFFERTE_URL,
  type OfferteCatalogFilters,
  type OfferteExploreHit,
  type OfferteSuggestCategory,
  type OfferteSuggestItem,
} from "@/lib/offerte/public-types";
import { useRotatingComparePlaceholder } from "@/lib/use-rotating-cap-placeholder";

const CATEGORY_ORDER: OfferteSuggestCategory[] = ["fornitore", "codice", "nome"];

type CompareCliente = "domestico" | "non domestico";
type ComparePrezzo = "fisso" | "variabile";
type ComparePunMonth = {
  start: string;
  end?: string;
  label: string;
  eurKwh: number | null;
};
type CompareCarico = {
  lambda: number;
  accisaPerKwh: number;
  ivaRate: number;
};
type CompareCaricoByCliente = {
  domestico: CompareCarico;
  nonDomestico: CompareCarico;
};
type CompareSpend = {
  monthKwh: number[];
  dayFractions: number[];
  hoursByMonth: number[][];
  sharesByMonth: Array<{ f1: number; f2: number; f3: number }>;
  shape: ComparePunShape | null;
  includeMarket: boolean;
};

const DEFAULT_ANNUAL_KWH = 2700;
const MIN_ANNUAL_KWH = 800;
const MAX_ANNUAL_KWH = 20000;
const MONTH_ABBREV = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"] as const;
const FASCIA_BANDS = [
  { key: "f1", label: "F1", color: FASCIA_COLOR.F1 },
  { key: "f2", label: "F2", color: FASCIA_COLOR.F2 },
  { key: "f3", label: "F3", color: FASCIA_COLOR.F3 },
] as const;

type FasciaKwh = { f1: number; f2: number; f3: number };

type MonthConsumption = {
  start: string;
  end: string;
  days: number;
  abbrev: string;
  kwh: number;
  f1: number;
  f2: number;
  f3: number;
  hours: number[];
  shares: FasciaKwh;
  standard: FasciaKwh;
  oculato: FasciaKwh;
};

function addCalendarMonths(iso: string, months: number) {
  const [year, month, day] = iso.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1 + months, day));
  return utc.toISOString().slice(0, 10);
}

/** Calendar months clipped to [from, the day before the same date N months later]. */
function contractSpans(from: string, months = 12) {
  const windowEnd = addDaysIso(addCalendarMonths(from, months), -1);
  const spans: Array<{ start: string; end: string }> = [];
  let cursor = from;
  for (let guard = 0; cursor <= windowEnd && guard < months + 4; guard++) {
    const monthEnd = inclusiveEnd(cursor, undefined);
    const end = monthEnd < windowEnd ? monthEnd : windowEnd;
    spans.push({ start: cursor, end });
    cursor = addDaysIso(end, 1);
  }
  return spans;
}

function overlapDays(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  const start = aStart > bStart ? aStart : bStart;
  const end = aEnd < bEnd ? aEnd : bEnd;
  if (start > end) return 0;
  return inclusiveDays(start, end);
}

function blendPun(start: string, end: string, calendar: ComparePunMonth[]) {
  let weighted = 0;
  let days = 0;
  for (let index = 0; index < calendar.length; index++) {
    const month = calendar[index]!;
    const monthEnd = inclusiveEnd(month.start, calendar[index + 1]?.start);
    const overlap = overlapDays(start, end, month.start, monthEnd);
    if (overlap <= 0 || month.eurKwh == null) continue;
    weighted += month.eurKwh * overlap;
    days += overlap;
  }
  return days > 0 ? weighted / days : null;
}

function daysInCalendarMonth(iso: string) {
  const [year, month] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function spanSeasonWeight(start: string, end: string) {
  let weight = 0;
  let date = start;
  const stop = addDaysIso(end, 1);
  for (let guard = 0; date < stop && guard < 40; guard++) {
    const month = Number(date.slice(5, 7)) - 1;
    weight += (STANDARD_MONTH_WEIGHT[month] ?? 1) / daysInCalendarMonth(date);
    date = addDaysIso(date, 1);
  }
  return weight;
}

function defaultSpanKwh(spans: Array<{ start: string; end: string }>, annual = DEFAULT_ANNUAL_KWH) {
  const weights = spans.map((span) => spanSeasonWeight(span.start, span.end));
  const sum = weights.reduce((total, value) => total + value, 0);
  const out = weights.map((weight) => Math.round(annual * (sum > 0 ? weight / sum : 0)));
  const drift = annual - out.reduce((total, value) => total + value, 0);
  if (out.length > 0) out[out.length - 1] = Math.max(0, (out[out.length - 1] ?? 0) + drift);
  return out;
}

function oculatoSpanKwh(
  spans: Array<{ start: string; end: string }>,
  annual: number,
  punBySpan: Array<number | null | undefined>,
) {
  const starts = spans.map((span) => span.start);
  const shares = monthKwhShares({ profilo: "oculato", starts, punEurKwh: punBySpan });
  const out = shares.map((share) => Math.round(annual * share));
  const drift = annual - out.reduce((total, value) => total + value, 0);
  if (out.length > 0) out[out.length - 1] = Math.max(0, (out[out.length - 1] ?? 0) + drift);
  return out;
}

function spanPhrase(start: string, end: string) {
  const from = Number(start.slice(8, 10));
  const to = Number(end.slice(8, 10));
  if (start.slice(0, 7) === end.slice(0, 7)) return `dal ${from} al ${to}`;
  return `dal ${from} ${monthAbbrev(start)} al ${to} ${monthAbbrev(end)}`;
}

function inclusiveEnd(start: string, next: string | undefined) {
  if (next) return addDaysIso(next, -1);
  const [year, month] = start.split("-").map(Number);
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
}

function inclusiveDays(start: string, end: string) {
  const [ys, ms, ds] = start.split("-").map(Number);
  const [ye, me, de] = end.split("-").map(Number);
  return Math.round((Date.UTC(ye, me - 1, de) - Date.UTC(ys, ms - 1, ds)) / 86_400_000) + 1;
}

function monthAbbrev(start: string) {
  return MONTH_ABBREV[Number(start.slice(5, 7)) - 1] ?? start.slice(5, 7);
}

function fasciaSharesForSpan(start: string, end: string, hours: number[]) {
  const acc = { f1: 0, f2: 0, f3: 0 };
  if (hours.length !== 24) return { f1: 1 / 3, f2: 1 / 3, f3: 1 / 3 };
  let date = start;
  const stop = addDaysIso(end, 1);
  for (let guard = 0; date < stop && guard < 40; guard++) {
    for (let hour = 0; hour < 24; hour++) acc[fasciaForHour(date, hour)] += hours[hour] ?? 0;
    date = addDaysIso(date, 1);
  }
  const sum = acc.f1 + acc.f2 + acc.f3;
  if (!(sum > 0)) return { f1: 1 / 3, f2: 1 / 3, f3: 1 / 3 };
  return { f1: acc.f1 / sum, f2: acc.f2 / sum, f3: acc.f3 / sum };
}

function splitKwh(total: number, shares: FasciaKwh): FasciaKwh {
  const rounded = Math.max(0, Math.round(total));
  const f1 = Math.min(rounded, Math.max(0, Math.round(rounded * shares.f1)));
  const f2 = Math.min(rounded - f1, Math.max(0, Math.round(rounded * shares.f2)));
  return { f1, f2, f3: Math.max(0, rounded - f1 - f2) };
}

function scaleFascia(source: FasciaKwh, total: number): FasciaKwh {
  const target = Math.min(20000, Math.max(0, Math.round(total)));
  const current = source.f1 + source.f2 + source.f3;
  if (!(current > 0) || target === 0) {
    const each = Math.floor(target / 3);
    return { f1: each, f2: each, f3: target - 2 * each };
  }
  const f1 = Math.min(target, Math.round((source.f1 / current) * target));
  const f2 = Math.min(Math.max(0, target - f1), Math.round((source.f2 / current) * target));
  return { f1, f2, f3: target - f1 - f2 };
}

function roundedStepPath(rows: Array<{ x: number; width: number; y: number }>, radius: number) {
  const first = rows[0];
  if (!first) return "";
  const parts = [`M ${first.x} ${first.y}`];
  for (let index = 0; index < rows.length; index++) {
    const row = rows[index]!;
    const next = rows[index + 1];
    const right = row.x + row.width;
    if (!next) {
      parts.push(`L ${right} ${row.y}`);
      break;
    }
    const dy = next.y - row.y;
    const curve = Math.min(radius, row.width / 3, next.width / 3, Math.abs(dy) / 2);
    if (curve < 0.5 || Math.abs(dy) < 0.5) {
      parts.push(`L ${right} ${row.y} L ${right} ${next.y}`);
      continue;
    }
    const sign = dy > 0 ? 1 : -1;
    parts.push(`L ${right - curve} ${row.y}`);
    parts.push(`Q ${right} ${row.y} ${right} ${row.y + sign * curve}`);
    parts.push(`L ${right} ${next.y - sign * curve}`);
    parts.push(`Q ${right} ${next.y} ${right + curve} ${next.y}`);
  }
  return parts.join(" ");
}

function sameFascia(a: FasciaKwh, b: FasciaKwh) {
  return Math.abs(a.f1 - b.f1) <= 1 && Math.abs(a.f2 - b.f2) <= 1 && Math.abs(a.f3 - b.f3) <= 1;
}

function shareDistance(a: FasciaKwh, b: FasciaKwh) {
  return Math.abs(a.f1 - b.f1) + Math.abs(a.f2 - b.f2) + Math.abs(a.f3 - b.f3);
}

function consumptionModeLabel(
  rows: MonthConsumption[],
  preset: OfferteConsumoProfilo,
  edits: Record<string, FasciaKwh>,
) {
  if (rows.length === 0) return "Standard";
  const customized = rows.some((row) => {
    const edit = edits[row.start];
    if (!edit) return false;
    const baseline = preset === "oculato" ? row.oculato : row.standard;
    return !sameFascia(edit, baseline);
  });
  if (customized) return "Personalizzato";
  return preset === "oculato" ? "Oculato" : "Standard";
}

function formatKwh(value: number) {
  return new Intl.NumberFormat("it-IT", { maximumFractionDigits: 0 }).format(Math.round(value));
}

const COMPARE_OFFER_COLORS = [
  "#f43f5e",
  "#3b82f6",
  "#22c55e",
  "#eab308",
  "#a855f7",
  "#06b6d4",
  "#f97316",
  "#ec4899",
] as const;

type OfferteCompareSearchProps = {
  className?: string;
  filters?: ReactNode;
  filterQuery?: OfferteCatalogFilters;
  filtersReady?: boolean;
  headlineTotal?: number;
};

function catalogSearchParams(filters?: OfferteCatalogFilters) {
  const params = new URLSearchParams();
  if (!filters) return params;
  if (filters.cliente) params.set("cliente", filters.cliente);
  if (filters.mercato && filters.mercato !== "tutti") params.set("mercato", filters.mercato);
  if (filters.prezzo && filters.prezzo !== "tutti") params.set("prezzo", filters.prezzo);
  if (filters.fascia && filters.fascia !== "tutti") params.set("fascia", filters.fascia);
  if (filters.residente === false) params.set("residente", "0");
  if (filters.residente === true) params.set("residente", "1");
  if (filters.pagamento?.length) params.set("pagamento", filters.pagamento.join(","));
  if (filters.attivazione?.length) params.set("attivazione", filters.attivazione.join(","));
  if (filters.contratto?.length) params.set("contratto", filters.contratto.join(","));
  return params;
}

function CompareSearchGhost() {
  const { text, isTyping } = useRotatingComparePlaceholder();
  return (
    <span
      className="pointer-events-none absolute inset-0 truncate text-3xl font-semibold tracking-tight text-neutral-400 sm:text-4xl"
      aria-hidden
    >
      {text}
      {isTyping ? (
        <span
          className="ml-px inline-block h-[0.9em] w-0.5 translate-y-[0.12em] bg-neutral-400 align-baseline opacity-70"
          aria-hidden
        />
      ) : null}
    </span>
  );
}

export function OfferteCompareSearch({
  className,
  filters,
  filterQuery,
  filtersReady = true,
  headlineTotal,
}: OfferteCompareSearchProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();

  const [query, setQuery] = useState("");
  const [vendorKey, setVendorKey] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const showCompareGhost = query.length === 0 && !focused;
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<OfferteSuggestItem[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [selected, setSelected] = useState<OfferteSuggestItem[]>([]);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Record<string, OfferteCompareProfile>>({});
  const [hotOffers, setHotOffers] = useState<OfferteExploreHit[]>([]);
  const [ownOfferOpen, setOwnOfferOpen] = useState(false);
  const compareOffers = useMemo(
    () => selected.filter((item) => item.category !== "fornitore"),
    [selected],
  );

  const filterKey = catalogSearchParams(filterQuery).toString();
  const flatItems = useMemo(() => items, [items]);
  const grouped = useMemo(() => {
    const map = new Map<OfferteSuggestCategory, OfferteSuggestItem[]>();
    for (const category of CATEGORY_ORDER) map.set(category, []);
    for (const item of flatItems) map.get(item.category)?.push(item);
    return CATEGORY_ORDER.map((category) => ({
      category,
      label: OFFERTE_SUGGEST_CATEGORY_LABELS[category],
      items: map.get(category) ?? [],
    })).filter((group) => group.items.length > 0);
  }, [flatItems]);

  useEffect(() => {
    const q = query.trim();
    if (!vendorKey && q.length < 2) {
      setItems([]);
      setLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);
    if (vendorKey) setItems([]);

    const timer = window.setTimeout(async () => {
      try {
        const params = catalogSearchParams(filterQuery);
        params.set("q", q);
        if (vendorKey) params.set("vendor", vendorKey);
        const response = await fetch(`/api/offerte/suggest?${params.toString()}`, {
          signal: controller.signal,
        });
        const payload = (await response.json()) as
          | { items: OfferteSuggestItem[] }
          | { error: string };
        if (!response.ok) {
          throw new Error("error" in payload ? payload.error : "Suggerimenti non disponibili");
        }
        setItems("items" in payload ? payload.items : []);
        setActiveIndex(0);
      } catch (caught) {
        if (controller.signal.aborted) return;
        setItems([]);
        setError(caught instanceof Error ? caught.message : "Errore di rete");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 180);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [filterKey, filterQuery, query, vendorKey]);

  useEffect(() => {
    if (!filtersReady) return;
    const controller = new AbortController();
    void (async () => {
      try {
        const params = catalogSearchParams(filterQuery);
        params.set("limit", "5");
        const response = await fetch(`/api/offerte/explore?${params.toString()}`, {
          signal: controller.signal,
        });
        const payload = (await response.json()) as
          | { items: OfferteExploreHit[] }
          | { error: string };
        if (!response.ok || !("items" in payload)) return;
        setHotOffers(payload.items.slice(0, 5));
      } catch (caught) {
        if (controller.signal.aborted) return;
        setHotOffers([]);
      }
    })();
    return () => controller.abort();
  }, [filterKey, filterQuery, filtersReady]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (!open || activeIndex < 0) return;
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  function pick(item: OfferteSuggestItem, options?: { focusInput?: boolean }) {
    const focusInput = options?.focusInput !== false;
    if (item.category === "fornitore" && item.venditoreKey) {
      setVendorKey(item.venditoreKey);
      setQuery(item.label);
      setItems([]);
      setLoading(true);
      setOpen(true);
      setActiveIndex(-1);
      if (focusInput) inputRef.current?.focus();
      return;
    }

    setSelected((prev) => {
      if (prev.some((entry) => entry.id === item.id)) return prev;
      return [...prev, item];
    });
    setFocusedId((current) => current ?? item.id);
    if (vendorKey) {
      setOpen(true);
      if (focusInput) inputRef.current?.focus();
      return;
    }
    setQuery("");
    setItems([]);
    setOpen(false);
    setActiveIndex(-1);
    if (focusInput) inputRef.current?.focus();
  }

  useEffect(() => {
    if (compareOffers.length === 0) setFocusedId(null);
  }, [compareOffers.length]);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      for (const item of compareOffers) {
        if (!item.source || !item.codOfferta) continue;
        try {
          const params = new URLSearchParams({
            source: item.source,
            cod: item.codOfferta,
          });
          const response = await fetch(`/api/offerte/compare?${params.toString()}`, {
            signal: controller.signal,
          });
          const payload = (await response.json()) as
            | { profile: OfferteCompareProfile }
            | { error: string };
          if (!response.ok || !("profile" in payload)) continue;
          setProfiles((prev) =>
            prev[item.id] ? prev : { ...prev, [item.id]: payload.profile },
          );
        } catch (caught) {
          if (controller.signal.aborted) return;
        }
      }
    })();
    return () => controller.abort();
  }, [compareOffers]);

  function addOwnOffer(draft: OwnOfferDraft) {
    const customCount = selected.filter((entry) => isCustomOfferId(entry.id)).length;
    const nome = customCount === 0 ? "La tua offerta" : `La tua offerta ${customCount + 1}`;
    const { item, profile } = buildCustomCompareOffer(nome, draft);
    setSelected((prev) => [...prev, item]);
    setProfiles((prev) => ({ ...prev, [item.id]: profile }));
    setFocusedId((current) => current ?? item.id);
    setOwnOfferOpen(false);
  }

  const remove = useCallback((id: string) => {
    setSelected((prev) => {
      const next = prev.filter((entry) => entry.id !== id);
      setFocusedId((focused) => {
        if (focused !== id) return focused;
        const remaining = next.filter((entry) => entry.category !== "fornitore");
        return remaining[0]?.id ?? null;
      });
      return next;
    });
    setProfiles((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  function onInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open && (vendorKey || query.trim().length >= 2)) setOpen(true);
      if (flatItems.length === 0) return;
      setActiveIndex((index) => (index + 1) % flatItems.length);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (flatItems.length === 0) return;
      setActiveIndex((index) => (index <= 0 ? flatItems.length - 1 : index - 1));
      return;
    }
    if (event.key === "Enter") {
      if (open && activeIndex >= 0 && flatItems[activeIndex]) {
        event.preventDefault();
        pick(flatItems[activeIndex]);
      }
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
    }
  }

  let runningIndex = -1;

  return (
    <div className={className ? `min-w-0 ${className}` : "min-w-0"}>
      {headlineTotal != null ? (
        <header className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Confronta offerte luce
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
            Confronta tra {formatKwh(headlineTotal)} offerte del{" "}
            <a
              href={PORTALE_OFFERTE_URL}
              target="_blank"
              rel="noreferrer"
              className="underline decoration-neutral-300 underline-offset-2 transition-colors hover:text-foreground dark:decoration-neutral-600"
            >
              Portale Offerte
            </a>{" "}
            o{" "}
            <button
              type="button"
              aria-haspopup="dialog"
              aria-expanded={ownOfferOpen}
              onClick={() => setOwnOfferOpen(true)}
              className="mx-0.5 inline-flex translate-y-[-0.08em] items-center rounded-md bg-foreground px-2.5 py-1 text-sm font-medium text-background transition-opacity hover:opacity-85"
            >
              aggiungine una tua
            </button>
          </p>
          <OwnOfferDialog
            open={ownOfferOpen}
            onClose={() => setOwnOfferOpen(false)}
            onSubmit={addOwnOffer}
          />
        </header>
      ) : null}
      <section id="offerte-compare-search" aria-label="Cerca offerte" className="scroll-mt-20">
        {filters}

        <div ref={rootRef} className="relative">
          <label htmlFor="offerte-compare-q" className="sr-only">
            Cerca fornitore, codice o nome offerta
          </label>
        {showCompareGhost ? <CompareSearchGhost /> : null}
        <input
          ref={inputRef}
          id="offerte-compare-q"
          type="search"
          autoComplete="off"
          spellCheck={false}
          value={query}
          onChange={(event) => {
            setVendorKey(null);
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            setFocused(true);
            if (vendorKey || query.trim().length >= 2) setOpen(true);
          }}
          onBlur={() => setFocused(false)}
          onKeyDown={onInputKeyDown}
          placeholder=""
          className="relative w-full border-0 bg-transparent p-0 text-3xl font-semibold tracking-tight text-foreground outline-none sm:text-4xl"
        />

        {open && (vendorKey || query.trim().length >= 2) ? (
          <div className="absolute inset-x-0 top-full z-40 mt-2 overflow-hidden rounded-lg border border-neutral-200 bg-background shadow-lg dark:border-neutral-800">
            {loading ? (
              <p className="px-3 py-2.5 text-sm text-neutral-500 dark:text-neutral-400">
                Cerco…
              </p>
            ) : error ? (
              <p className="px-3 py-2.5 text-sm text-red-600 dark:text-red-400">{error}</p>
            ) : flatItems.length === 0 ? (
              <p className="px-3 py-2.5 text-sm text-neutral-500 dark:text-neutral-400">
                {vendorKey
                  ? "Nessuna offerta per questo fornitore."
                  : `Nessun risultato per «${query.trim()}».`}
              </p>
            ) : (
              <ul ref={listRef} id={listId} role="listbox" className="max-h-72 overflow-y-auto py-1">
                {grouped.map((group) => (
                  <li key={group.category}>
                    {vendorKey ? null : (
                      <p className="px-3 pb-1 pt-2 text-[11px] uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">
                        {group.label}
                      </p>
                    )}
                    <ul>
                      {group.items.map((item) => {
                        runningIndex += 1;
                        const index = runningIndex;
                        const active = index === activeIndex;
                        const picked = selected.some((entry) => entry.id === item.id);
                        return (
                          <li key={item.id}>
                            <button
                              type="button"
                              role="option"
                              aria-selected={active}
                              data-index={index}
                              onMouseDown={(event) => event.preventDefault()}
                              onMouseEnter={() => setActiveIndex(index)}
                              onClick={() => pick(item)}
                              className={`flex w-full items-start gap-3 px-3 py-2 text-left transition-colors ${
                                picked
                                  ? "opacity-45"
                                  : active
                                    ? "bg-neutral-100 dark:bg-neutral-900"
                                    : "hover:bg-neutral-50 dark:hover:bg-neutral-900/60"
                              }`}
                            >
                              {vendorKey ? null : <SuggestBadge category={item.category} />}
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-medium text-foreground">
                                  {item.label}
                                </span>
                                {item.detail ? (
                                  <span className="mt-0.5 block truncate text-xs text-neutral-500 dark:text-neutral-400">
                                    {item.detail}
                                  </span>
                                ) : null}
                              </span>
                              <OfferTraitIcons
                                tipoCliente={item.tipoCliente}
                                tipoOfferta={item.tipoOfferta}
                                plan={item.plan}
                                source={item.source}
                                className="mt-0.5 inline-flex shrink-0 items-center gap-1.5 text-neutral-400"
                              />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
        </div>

        <p className="mt-0.5 text-sm text-neutral-500 dark:text-neutral-400">
          nome fornitore, codice o nome offerta👆 oppure scegli tra le hot 🔥
        </p>

        <SoftReveal open={hotOffers.length > 0}>
          <HotOfferList
            offers={hotOffers}
            selectedIds={new Set(selected.map((entry) => entry.id))}
            onPick={(offer) => pick(offerToSuggestItem(offer), { focusInput: false })}
          />
        </SoftReveal>
      </section>

      <CompareReveal watch={compareOffers.length}>
        {compareOffers.length > 0 ? (
          <section
            aria-label="Confronto e condizioni"
            className="mt-16 rounded-xl border border-neutral-200 bg-neutral-50/70 p-5 pt-6 sm:p-6 dark:border-neutral-800 dark:bg-neutral-900/50"
          >
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              {compareOffers.length} selezionat{compareOffers.length === 1 ? "a" : "e"}
            </p>
            <CompareWorkspace
              offers={compareOffers}
              colors={COMPARE_OFFER_COLORS}
              focusedId={focusedId}
              profiles={profiles}
              initialCliente={catalogCliente(filterQuery?.cliente)}
              initialPrezzo={catalogPrezzo(filterQuery?.prezzo)}
              initialResidente={filterQuery?.residente !== false}
              onFocus={setFocusedId}
              onRemove={remove}
            />
          </section>
        ) : null}
      </CompareReveal>
    </div>
  );
}

function SoftReveal({ open, children }: { open: boolean; children: ReactNode }) {
  const innerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);

  useLayoutEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    if (!open) {
      setHeight(0);
      return;
    }
    const frame = requestAnimationFrame(() => setHeight(el.scrollHeight));
    const observer = new ResizeObserver(() => setHeight(el.scrollHeight));
    observer.observe(el);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [open]);

  return (
    <div
      aria-hidden={!open}
      inert={!open}
      className={`overflow-hidden overflow-anchor-none transition-[height,opacity] duration-300 ease-out motion-reduce:transition-none ${
        open || height > 0 ? "" : "mt-0!"
      }`}
      style={{ height, opacity: open ? 1 : 0 }}
    >
      <div ref={innerRef} className={open ? "" : "pointer-events-none"}>
        {children}
      </div>
    </div>
  );
}

function CompareReveal({ watch, children }: { watch: string | number; children: ReactNode }) {
  const innerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    const sync = () => setHeight(el.scrollHeight);
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(el);
    return () => observer.disconnect();
  }, [watch]);

  return (
    <div
      className="overflow-hidden overflow-anchor-none transition-[height] duration-500 ease-out motion-reduce:transition-none"
      style={{ height }}
    >
      <div ref={innerRef}>{children}</div>
    </div>
  );
}

function offerToSuggestItem(offer: OfferteExploreHit): OfferteSuggestItem {
  return {
    id: `nome:${offer.source}:${offer.codOfferta}`,
    category: "nome",
    label: offer.nome,
    detail: `${offer.venditore} · ${offer.codOfferta}`,
    codOfferta: offer.codOfferta,
    venditoreKey: offer.venditoreKey,
    venditore: offer.venditore,
    source: offer.source,
    tipoCliente: offer.tipoCliente,
    tipoOfferta: offer.tipoOfferta,
    plan: offer.plan,
  };
}

function HotOfferList({
  offers,
  selectedIds,
  onPick,
}: {
  offers: OfferteExploreHit[];
  selectedIds: Set<string>;
  onPick: (offer: OfferteExploreHit) => void;
}) {
  return (
    <ul className="mt-3 flex flex-wrap gap-2">
      {offers.map((offer, index) => {
        const id = `nome:${offer.source}:${offer.codOfferta}`;
        const picked = selectedIds.has(id);
        return (
          <li
            key={id}
            className="hot-offer-in max-w-full"
            style={{ animationDelay: `${index * 45}ms` }}
          >
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onPick(offer)}
              disabled={picked}
              className={`flex w-max max-w-full flex-col rounded-md border px-3 py-2.5 text-left transition-colors ${
                picked
                  ? "cursor-default border-neutral-200/70 opacity-45 dark:border-neutral-800/70"
                  : "border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:border-neutral-700 dark:hover:bg-neutral-900/60"
              }`}
            >
              <span className="text-sm font-medium text-foreground">
                <span aria-hidden>🔥 </span>
                {offer.nome}
              </span>
              <span className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                {offer.venditore}
              </span>
              <OfferTraitIcons
                tipoCliente={offer.tipoCliente}
                tipoOfferta={offer.tipoOfferta}
                plan={offer.plan}
                source={offer.source}
                className="mt-1.5 inline-flex items-center gap-1.5 text-neutral-400"
              />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function SuggestBadge({
  category,
  compact = false,
}: {
  category: OfferteSuggestCategory;
  compact?: boolean;
}) {
  const label = OFFERTE_SUGGEST_CATEGORY_LABELS[category];
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full bg-neutral-200/80 font-medium text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 ${
        compact ? "px-2 py-0.5 text-[10px]" : "px-2 py-0.5 text-[11px]"
      }`}
    >
      {compact ? label.split(" ")[0] : label}
    </span>
  );
}

type CompareSlice = {
  cliente: CompareCliente;
  prezzo: ComparePrezzo;
};

const COMPARE_SLICE_ORDER = [
  "domestico:variabile",
  "domestico:fisso",
  "non domestico:variabile",
  "non domestico:fisso",
] as const;

function offerCompareSlice(profile: OfferteCompareProfile | undefined): CompareSlice | null {
  if (!profile) return null;
  return {
    cliente: profile.tipoCliente === "non domestico" ? "non domestico" : "domestico",
    prezzo: profile.tipoOfferta.includes("variabile") ? "variabile" : "fisso",
  };
}

function compareSliceKey(slice: CompareSlice) {
  return `${slice.cliente}:${slice.prezzo}`;
}

function compareSliceLabel(slice: CompareSlice) {
  const clienteLabel = slice.cliente === "domestico" ? "Casa" : "Partita IVA";
  const prezzoLabel = slice.prezzo === "variabile" ? "Variabile" : "Fisso";
  return `${clienteLabel} · ${prezzoLabel}`;
}

function compareSliceSortIndex(key: string) {
  const index = COMPARE_SLICE_ORDER.indexOf(key as (typeof COMPARE_SLICE_ORDER)[number]);
  return index === -1 ? COMPARE_SLICE_ORDER.length : index;
}

function catalogCliente(cliente?: OfferteCatalogFilters["cliente"]): CompareCliente {
  return cliente === "non domestico" ? "non domestico" : "domestico";
}

function catalogPrezzo(prezzo?: OfferteCatalogFilters["prezzo"]): ComparePrezzo {
  return prezzo === "prezzo fisso" ? "fisso" : "variabile";
}

function scrollChildX(container: HTMLElement | null, selector: string) {
  if (!container) return;
  const el = container.querySelector<HTMLElement>(selector);
  if (!el) return;
  const frame = container.getBoundingClientRect();
  const box = el.getBoundingClientRect();
  if (box.left < frame.left) container.scrollLeft += box.left - frame.left;
  else if (box.right > frame.right) container.scrollLeft += box.right - frame.right;
}

function groupOffersByCompareSlice(
  offers: OfferteSuggestItem[],
  profiles: Record<string, OfferteCompareProfile>,
) {
  const groups = new Map<string, { slice: CompareSlice; offers: OfferteSuggestItem[] }>();
  for (const offer of offers) {
    const slice = offerCompareSlice(profiles[offer.id]);
    if (!slice) continue;
    const key = compareSliceKey(slice);
    const group = groups.get(key);
    if (group) group.offers.push(offer);
    else groups.set(key, { slice, offers: [offer] });
  }
  return groups;
}

function MonthPlayIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden fill="none">
      <path d="M5.2 3.4v9.2L13 8Z" fill="currentColor" />
    </svg>
  );
}

function MonthStopIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden fill="none">
      <rect x="4.2" y="4.2" width="7.6" height="7.6" rx="1" fill="currentColor" />
    </svg>
  );
}

function MonthScrub({
  count,
  index,
  label,
  disabled,
  onChange,
}: {
  count: number;
  index: number;
  label: string | null;
  disabled: boolean;
  onChange: (index: number) => void;
}) {
  const [playing, setPlaying] = useState(false);
  const indexRef = useRef(index);
  indexRef.current = index;
  const max = Math.max(count, 1);
  const at = Math.min(Math.max(index, 0), max - 1);
  const canPlay = !disabled && count >= 2;

  useEffect(() => {
    if (!canPlay) setPlaying(false);
  }, [canPlay]);

  useEffect(() => {
    if (!playing || !canPlay) return;
    const id = window.setInterval(() => {
      onChange((indexRef.current + 1) % count);
    }, 1000);
    return () => window.clearInterval(id);
  }, [playing, canPlay, count, onChange]);

  return (
    <div className="flex min-w-0 w-full items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400">
      <span className="shrink-0 tabular-nums text-foreground">{label ?? `Mese ${at + 1}`}</span>
      <button
        type="button"
        disabled={!canPlay}
        aria-pressed={playing}
        aria-label={playing ? "Ferma il passaggio automatico dei mesi" : "Avvia il passaggio automatico dei mesi"}
        title={playing ? "Stop" : "Play"}
        onClick={() => setPlaying((value) => !value)}
        className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors disabled:cursor-default disabled:opacity-40 ${
          playing
            ? "bg-neutral-200 text-foreground dark:bg-neutral-800"
            : "text-neutral-400 hover:bg-neutral-100 hover:text-foreground dark:hover:bg-neutral-800"
        }`}
      >
        {playing ? <MonthStopIcon /> : <MonthPlayIcon />}
      </button>
      <input
        type="range"
        min={0}
        max={max - 1}
        step={1}
        value={at}
        disabled={disabled}
        aria-label={`Mese del prezzo medio, dal mese 1 al mese ${max}`}
        aria-valuetext={label ?? `Mese ${at + 1} di ${max}`}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-1 w-full cursor-pointer accent-foreground disabled:cursor-default disabled:opacity-40"
      />
      <span className="shrink-0 tabular-nums">
        {at + 1}/{max}
      </span>
    </div>
  );
}

const PROFILE_DAY_PX = 2.9;
const PROFILE_CHART_H = 136;
const PROFILE_PAD_Y = 14;
const PROFILE_BAR_RATIO = 0.62;

function clampAnnualKwh(value: number) {
  return Math.min(MAX_ANNUAL_KWH, Math.max(MIN_ANNUAL_KWH, Math.round(value)));
}

const ANNUAL_KWH_PREF_KEY = "kilowattebanane.offerte.compare-kwh";

function readAnnualKwhPref(): number | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = window.localStorage.getItem(ANNUAL_KWH_PREF_KEY);
    if (raw == null) return undefined;
    const value = Number(raw);
    if (!Number.isFinite(value)) return undefined;
    return clampAnnualKwh(value);
  } catch {
    return undefined;
  }
}

function persistAnnualKwhPref(value: number) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ANNUAL_KWH_PREF_KEY, String(clampAnnualKwh(value)));
  } catch {
    // private mode / disabled storage
  }
}

function AnnualTotalControl({
  totalKwh,
  onChange,
}: {
  totalKwh: number;
  onChange: (kwh: number) => void;
}) {
  const [draft, setDraft] = useState(String(totalKwh));

  useEffect(() => {
    setDraft(String(totalKwh));
  }, [totalKwh]);

  const commitDraft = () => {
    const parsed = Number(draft.replace(/\s/g, ""));
    if (!Number.isFinite(parsed)) {
      setDraft(String(totalKwh));
      return;
    }
    onChange(clampAnnualKwh(parsed));
  };

  return (
    <label className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm text-neutral-600 dark:text-neutral-400">
      <span className="shrink-0">Totale annuo</span>
      <input
        type="number"
        inputMode="numeric"
        min={MIN_ANNUAL_KWH}
        max={MAX_ANNUAL_KWH}
        step={10}
        aria-label="Totale annuo in kWh"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commitDraft}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commitDraft();
          }
        }}
        className="w-20 rounded-md border border-neutral-200 bg-background px-2 py-1 tabular-nums text-foreground dark:border-neutral-800"
      />
      <span className="shrink-0">kWh</span>
      <input
        type="range"
        min={MIN_ANNUAL_KWH}
        max={MAX_ANNUAL_KWH}
        step={10}
        value={totalKwh}
        aria-label="Regola il totale annuo"
        aria-valuetext={`${formatKwh(totalKwh)} kWh`}
        onChange={(event) => onChange(clampAnnualKwh(Number(event.target.value)))}
        className="h-1 min-w-32 flex-1 cursor-pointer accent-foreground"
      />
    </label>
  );
}

function ProfilePresetSelect({
  value,
  onChange,
}: {
  value: OfferteConsumoProfilo;
  onChange: (value: OfferteConsumoProfilo) => void;
}) {
  const id = useId();
  return (
    <label htmlFor={id} className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400">
      <span>Profilo</span>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value === "oculato" ? "oculato" : "standard")}
        className="rounded-md border border-neutral-200 bg-background px-2 py-1 text-sm text-foreground dark:border-neutral-800"
      >
        <option value="standard">Standard</option>
        <option value="oculato">Oculato</option>
      </select>
    </label>
  );
}

function ConsumptionProfilePanel({
  id,
  rows,
  totalKwh,
  onTotalChange,
  profilePreset,
  onProfilePresetChange,
  selectedStart,
  onSelect,
  onFascia,
  onScale,
}: {
  id: string;
  rows: MonthConsumption[];
  totalKwh: number;
  onTotalChange: (kwh: number) => void;
  profilePreset: OfferteConsumoProfilo;
  onProfilePresetChange: (value: OfferteConsumoProfilo) => void;
  selectedStart: string | null;
  onSelect: (start: string) => void;
  onFascia: (start: string, band: keyof FasciaKwh, kwh: number) => void;
  onScale: (start: string, fascia: FasciaKwh) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const lineSvgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<{
    start: string;
    pointerId: number;
    startY: number;
    fascia: FasciaKwh;
    kwhPerPx: number;
  } | null>(null);
  const layout = useMemo(() => {
    let x = 0;
    return rows.map((row) => {
      const width = Math.max(row.days, 1) * PROFILE_DAY_PX;
      const barWidth = Math.max(width * PROFILE_BAR_RATIO, 8);
      const placed = { ...row, x, width, barWidth, barX: x + (width - barWidth) / 2 };
      x += width;
      return placed;
    });
  }, [rows]);
  const trackWidth = layout.reduce((sum, row) => sum + row.width, 0);
  const peak = Math.max(...rows.map((row) => row.kwh), 1);
  const yTop = axisTicks(peak).at(-1) ?? peak;
  const yTicks = axisTicks(peak);
  const innerH = PROFILE_CHART_H - PROFILE_PAD_Y * 2;
  const yOf = (kwh: number) => PROFILE_PAD_Y + innerH - (kwh / yTop) * innerH;
  const selected = layout.find((row) => row.start === selectedStart) ?? null;

  useEffect(() => {
    if (!selectedStart) return;
    scrollChildX(scrollRef.current, `[data-month="${selectedStart}"]`);
  }, [selectedStart]);

  const baseline = PROFILE_CHART_H - PROFILE_PAD_Y;
  const stepLine = roundedStepPath(
    layout.map((row) => ({ x: row.x, width: row.width, y: yOf(row.kwh) })),
    12,
  );
  const stepArea = stepLine ? `${stepLine} L ${trackWidth} ${baseline} L 0 ${baseline} Z` : "";

  function kwhPerPixel() {
    const rect = lineSvgRef.current?.getBoundingClientRect();
    const plot = rect ? (innerH / PROFILE_CHART_H) * rect.height : innerH;
    return yTop / Math.max(plot, 1);
  }

  function beginDrag(event: PointerEvent<SVGElement>, row: (typeof layout)[number]) {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    onSelect(row.start);
    dragRef.current = {
      start: row.start,
      pointerId: event.pointerId,
      startY: event.clientY,
      fascia: { f1: row.f1, f2: row.f2, f3: row.f3 },
      kwhPerPx: kwhPerPixel(),
    };
  }

  function moveDrag(event: PointerEvent<SVGElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const total = drag.fascia.f1 + drag.fascia.f2 + drag.fascia.f3 + (drag.startY - event.clientY) * drag.kwhPerPx;
    onScale(drag.start, scaleFascia(drag.fascia, total));
  }

  function endDrag(event: PointerEvent<SVGElement>) {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
  }

  return (
    <section id={id} aria-label="Profilo di consumo" className="space-y-3">
      {rows.length > 0 ? (
        <div className="space-y-2">
          <AnnualTotalControl totalKwh={totalKwh} onChange={onTotalChange} />
          <ProfilePresetSelect value={profilePreset} onChange={onProfilePresetChange} />
        </div>
      ) : null}
      {rows.length === 0 ? (
        <p className="text-sm text-neutral-500">Mesi del contratto in caricamento.</p>
      ) : (
        <div className="flex min-w-0">
          <div className="w-11 shrink-0">
            <div className="flex h-9 items-end justify-end pr-1 text-[10px] text-neutral-400">kWh</div>
            <ProfileYAxis ticks={yTicks} yOf={yOf} />
            <ProfileYAxis ticks={yTicks} yOf={yOf} />
          </div>
          <div ref={scrollRef} className="profile-month-scroll min-w-0 flex-1 overflow-x-auto">
            <div style={{ width: trackWidth }}>
              <div className="relative h-9">
                {layout.map((row, index) => {
                  const year = row.start.slice(0, 4);
                  const showYear = index === 0 || year !== layout[index - 1]?.start.slice(0, 4);
                  const active = row.start === selectedStart;
                  const phrase = spanPhrase(row.start, row.end);
                  return (
                    <button
                      key={row.start}
                      type="button"
                      data-month={row.start}
                      aria-pressed={active}
                      title={`${row.abbrev} ${year}, ${phrase}`}
                      onClick={() => onSelect(row.start)}
                      style={{ left: row.x, width: row.width }}
                      className="absolute top-0 flex h-9 flex-col items-center justify-end pb-1"
                    >
                      <span className="text-[10px] tabular-nums leading-none text-neutral-400">
                        {showYear ? `'${year.slice(2)}` : ""}
                      </span>
                      <span
                        className={`text-[11px] uppercase leading-none tracking-wide ${
                          active
                            ? "font-semibold text-foreground"
                            : "text-neutral-500 dark:text-neutral-400"
                        }`}
                      >
                        {row.abbrev}
                      </span>
                    </button>
                  );
                })}
              </div>
              <svg
                ref={lineSvgRef}
                width={trackWidth}
                height={PROFILE_CHART_H}
                role="img"
                aria-label="Consumo in kWh mese per mese. Trascina un mese in verticale per alzare o abbassare il consumo."
                className="block touch-none"
              >
                <line
                  x1={0}
                  x2={trackWidth}
                  y1={baseline}
                  y2={baseline}
                  className="stroke-neutral-200 dark:stroke-neutral-800"
                />
                {selected ? (
                  <rect
                    x={selected.x + 2}
                    y={PROFILE_PAD_Y}
                    width={Math.max(selected.width - 4, 1)}
                    height={innerH}
                    rx={10}
                    className="fill-neutral-100 dark:fill-neutral-900"
                  />
                ) : null}
                <path d={stepArea} className="fill-neutral-900/10 dark:fill-neutral-100/15" />
                <path
                  d={stepLine}
                  fill="none"
                  className="stroke-neutral-900 dark:stroke-neutral-100"
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                {layout.map((row) => {
                  const phrase = spanPhrase(row.start, row.end);
                  const active = row.start === selectedStart;
                  return (
                    <g key={row.start}>
                      <rect
                        x={row.x}
                        y={0}
                        width={row.width}
                        height={PROFILE_CHART_H}
                        fill="transparent"
                        role="slider"
                        aria-label={`Consumo di ${row.abbrev} ${row.start.slice(0, 4)}`}
                        aria-valuemin={0}
                        aria-valuemax={20000}
                        aria-valuenow={Math.round(row.kwh)}
                        aria-valuetext={`${formatKwh(row.kwh)} kWh`}
                        className="cursor-ns-resize"
                        onPointerDown={(event) => beginDrag(event, row)}
                        onPointerMove={moveDrag}
                        onPointerUp={endDrag}
                        onPointerCancel={endDrag}
                      >
                        <title>{`${row.abbrev} ${row.start.slice(0, 4)}, ${phrase}: ${formatKwh(row.kwh)} kWh. Trascina per modificare.`}</title>
                      </rect>
                      <circle
                        cx={row.x + row.width / 2}
                        cy={yOf(row.kwh)}
                        r={active ? 5 : 3.5}
                        className="pointer-events-none fill-neutral-900 dark:fill-neutral-100"
                      />
                    </g>
                  );
                })}
              </svg>
              <svg
                width={trackWidth}
                height={PROFILE_CHART_H}
                role="img"
                aria-label="Consumo per fasce F1 F2 F3"
                className="block touch-none"
              >
                <line
                  x1={0}
                  x2={trackWidth}
                  y1={baseline}
                  y2={baseline}
                  className="stroke-neutral-200 dark:stroke-neutral-800"
                />
                {layout.map((row, index) => {
                  const active = row.start === selectedStart;
                  const stackH = (row.kwh / yTop) * innerH;
                  const top = baseline - stackH;
                  const radius = Math.min(12, row.barWidth / 2, Math.max(stackH / 2, 0));
                  const clipId = `profile-bar-${index}`;
                  let cursor = baseline;
                  const bands = [
                    { key: "f3" as const, color: FASCIA_COLOR.F3 },
                    { key: "f2" as const, color: FASCIA_COLOR.F2 },
                    { key: "f1" as const, color: FASCIA_COLOR.F1 },
                  ];
                  return (
                    <g
                      key={row.start}
                      opacity={active ? 1 : 0.72}
                      className="cursor-ns-resize"
                      onPointerDown={(event) => beginDrag(event, row)}
                      onPointerMove={moveDrag}
                      onPointerUp={endDrag}
                      onPointerCancel={endDrag}
                    >
                      <clipPath id={clipId}>
                        <rect
                          x={row.barX}
                          y={top}
                          width={row.barWidth}
                          height={Math.max(stackH, 0)}
                          rx={radius}
                        />
                      </clipPath>
                      <g clipPath={`url(#${clipId})`}>
                        {bands.map((band) => {
                          const height = (row[band.key] / yTop) * innerH;
                          cursor -= height;
                          return (
                            <rect
                              key={band.key}
                              x={row.barX}
                              y={cursor}
                              width={row.barWidth}
                              height={Math.max(height, 0)}
                              fill={band.color}
                            />
                          );
                        })}
                      </g>
                      <title>{`${row.abbrev}: F1 ${formatKwh(row.f1)}, F2 ${formatKwh(row.f2)}, F3 ${formatKwh(row.f3)} kWh`}</title>
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>
        </div>
      )}
      {selected ? (
        <FasciaEditor row={selected} onFascia={onFascia} />
      ) : (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Trascina un mese sul grafico: F1, F2 e F3 seguono in proporzione.
        </p>
      )}
    </section>
  );
}

function ProfileYAxis({
  ticks,
  yOf,
}: {
  ticks: number[];
  yOf: (kwh: number) => number;
}) {
  return (
    <svg width={44} height={PROFILE_CHART_H} className="block" aria-hidden="true">
      {ticks.map((tick) => (
        <text
          key={tick}
          x={40}
          y={yOf(tick)}
          textAnchor="end"
          dominantBaseline="middle"
          fontSize={10}
          className="fill-neutral-400"
        >
          {formatKwh(tick)}
        </text>
      ))}
    </svg>
  );
}

function FasciaEditor({
  row,
  onFascia,
}: {
  row: MonthConsumption;
  onFascia: (start: string, band: keyof FasciaKwh, kwh: number) => void;
}) {
  const name = new Intl.DateTimeFormat("it-IT", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${row.start}T00:00:00Z`));
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="capitalize text-foreground">{name}</span>
        <span className="tabular-nums text-neutral-500 dark:text-neutral-400">
          {spanPhrase(row.start, row.end)} · {formatKwh(row.kwh)} kWh
        </span>
      </p>
      {FASCIA_BANDS.map((band) => (
        <label key={band.key} className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: band.color }} />
          <span className="w-5 font-medium">{band.label}</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={20000}
            step={1}
            aria-label={`${band.label} di ${name}, kWh`}
            value={row[band.key]}
            onChange={(event) => {
              const next = Number(event.target.value);
              if (!Number.isFinite(next)) return;
              onFascia(row.start, band.key, Math.min(20000, Math.max(0, Math.round(next))));
            }}
            className="w-16 rounded-md border border-neutral-200 bg-background px-2 py-1 tabular-nums text-foreground dark:border-neutral-800"
          />
        </label>
      ))}
    </div>
  );
}

function CompareFilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  const id = useId();
  return (
    <label htmlFor={id} className="flex items-center text-sm">
      <span className="sr-only">{label}</span>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-md border border-neutral-200 bg-background px-2 py-1 text-sm text-foreground dark:border-neutral-800"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function compareOfferFields(item: OfferteSuggestItem) {
  if (item.category === "codice") {
    return {
      nome: item.detail ?? item.label,
      venditore: item.venditore,
      codOfferta: item.codOfferta ?? item.label,
    };
  }
  return {
    nome: item.label,
    venditore: item.venditore,
    codOfferta: item.codOfferta,
  };
}

function SelectedOfferCard({
  item,
  color,
  onRemove,
}: {
  item: OfferteSuggestItem;
  color: string;
  onRemove: () => void;
}) {
  const fields = compareOfferFields(item);
  return (
    <div className="flex w-max max-w-full items-start gap-2 rounded-md border border-foreground bg-neutral-50 p-3 ring-1 ring-foreground dark:bg-neutral-900">
      <span className="min-w-0">
        <span className="flex items-center gap-2">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: color }}
            aria-hidden
          />
          <span className="block whitespace-nowrap text-lg font-semibold tracking-tight text-foreground">
            {fields.nome}
          </span>
        </span>
        {fields.venditore ? (
          <span className="mt-0.5 block whitespace-nowrap text-sm text-neutral-600 dark:text-neutral-400">
            {fields.venditore}
          </span>
        ) : null}
        {fields.codOfferta ? (
          <span className="mt-0.5 block whitespace-nowrap font-mono text-xs text-neutral-500 dark:text-neutral-400">
            {fields.codOfferta}
          </span>
        ) : null}
      </span>
      <button
        type="button"
        aria-label={`Rimuovi ${fields.nome}`}
        onMouseDown={(event) => event.preventDefault()}
        onClick={onRemove}
        className="shrink-0 px-0.5 text-lg leading-none text-neutral-400 transition-colors hover:text-neutral-700 sm:text-xl dark:hover:text-neutral-200"
      >
        ×
      </button>
    </div>
  );
}

function SelectedOfferDot({
  item,
  color,
  muted,
  onSelect,
}: {
  item: OfferteSuggestItem;
  color: string;
  muted: boolean;
  onSelect: () => void;
}) {
  const fields = compareOfferFields(item);
  const label = fields.venditore ? `${fields.nome}, ${fields.venditore}` : fields.nome;
  return (
    <li className="flex shrink-0">
      <button
        type="button"
        aria-label={label}
        title={label}
        onMouseDown={(event) => event.preventDefault()}
        onClick={onSelect}
        className={`inline-flex h-7 w-7 items-center justify-center rounded-full ${
          muted ? "opacity-40 hover:opacity-70" : ""
        }`}
      >
        <span
          className="h-3.5 w-3.5 rounded-full"
          style={{ backgroundColor: color }}
          aria-hidden
        />
      </button>
    </li>
  );
}

function SelectedOfferClusterBox({
  label,
  offers,
  colors,
  allOffers,
  isMuted,
  onSelect,
}: {
  label: string;
  offers: OfferteSuggestItem[];
  colors: readonly string[];
  allOffers: OfferteSuggestItem[];
  isMuted: (item: OfferteSuggestItem) => boolean;
  onSelect: (item: OfferteSuggestItem) => void;
}) {
  return (
    <div className="rounded-md border border-neutral-200 bg-background px-2.5 py-2 dark:border-neutral-800">
      <p className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-neutral-500 dark:text-neutral-400">
        {label}
      </p>
      <ul className="flex flex-wrap gap-0.5" aria-label={label}>
        {offers.map((item) => {
          const index = allOffers.findIndex((offer) => offer.id === item.id);
          return (
            <SelectedOfferDot
              key={item.id}
              item={item}
              color={colors[index % colors.length]!}
              muted={isMuted(item)}
              onSelect={() => onSelect(item)}
            />
          );
        })}
      </ul>
    </div>
  );
}

function SelectedOffersCluster({
  offers,
  colors,
  profiles,
  heroId,
  activeSlice,
  onSelect,
  onRemove,
}: {
  offers: OfferteSuggestItem[];
  colors: readonly string[];
  profiles: Record<string, OfferteCompareProfile>;
  heroId: string;
  activeSlice: CompareSlice;
  onSelect: (item: OfferteSuggestItem) => void;
  onRemove: (id: string) => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [cardHeight, setCardHeight] = useState<number | null>(null);
  const heroIndex = Math.max(
    offers.findIndex((offer) => offer.id === heroId),
    0,
  );
  const hero = offers[heroIndex]!;
  const heroSlice = offerCompareSlice(profiles[hero.id]) ?? activeSlice;
  const heroKey = compareSliceKey(heroSlice);
  const groups = groupOffersByCompareSlice(offers, profiles);
  const comparable = (groups.get(heroKey)?.offers ?? []).filter((offer) => offer.id !== hero.id);
  const otherClusters = [...groups.entries()]
    .filter(([key]) => key !== heroKey)
    .sort(([a], [b]) => compareSliceSortIndex(a) - compareSliceSortIndex(b))
    .map(([, group]) => group);
  const isMuted = (item: OfferteSuggestItem) => {
    const slice = offerCompareSlice(profiles[item.id]);
    return slice != null && compareSliceKey(slice) !== compareSliceKey(activeSlice);
  };

  useLayoutEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const sync = () => setCardHeight(el.getBoundingClientRect().height);
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(el);
    return () => observer.disconnect();
  }, [hero.id, hero.label, hero.venditore, hero.codOfferta]);

  return (
    <div className="flex flex-wrap items-start gap-3">
      <div className="flex items-start gap-3">
        <div ref={cardRef} className="shrink-0">
          <SelectedOfferCard
            item={hero}
            color={colors[heroIndex % colors.length]!}
            onRemove={() => onRemove(hero.id)}
          />
        </div>
        {comparable.length > 0 ? (
          <ul
            aria-label="Offerte confrontabili"
            className="flex min-h-0 min-w-0 flex-col flex-wrap content-start gap-0.5 overflow-x-auto overflow-y-hidden"
            style={cardHeight != null ? { height: cardHeight } : undefined}
          >
            {comparable.map((item) => {
              const index = offers.findIndex((offer) => offer.id === item.id);
              return (
                <SelectedOfferDot
                  key={item.id}
                  item={item}
                  color={colors[index % colors.length]!}
                  muted={isMuted(item)}
                  onSelect={() => onSelect(item)}
                />
              );
            })}
          </ul>
        ) : null}
      </div>
      {otherClusters.map((cluster) => (
        <SelectedOfferClusterBox
          key={compareSliceKey(cluster.slice)}
          label={compareSliceLabel(cluster.slice)}
          offers={cluster.offers}
          colors={colors}
          allOffers={offers}
          isMuted={isMuted}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

const CompareWorkspace = memo(function CompareWorkspace({
  offers,
  colors,
  focusedId,
  profiles,
  initialCliente = "domestico",
  initialPrezzo = "variabile",
  initialResidente = true,
  onFocus,
  onRemove,
}: {
  offers: OfferteSuggestItem[];
  colors: readonly string[];
  focusedId: string | null;
  profiles: Record<string, OfferteCompareProfile>;
  initialCliente?: CompareCliente;
  initialPrezzo?: ComparePrezzo;
  initialResidente?: boolean;
  onFocus: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const [cliente, setCliente] = useState<CompareCliente>(initialCliente);
  const [prezzo, setPrezzo] = useState<ComparePrezzo>(initialPrezzo);
  const [residente, setResidente] = useState(initialResidente);
  const syncedFocusRef = useRef<string | null>(null);
  const [months, setMonths] = useState<ComparePunMonth[] | null>(null);
  const [carico, setCarico] = useState<CompareCaricoByCliente | null>(null);
  const [shape, setShape] = useState<ComparePunShape | null>(null);
  const [monthIndex, setMonthIndex] = useState(0);
  const [includeEnergy, setIncludeEnergy] = useState(true);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileMonth, setProfileMonth] = useState<string | null>(null);
  const profilePanelId = useId();
  const [annualKwh, setAnnualKwh] = useState(DEFAULT_ANNUAL_KWH);
  const [profilePreset, setProfilePreset] = useState<OfferteConsumoProfilo>("standard");
  const [monthEdits, setMonthEdits] = useState<Record<string, FasciaKwh>>({});
  const [offerStart, setOfferStart] = useState(defaultOfferStartDate);
  useEffect(() => {
    const stored = readAnnualKwhPref();
    if (stored != null) setAnnualKwh(stored);
  }, []);
  const visible = useMemo(
    () =>
      offers.filter((offer) => {
        const slice = offerCompareSlice(profiles[offer.id]);
        return slice?.cliente === cliente && slice?.prezzo === prezzo;
      }),
    [offers, profiles, cliente, prezzo],
  );
  const focused = visible.find((offer) => offer.id === focusedId) ?? visible[0] ?? null;
  const hero = focused ?? offers.find((offer) => offer.id === focusedId) ?? offers[0];
  const chartOffers = visible;
  const chartColors = chartOffers.map(
    (offer) => colors[Math.max(offers.findIndex((item) => item.id === offer.id), 0) % colors.length]!,
  );
  const chartFocus = focused;
  const chartPrezzo = prezzo;

  useEffect(() => {
    if (!focusedId) {
      syncedFocusRef.current = null;
      return;
    }
    const slice = offerCompareSlice(profiles[focusedId]);
    if (!slice) return;
    if (syncedFocusRef.current === focusedId) return;
    syncedFocusRef.current = focusedId;
    setCliente(slice.cliente);
    setPrezzo(slice.prezzo);
  }, [focusedId, profiles]);
  const focusedProfile = chartFocus ? profiles[chartFocus.id] : undefined;
  const compareHorizon = useMemo(() => {
    if (chartOffers.length === 0) return 12;
    return Math.max(
      ...chartOffers.map((offer) => billHorizon(profiles[offer.id]?.durataMesi)),
      1,
    );
  }, [chartOffers, profiles]);
  const windowSpans = useMemo(
    () => contractSpans(offerStart, compareHorizon),
    [offerStart, compareHorizon],
  );
  const windowMonths = useMemo(
    () =>
      windowSpans.map((span) => ({
        start: span.start,
        end: span.end,
        label: spanPhrase(span.start, span.end),
        eurKwh: months ? blendPun(span.start, span.end, months) : null,
      })),
    [windowSpans, months],
  );
  const punEurKwh = windowMonths[monthIndex]?.eurKwh ?? null;
  const monthLabel = windowMonths[monthIndex]?.label ?? null;
  const includeMarket = chartPrezzo === "fisso" || includeEnergy;
  const punBySpan = useMemo(
    () => windowSpans.map((span) => (months ? blendPun(span.start, span.end, months) : null)),
    [windowSpans, months],
  );
  const monthRows = useMemo<MonthConsumption[]>(() => {
    const standardTotals = defaultSpanKwh(windowSpans, annualKwh);
    const oculatoTotals = oculatoSpanKwh(windowSpans, annualKwh, punBySpan);
    return windowSpans.map((month, index) => {
      const end = month.end;
      const standardHours = hourShares("standard", shape?.hourlyRel);
      const oculatoHours = hourShares("oculato", shape?.hourlyRel);
      const standardShares = fasciaSharesForSpan(month.start, end, standardHours);
      const oculatoShares = fasciaSharesForSpan(month.start, end, oculatoHours);
      const standard = splitKwh(standardTotals[index] ?? 0, standardShares);
      const oculato = splitKwh(oculatoTotals[index] ?? 0, oculatoShares);
      const presetBaseline = profilePreset === "oculato" ? oculato : standard;
      const edit = monthEdits[month.start];
      const customized = edit != null && !sameFascia(edit, presetBaseline);
      const fascia = customized ? edit : presetBaseline;
      const kwh = fascia.f1 + fascia.f2 + fascia.f3;
      const shares =
        kwh > 0
          ? { f1: fascia.f1 / kwh, f2: fascia.f2 / kwh, f3: fascia.f3 / kwh }
          : profilePreset === "oculato"
            ? oculatoShares
            : standardShares;
      const profilo: OfferteConsumoProfilo = customized
        ? shareDistance(shares, oculatoShares) + 0.02 < shareDistance(shares, standardShares)
          ? "oculato"
          : "standard"
        : profilePreset;
      return {
        start: month.start,
        end,
        days: inclusiveDays(month.start, end),
        abbrev: monthAbbrev(month.start),
        kwh,
        f1: fascia.f1,
        f2: fascia.f2,
        f3: fascia.f3,
        hours: hourShares(profilo, shape?.hourlyRel),
        shares,
        standard,
        oculato,
      };
    });
  }, [windowSpans, monthEdits, shape, annualKwh, profilePreset, punBySpan]);
  const totalKwh = monthRows.reduce((sum, row) => sum + row.kwh, 0);
  const monthRowsRef = useRef(monthRows);
  monthRowsRef.current = monthRows;
  const handleTotalChange = useCallback((target: number) => {
    const next = clampAnnualKwh(target);
    const rows = monthRowsRef.current;
    const current = rows.reduce((sum, row) => sum + row.kwh, 0);
    setAnnualKwh(next);
    persistAnnualKwhPref(next);
    if (!(current > 0)) return;
    setMonthEdits((prev) => {
      if (Object.keys(prev).length === 0) return prev;
      const factor = next / current;
      return Object.fromEntries(
        rows.map((row) => [
          row.start,
          scaleFascia({ f1: row.f1, f2: row.f2, f3: row.f3 }, row.kwh * factor),
        ]),
      );
    });
  }, []);
  const handleProfilePresetChange = useCallback((preset: OfferteConsumoProfilo) => {
    setProfilePreset(preset);
    setMonthEdits({});
  }, []);
  const modeLabel = consumptionModeLabel(monthRows, profilePreset, monthEdits);
  const spend = useMemo(() => {
    if (monthRows.length === 0) return null;
    return {
      monthKwh: monthRows.map((row) => row.kwh),
      dayFractions: monthRows.map((row) => {
        const dim = daysInCalendarMonth(row.start);
        return dim > 0 ? row.days / dim : 1;
      }),
      hoursByMonth: monthRows.map((row) => row.hours),
      sharesByMonth: monthRows.map((row) => row.shares),
      shape,
      includeMarket,
    };
  }, [monthRows, shape, includeMarket]);
  const activeCarico = carico?.[cliente === "non domestico" ? "nonDomestico" : "domestico"] ?? null;
  const profileMode = useMemo((): "standard" | "oculato" | "custom" => {
    if (monthRows.length === 0) return "standard";
    const customized = monthRows.some((row) => {
      const edit = monthEdits[row.start];
      if (!edit) return false;
      const baseline = profilePreset === "oculato" ? row.oculato : row.standard;
      return !sameFascia(edit, baseline);
    });
    if (customized) return "custom";
    return profilePreset;
  }, [monthRows, monthEdits, profilePreset]);
  const synthesis = useMemo(
    () =>
      buildCompareSynthesis({
        offers: chartOffers.flatMap((offer) => {
          const profile = profiles[offer.id];
          if (!profile) return [];
          return [{ id: offer.id, label: compareOfferFields(offer).nome, profile }];
        }),
        spans: windowSpans,
        punBySpan,
        carico: activeCarico,
        shape,
        includeMarket,
        prezzo: chartPrezzo,
        includeEnergy,
        annualKwh: totalKwh,
        profileMode,
        spend,
      }),
    [
      chartOffers,
      profiles,
      windowSpans,
      punBySpan,
      activeCarico,
      shape,
      includeMarket,
      chartPrezzo,
      includeEnergy,
      totalKwh,
      profileMode,
      spend,
    ],
  );
  const synthesisColors = useMemo(
    () =>
      Object.fromEntries(
        chartOffers.map((offer, index) => [
          offer.id,
          chartColors[index % chartColors.length]!,
        ]),
      ),
    [chartOffers, chartColors],
  );

  useEffect(() => {
    setMonthIndex((index) => Math.min(index, Math.max(windowMonths.length - 1, 0)));
  }, [windowMonths.length]);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch("/api/offerte/forward-months", { signal: controller.signal });
        const payload = (await response.json()) as
          | { months: ComparePunMonth[]; carico?: CompareCaricoByCliente; shape?: ComparePunShape | null }
          | { error: string };
        if (!response.ok || !("months" in payload)) {
          setMonths([]);
          return;
        }
        setMonths(payload.months.slice(0, 24));
        setCarico(payload.carico ?? null);
        setShape(payload.shape?.hourlyRel?.length === 24 ? payload.shape : null);
      } catch (caught) {
        if (controller.signal.aborted) return;
        setMonths([]);
      }
    })();
    return () => controller.abort();
  }, []);

  return (
    <div className="mt-5 space-y-8">
      {hero ? (
        <SelectedOffersCluster
          offers={offers}
          colors={colors}
          profiles={profiles}
          heroId={hero.id}
          activeSlice={{ cliente, prezzo }}
          onSelect={(item) => {
            const slice = offerCompareSlice(profiles[item.id]);
            if (slice) {
              setCliente(slice.cliente);
              setPrezzo(slice.prezzo);
            }
            onFocus(item.id);
          }}
          onRemove={onRemove}
        />
      ) : null}

      <div aria-label="Confronto offerte" className="space-y-2 border-t border-neutral-200 pt-8 dark:border-neutral-800">
        <label className="flex flex-wrap items-center gap-1.5 text-sm text-neutral-600 dark:text-neutral-400">
          <span>Offerta parte il</span>
          <input
            type="date"
            value={offerStart}
            onChange={(event) => {
              const next = event.target.value;
              if (!next) return;
              setOfferStart(next);
              setMonthIndex(0);
            }}
            className="rounded-md border border-neutral-200 bg-background px-2 py-1 text-sm tabular-nums text-foreground scheme-light dark:border-neutral-800 dark:scheme-dark [&::-webkit-calendar-picker-indicator]:cursor-pointer dark:[&::-webkit-calendar-picker-indicator]:invert"
          />
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <CompareFilterSelect
            label="Cliente"
            value={cliente}
            onChange={(value) => setCliente(value as CompareCliente)}
            options={[
              { value: "domestico", label: "Casa" },
              { value: "non domestico", label: "Partita IVA" },
            ]}
          />
          {cliente === "domestico" ? (
            <CompareResidenzaToggle checked={residente} onChange={setResidente} />
          ) : null}
          <CompareFilterSelect
            label="Tipo prezzo"
            value={prezzo}
            onChange={(value) => setPrezzo(value as ComparePrezzo)}
            options={[
              { value: "variabile", label: "Variabile" },
              { value: "fisso", label: "Fisso" },
            ]}
          />
          <button
            type="button"
            aria-expanded={profileOpen}
            aria-controls={profilePanelId}
            onClick={() => setProfileOpen((open) => !open)}
            className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-sm tabular-nums ${
              profileOpen
                ? "border-foreground bg-neutral-50 dark:bg-neutral-900"
                : "border-neutral-200 bg-background hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900"
            }`}
          >
            <span aria-hidden="true">⚡</span>
            <span>{monthRows.length === 0 ? "…" : `${formatKwh(totalKwh)} kWh`}</span>
            <span aria-hidden="true">👤</span>
            <span>{modeLabel}</span>
          </button>
        </div>
        <SoftReveal open={profileOpen}>
          <ConsumptionProfilePanel
            id={profilePanelId}
            rows={monthRows}
            totalKwh={totalKwh}
            onTotalChange={handleTotalChange}
            profilePreset={profilePreset}
            onProfilePresetChange={handleProfilePresetChange}
            selectedStart={profileMonth}
            onSelect={setProfileMonth}
            onFascia={(start, band, kwh) => {
              const row = monthRows.find((item) => item.start === start);
              if (!row) return;
              setMonthEdits((prev) => ({
                ...prev,
                [start]: { f1: row.f1, f2: row.f2, f3: row.f3, [band]: kwh },
              }));
            }}
            onScale={(start, fascia) => {
              setMonthEdits((prev) => ({ ...prev, [start]: fascia }));
            }}
          />
        </SoftReveal>
        <CompareChart
          offers={chartOffers}
          colors={chartColors}
          profiles={profiles}
          focusedId={chartFocus?.id ?? null}
          prezzo={chartPrezzo}
          punEurKwh={punEurKwh}
          months={windowMonths}
          monthIndex={monthIndex}
          horizon={compareHorizon}
          carico={activeCarico}
          includeEnergy={includeEnergy}
          spend={spend}
          onIncludeEnergy={setIncludeEnergy}
          onFocus={onFocus}
        />
        <MonthScrub
          count={windowMonths.length}
          index={monthIndex}
          label={monthLabel}
          disabled={windowMonths.length === 0}
          onChange={setMonthIndex}
        />
        {spend?.includeMarket && chartFocus && profiles[chartFocus.id] ? (
          <CompareSpendHistogram
            months={windowMonths}
            monthIndex={monthIndex}
            onMonthSelect={setMonthIndex}
            offerLabel={compareOfferFields(chartFocus).nome}
            color={chartColors[Math.max(chartOffers.findIndex((item) => item.id === chartFocus.id), 0)]!}
            breakdowns={windowMonths.map((month, index) =>
              offerMonthBreakdown(profiles[chartFocus.id]!, index, month.eurKwh, activeCarico, spend),
            )}
          />
        ) : null}
        {chartOffers.length > 0 ? (
          <CompareTable
            offers={chartOffers}
            colors={chartColors}
            profiles={profiles}
            focusedId={chartFocus?.id ?? null}
            prezzo={chartPrezzo}
            punEurKwh={punEurKwh}
            punBySpan={punBySpan}
            monthIndex={monthIndex}
            carico={activeCarico}
            includeEnergy={includeEnergy}
            spend={spend}
            onFocus={onFocus}
          />
        ) : null}
        {chartOffers.length > 0 ? (
          <CompareSynthesis synthesis={synthesis} colors={synthesisColors} onFocus={onFocus} />
        ) : null}
      </div>

      {chartFocus ? (
        <section
          aria-label="Dettaglio offerta selezionata"
          className="border-t border-neutral-200 pt-8 dark:border-neutral-800"
        >
          <h3 className="mb-4 text-[11px] font-medium uppercase tracking-[0.16em] text-neutral-500 dark:text-neutral-400">
            Condizioni
          </h3>
          <CompareOfferDetail
            item={chartFocus}
            profile={focusedProfile}
            color={colors[offers.findIndex((offer) => offer.id === chartFocus.id) % colors.length]!}
          />
        </section>
      ) : null}
    </div>
  );
});

type CompareSpaceTrack = {
  id: string;
  label: string;
  color: string;
  x: number;
  kind: "spread" | "energia";
  detail: string | null;
  horizon: number;
  values: Array<number | null>;
};

const SPACE_YAW = 0.72;
const SPACE_PITCH = 0.52;

type SpaceView = "space" | "energyTime" | "quotaEnergy" | "quotaTime";

const SPACE_VIEWS: Record<SpaceView, { yaw: number; pitch: number; label: string; mark: string }> = {
  space: { yaw: SPACE_YAW, pitch: SPACE_PITCH, label: "Vista 3D", mark: "3D" },
  energyTime: { yaw: Math.PI / 2, pitch: 0, label: "Tempo e energia", mark: "t-e" },
  quotaEnergy: { yaw: 0, pitch: 0, label: "Quota fissa e energia", mark: "f-e" },
  quotaTime: { yaw: 0, pitch: Math.PI / 2, label: "Tempo e quota fissa", mark: "t-f" },
};

const SPACE_VIEW_ORDER: SpaceView[] = ["space", "energyTime", "quotaEnergy", "quotaTime"];

const ENERGY_PRICE_HELP =
  "Prezzo atteso mese per mese: indice di mercato stimato più condizioni contrattuali, profilato sul consumo impostato. Non è una bolletta reale.";

const SPEND_BREAKDOWN_COLORS = {
  canone: "#64748b",
  energia: "#3b82f6",
  perdite: "#a855f7",
  accise: "#eab308",
  iva: "#f43f5e",
} as const;

const SPEND_BREAKDOWN_LEGEND = [
  { key: "canoneEur" as const, label: "Canone", color: SPEND_BREAKDOWN_COLORS.canone },
  { key: "energiaEur" as const, label: "Energia", color: SPEND_BREAKDOWN_COLORS.energia },
  { key: "perditeReteEur" as const, label: "Perdite di rete", color: SPEND_BREAKDOWN_COLORS.perdite },
  { key: "acciseEur" as const, label: "Accise", color: SPEND_BREAKDOWN_COLORS.accise },
  { key: "ivaEur" as const, label: "IVA", color: SPEND_BREAKDOWN_COLORS.iva },
];

function CompareHelpTip({ text }: { text: string }) {
  return (
    <button
      type="button"
      title={text}
      aria-label={text}
      className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-neutral-300 text-[10px] leading-none text-neutral-400 hover:border-neutral-400 hover:text-foreground dark:border-neutral-700 dark:hover:border-neutral-500"
    >
      ?
    </button>
  );
}

function CompareSwitchToggle({
  checked,
  onChange,
  label,
  ariaLabel,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  ariaLabel: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={ariaLabel}
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
          checked ? "bg-neutral-900 dark:bg-neutral-100" : "bg-neutral-300 dark:bg-neutral-700"
        }`}
      >
        <span
          className={`absolute top-0.5 block h-4 w-4 rounded-full bg-white transition-[left] dark:bg-neutral-900 ${
            checked ? "left-4.5" : "left-0.5"
          }`}
        />
      </button>
      <span className="text-sm text-neutral-600 dark:text-neutral-400">{label}</span>
    </div>
  );
}

function IncludeEnergyToggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="ml-1 flex items-center gap-1.5 border-l border-neutral-200 pl-2 dark:border-neutral-800">
      <CompareSwitchToggle
        checked={checked}
        onChange={onChange}
        label="Includi prezzo energia"
        ariaLabel="Includi prezzo energia"
      />
      <CompareHelpTip text={ENERGY_PRICE_HELP} />
    </div>
  );
}

function CompareResidenzaToggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <CompareSwitchToggle
      checked={checked}
      onChange={onChange}
      label={checked ? "Residente" : "Non residente"}
      ariaLabel="Residente"
    />
  );
}

function CompareChart({
  offers,
  colors,
  profiles,
  focusedId,
  prezzo,
  punEurKwh,
  months,
  monthIndex,
  horizon,
  carico,
  includeEnergy,
  spend,
  onIncludeEnergy,
  onFocus,
}: {
  offers: OfferteSuggestItem[];
  colors: readonly string[];
  profiles: Record<string, OfferteCompareProfile>;
  focusedId: string | null;
  prezzo: ComparePrezzo;
  punEurKwh: number | null;
  months: ComparePunMonth[] | null;
  monthIndex: number;
  horizon: number;
  carico: CompareCarico | null;
  includeEnergy: boolean;
  spend: CompareSpend | null;
  onIncludeEnergy: (value: boolean) => void;
  onFocus: (id: string) => void;
}) {
  const priced = includeEnergy && prezzo === "variabile" && punEurKwh != null;
  const energyLabel = spend
    ? "Spesa €/mese"
    : priced || (includeEnergy && prezzo === "fisso")
      ? "Energia c€/kWh"
      : "Spread c€/kWh";
  const formatY = spend ? formatEuro : formatCentesimi;
  const formatTick = spend ? formatAxisEuro : formatAxisCents;
  const monthValue = (profile: OfferteCompareProfile | undefined, index: number, pun: number | null) => {
    if (!profile || !spend || index >= billHorizon(profile.durataMesi)) return null;
    return offerSpendEur(profile, index, pun, carico, spend);
  };
  const plotted = offers.flatMap((offer, index) => {
    const profile = profiles[offer.id];
    const point = spend
      ? (() => {
          const base = comparePlotPoint(profile);
          const y = monthValue(profile, monthIndex, punEurKwh);
          if (!base || y == null) return null;
          return { ...base, y };
        })()
      : monthIndex < billHorizon(profile?.durataMesi)
        ? offerEnergyPoint(profile, punEurKwh, carico, includeEnergy)
        : null;
    if (!point) return [];
    return [
      {
        id: offer.id,
        label: compareOfferFields(offer).nome,
        color: colors[index % colors.length]!,
        ...point,
      },
    ];
  });
  const waiting = offers.some((offer) => !profiles[offer.id]);
  const chartMonths = months != null && months.length > 0 ? months.slice(0, Math.max(horizon, 1)) : [];
  if (offers.length === 0) {
    if (chartMonths.length >= 2) {
      return (
        <CompareChartSpace
          tracks={[]}
          months={chartMonths}
          monthIndex={monthIndex}
          energyLabel={energyLabel}
          energyHelp={spend?.includeMarket ? ENERGY_PRICE_HELP : null}
          formatTick={formatTick}
          formatValue={formatY}
          focusedId={null}
          includeEnergy={prezzo === "variabile" ? includeEnergy : null}
          onIncludeEnergy={onIncludeEnergy}
          onFocus={onFocus}
        />
      );
    }
    return null;
  }
  const tracks = offers.flatMap((offer, index) => {
    const profile = profiles[offer.id];
    const base = comparePlotPoint(profile);
    if (!base || !profile || chartMonths.length === 0) return [];
    const offerHorizon = billHorizon(profile.durataMesi);
    const values = chartMonths.map((month, index) => {
      if (index >= offerHorizon) return null;
      if (spend) return monthValue(profile, index, month.eurKwh);
      return offerEnergyPoint(profile, month.eurKwh, carico, includeEnergy)?.y ?? null;
    });
    if (values.slice(0, offerHorizon).every((value) => value == null)) return [];
    return [
      {
        id: offer.id,
        label: compareOfferFields(offer).nome,
        color: colors[index % colors.length]!,
        x: base.x,
        kind: base.kind,
        detail: base.detail,
        horizon: offerHorizon,
        values,
      } satisfies CompareSpaceTrack,
    ];
  });

  if (plotted.length === 0 && tracks.length === 0) {
    return (
      <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
        {waiting
          ? "Carico il confronto…"
          : "Queste offerte non hanno quota fissa e prezzo energia da mettere sul grafico."}
      </p>
    );
  }

  const canSpace = tracks.some((track) => track.values.filter((value) => value != null).length >= 2);
  if (canSpace) {
    return (
      <CompareChartSpace
        tracks={tracks}
        months={chartMonths}
        monthIndex={monthIndex}
        energyLabel={energyLabel}
        energyHelp={spend?.includeMarket ? ENERGY_PRICE_HELP : null}
        formatTick={formatTick}
        formatValue={formatY}
        focusedId={focusedId}
        includeEnergy={prezzo === "variabile" ? includeEnergy : null}
        onIncludeEnergy={onIncludeEnergy}
        onFocus={onFocus}
      />
    );
  }

  if (plotted.length === 0) {
    return (
      <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
        {waiting ? "Carico il confronto…" : "Prezzi medi non disponibili."}
      </p>
    );
  }

  return (
    <CompareChartFlat
      plotted={plotted}
      focusedId={focusedId}
      energyLabel={energyLabel}
      energyHelp={spend?.includeMarket ? ENERGY_PRICE_HELP : null}
      formatTick={formatTick}
      formatValue={formatY}
      includeEnergy={prezzo === "variabile" ? includeEnergy : null}
      onIncludeEnergy={onIncludeEnergy}
      ariaLabel={
        spend
          ? "Grafico a due assi: quota fissa in euro l’anno, spesa del mese in euro per il consumo scelto"
          : priced
            ? "Grafico a due assi: quota fissa in euro l’anno, prezzo energia del mese scelto in centesimi al kilowattora"
            : prezzo === "variabile"
              ? "Grafico a due assi: quota fissa in euro l’anno, spread in centesimi al kilowattora"
              : "Grafico a due assi: quota fissa in euro l’anno, prezzo energia in centesimi al kilowattora"
      }
      onFocus={onFocus}
    />
  );
}

function CompareChartFlat({
  plotted,
  focusedId,
  energyLabel,
  energyHelp,
  formatTick,
  formatValue,
  includeEnergy,
  onIncludeEnergy,
  ariaLabel,
  onFocus,
}: {
  plotted: Array<{
    id: string;
    label: string;
    color: string;
    x: number;
    y: number;
    kind: "spread" | "energia";
    detail: string | null;
  }>;
  focusedId: string | null;
  energyLabel: string;
  energyHelp: string | null;
  formatTick: (value: number) => string;
  formatValue: (value: number) => string;
  includeEnergy: boolean | null;
  onIncludeEnergy: (value: boolean) => void;
  ariaLabel: string;
  onFocus: (id: string) => void;
}) {
  const width = 640;
  const height = 300;
  const pad = { top: 22, right: 28, bottom: 42, left: 52 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const xMax = axisMax(plotted.map((point) => point.x));
  const yMax = axisMax(plotted.map((point) => point.y));
  const xTicks = axisTicks(xMax);
  const yTicks = axisTicks(yMax);
  const xTop = xTicks[xTicks.length - 1]!;
  const yTop = yTicks[yTicks.length - 1]!;
  const xOf = (value: number) => pad.left + (value / xTop) * innerW;
  const yOf = (value: number) => pad.top + innerH - (value / yTop) * innerH;

  return (
    <figure className="mt-2">
      {includeEnergy != null ? (
        <div className="flex items-center gap-0.5" role="toolbar" aria-label="Opzioni grafico">
          <IncludeEnergyToggle checked={includeEnergy} onChange={onIncludeEnergy} />
        </div>
      ) : null}
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={ariaLabel}
        className="mt-3 h-auto w-full"
      >
        {yTicks.map((tick) => (
          <g key={`y-${tick}`}>
            <line
              x1={pad.left}
              x2={width - pad.right}
              y1={yOf(tick)}
              y2={yOf(tick)}
              className="stroke-neutral-200 dark:stroke-neutral-800"
              strokeWidth={1}
            />
            <text
              x={pad.left - 8}
              y={yOf(tick)}
              textAnchor="end"
              dominantBaseline="middle"
              fontSize={11}
              className="fill-neutral-500 dark:fill-neutral-400"
            >
              {formatTick(tick)}
            </text>
          </g>
        ))}
        {xTicks.map((tick) => (
          <text
            key={`x-${tick}`}
            x={xOf(tick)}
            y={height - pad.bottom + 16}
            textAnchor="middle"
            fontSize={11}
            className="fill-neutral-500 dark:fill-neutral-400"
          >
            {formatAxisEuro(tick)}
          </text>
        ))}
        <text
          x={pad.left + innerW / 2}
          y={height - 6}
          textAnchor="middle"
          fontSize={11}
          className="fill-neutral-500 dark:fill-neutral-400"
        >
          Quota fissa €/anno
        </text>
        <text
          x={14}
          y={pad.top + innerH / 2}
          textAnchor="middle"
          fontSize={11}
          transform={`rotate(-90 14 ${pad.top + innerH / 2})`}
          className="fill-neutral-500 dark:fill-neutral-400"
        >
          {energyLabel}
        </text>
        {energyHelp ? (
          <g transform={`translate(26 ${pad.top + innerH / 2 - 14})`}>
            <title>{energyHelp}</title>
            <circle r={7} className="fill-neutral-200 dark:fill-neutral-800" />
            <text
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={10}
              className="fill-neutral-500 dark:fill-neutral-400"
            >
              ?
            </text>
          </g>
        ) : null}
        {[...plotted].sort((a, b) => Number(a.id === focusedId) - Number(b.id === focusedId)).map((point) => {
          const cx = xOf(point.x);
          const cy = yOf(point.y);
          const labelLeft = cx > pad.left + innerW * 0.72;
          const kind = point.kind === "spread" ? "spread" : "energia";
          const active = point.id === focusedId;
          return (
            <g
              key={point.id}
              className="cursor-pointer"
              onClick={() => onFocus(point.id)}
            >
              <circle
                cx={cx}
                cy={cy}
                r={active ? 11 : 7}
                fill="none"
                stroke={point.color}
                strokeWidth={active ? 2 : 0}
                opacity={active ? 0.45 : 0}
              />
              <circle cx={cx} cy={cy} r={active ? 7 : 5.5} fill={point.color} opacity={active ? 1 : 0.4}>
                <title>
                  {`${point.label}: ${formatEuroAmount(point.x)} €/anno, ${kind} ${formatValue(point.y)}${point.detail ? `. ${point.detail}` : ""}`}
                </title>
              </circle>
              <text
                x={labelLeft ? cx - 12 : cx + 12}
                y={cy - (active ? 16 : 12)}
                textAnchor={labelLeft ? "end" : "start"}
                fontSize={11}
                fontWeight={active ? 600 : 400}
                className={active ? "fill-neutral-900 dark:fill-neutral-100" : "fill-neutral-400 dark:fill-neutral-500"}
              >
                {point.label.length > 22 ? `${point.label.slice(0, 21)}…` : point.label}
              </text>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}

function CompareChartSpace({
  tracks,
  months,
  monthIndex,
  energyLabel,
  energyHelp,
  formatTick,
  formatValue,
  focusedId,
  includeEnergy,
  onIncludeEnergy,
  onFocus,
}: {
  tracks: CompareSpaceTrack[];
  months: ComparePunMonth[];
  monthIndex: number;
  energyLabel: string;
  energyHelp: string | null;
  formatTick: (value: number) => string;
  formatValue: (value: number) => string;
  focusedId: string | null;
  includeEnergy: boolean | null;
  onIncludeEnergy: (value: boolean) => void;
  onFocus: (id: string) => void;
}) {
  const [yaw, setYaw] = useState(SPACE_YAW);
  const [pitch, setPitch] = useState(SPACE_PITCH);
  const [view, setView] = useState<SpaceView | null>("space");
  const frameRef = useRef<HTMLElement>(null);
  const [frameW, setFrameW] = useState(720);
  const drag = useRef<{ x: number; y: number; yaw: number; pitch: number; moved: boolean } | null>(
    null,
  );

  useLayoutEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const sync = () => setFrameW(Math.max(el.getBoundingClientRect().width, 280));
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const { width, height, project } = spaceLayout(yaw, pitch, frameW);
  const at = Math.min(Math.max(monthIndex, 0), months.length - 1);
  const month = months[at]!;
  const zSpan = Math.max(months.length - 1, 1);
  const ys = tracks.flatMap((track) => track.values.filter((value): value is number => value != null));
  const xTicks = axisTicks(axisMax(tracks.map((track) => track.x)));
  const yTicks = axisTicks(axisMax(ys));
  const xTop = xTicks[xTicks.length - 1]!;
  const yTop = yTicks[yTicks.length - 1]!;
  const zTicks = monthChartTicks(months.length);
  const nx = (value: number) => value / xTop;
  const ny = (value: number) => value / yTop;
  const nz = (index: number) => index / zSpan;
  const atZ = nz(at);
  const plane = [
    project(0, 0, atZ),
    project(1, 0, atZ),
    project(1, 1, atZ),
    project(0, 1, atZ),
  ];
  const box: Array<[[number, number, number], [number, number, number]]> = [
    [[0, 0, 0], [1, 0, 0]],
    [[0, 0, 0], [0, 1, 0]],
    [[0, 0, 0], [0, 0, 1]],
    [[1, 0, 0], [1, 1, 0]],
    [[1, 0, 0], [1, 0, 1]],
    [[0, 1, 0], [1, 1, 0]],
    [[0, 1, 0], [0, 1, 1]],
    [[0, 0, 1], [1, 0, 1]],
    [[0, 0, 1], [0, 1, 1]],
    [[1, 1, 0], [1, 1, 1]],
    [[1, 0, 1], [1, 1, 1]],
    [[0, 1, 1], [1, 1, 1]],
  ];

  const onPointerDown = (event: PointerEvent<SVGSVGElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { x: event.clientX, y: event.clientY, yaw, pitch, moved: false };
  };
  const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const start = drag.current;
    if (!start || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.hypot(dx, dy) > 4) {
      start.moved = true;
      setView(null);
    }
    setYaw(start.yaw + dx * 0.008);
    setPitch(clamp(start.pitch - dy * 0.008, 0, Math.PI / 2));
  };
  const onPointerUp = (event: PointerEvent<SVGSVGElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };
  const applyView = (next: SpaceView) => {
    setView(next);
    setYaw(SPACE_VIEWS[next].yaw);
    setPitch(SPACE_VIEWS[next].pitch);
  };
  const pick = (id: string) => {
    if (drag.current?.moved) return;
    onFocus(id);
  };

  const origin = project(0, 0, 0);
  const xEnd = project(1, 0, 0);
  const yEnd = project(0, 1, 0);
  const zEnd = project(0, 0, 1);
  const sorted = [...tracks].sort((a, b) => {
    const aAt = a.values[at];
    const bAt = b.values[at];
    const aDepth = aAt == null ? -1 : project(nx(a.x), ny(aAt), atZ).depth;
    const bDepth = bAt == null ? -1 : project(nx(b.x), ny(bAt), atZ).depth;
    if (a.id === focusedId) return 1;
    if (b.id === focusedId) return -1;
    return aDepth - bDepth;
  });

  return (
    <figure ref={frameRef} className="mt-2 w-full">
      <div
        className="flex items-center gap-0.5"
        role="toolbar"
        aria-label="Inquadratura del grafico"
      >
        {SPACE_VIEW_ORDER.map((id) => {
          const active = view === id;
          return (
            <button
              key={id}
              type="button"
              title={SPACE_VIEWS[id].label}
              aria-label={SPACE_VIEWS[id].label}
              aria-pressed={active}
              onClick={() => applyView(id)}
              className={`inline-flex items-center gap-1 rounded-md px-1.5 py-1 transition-colors ${
                active
                  ? "bg-neutral-200 text-foreground dark:bg-neutral-800"
                  : "text-neutral-400 hover:bg-neutral-100 hover:text-foreground dark:hover:bg-neutral-800"
              }`}
            >
              <SpaceViewIcon view={id} />
            </button>
          );
        })}
        {includeEnergy != null ? (
          <IncludeEnergyToggle checked={includeEnergy} onChange={onIncludeEnergy} />
        ) : null}
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Grafico a tre assi: quota fissa in euro l’anno, ${energyLabel}, tempo in mesi. Piano del mese ${month.label}.`}
        className="mt-2 block h-auto w-full cursor-grab touch-none active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {xTicks.slice(1).map((tick) => {
          const from = project(nx(tick), 0, 0);
          const to = project(nx(tick), 0, 1);
          return (
            <line
              key={`floor-x-${tick}`}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              className="stroke-neutral-200 dark:stroke-neutral-800"
              strokeWidth={1}
            />
          );
        })}
        {zTicks.map((index) => {
          const from = project(0, 0, nz(index));
          const to = project(1, 0, nz(index));
          return (
            <line
              key={`floor-z-${months[index]!.start}`}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              className="stroke-neutral-200 dark:stroke-neutral-800"
              strokeWidth={1}
            />
          );
        })}
        {yTicks.slice(1).map((tick) => {
          const from = project(0, ny(tick), 0);
          const to = project(0, ny(tick), 1);
          return (
            <line
              key={`wall-y-${tick}`}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              className="stroke-neutral-200 dark:stroke-neutral-800"
              strokeWidth={1}
            />
          );
        })}
        {box.map(([from, to]) => {
          const a = project(from[0], from[1], from[2]);
          const b = project(to[0], to[1], to[2]);
          return (
            <line
              key={`${from.join(",")}-${to.join(",")}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              className="stroke-neutral-300 dark:stroke-neutral-700"
              strokeWidth={1}
            />
          );
        })}
        <polygon
          points={plane.map((point) => `${point.x},${point.y}`).join(" ")}
          className="fill-neutral-400/15 stroke-neutral-400 dark:fill-neutral-500/15 dark:stroke-neutral-500"
          strokeWidth={1}
        />
        {sorted.map((track) => {
          const active = track.id === focusedId;
          const points = track.values.flatMap((value, index) =>
            value == null ? [] : [project(nx(track.x), ny(value), nz(index))],
          );
          const floor = track.values.flatMap((value, index) =>
            value == null ? [] : [project(nx(track.x), 0, nz(index))],
          );
          const wall = active
            ? track.values.flatMap((value, index) =>
                value == null ? [] : [project(0, ny(value), nz(index))],
              )
            : [];
          const d = points
            .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
            .join(" ");
          const floorD = floor
            .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
            .join(" ");
          const wallD = wall
            .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
            .join(" ");
          const atValue = at < track.horizon ? track.values[at] : null;
          const here = atValue == null ? null : project(nx(track.x), ny(atValue), atZ);
          const foot = atValue == null ? null : project(nx(track.x), 0, atZ);
          return (
            <g key={track.id}>
              {floorD ? (
                <path
                  d={floorD}
                  fill="none"
                  stroke={track.color}
                  strokeWidth={1}
                  opacity={active ? 0.35 : 0.16}
                />
              ) : null}
              {wallD ? (
                <path
                  d={wallD}
                  fill="none"
                  stroke={track.color}
                  strokeWidth={1}
                  strokeDasharray="3 3"
                  opacity={0.4}
                />
              ) : null}
              {d ? (
                <path
                  d={d}
                  fill="none"
                  stroke={track.color}
                  strokeWidth={active ? 2.4 : 1.6}
                  opacity={active ? 1 : 0.55}
                />
              ) : null}
              {here && foot ? (
                <line
                  x1={foot.x}
                  y1={foot.y}
                  x2={here.x}
                  y2={here.y}
                  stroke={track.color}
                  strokeWidth={1}
                  opacity={active ? 0.45 : 0.2}
                />
              ) : null}
              {here ? (
                <g className="cursor-pointer" onClick={() => pick(track.id)}>
                  <circle
                    cx={here.x}
                    cy={here.y}
                    r={active ? 11 : 7}
                    fill="none"
                    stroke={track.color}
                    strokeWidth={active ? 2 : 0}
                    opacity={active ? 0.45 : 0}
                  />
                  <circle
                    cx={here.x}
                    cy={here.y}
                    r={active ? 6.5 : 4.5}
                    fill={track.color}
                    opacity={active ? 1 : 0.7}
                  >
                    <title>
                      {`${track.label}: ${formatEuroAmount(track.x)} €/anno, ${formatValue(atValue!)} a ${month.label}${track.detail ? `. ${track.detail}` : ""}`}
                    </title>
                  </circle>
                  <text
                    x={here.x + 10}
                    y={here.y - 10}
                    fontSize={11}
                    fontWeight={active ? 600 : 400}
                    className={
                      active ? "fill-neutral-900 dark:fill-neutral-100" : "fill-neutral-400 dark:fill-neutral-500"
                    }
                  >
                    {track.label.length > 22 ? `${track.label.slice(0, 21)}…` : track.label}
                  </text>
                </g>
              ) : null}
            </g>
          );
        })}
        {xTicks.map((tick) => {
          const point = project(nx(tick), 0, 0);
          return (
            <text
              key={`x-tick-${tick}`}
              x={point.x}
              y={point.y + 14}
              textAnchor="middle"
              fontSize={10}
              className="fill-neutral-500 dark:fill-neutral-400"
            >
              {formatAxisEuro(tick)}
            </text>
          );
        })}
        {yTicks.map((tick) => {
          const point = project(0, ny(tick), 0);
          return (
            <text
              key={`y-tick-${tick}`}
              x={point.x - 8}
              y={point.y}
              textAnchor="end"
              dominantBaseline="middle"
              fontSize={10}
              className="fill-neutral-500 dark:fill-neutral-400"
            >
              {formatTick(tick)}
            </text>
          );
        })}
        {zTicks.map((index) => {
          const point = project(0, 0, nz(index));
          return (
            <text
              key={`z-tick-${months[index]!.start}`}
              x={point.x - 6}
              y={point.y + 14}
              textAnchor="end"
              fontSize={10}
              className="fill-neutral-500 dark:fill-neutral-400"
            >
              {monthTickLabel(months[index]!.start, months[index]!.end)}
            </text>
          );
        })}
        <text
          x={(origin.x + xEnd.x) / 2}
          y={(origin.y + xEnd.y) / 2 + 28}
          textAnchor="middle"
          fontSize={11}
          className="fill-neutral-500 dark:fill-neutral-400"
        >
          Quota fissa €/anno
        </text>
        <text
          x={yEnd.x - 10}
          y={yEnd.y - 8}
          textAnchor="end"
          fontSize={11}
          className="fill-neutral-500 dark:fill-neutral-400"
        >
          {energyLabel}
        </text>
        {energyHelp ? (
          <g transform={`translate(${yEnd.x + 2} ${yEnd.y - 18})`}>
            <title>{energyHelp}</title>
            <circle r={7} className="fill-neutral-200 dark:fill-neutral-800" />
            <text
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={10}
              className="fill-neutral-500 dark:fill-neutral-400"
            >
              ?
            </text>
          </g>
        ) : null}
        <text
          x={(origin.x + zEnd.x) / 2 - 8}
          y={(origin.y + zEnd.y) / 2 + 28}
          textAnchor="end"
          fontSize={11}
          className="fill-neutral-500 dark:fill-neutral-400"
        >
          Tempo
        </text>
      </svg>
    </figure>
  );
}

function spaceLayout(yaw: number, pitch: number, frameW: number) {
  const pad = { top: 40, right: 76, bottom: 56, left: 58 };
  const corners = [
    [0, 0, 0],
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
    [1, 1, 0],
    [1, 0, 1],
    [0, 1, 1],
    [1, 1, 1],
  ].map(([x, y, z]) => rotateSpace(x, y, z, yaw, pitch));
  const xs = corners.map((point) => point.x);
  const ys = corners.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const width = Math.max(frameW, 280);
  const innerW = Math.max(width - pad.left - pad.right, 160);
  const scale = innerW / (maxX - minX || 1);
  const height = Math.max(Math.round(pad.top + pad.bottom + (maxY - minY) * scale), 280);
  const ox = pad.left - minX * scale;
  const oy = pad.top + maxY * scale;
  return {
    width,
    height,
    project: (x: number, y: number, z: number) => {
      const point = rotateSpace(x, y, z, yaw, pitch);
      return {
        x: ox + point.x * scale,
        y: oy - point.y * scale,
        depth: point.depth,
      };
    },
  };
}

function rotateSpace(x: number, y: number, z: number, yaw: number, pitch: number) {
  const cx = x - 0.5;
  const cy = y - 0.5;
  const cz = z - 0.5;
  const cosY = Math.cos(yaw);
  const sinY = Math.sin(yaw);
  const rx = cx * cosY + cz * sinY;
  const rz = -cx * sinY + cz * cosY;
  const cosP = Math.cos(pitch);
  const sinP = Math.sin(pitch);
  return {
    x: rx,
    y: cy * cosP - rz * sinP,
    depth: cy * sinP + rz * cosP,
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function SpaceViewIcon({ view }: { view: SpaceView }) {
  const mark = SPACE_VIEWS[view].mark;
  if (view === "space") {
    const top = "M8 2.6 13.4 5.4 8 8.2 2.6 5.4Z";
    const left = "M2.6 5.4V10.8L8 13.6V8.2Z";
    const right = "M13.4 5.4V10.8L8 13.6V8.2Z";
    return (
      <span className="inline-flex items-center gap-1">
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden fill="none">
          <path d={top} fill="currentColor" opacity="0.22" />
          <path d={left} fill="currentColor" opacity="0.14" />
          <path d={right} fill="currentColor" opacity="0.08" />
          <path d={top} stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
          <path d={left} stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
          <path d={right} stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
        </svg>
        <span className="text-[11px] font-medium leading-none">{mark}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1">
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden fill="none">
        <path
          d="M3 3v10h10"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M5.2 10.2 7.4 7.4 9.3 8.6 12.4 4.8"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="text-[11px] font-medium leading-none">{mark}</span>
    </span>
  );
}

function allInEnergyEurKwh(energyEurKwh: number, carico: CompareCarico) {
  return (energyEurKwh * (1 + carico.lambda) + carico.accisaPerKwh) * (1 + carico.ivaRate);
}

function offerEnergyPoint(
  profile: OfferteCompareProfile | undefined,
  punEurKwh: number | null,
  carico?: CompareCarico | null,
  includeEnergy = true,
) {
  const point = comparePlotPoint(profile);
  if (!point || !profile) return point;
  if (!includeEnergy || !profile.scheda.variabile || punEurKwh == null) {
    if (includeEnergy && carico && !profile.scheda.variabile) {
      return { ...point, y: allInEnergyEurKwh(point.y, carico), kind: "energia" as const };
    }
    return {
      ...point,
      kind: profile.scheda.variabile ? ("spread" as const) : point.kind,
    };
  }
  const coeff = profile.scheda.coefficiente;
  const factor = coeff != null && Number.isFinite(coeff) ? coeff : 1;
  const raw = punEurKwh * factor + point.y;
  return {
    ...point,
    y: carico ? allInEnergyEurKwh(raw, carico) : raw,
    kind: "energia" as const,
  };
}

function comparePlotPoint(profile: OfferteCompareProfile | undefined) {
  if (!profile) return null;
  const x = profile.scheda.quotaFissaEurAnno;
  if (x == null) return null;
  const bands = profile.scheda.energia;
  const varied =
    bands.length > 1 && bands.some((band) => Math.abs(band.eurKwh - bands[0]!.eurKwh) > 1e-6);
  const fromBands =
    bands.length > 0 ? bands.reduce((sum, band) => sum + band.eurKwh, 0) / bands.length : null;
  const y = fromBands ?? profile.spreadEurKwh;
  if (y == null) return null;
  return {
    x,
    y,
    kind: profile.scheda.variabile ? ("spread" as const) : ("energia" as const),
    detail: varied
      ? bands.map((band) => `${band.label ?? "Prezzo"} ${formatCentesimi(band.eurKwh)}`).join(" · ")
      : null,
  };
}

function monthChartTicks(count: number) {
  const last = count - 1;
  const candidates = count <= 12 ? [0, 3, 6, 9, last] : [0, 6, 12, 18, last];
  return candidates.filter((index, position, all) => index < count && all.indexOf(index) === position);
}

function monthTickLabel(start: string, end?: string) {
  const [year, month] = start.split("-").map(Number);
  if (!year || !month) return start;
  const short = new Intl.DateTimeFormat("it-IT", { month: "short", timeZone: "UTC" })
    .format(new Date(Date.UTC(year, month - 1, 1)))
    .replace(".", "")
    .trim();
  const yy = `'${String(year).slice(-2)}`;
  if (!end) return `${short} ${yy}`;
  const from = Number(start.slice(8, 10));
  const to = Number(end.slice(8, 10));
  if (from === 1 && to === daysInCalendarMonth(start)) return `${short} ${yy}`;
  return `${from}–${to} ${short} ${yy}`;
}

function axisMax(values: number[]) {
  return Math.max(...values, 0);
}

function axisTicks(max: number) {
  const step = niceStep(max <= 0 ? 1 : max / 4);
  const top = Math.max(step, Math.ceil((max <= 0 ? step : max) / step) * step);
  const ticks: number[] = [];
  for (let value = 0; value <= top + step * 0.001; value += step) ticks.push(roundTick(value));
  return ticks;
}

function niceStep(rough: number) {
  const safe = rough > 0 ? rough : 1;
  const pow = 10 ** Math.floor(Math.log10(safe));
  const fraction = safe / pow;
  const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  return nice * pow;
}

function roundTick(value: number) {
  return Math.round(value * 1e6) / 1e6;
}

function formatAxisEuro(value: number) {
  return new Intl.NumberFormat("it-IT", { maximumFractionDigits: 0 }).format(value);
}

function formatAxisCents(eurKwh: number) {
  const cent = eurKwh * 100;
  return new Intl.NumberFormat("it-IT", {
    maximumFractionDigits: cent >= 10 ? 1 : 2,
  }).format(cent);
}

function formatEuroAmount(value: number) {
  return new Intl.NumberFormat("it-IT", {
    maximumFractionDigits: value >= 100 ? 0 : 2,
  }).format(value);
}

function monthCanoneEur(
  profile: OfferteCompareProfile | undefined,
  monthIndex: number,
  dayFraction = 1,
) {
  if (!profile || monthIndex >= billHorizon(profile.durataMesi)) return null;
  const monthly = recurringQuotaEur(profile);
  if (monthly == null) return null;
  return monthly * dayFraction + (monthIndex === 0 ? (profile.scheda.unaTantumEur ?? 0) : 0);
}

function recurringQuotaEur(profile: OfferteCompareProfile | undefined) {
  if (!profile) return null;
  return (
    profile.monthlyEur ??
    (profile.scheda.quotaFissaEurAnno != null ? profile.scheda.quotaFissaEurAnno / 12 : null)
  );
}

function offerBands(profile: OfferteCompareProfile) {
  if (profile.scheda.energia.length > 0) return profile.scheda.energia;
  if (profile.spreadEurKwh == null) return [];
  return [{ label: null, eurKwh: profile.spreadEurKwh }];
}

function offerPricedOptions(
  profile: OfferteCompareProfile,
  monthIndex: number,
  punEurKwh: number | null,
  carico: CompareCarico | null,
  spend: CompareSpend,
) {
  if (monthIndex >= billHorizon(profile.durataMesi)) return null;
  const monthKwh = spend.monthKwh[monthIndex];
  const hours = spend.hoursByMonth[monthIndex];
  const shares = spend.sharesByMonth[monthIndex];
  const recurring = recurringQuotaEur(profile);
  if (monthKwh == null || !hours || !shares || recurring == null) return null;
  return {
    bands: offerBands(profile),
    variabile: profile.scheda.variabile,
    plan: profile.plan,
    coefficiente: profile.scheda.coefficiente,
    punEurKwh: spend.includeMarket ? punEurKwh : null,
    hours,
    shares,
    shape: spend.shape,
    quotaMonthEur: recurring * (spend.dayFractions[monthIndex] ?? 1),
    consumoKwh: monthKwh,
    monthShare: 1,
    carico: spend.includeMarket ? carico : null,
  };
}

function offerPriced(
  profile: OfferteCompareProfile,
  monthIndex: number,
  punEurKwh: number | null,
  carico: CompareCarico | null,
  spend: CompareSpend,
) {
  const options = offerPricedOptions(profile, monthIndex, punEurKwh, carico, spend);
  return options ? pricedMonth(options) : null;
}

function offerMonthBreakdown(
  profile: OfferteCompareProfile,
  monthIndex: number,
  punEurKwh: number | null,
  carico: CompareCarico | null,
  spend: CompareSpend,
) {
  const options = offerPricedOptions(profile, monthIndex, punEurKwh, carico, spend);
  return options ? monthSpendBreakdown(options) : null;
}

function offerSpendEur(
  profile: OfferteCompareProfile,
  monthIndex: number,
  punEurKwh: number | null,
  carico: CompareCarico | null,
  spend: CompareSpend,
) {
  return offerPriced(profile, monthIndex, punEurKwh, carico, spend)?.spendEur ?? null;
}

function contractDurataMesi(profile: OfferteCompareProfile | undefined) {
  if (!profile) return 12;
  const durata = profile.durataMesi;
  if (durata == null || !Number.isFinite(durata) || durata <= 0) return 12;
  return Math.round(durata);
}

function offerPeriodTotalSpend(
  profile: OfferteCompareProfile,
  monthCount: number,
  punBySpan: Array<number | null>,
  carico: CompareCarico | null,
  spend: CompareSpend,
) {
  let total = 0;
  let hasAny = false;
  const limit = Math.min(monthCount, spend.monthKwh.length);
  for (let monthIndex = 0; monthIndex < limit; monthIndex++) {
    if (monthIndex >= billHorizon(profile.durataMesi)) continue;
    const part = offerSpendEur(profile, monthIndex, punBySpan[monthIndex] ?? null, carico, spend);
    if (part == null) continue;
    total += part;
    hasAny = true;
  }
  return hasAny ? total : null;
}

function ValueBadge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-neutral-900 px-2.5 py-0.5 text-sm font-medium tabular-nums text-white dark:bg-neutral-100 dark:text-neutral-900">
      {children}
    </span>
  );
}

function formatSpendShare(value: number, total: number) {
  if (!(total > 0)) return "—";
  const pct = (value / total) * 100;
  return `${new Intl.NumberFormat("it-IT", { maximumFractionDigits: pct >= 10 ? 0 : 1 }).format(pct)}%`;
}

const SPEND_HIST_DAY_PX = 2.9;
const SPEND_HIST_SLOT_PX = 31 * SPEND_HIST_DAY_PX;
const SPEND_HIST_BAR_RATIO = 0.62;
const SPEND_HIST_CHART_H = 120;
const SPEND_HIST_PAD_Y = 12;

function SpendColumnTotalBadge({
  active,
  children,
}: {
  active: boolean;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex max-w-full items-center justify-center rounded-full px-2.5 tabular-nums font-semibold leading-none ${
        active
          ? "bg-neutral-900 py-1.5 text-base text-white shadow-sm dark:bg-neutral-100 dark:text-neutral-900"
          : "bg-neutral-200 py-1 text-sm text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200"
      }`}
    >
      {children}
    </span>
  );
}

function CompareSpendHistogram({
  months,
  monthIndex,
  onMonthSelect,
  offerLabel,
  color,
  breakdowns,
}: {
  months: ComparePunMonth[];
  monthIndex: number;
  onMonthSelect: (index: number) => void;
  offerLabel: string;
  color: string;
  breakdowns: Array<MonthSpendBreakdown | null>;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const layout = useMemo(() => {
    let x = 0;
    return months.map((month, index) => {
      const end = month.end ?? inclusiveEnd(month.start, months[index + 1]?.start);
      const days = inclusiveDays(month.start, end);
      const width = SPEND_HIST_SLOT_PX;
      const placed = { index, start: month.start, end, days, width, x, breakdown: breakdowns[index] };
      x += width;
      return placed;
    });
  }, [months, breakdowns]);
  const trackWidth = layout.reduce((sum, row) => sum + row.width, 0);
  const peak = Math.max(...layout.map((row) => row.breakdown?.totalEur ?? 0), 1);
  const yTop = axisTicks(peak).at(-1) ?? peak;
  const yTicks = axisTicks(peak);
  const innerH = SPEND_HIST_CHART_H - SPEND_HIST_PAD_Y * 2;
  const yOf = (eur: number) => SPEND_HIST_PAD_Y + innerH - (eur / yTop) * innerH;
  const baseline = SPEND_HIST_CHART_H - SPEND_HIST_PAD_Y;
  const selectedStart = months[monthIndex]?.start ?? null;

  const selectedMonth = months[monthIndex];
  const selectedBreakdown = breakdowns[monthIndex] ?? null;

  useEffect(() => {
    if (!selectedStart) return;
    scrollChildX(scrollRef.current, `[data-spend-month="${selectedStart}"]`);
  }, [selectedStart]);

  return (
    <section aria-label="Spesa mensile stimata" className="mt-4 space-y-2">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <h4 className="text-sm text-neutral-600 dark:text-neutral-400">
          Spesa mensile stimata
          <span className="text-neutral-400"> · </span>
          <span style={{ color }}>{offerLabel}</span>
        </h4>
        <CompareHelpTip text={ENERGY_PRICE_HELP} />
      </div>
      <div className="flex min-w-0">
        <div className="w-11 shrink-0">
          <div className="flex h-9 items-end justify-end pr-1 text-[10px] text-neutral-400">€</div>
          <svg width={44} height={SPEND_HIST_CHART_H} aria-hidden="true" className="block">
            {yTicks.map((tick) => (
              <text
                key={tick}
                x={40}
                y={yOf(tick)}
                textAnchor="end"
                dominantBaseline="middle"
                fontSize={10}
                className="fill-neutral-400"
              >
                {formatAxisEuro(tick)}
              </text>
            ))}
          </svg>
        </div>
        <div ref={scrollRef} className="profile-month-scroll min-w-0 flex-1 overflow-x-auto">
          <div style={{ width: trackWidth }}>
            <div className="relative h-9">
              {layout.map((row, index) => {
                const year = row.start.slice(0, 4);
                const showYear = index === 0 || year !== layout[index - 1]?.start.slice(0, 4);
                const active = row.index === monthIndex;
                return (
                  <button
                    key={row.start}
                    type="button"
                    data-spend-month={row.start}
                    aria-pressed={active}
                    onClick={() => onMonthSelect(row.index)}
                    style={{ left: row.x, width: row.width }}
                    className="absolute top-0 flex h-9 cursor-pointer flex-col items-center justify-end pb-1"
                  >
                    <span className="text-[10px] tabular-nums leading-none text-neutral-400">
                      {showYear ? `'${year.slice(2)}` : ""}
                    </span>
                    <span
                      className={`text-[11px] uppercase leading-none tracking-wide ${
                        active
                          ? "font-semibold text-foreground"
                          : "text-neutral-500 dark:text-neutral-400"
                      }`}
                    >
                      {monthAbbrev(row.start)}
                    </span>
                  </button>
                );
              })}
            </div>
            <svg
              width={trackWidth}
              height={SPEND_HIST_CHART_H}
              role="img"
              aria-label="Istogramma della spesa mensile stimata, mese per mese. Clicca una colonna per cambiare mese."
              className="block"
            >
              <line
                x1={0}
                x2={trackWidth}
                y1={baseline}
                y2={baseline}
                className="stroke-neutral-200 dark:stroke-neutral-800"
              />
              {layout.map((row, rowIndex) => {
                const active = row.index === monthIndex;
                const breakdown = row.breakdown;
                const dim = daysInCalendarMonth(row.start);
                const barWidth = Math.max((row.days / Math.max(dim, 1)) * row.width * SPEND_HIST_BAR_RATIO, 8);
                const barX = row.x + (row.width - barWidth) / 2;
                const stackH =
                  breakdown && breakdown.totalEur > 0 ? (breakdown.totalEur / yTop) * innerH : 0;
                const top = baseline - stackH;
                const radius = Math.min(12, barWidth / 2, Math.max(stackH / 2, 0));
                const clipId = `spend-bar-${rowIndex}`;
                let cursor = baseline;
                return (
                  <g
                    key={row.start}
                    opacity={active ? 1 : 0.72}
                    className="cursor-pointer"
                    onClick={() => onMonthSelect(row.index)}
                  >
                    <rect
                      x={row.x}
                      y={0}
                      width={row.width}
                      height={SPEND_HIST_CHART_H}
                      fill="transparent"
                      aria-label={`${monthAbbrev(row.start)} ${row.start.slice(0, 4)}`}
                    />
                    {breakdown && breakdown.totalEur > 0 ? (
                      <>
                        {active ? (
                          <rect
                            x={row.x + 2}
                            y={SPEND_HIST_PAD_Y}
                            width={Math.max(row.width - 4, 1)}
                            height={innerH}
                            rx={10}
                            className="fill-neutral-100 dark:fill-neutral-900"
                          />
                        ) : null}
                        <clipPath id={clipId}>
                          <rect
                            x={barX}
                            y={top}
                            width={barWidth}
                            height={Math.max(stackH, 0)}
                            rx={radius}
                          />
                        </clipPath>
                        <g clipPath={`url(#${clipId})`}>
                          {SPEND_BREAKDOWN_LEGEND.map((band) => {
                            const value = breakdown[band.key];
                            if (!(value > 0)) return null;
                            const height = (value / yTop) * innerH;
                            cursor -= height;
                            return (
                              <rect
                                key={band.key}
                                x={barX}
                                y={cursor}
                                width={barWidth}
                                height={Math.max(height, 0)}
                                fill={band.color}
                              >
                                <title>{`${band.label}: ${formatEuro(value)}`}</title>
                              </rect>
                            );
                          })}
                        </g>
                      </>
                    ) : null}
                  </g>
                );
              })}
            </svg>
            <div className="relative mt-2 min-h-10">
              {layout.map((row) => {
                const breakdown = row.breakdown;
                if (!breakdown || breakdown.totalEur <= 0) return null;
                const active = row.index === monthIndex;
                return (
                  <button
                    key={`total-${row.start}`}
                    type="button"
                    aria-pressed={active}
                    onClick={() => onMonthSelect(row.index)}
                    style={{ left: row.x, width: row.width }}
                    className="absolute top-0 flex cursor-pointer justify-center px-0.5"
                  >
                    <SpendColumnTotalBadge active={active}>
                      {formatEuro(breakdown.totalEur)}
                    </SpendColumnTotalBadge>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      {selectedMonth && selectedBreakdown ? (
        <div className="ml-11 max-w-sm">
          <table className="w-full border-collapse text-sm">
            <caption className="mb-1 text-left text-xs text-neutral-500 dark:text-neutral-400">
              {selectedMonth.label}
            </caption>
            <thead>
              <tr className="text-xs text-neutral-500 dark:text-neutral-400">
                <th scope="col" className="pb-1 text-left font-normal">
                  Voce
                </th>
                <th scope="col" className="pb-1 text-right font-normal">
                  Importo
                </th>
                <th scope="col" className="pb-1 pl-3 text-right font-normal">
                  %
                </th>
              </tr>
            </thead>
            <tbody>
              {SPEND_BREAKDOWN_LEGEND.map((band) => {
                const value = selectedBreakdown[band.key];
                if (!(value > 0)) return null;
                return (
                  <tr key={band.key}>
                    <th
                      scope="row"
                      className="py-0.5 pr-3 text-left font-normal text-neutral-600 dark:text-neutral-400"
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className="inline-block h-2 w-2 rounded-sm"
                          style={{ backgroundColor: band.color }}
                          aria-hidden="true"
                        />
                        {band.label}
                      </span>
                    </th>
                    <td className="py-0.5 text-right tabular-nums text-foreground">{formatEuro(value)}</td>
                    <td className="py-0.5 pl-3 text-right tabular-nums text-neutral-500 dark:text-neutral-400">
                      {formatSpendShare(value, selectedBreakdown.totalEur)}
                    </td>
                  </tr>
                );
              })}
              <tr className="border-t border-neutral-200 dark:border-neutral-800">
                <th scope="row" className="py-1 pr-3 text-left font-medium text-foreground">
                  Totale
                </th>
                <td className="py-1 text-right">
                  <ValueBadge>{formatEuro(selectedBreakdown.totalEur)}</ValueBadge>
                </td>
                <td className="py-1 pl-3 text-right tabular-nums font-medium text-foreground">100%</td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

function compareTableEnergyLabel(
  prezzo: ComparePrezzo,
  includeEnergy: boolean,
  punEurKwh: number | null,
) {
  if (prezzo === "fisso") return "Prezzo";
  return includeEnergy && punEurKwh != null ? "Energia" : "Spread";
}

function CompareTable({
  offers,
  colors,
  profiles,
  focusedId,
  prezzo,
  punEurKwh,
  punBySpan,
  monthIndex,
  carico,
  includeEnergy,
  spend,
  onFocus,
}: {
  offers: OfferteSuggestItem[];
  colors: readonly string[];
  profiles: Record<string, OfferteCompareProfile>;
  focusedId: string | null;
  prezzo: ComparePrezzo;
  punEurKwh: number | null;
  punBySpan: Array<number | null>;
  monthIndex: number;
  carico: CompareCarico | null;
  includeEnergy: boolean;
  spend: CompareSpend | null;
  onFocus: (id: string) => void;
}) {
  const energyLabel = compareTableEnergyLabel(prezzo, includeEnergy, punEurKwh);
  const showPeriodTotals = spend?.includeMarket === true;
  const maxContractDurata = offers.reduce(
    (max, offer) => Math.max(max, contractDurataMesi(profiles[offer.id])),
    12,
  );
  const rows = [
    {
      label: "Canone mensile",
      value: (profile: OfferteCompareProfile | undefined) => {
        const eur = monthCanoneEur(profile, monthIndex, spend?.dayFractions[monthIndex] ?? 1);
        return eur != null ? <ValueBadge>{formatEuro(eur)}</ValueBadge> : "—";
      },
    },
    {
      label: energyLabel,
      value: (profile: OfferteCompareProfile | undefined) => {
        if (!profile || monthIndex >= billHorizon(profile.durataMesi)) return "—";
        if (spend) {
          const priced = offerPriced(profile, monthIndex, punEurKwh, carico, spend);
          return priced ? <ValueBadge>{formatCentesimi(priced.eurKwh)}</ValueBadge> : "—";
        }
        const point = offerEnergyPoint(profile, punEurKwh, carico, includeEnergy);
        return point ? <ValueBadge>{formatCentesimi(point.y)}</ValueBadge> : "—";
      },
    },
    ...(showPeriodTotals
      ? [
          {
            label: "Tot primi 12 mesi",
            value: (profile: OfferteCompareProfile | undefined) => {
              if (!profile || !spend) return "—";
              const total = offerPeriodTotalSpend(profile, 12, punBySpan, carico, spend);
              return total != null ? <ValueBadge>{formatEuro(total)}</ValueBadge> : "—";
            },
          },
          ...(maxContractDurata > 12
            ? [
                {
                  label: `Tot ${formatMonthsCount(maxContractDurata)} mesi`,
                  value: (profile: OfferteCompareProfile | undefined) => {
                    if (!profile || !spend) return "—";
                    const durata = contractDurataMesi(profile);
                    if (durata <= 12) return "—";
                    const total = offerPeriodTotalSpend(profile, durata, punBySpan, carico, spend);
                    return total != null ? <ValueBadge>{formatEuro(total)}</ValueBadge> : "—";
                  },
                },
              ]
            : []),
        ]
      : []),
    {
      label: "Tipo prezzo",
      value: (profile: OfferteCompareProfile | undefined) =>
        profile?.tipoOfferta.includes("variabile") ? "Variabile" : "Fisso",
    },
    {
      label: "Durata",
      value: (profile: OfferteCompareProfile | undefined) => formatDurata(profile?.durataMesi),
    },
    {
      label: "Profilo orario",
      value: (profile: OfferteCompareProfile | undefined) =>
        profile?.plan ? comparePlanLabel(profile.plan) : "—",
    },
    {
      label: "Mercato",
      value: (profile: OfferteCompareProfile | undefined) =>
        profile?.source === "placet" ? "PLACET" : "Mercato libero",
    },
    {
      label: "Cliente",
      value: (profile: OfferteCompareProfile | undefined) =>
        profile?.tipoCliente === "non domestico" ? "Partita IVA" : "Casa",
    },
  ];

  return (
    <div className="profile-month-scroll mt-6 overflow-x-auto">
      <table className="min-w-full border-collapse text-sm">
        <thead>
          <tr>
            <th
              scope="col"
              className="sticky left-0 bg-background px-3 py-2 text-left text-xs font-medium uppercase tracking-[0.12em] text-neutral-500 dark:text-neutral-400"
            >
              
            </th>
            {offers.map((offer, index) => {
              const fields = compareOfferFields(offer);
              const active = offer.id === focusedId;
              const color = colors[index % colors.length]!;
              return (
                <th
                  key={offer.id}
                  scope="col"
                  className="min-w-36 px-3 py-2 text-left font-medium text-foreground"
                  style={active ? selectedColumnStyle(color, "top") : undefined}
                >
                  <button
                    type="button"
                    title={fields.nome}
                    aria-label={fields.nome}
                    aria-pressed={active}
                    onClick={() => onFocus(offer.id)}
                    className="inline-flex items-center"
                  >
                    <span
                      className={`shrink-0 rounded-full ${active ? "h-3.5 w-3.5" : "h-2.5 w-2.5"}`}
                      style={{ backgroundColor: color }}
                      aria-hidden
                    />
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={row.label} className="border-t border-neutral-200 dark:border-neutral-800">
              <th
                scope="row"
                className="sticky left-0 bg-background px-3 py-2 text-left text-neutral-600 dark:text-neutral-400"
              >
                {row.label}
              </th>
              {offers.map((offer, index) => {
                const active = offer.id === focusedId;
                const color = colors[index % colors.length]!;
                return (
                  <td
                    key={offer.id}
                    className="px-3 py-2 tabular-nums text-foreground"
                    style={
                      active
                        ? selectedColumnStyle(color, rowIndex === rows.length - 1 ? "bottom" : "mid")
                        : undefined
                    }
                  >
                    {row.value(profiles[offer.id])}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function selectedColumnStyle(color: string, edge: "top" | "mid" | "bottom") {
  const cap =
    edge === "top" ? `, inset 0 3px 0 ${color}` : edge === "bottom" ? `, inset 0 -3px 0 ${color}` : "";
  return {
    boxShadow: `inset 3px 0 0 ${color}, inset -3px 0 0 ${color}${cap}`,
    backgroundColor: `${color}1a`,
  };
}

function CompareOfferDetail({
  item,
  profile,
  color,
}: {
  item: OfferteSuggestItem;
  profile: OfferteCompareProfile | undefined;
  color: string;
}) {
  const fields = compareOfferFields(item);
  const custom = isCustomOfferId(item.id);
  const nome = profile?.nome ?? fields.nome;
  const venditore = profile?.venditore ?? fields.venditore;
  const codOfferta = custom ? null : (profile?.codOfferta ?? fields.codOfferta);
  const source = custom ? null : (profile?.source ?? item.source);
  const period = profile && !custom
    ? formatOfferPeriod({
        validFrom: profile.validFrom,
        validTo: profile.validTo,
        durataMesi: profile.durataMesi,
      })
    : profile && custom && profile.durataMesi
      ? `${profile.durataMesi} mesi di contratto`
      : null;

  return (
    <article className="rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
      <div className="flex items-start gap-3">
        <span
          className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: color }}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <h3 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">{nome}</h3>
          {venditore ? (
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{venditore}</p>
          ) : null}
          {codOfferta && source ? (
            <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
              <OfferCodeLink
                hit={{
                  codOfferta,
                  urlOfferta: profile?.urlOfferta ?? null,
                }}
              />
            </p>
          ) : null}
          {period ? (
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{period}</p>
          ) : null}
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-neutral-500 dark:text-neutral-400">
            {profile?.tipoCliente ? (
              <span className="inline-flex items-center gap-1">
                <ClienteIcon
                  kind={profile.tipoCliente === "non domestico" ? "non domestico" : "domestico"}
                />
                {profile.tipoCliente === "non domestico" ? "Partita IVA" : "Casa"}
              </span>
            ) : null}
            {source ? (
              <span className="inline-flex items-center gap-1">
                <MercatoIcon kind={source} />
                {source === "placet" ? "PLACET" : "Mercato libero"}
              </span>
            ) : null}
            {profile?.tipoOfferta ? (
              <span className="inline-flex items-center gap-1">
                <PrezzoIcon
                  kind={
                    profile.tipoOfferta.includes("variabile") ? "prezzo variabile" : "prezzo fisso"
                  }
                />
                {profile.tipoOfferta.includes("variabile") ? "Variabile" : "Fisso"}
              </span>
            ) : null}
            {profile?.plan ? (
              <span className="inline-flex items-center gap-1">
                <FasciaPlanIcon plan={profile.plan} />
                {comparePlanLabel(profile.plan)}
              </span>
            ) : null}
          </div>
        </div>
      </div>
      {profile ? (
        <CompareOfferScheda scheda={profile.scheda} dettaglio={profile.dettaglio} />
      ) : (
        <p className="mt-4 text-sm text-neutral-500 dark:text-neutral-400">Carico i dettagli…</p>
      )}
    </article>
  );
}

function CompareOfferScheda({
  scheda,
  dettaglio,
}: {
  scheda: CompareScheda;
  dettaglio: OfferteHitDettaglio;
}) {
  const priceRows = priceLines(scheda);
  const audience = audienceLines(scheda);
  const vincoli = vincoloLines(scheda);
  const contatti = contattoLines(dettaglio);

  return (
    <div className="mt-4 space-y-5 border-t border-neutral-200 pt-4 dark:border-neutral-800">
      {scheda.descrizione ? (
        <p className="whitespace-pre-wrap text-sm text-foreground">{scheda.descrizione}</p>
      ) : null}

      {priceRows.length > 0 ? (
        <SchedaBlock title="Prezzo">
          <SchedaRows rows={priceRows} />
        </SchedaBlock>
      ) : null}

      <SchedaBlock title="Sconti">
        {scheda.sconti.length === 0 ? (
          <p className="text-sm text-neutral-600 dark:text-neutral-400">Nessuno sconto</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {scheda.sconti.map((sconto, index) => (
              <li key={`${sconto.nome}-${index}`}>
                <p className="text-sm font-medium text-foreground">
                  {sconto.nome}
                  {sconto.valore ? (
                    <span className="font-normal text-neutral-500 dark:text-neutral-400">
                      {" · "}
                      {sconto.valore}
                    </span>
                  ) : null}
                </p>
                {sconto.meta ? (
                  <p className="mt-0.5 text-sm text-neutral-600 dark:text-neutral-400">{sconto.meta}</p>
                ) : null}
                {sconto.nota ? (
                  <p className="mt-0.5 text-sm text-neutral-600 dark:text-neutral-400">{sconto.nota}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </SchedaBlock>

      {audience.length > 0 ? (
        <SchedaBlock title="A chi è rivolta">
          <SchedaRows rows={audience} columns />
        </SchedaBlock>
      ) : null}

      {vincoli.length > 0 ? (
        <SchedaBlock title="Vincoli">
          <SchedaRows rows={vincoli} />
        </SchedaBlock>
      ) : null}

      {contatti.length > 0 ? (
        <SchedaBlock title="Contatti e attivazione">
          <SchedaRows rows={contatti} columns />
        </SchedaBlock>
      ) : null}
    </div>
  );
}

function SchedaBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h4 className="text-xs font-medium uppercase tracking-[0.12em] text-neutral-500 dark:text-neutral-400">
        {title}
      </h4>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function SchedaRows({
  rows,
  columns = false,
}: {
  rows: { label: string; value: ReactNode }[];
  columns?: boolean;
}) {
  return (
    <dl className={columns ? "grid gap-2 sm:grid-cols-2" : "flex flex-col gap-2"}>
      {rows.map((row) => (
        <div key={row.label}>
          <dt className="text-xs text-neutral-500 dark:text-neutral-400">{row.label}</dt>
          <dd className="mt-0.5 text-sm text-foreground">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function priceLines(scheda: CompareScheda) {
  const rows: { label: string; value: ReactNode }[] = [];
  if (scheda.quotaFissaEurAnno != null) {
    rows.push({ label: "Quota fissa", value: `${formatAmount(scheda.quotaFissaEurAnno)} €/anno` });
  }
  if (scheda.quotaPotenzaEurKw != null) {
    rows.push({ label: "Quota potenza", value: `${formatAmount(scheda.quotaPotenzaEurKw)} €/kW` });
  }
  if (scheda.unaTantumEur != null) {
    rows.push({ label: "Una tantum", value: `${formatAmount(scheda.unaTantumEur)} €` });
  }
  const bands =
    scheda.energia.length > 0
      ? scheda.energia
      : scheda.variabile && scheda.indice
        ? [{ label: null, eurKwh: 0 }]
        : [];
  if (bands.length > 0) {
    rows.push({
      label: "Energia",
      value: (
        <span className="flex flex-col gap-0.5">
          {bands.map((band, index) => (
            <span key={`${band.label ?? "mono"}-${index}`}>
              {band.label ? (
                <span className="text-neutral-500 dark:text-neutral-400">{band.label} · </span>
              ) : null}
              {formatEnergyPhrase(band.eurKwh, scheda)}
            </span>
          ))}
        </span>
      ),
    });
  }
  rows.push({ label: "Dispacciamento", value: scheda.dispacciamento });
  if (scheda.verde) rows.push({ label: "Energia verde", value: scheda.verde });
  return rows;
}

function audienceLines(scheda: CompareScheda) {
  const rows: { label: string; value: ReactNode }[] = [];
  if (scheda.cliente) rows.push({ label: "Cliente", value: scheda.cliente });
  if (scheda.residente) rows.push({ label: "Residenza", value: scheda.residente });
  if (scheda.consumo) rows.push({ label: "Consumo ammesso", value: scheda.consumo });
  if (scheda.potenza) rows.push({ label: "Potenza ammessa", value: scheda.potenza });
  rows.push({ label: "Copertura", value: scheda.copertura });
  if (scheda.soloAbbinamento) {
    rows.push({ label: "Sottoscrizione", value: "Solo insieme a un’altra fornitura" });
  }
  if (scheda.onnicomprensiva) rows.push({ label: "Struttura", value: scheda.onnicomprensiva });
  return rows;
}

function vincoloLines(scheda: CompareScheda) {
  const rows: { label: string; value: ReactNode }[] = [];
  if (scheda.pluriennale) rows.push({ label: "Offerta pluriennale", value: scheda.pluriennale });
  if (scheda.onereRecesso) rows.push({ label: "Onere di recesso", value: scheda.onereRecesso });
  if (scheda.garanzie) rows.push({ label: "Deposito", value: scheda.garanzie });
  return rows;
}

function contattoLines(dettaglio: OfferteHitDettaglio) {
  const rows: { label: string; value: ReactNode }[] = [];
  if (dettaglio.telefono) {
    rows.push({
      label: "Telefono",
      value: (
        <a
          href={`tel:${dettaglio.telefono.replace(/[^\d+]/g, "")}`}
          className="underline underline-offset-2"
        >
          {dettaglio.telefono}
        </a>
      ),
    });
  }
  if (dettaglio.attivazione.length > 0) {
    rows.push({ label: "Attivazione", value: dettaglio.attivazione.join(", ") });
  }
  if (dettaglio.pagamento.length > 0) {
    rows.push({ label: "Pagamento", value: dettaglio.pagamento.join(", ") });
  }
  if (dettaglio.tipologiaContratto.length > 0) {
    rows.push({ label: "Quando si attiva", value: dettaglio.tipologiaContratto.join(", ") });
  }
  return rows;
}

function formatEnergyPhrase(eurKwh: number, scheda: CompareScheda) {
  const spread = Math.abs(eurKwh) < 1e-8 ? null : formatCentesimi(Math.abs(eurKwh));
  if (!scheda.variabile || !scheda.indice) return spread ?? "—";
  const coeff = scheda.coefficiente;
  const base =
    coeff != null && Math.abs(coeff - 1) > 0.001
      ? `${formatAmount(coeff)} × ${scheda.indice}`
      : scheda.indice;
  if (!spread) return base;
  return eurKwh < 0 ? `${base} − ${spread}` : `${base} + ${spread}`;
}

function formatAmount(value: number) {
  return new Intl.NumberFormat("it-IT", {
    maximumFractionDigits: Math.abs(value) >= 100 ? 0 : Math.abs(value) >= 10 ? 1 : 2,
  }).format(value);
}

function comparePlanLabel(plan: NonNullable<OfferteCompareProfile["plan"]>) {
  if (plan === "monoraria") return "Monoraria";
  if (plan === "bioraria") return "Bioraria";
  if (plan === "fasce") return "Trioraria";
  if (plan === "dinamica") return "Dinamica";
  return plan;
}

function formatMonthsCount(value: number) {
  return new Intl.NumberFormat("it-IT", { maximumFractionDigits: 0 }).format(Math.round(value));
}

function formatDurata(durataMesi: number | null | undefined) {
  if (durataMesi == null || !Number.isFinite(durataMesi) || durataMesi <= 0) return "12 mesi";
  return `${formatMonthsCount(durataMesi)} mesi`;
}

function formatEuro(value: number) {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: value >= 100 ? 0 : 2,
  }).format(value);
}

function formatCentesimi(eurKwh: number) {
  const cent = eurKwh * 100;
  return `${new Intl.NumberFormat("it-IT", { maximumFractionDigits: cent >= 10 ? 1 : 2 }).format(cent)} c€/kWh`;
}
