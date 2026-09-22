"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { FasciaPlanIcon } from "@/components/offerte/FasciaPlanIcon";
import { OfferCodeLink, formatOfferPeriod } from "@/components/offerte/OfferHitDettaglio";
import {
  MercatoIcon,
  PrezzoIcon,
} from "@/components/offerte/OfferteTraitIcons";
import type { CompareScheda } from "@/lib/offerte/compare-scheda";
import type { OfferteCompareProfile } from "@/lib/offerte/compare-profile";
import type { OfferteHitDettaglio } from "@/lib/offerte/public-types";
import {
  OFFERTE_SUGGEST_CATEGORY_LABELS,
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
};

export function OfferteCompareSearch({ className }: OfferteCompareSearchProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();

  const [query, setQuery] = useState("");
  const [vendorKey, setVendorKey] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const { text: compareGhost, isTyping: compareGhostTyping } = useRotatingComparePlaceholder();
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
  const compareOffers = useMemo(
    () => selected.filter((item) => item.category !== "fornitore"),
    [selected],
  );

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
        const params = new URLSearchParams({ q });
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
  }, [query, vendorKey]);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch("/api/offerte/explore?limit=5", {
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
  }, []);

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
    setFocusedId(item.id);
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

  function remove(id: string) {
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
  }

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
    <div className={className}>
      <div ref={rootRef} className="relative">
        <label htmlFor="offerte-compare-q" className="sr-only">
          Cerca fornitore, codice o nome offerta
        </label>
        {showCompareGhost ? (
          <span
            className="pointer-events-none absolute inset-0 truncate text-3xl font-semibold tracking-tight text-neutral-400 sm:text-4xl"
            aria-hidden
          >
            {compareGhost}
            {compareGhostTyping ? (
              <span
                className="ml-px inline-block h-[0.9em] w-0.5 translate-y-[0.12em] bg-neutral-400 align-baseline opacity-70"
                aria-hidden
              />
            ) : null}
          </span>
        ) : null}
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
                              {item.source ? (
                                <MercatoIcon
                                  kind={item.source}
                                  className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neutral-400"
                                />
                              ) : null}
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
        {selected.length === 0
          ? vendorKey
            ? "Scegli un'offerta da confrontare"
            : "nome fornitore, codice o nome offerta👆 oppure scegli tra le hot 🔥"
          : `${selected.length} selezionat${selected.length === 1 ? "a" : "e"}`}
      </p>

      {hotOffers.length > 0 ? (
        <HotOfferStrip
          offers={hotOffers}
          selectedIds={new Set(selected.map((entry) => entry.id))}
          onPick={(offer) => pick(offerToSuggestItem(offer), { focusInput: false })}
        />
      ) : null}

      <CompareReveal watch={`${compareOffers.length}:${focusedId ?? ""}`}>
        {compareOffers.length > 0 ? (
          <CompareWorkspace
            offers={compareOffers}
            colors={COMPARE_OFFER_COLORS}
            focusedId={focusedId}
            profiles={profiles}
            onFocus={setFocusedId}
            onRemove={remove}
          />
        ) : null}
      </CompareReveal>
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
      className="overflow-hidden transition-[height] duration-500 ease-out motion-reduce:transition-none"
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
  };
}

const STRIP_ARROW =
  "hidden h-8 w-8 shrink-0 items-center justify-center rounded-md border border-neutral-200 text-lg leading-none text-neutral-700 transition-colors hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-30 sm:flex dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-900";

function HorizontalScrollStrip({
  ariaLabelLeft,
  ariaLabelRight,
  className,
  children,
  watch,
}: {
  ariaLabelLeft: string;
  ariaLabelRight: string;
  className?: string;
  children: ReactNode;
  watch?: unknown;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

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
  }, [watch]);

  function scrollStrip(dir: -1 | 1) {
    const el = scrollerRef.current;
    if (!el) return;
    const card = el.querySelector("li");
    const delta = (card?.getBoundingClientRect().width ?? 176) + 8;
    el.scrollBy({ left: dir * delta, behavior: "smooth" });
  }

  return (
    <div className={`flex items-center gap-1.5 ${className ?? ""}`}>
      <button
        type="button"
        disabled={!canLeft}
        aria-label={ariaLabelLeft}
        onClick={() => scrollStrip(-1)}
        className={STRIP_ARROW}
      >
        ‹
      </button>
      <div ref={scrollerRef} className="min-w-0 flex-1 overflow-x-auto scrollbar-none">
        {children}
      </div>
      <button
        type="button"
        disabled={!canRight}
        aria-label={ariaLabelRight}
        onClick={() => scrollStrip(1)}
        className={STRIP_ARROW}
      >
        ›
      </button>
    </div>
  );
}

