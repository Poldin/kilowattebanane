"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import type {
  OfferteParetoCarousel,
  OfferteParetoCarouselCluster,
  OfferteParetoPlan,
  OfferteSuggestItem,
} from "@/lib/offerte/public-types";

const INTERVAL_MS = 7000;
const SWIPE_THRESHOLD_PX = 48;

export type OfferBoardPreset = {
  cliente: "domestico" | "non domestico";
  residente: boolean;
  prezzo: "prezzo fisso" | "prezzo variabile";
  fascia: OfferteParetoPlan;
  offers: OfferteSuggestItem[];
};

type Slide = {
  id: string;
  emoji: string;
  kicker: string;
  count: number | null;
  lead: string;
  body: string;
  preset: OfferBoardPreset | null;
  surface: string;
  ink: string;
  muted: string;
  button: string;
  dot: string;
  dotOn: string;
};

const SURFACES = [
  {
    emoji: "🧐",
    surface: "bg-[#F5D547] text-[#111111]",
    ink: "text-[#111111]",
    muted: "text-[#111111]/75",
    button: "bg-[#111111] text-[#F5D547]",
    dot: "bg-[#111111]/25",
    dotOn: "bg-[#111111]",
  },
  {
    emoji: "🤨",
    surface: "bg-[#165B44] text-[#f5f5f5]",
    ink: "text-[#f5f5f5]",
    muted: "text-[#f5f5f5]/80",
    button: "bg-[#F5D547] text-[#111111]",
    dot: "bg-[#f5f5f5]/30",
    dotOn: "bg-[#f5f5f5]",
  },
  {
    emoji: "😐",
    surface: "bg-[#111111] text-[#f5f5f5]",
    ink: "text-[#f5f5f5]",
    muted: "text-[#f5f5f5]/75",
    button: "bg-[#F5D547] text-[#111111]",
    dot: "bg-[#f5f5f5]/30",
    dotOn: "bg-[#F5D547]",
  },
] as const;

function formatIt(value: number) {
  return new Intl.NumberFormat("it-IT", { maximumFractionDigits: 0 }).format(value);
}

function clusterKicker(cluster: OfferteParetoCarouselCluster) {
  const parts = [cluster.cliente === "domestico" ? "Casa" : "Partita IVA"];
  if (cluster.residenza === "residente") parts.push("residente");
  if (cluster.residenza === "non residente") parts.push("non residente");
  parts.push(cluster.prezzo === "variabile" ? "variabile" : "fisso");
  parts.push(planKickerWord(cluster.plan));
  return parts.join(" · ");
}

function planKickerWord(plan: OfferteParetoPlan) {
  if (plan === "monoraria") return "monoraria";
  if (plan === "bioraria") return "bioraria";
  if (plan === "fasce") return "trioraria";
  return "dinamica";
}

function clusterId(cluster: OfferteParetoCarouselCluster) {
  return [cluster.cliente, cluster.residenza ?? "tutti", cluster.prezzo, cluster.plan].join(":");
}

function presetFromCluster(cluster: OfferteParetoCarouselCluster): OfferBoardPreset {
  return {
    cliente: cluster.cliente,
    residente: cluster.residenza !== "non residente",
    prezzo: cluster.prezzo === "fisso" ? "prezzo fisso" : "prezzo variabile",
    fascia: cluster.plan,
    offers: cluster.offers,
  };
}

function slidesFor(total: number, carousel: OfferteParetoCarousel): Slide[] {
  const featured = carousel.featured.map((cluster, index) => {
    const look = SURFACES[index % SURFACES.length]!;
    const energy = cluster.prezzo === "variabile" ? "spread" : "prezzo dell’energia";
    return {
      id: clusterId(cluster),
      kicker: clusterKicker(cluster),
      count: cluster.hull,
      lead: `offerte da guardare.`,
      body: `Canone e ${energy}. Se un’altra è più bassa su tutti e due, quella la puoi ignorare.`,
      preset: presetFromCluster(cluster),
      ...look,
    };
  });

  return [
    ...featured,
    {
      id: "sapevi",
      emoji: "🤯",
      kicker: "Lo sapevi?",
      count: null,
      lead: `Su ${formatIt(total)} offerte del Portale Offerte, solo ${formatIt(carousel.convenienti)} sono da guardare.`,
      body: "Stesso cluster, due assi: canone e energia. Le altre costano di più per ogni consumo.",
      preset: null,
      surface: "bg-neutral-100 text-foreground dark:bg-neutral-900",
      ink: "text-foreground",
      muted: "text-neutral-600 dark:text-neutral-400",
      button: "",
      dot: "bg-neutral-400/50",
      dotOn: "bg-foreground",
    },
  ];
}