function HotOfferStrip({
  offers,
  selectedIds,
  onPick,
}: {
  offers: OfferteExploreHit[];
  selectedIds: Set<string>;
  onPick: (offer: OfferteExploreHit) => void;
}) {
  return (
    <HorizontalScrollStrip
      className="mt-3"
      ariaLabelLeft="Scorri le offerte hot a sinistra"
      ariaLabelRight="Scorri le offerte hot a destra"
      watch={offers}
    >
      <ul className="flex w-max flex-nowrap gap-2">
        {offers.map((offer) => {
          const id = `nome:${offer.source}:${offer.codOfferta}`;
          const picked = selectedIds.has(id);
          return (
            <li key={id} className="shrink-0">
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => onPick(offer)}
                disabled={picked}
                className={`flex w-max flex-col rounded-md border px-3 py-2.5 text-left transition-colors ${
                  picked
                    ? "cursor-default border-neutral-200/70 opacity-45 dark:border-neutral-800/70"
                    : "border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:border-neutral-700 dark:hover:bg-neutral-900/60"
                }`}
              >
                <span className="whitespace-nowrap text-sm font-medium text-foreground">
                  <span aria-hidden>🔥 </span>
                  {offer.nome}
                </span>
                <span className="mt-1 whitespace-nowrap text-xs text-neutral-500 dark:text-neutral-400">
                  {offer.venditore}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </HorizontalScrollStrip>
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

function offerCompareSlice(profile: OfferteCompareProfile | undefined): {
  cliente: CompareCliente;
  prezzo: ComparePrezzo;
} | null {
  if (!profile) return null;
  return {
    cliente: profile.tipoCliente === "non domestico" ? "non domestico" : "domestico",
    prezzo: profile.tipoOfferta.includes("variabile") ? "variabile" : "fisso",
  };
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
  const max = Math.max(count, 1);
  const at = Math.min(Math.max(index, 0), max - 1);
  return (
    <label className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-2 text-sm text-neutral-600 dark:text-neutral-400">
      <span className="shrink-0 tabular-nums text-foreground">{label ?? `Mese ${at + 1}`}</span>
      <input
        type="range"
        min={0}
        max={max - 1}
        step={1}
        value={at}
        disabled={disabled}
        aria-label="Mese del prezzo medio, dal mese 1 al mese 24"
        aria-valuetext={label ?? `Mese ${at + 1} di ${max}`}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-1 w-full max-w-52 cursor-pointer accent-foreground disabled:cursor-default disabled:opacity-40"
      />
      <span className="shrink-0 tabular-nums">
        {at + 1}/{max}
      </span>
    </label>
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

function SelectedOffersCluster({
  offers,
  colors,
  heroId,
  mutedIds,
  onSelect,
  onRemove,
}: {
  offers: OfferteSuggestItem[];
  colors: readonly string[];
  heroId: string;
  mutedIds: Set<string>;
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
  const others = offers.filter((offer) => offer.id !== hero.id);

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
    <div className="flex items-start gap-3">
      <div ref={cardRef} className="shrink-0">
        <SelectedOfferCard
          item={hero}
          color={colors[heroIndex % colors.length]!}
          onRemove={() => onRemove(hero.id)}
        />
      </div>
      {others.length > 0 ? (
        <ul
          aria-label="Altre offerte selezionate"
          className="flex min-h-0 min-w-0 flex-1 flex-col flex-wrap content-start gap-0.5 overflow-x-auto overflow-y-hidden"
          style={cardHeight != null ? { height: cardHeight } : undefined}
        >
          {others.map((item) => {
            const index = offers.findIndex((offer) => offer.id === item.id);
            return (
              <SelectedOfferDot
                key={item.id}
                item={item}
                color={colors[index % colors.length]!}
                muted={mutedIds.has(item.id)}
                onSelect={() => onSelect(item)}
              />
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

function CompareWorkspace({
  offers,
  colors,
  focusedId,
  profiles,
  onFocus,
  onRemove,
}: {
  offers: OfferteSuggestItem[];
  colors: readonly string[];
  focusedId: string | null;
  profiles: Record<string, OfferteCompareProfile>;
  onFocus: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const [cliente, setCliente] = useState<CompareCliente>("domestico");
  const [prezzo, setPrezzo] = useState<ComparePrezzo>("variabile");
  const [months, setMonths] = useState<ComparePunMonth[] | null>(null);
  const [carico, setCarico] = useState<CompareCaricoByCliente | null>(null);
  const [monthIndex, setMonthIndex] = useState(0);
  const visible = offers.filter((offer) => {
    const slice = offerCompareSlice(profiles[offer.id]);
    return slice?.cliente === cliente && slice?.prezzo === prezzo;
  });
  const focused = visible.find((offer) => offer.id === focusedId) ?? visible[0] ?? null;
  const hero = focused ?? offers.find((offer) => offer.id === focusedId) ?? offers[0];
  const chartOffers = visible.length > 0 ? visible : hero ? [hero] : [];
  const chartColors = chartOffers.map(
    (offer) => colors[Math.max(offers.findIndex((item) => item.id === offer.id), 0) % colors.length]!,
  );
  const chartFocus = focused ?? hero ?? null;
  const chartPrezzo =
    visible.length > 0
      ? prezzo
      : (offerCompareSlice(chartFocus ? profiles[chartFocus.id] : undefined)?.prezzo ?? prezzo);
  const focusedProfile = chartFocus ? profiles[chartFocus.id] : undefined;
  const punEurKwh = months?.[monthIndex]?.eurKwh ?? null;
  const monthLabel = months?.[monthIndex]?.label ?? null;

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch("/api/offerte/forward-months", { signal: controller.signal });
        const payload = (await response.json()) as
          | { months: ComparePunMonth[]; carico?: CompareCaricoByCliente }
          | { error: string };
        if (!response.ok || !("months" in payload)) {
          setMonths([]);
          return;
        }
        setMonths(payload.months.slice(0, 24));
        setCarico(payload.carico ?? null);
      } catch (caught) {
        if (controller.signal.aborted) return;
        setMonths([]);
      }
    })();
    return () => controller.abort();
  }, []);

  const mutedIds = new Set(
    offers.flatMap((offer) => {
      const slice = offerCompareSlice(profiles[offer.id]);
      const muted = slice != null && (slice.cliente !== cliente || slice.prezzo !== prezzo);
      return muted ? [offer.id] : [];
    }),
  );

  return (
    <div className="space-y-6 pt-5">
      {hero ? (
        <SelectedOffersCluster
          offers={offers}
          colors={colors}
          heroId={hero.id}
          mutedIds={mutedIds}
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

      <section aria-label="Confronto offerte">
        <div className="flex items-center gap-3">
          <CompareFilterSelect
            label="Cliente"
            value={cliente}
            onChange={(value) => setCliente(value as CompareCliente)}
            options={[
              { value: "domestico", label: "Casa" },
              { value: "non domestico", label: "Partita IVA" },
            ]}
          />
          <CompareFilterSelect
            label="Tipo prezzo"
            value={prezzo}
            onChange={(value) => setPrezzo(value as ComparePrezzo)}
            options={[
              { value: "variabile", label: "Variabile" },
              { value: "fisso", label: "Fisso" },
            ]}
          />
          <MonthScrub
            count={months?.length || 24}
            index={monthIndex}
            label={monthLabel}
            disabled={months == null || months.length === 0}
            onChange={setMonthIndex}
          />
        </div>
        <CompareChart
          offers={chartOffers}
          colors={chartColors}
          profiles={profiles}
          focusedId={chartFocus?.id ?? null}
          prezzo={chartPrezzo}
          punEurKwh={punEurKwh}
          onFocus={onFocus}
        />
        <CompareMonthChart
          offers={chartOffers}
          colors={chartColors}
          profiles={profiles}
          focusedId={chartFocus?.id ?? null}
          months={months}
          monthIndex={monthIndex}
          onMonth={setMonthIndex}
          carico={carico?.[cliente === "non domestico" ? "nonDomestico" : "domestico"] ?? null}
        />
        <CompareTable
          offers={chartOffers}
          colors={chartColors}
          profiles={profiles}
          focusedId={chartFocus?.id ?? null}
          onFocus={onFocus}
        />
      </section>

      {chartFocus ? (
        <section aria-label="Dettaglio offerta selezionata">
          <CompareOfferDetail
            item={chartFocus}
            profile={focusedProfile}
            color={colors[offers.findIndex((offer) => offer.id === chartFocus.id) % colors.length]!}
          />
        </section>
      ) : null}
    </div>
  );
}

function CompareChart({
  offers,
  colors,
  profiles,
  focusedId,
  prezzo,
  punEurKwh,
  onFocus,
}: {
  offers: OfferteSuggestItem[];
  colors: readonly string[];
  profiles: Record<string, OfferteCompareProfile>;
  focusedId: string | null;
  prezzo: ComparePrezzo;
  punEurKwh: number | null;
  onFocus: (id: string) => void;
}) {
  const priced = prezzo === "variabile" && punEurKwh != null;
  const plotted = offers.flatMap((offer, index) => {
    const point = offerEnergyPoint(profiles[offer.id], punEurKwh);
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
  const missing = offers.filter(
    (offer) => profiles[offer.id] && !plotted.some((point) => point.id === offer.id),
  );
  const waiting = offers.some((offer) => !profiles[offer.id]);

  if (plotted.length === 0) {
    return (
      <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
        {waiting
          ? "Carico il confronto…"
          : "Queste offerte non hanno quota fissa e prezzo energia da mettere sul grafico."}
      </p>
    );
  }

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
      
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={
          priced
            ? "Grafico a due assi: quota fissa in euro l’anno, prezzo energia del mese scelto in centesimi al kilowattora"
            : prezzo === "variabile"
              ? "Grafico a due assi: quota fissa in euro l’anno, spread in centesimi al kilowattora"
              : "Grafico a due assi: quota fissa in euro l’anno, prezzo energia in centesimi al kilowattora"
        }
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
              {formatAxisCents(tick)}
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
          {priced || prezzo === "fisso" ? "Energia c€/kWh" : "Spread c€/kWh"}
        </text>
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
                  {`${point.label}: ${formatEuroAmount(point.x)} €/anno, ${kind} ${formatCentesimi(point.y)}${point.detail ? `. ${point.detail}` : ""}`}
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

function offerEnergyPoint(profile: OfferteCompareProfile | undefined, punEurKwh: number | null) {
  const point = comparePlotPoint(profile);
  if (!point || !profile) return point;
  if (!profile.scheda.variabile || punEurKwh == null) return point;
  const coeff = profile.scheda.coefficiente;
  const factor = coeff != null && Number.isFinite(coeff) ? coeff : 1;
  return {
    ...point,
    y: punEurKwh * factor + point.y,
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

function spreadZeroEurKwh(punEurKwh: number, carico: CompareCarico) {
  const afterLoss = punEurKwh * (1 + carico.lambda);
  return (afterLoss + carico.accisaPerKwh) * (1 + carico.ivaRate);
}

function CompareMonthChart({
  offers,
  colors,
  profiles,
  focusedId,
  months,
  monthIndex,
  onMonth,
  carico,
}: {
  offers: OfferteSuggestItem[];
  colors: readonly string[];
  profiles: Record<string, OfferteCompareProfile>;
  focusedId: string | null;
  months: ComparePunMonth[] | null;
  monthIndex: number;
  onMonth: (index: number) => void;
  carico: CompareCarico | null;
}) {
  if (months == null || months.length < 2) {
    return (
      <p className="mt-6 text-sm text-neutral-500 dark:text-neutral-400">
        {months == null ? "Carico i prezzi medi…" : "Prezzi medi non disponibili."}
      </p>
    );
  }

  const series = offers.flatMap((offer, index) => {
    const values = months.map((month) => offerEnergyPoint(profiles[offer.id], month.eurKwh)?.y ?? null);
    if (values.some((value) => value == null)) return [];
    return [
      {
        id: offer.id,
        label: compareOfferFields(offer).nome,
        color: colors[index % colors.length]!,
        values: values as number[],
      },
    ];
  });
  if (series.length === 0) return null;

  const width = 640;
  const height = 200;
  const pad = { top: 16, right: 16, bottom: 36, left: 48 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const punValues = months.flatMap((month) => (month.eurKwh == null ? [] : [month.eurKwh]));
  const taxedValues =
    carico == null
      ? []
      : months.flatMap((month) =>
          month.eurKwh == null ? [] : [spreadZeroEurKwh(month.eurKwh, carico)],
        );
  const flat = [...series.flatMap((line) => line.values), ...punValues, ...taxedValues];
  const min = Math.min(...flat);
  const max = Math.max(...flat);
  const slack = Math.max((max - min) * 0.12, 0.002);
  const yMin = min - slack;
  const yMax = max + slack;
  const ySpan = yMax - yMin || 1;
  const xOf = (index: number) => pad.left + (index / (months.length - 1)) * innerW;
  const yOf = (value: number) => pad.top + innerH - ((value - yMin) / ySpan) * innerH;
  const at = Math.min(Math.max(monthIndex, 0), months.length - 1);
  const punLine = months.flatMap((month, index) =>
    month.eurKwh == null ? [] : [{ index, value: month.eurKwh }],
  );
  const punAt = punLine.find((point) => point.index === at) ?? null;
  const punPath = punLine
    .map((point, index) => `${index === 0 ? "M" : "L"} ${xOf(point.index)} ${yOf(point.value)}`)
    .join(" ");
  const taxedLine =
    carico == null
      ? []
      : months.flatMap((month, index) =>
          month.eurKwh == null ? [] : [{ index, value: spreadZeroEurKwh(month.eurKwh, carico) }],
        );
  const taxedAt = taxedLine.find((point) => point.index === at) ?? null;
  const taxedPath = taxedLine
    .map((point, index) => `${index === 0 ? "M" : "L"} ${xOf(point.index)} ${yOf(point.value)}`)
    .join(" ");
  const ticks = [0, 6, 12, 18, months.length - 1].filter(
    (index, position, all) => index < months.length && all.indexOf(index) === position,
  );

  return (
    <figure className="mt-6">
      <figcaption className="text-sm font-medium text-foreground">
        Prezzo nei 24 mesi, c€/kWh
      </figcaption>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Andamento del prezzo energia delle offerte confrontate sui primi 24 mesi, in centesimi al kilowattora"
        className="mt-3 h-auto w-full"
      >
        {[yMin, (yMin + yMax) / 2, yMax].map((value) => (
          <text
            key={value}
            x={pad.left - 8}
            y={yOf(value)}
            textAnchor="end"
            dominantBaseline="middle"
            fontSize={11}
            className="fill-neutral-500 dark:fill-neutral-400"
          >
            {formatAxisCents(value)}
          </text>
        ))}
        {ticks.map((index) => (
          <text
            key={months[index]!.start}
            x={xOf(index)}
            y={height - 10}
            textAnchor="middle"
            fontSize={11}
            className="fill-neutral-500 dark:fill-neutral-400"
          >
            {monthTickLabel(months[index]!.start)}
          </text>
        ))}
        <line
          x1={xOf(at)}
          x2={xOf(at)}
          y1={pad.top}
          y2={pad.top + innerH}
          className="stroke-neutral-300 dark:stroke-neutral-700"
          strokeWidth={1}
        />
        {punPath ? (
          <g>
            <path
              d={punPath}
              fill="none"
              className="stroke-neutral-400 dark:stroke-neutral-500"
              strokeWidth={1}
            >
              <title>
                {punAt
                  ? `Prezzo medio dell’energia: ${formatCentesimi(punAt.value)} a ${months[at]!.label}`
                  : "Prezzo medio dell’energia"}
              </title>
            </path>
            {punAt ? (
              <circle
                cx={xOf(at)}
                cy={yOf(punAt.value)}
                r={2.5}
                className="fill-neutral-400 dark:fill-neutral-500"
              />
            ) : null}
          </g>
        ) : null}
        {taxedPath ? (
          <g>
            <path
              d={taxedPath}
              fill="none"
              className="stroke-neutral-400 dark:stroke-neutral-500"
              strokeWidth={1}
              strokeDasharray="3 3"
            >
              <title>
                {taxedAt
                  ? `Spread 0, con 10% di perdite e tasse: ${formatCentesimi(taxedAt.value)} a ${months[at]!.label}`
                  : "Spread 0, con 10% di perdite e tasse"}
              </title>
            </path>
            {taxedAt ? (
              <circle
                cx={xOf(at)}
                cy={yOf(taxedAt.value)}
                r={2.5}
                className="fill-neutral-400 dark:fill-neutral-500"
              />
            ) : null}
          </g>
        ) : null}
        {[...series]
          .sort((a, b) => Number(a.id === focusedId) - Number(b.id === focusedId))
          .map((line) => {
            const active = line.id === focusedId;
            const d = line.values
              .map((value, index) => `${index === 0 ? "M" : "L"} ${xOf(index)} ${yOf(value)}`)
              .join(" ");
            return (
              <g key={line.id}>
                <path
                  d={d}
                  fill="none"
                  stroke={line.color}
                  strokeWidth={active ? 2.4 : 1.5}
                  opacity={active ? 1 : 0.45}
                >
                  <title>{`${line.label}: ${formatCentesimi(line.values[at]!)} a ${months[at]!.label}`}</title>
                </path>
                <circle cx={xOf(at)} cy={yOf(line.values[at]!)} r={active ? 4.5 : 3.5} fill={line.color} opacity={active ? 1 : 0.7} />
              </g>
            );
          })}
        {months.map((month, index) => (
          <rect
            key={month.start}
            x={xOf(index) - innerW / months.length / 2}
            y={pad.top}
            width={innerW / months.length}
            height={innerH}
            fill="transparent"
            className="cursor-pointer"
            onClick={() => onMonth(index)}
          >
            <title>{month.label}</title>
          </rect>
        ))}
      </svg>
    </figure>
  );
}

function monthTickLabel(start: string) {
  const [year, month] = start.split("-").map(Number);
  if (!year || !month) return start;
  const short = new Intl.DateTimeFormat("it-IT", { month: "short", timeZone: "UTC" })
    .format(new Date(Date.UTC(year, month - 1, 1)))
    .replace(".", "")
    .trim();
  return `${short} '${String(year).slice(-2)}`;
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

function CompareTable({
  offers,
  colors,
  profiles,
  focusedId,
  onFocus,
}: {
  offers: OfferteSuggestItem[];
  colors: readonly string[];
  profiles: Record<string, OfferteCompareProfile>;
  focusedId: string | null;
  onFocus: (id: string) => void;
}) {
  const rows = [
    {
      label: "Canone mensile",
      value: (profile: OfferteCompareProfile | undefined) =>
        profile?.monthlyEur != null ? formatEuro(profile.monthlyEur) : "—",
    },
    {
      label: "Energia",
      value: (profile: OfferteCompareProfile | undefined) =>
        profile ? formatEnergy(profile) : "—",
    },
    {
      label: "Tipo prezzo",
      value: (profile: OfferteCompareProfile | undefined) =>
        profile?.tipoOfferta.includes("variabile") ? "Variabile" : "Fisso",
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
  ] as const;

  return (
    <div className="mt-6 overflow-x-auto">
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
                  className={`min-w-36 px-3 py-2 text-left font-medium text-foreground ${
                    active ? "bg-neutral-100 dark:bg-neutral-900" : ""
                  }`}
                  style={active ? { boxShadow: `inset 0 -2px 0 ${color}` } : undefined}
                >
                  <button
                    type="button"
                    onClick={() => onFocus(offer.id)}
                    className="inline-flex items-center gap-2 text-left"
                  >
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: color }}
                      aria-hidden
                    />
                    <span className="line-clamp-2">{fields.nome}</span>
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-t border-neutral-200 dark:border-neutral-800">
              <th
                scope="row"
                className="sticky left-0 bg-background px-3 py-2 text-left text-neutral-600 dark:text-neutral-400"
              >
                {row.label}
              </th>
              {offers.map((offer) => (
                <td
                  key={offer.id}
                  className={`px-3 py-2 tabular-nums text-foreground ${
                    offer.id === focusedId ? "bg-neutral-100 dark:bg-neutral-900" : ""
                  }`}
                >
                  {row.value(profiles[offer.id])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
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
  const nome = profile?.nome ?? fields.nome;
  const venditore = profile?.venditore ?? fields.venditore;
  const codOfferta = profile?.codOfferta ?? fields.codOfferta;
  const source = profile?.source ?? item.source;
  const period = profile
    ? formatOfferPeriod({
        validFrom: profile.validFrom,
        validTo: profile.validTo,
        durataMesi: profile.durataMesi,
      })
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

function formatEnergy(profile: OfferteCompareProfile) {
  if (profile.spreadMinEurKwh != null && profile.spreadMaxEurKwh != null) {
    if (Math.abs(profile.spreadMinEurKwh - profile.spreadMaxEurKwh) > 0.000001) {
      return `${formatCentesimi(profile.spreadMinEurKwh)}–${formatCentesimi(profile.spreadMaxEurKwh)}`;
    }
  }
  if (profile.spreadEurKwh != null) return formatCentesimi(profile.spreadEurKwh);
  return "—";
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