export function OfferCompareBoard({
  total,
  carousel,
  onConfronta,
}: {
  total: number;
  carousel: OfferteParetoCarousel;
  onConfronta: (preset: OfferBoardPreset) => void;
}) {
  const slides = useMemo(() => slidesFor(total, carousel), [carousel, total]);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);
  const drag = useRef<{ x: number; pointerId: number } | null>(null);
  const safeIndex = Math.min(index, slides.length - 1);
  const slide = slides[safeIndex] ?? slides[0];

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (paused || reduced) return;
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % slides.length);
    }, INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [paused, reduced, slides.length]);

  const go = useCallback(
    (next: number) => {
      const count = slides.length;
      setIndex(((next % count) + count) % count);
    },
    [slides.length],
  );

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if ((event.target as HTMLElement).closest("button")) return;
    drag.current = { x: event.clientX, pointerId: event.pointerId };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    const start = drag.current;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (!start || start.pointerId !== event.pointerId) return;
    const delta = event.clientX - start.x;
    if (delta > SWIPE_THRESHOLD_PX) go(safeIndex - 1);
    else if (delta < -SWIPE_THRESHOLD_PX) go(safeIndex + 1);
  }

  return (
    <section
      aria-roledescription="carosello"
      aria-label="Cose utili sulle bollette"
      className="mb-8"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setPaused(false);
      }}
    >
      <div className="relative overflow-hidden rounded-lg">
        <div
          className="flex w-full touch-pan-y transition-transform duration-500 ease-out motion-reduce:transition-none"
          style={{ transform: `translateX(-${safeIndex * 100}%)` }}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={(event) => {
            drag.current = null;
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
              event.currentTarget.releasePointerCapture(event.pointerId);
            }
          }}
        >
          {slides.map((item, slideIndex) => (
            <article
              key={item.id}
              aria-hidden={slideIndex !== safeIndex}
              aria-labelledby={`offer-board-kicker-${item.id}`}
              className={`relative flex min-h-70 w-full min-w-full shrink-0 grow-0 basis-full flex-col pb-10 sm:min-h-74 sm:pb-11 lg:min-h-80 ${item.surface}`}
            >
              <span
                aria-hidden
                className="pointer-events-none absolute right-1 top-1/2 z-0 -translate-y-1/2 select-none text-[5.5rem] leading-none sm:right-3 sm:text-[7rem] md:right-5 md:text-[9rem] lg:right-6 lg:text-[11rem] xl:text-[12rem]"
              >
                {item.emoji}
              </span>
              <div className="relative z-10 max-w-[68%] px-5 pt-5 sm:max-w-[60%] sm:px-6 sm:pt-6 md:max-w-[55%] lg:max-w-md">
                <p
                  id={`offer-board-kicker-${item.id}`}
                  className={`text-[11px] uppercase tracking-[0.16em] ${item.muted}`}
                >
                  {item.kicker}
                </p>
                {item.count != null ? (
                  <>
                    <p className={`mt-3 text-6xl font-semibold tracking-tight tabular-nums ${item.ink}`}>
                      {item.count}
                    </p>
                    <p className={`mt-1 max-w-md text-lg font-medium leading-snug ${item.ink}`}>{item.lead}</p>
                  </>
                ) : (
                  <p
                    className={`mt-3 max-w-md text-2xl font-semibold leading-tight tracking-tight sm:text-3xl ${item.ink}`}
                  >
                    {item.lead}
                  </p>
                )}
                <p className={`mt-2 hidden max-w-md text-sm leading-relaxed sm:block ${item.muted}`}>{item.body}</p>
                {item.preset ? (
                  <button
                    type="button"
                    tabIndex={slideIndex === safeIndex ? 0 : -1}
                    onClick={() => onConfronta(item.preset!)}
                    className={`mt-4 inline-flex h-11 w-full items-center justify-center rounded-md px-4 text-sm font-medium transition-opacity hover:opacity-90 sm:mt-5 sm:w-auto ${item.button}`}
                  >
                    Confronta offerte
                  </button>
                ) : (
                  <div className="mt-4 h-11 sm:mt-5" aria-hidden />
                )}
              </div>
            </article>
          ))}
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between px-3 pb-3 sm:px-4">
          <button
            type="button"
            aria-label="Slide precedente"
            onClick={() => go(safeIndex - 1)}
            className={`pointer-events-auto flex h-8 w-8 items-center justify-center rounded-md text-lg leading-none transition-opacity hover:opacity-80 ${slide.ink}`}
          >
            ‹
          </button>
          <div className="pointer-events-auto flex items-center gap-1.5">
            {slides.map((dot, dotIndex) => (
              <button
                key={dot.id}
                type="button"
                aria-current={dotIndex === safeIndex ? "true" : undefined}
                aria-label={`${dot.kicker}, slide ${dotIndex + 1} di ${slides.length}`}
                onClick={() => go(dotIndex)}
                className={`h-1.5 rounded-full transition-all ${
                  dotIndex === safeIndex ? `w-5 ${slide.dotOn}` : `w-1.5 ${slide.dot}`
                }`}
              />
            ))}
          </div>
          <button
            type="button"
            aria-label="Slide successiva"
            onClick={() => go(safeIndex + 1)}
            className={`pointer-events-auto flex h-8 w-8 items-center justify-center rounded-md text-lg leading-none transition-opacity hover:opacity-80 ${slide.ink}`}
          >
            ›
          </button>
        </div>
      </div>
    </section>
  );
}
