"use client";

import { useMemo, useState } from "react";
import { ITALY_MAP_VIEWBOX, ITALY_REGION_PATHS } from "@/lib/cer/italy-paths";
import { regionPhoto } from "@/lib/cer/region-photos";
import type { CerRegionStat } from "@/lib/cer/public-types";
import type { ItalianRegion } from "@/lib/market-zones";

export function CerItalyMap({
  regions,
  total,
}: {
  regions: CerRegionStat[];
  total: number;
}) {
  const byKey = useMemo(
    () => new Map(regions.map((region) => [region.key, region])),
    [regions],
  );
  const max = Math.max(1, ...regions.map((region) => region.total));
  const potenzaItalia = regions.reduce(
    (sum, region) => sum + (region.potenzaKwTotale ?? 0),
    0,
  );
  const utenzeItalia = regions.reduce(
    (sum, region) => sum + (region.utenzeTotale ?? 0),
    0,
  );
  const defaultKey = regions[0]?.key ?? "Lombardia";
  const [selected, setSelected] = useState(defaultKey);
  const [hovered, setHovered] = useState<string | null>(null);
  const current = byKey.get(selected) ?? regions[0];
  const hoveredRow = hovered ? byKey.get(hovered) : undefined;

  function warm(key: string) {
    const photo = regionPhoto(key);
    if (!photo) return;
    const img = new window.Image();
    img.src = photo.src;
  }

  function preview(key: string) {
    setHovered(key);
    warm(key);
  }

  function choose(key: string) {
    warm(key);
    setSelected(key);
  }

  return (
    <section className="mt-8" aria-labelledby="cer-mappa">
      <h2 id="cer-mappa" className="text-xl font-semibold tracking-tight sm:text-2xl">
        Comunità energetiche in Italia
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
        Clicca una regione.
      </p>

      <div className="mt-6 grid items-start gap-6 sm:grid-cols-[minmax(0,1fr)_minmax(10.5rem,14rem)] sm:gap-8">
        <div className="min-w-0">
          <svg
            viewBox={ITALY_MAP_VIEWBOX}
            role="img"
            aria-labelledby="cer-mappa-title"
            className="mx-auto h-auto w-full max-w-[20rem] sm:mx-0 sm:max-w-none"
          >
            <title id="cer-mappa-title">Configurazioni TIAD per regione</title>
            {(Object.keys(ITALY_REGION_PATHS) as ItalianRegion[]).map((key) => {
              const row = byKey.get(key);
              const count = row?.total ?? 0;
              const t = count / max;
              const isSelected = selected === key;
              const isHovered = hovered === key;
              const mix = 12 + Math.round(t * 70);
              const shown = isSelected ? Math.min(100, mix + 28) : isHovered ? Math.min(94, mix + 14) : mix;
              return (
                <path
                  key={key}
                  d={ITALY_REGION_PATHS[key]}
                  tabIndex={0}
                  role="button"
                  aria-pressed={isSelected}
                  aria-controls="cer-regione"
                  aria-label={`${key}: ${formatIt(count)} configurazioni`}
                  onClick={() => choose(key)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      choose(key);
                    }
                  }}
                  onMouseEnter={() => preview(key)}
                  onMouseLeave={() => setHovered((value) => (value === key ? null : value))}
                  onFocus={() => preview(key)}
                  onBlur={() => setHovered((value) => (value === key ? null : value))}
                  className="cursor-pointer outline-none transition-[fill,stroke,stroke-width] duration-300 ease-out"
                  vectorEffect="non-scaling-stroke"
                  style={{
                    fill:
                      shown >= 100
                        ? "var(--foreground)"
                        : `color-mix(in srgb, var(--foreground) ${shown}%, var(--background))`,
                    stroke: isSelected ? "var(--foreground)" : "var(--background)",
                    strokeWidth: isSelected ? 2 : isHovered ? 1.35 : 0.85,
                  }}
                />
              );
            })}
          </svg>
          <p className="mt-2 flex items-center justify-center gap-2 text-[11px] text-neutral-500 dark:text-neutral-400 sm:justify-start">
            <span>poche</span>
            <span
              className="h-1.5 w-16 overflow-hidden rounded-full"
              style={{
                background:
                  "linear-gradient(to right, color-mix(in srgb, var(--foreground) 12%, var(--background)), var(--foreground))",
              }}
              aria-hidden
            />
            <span>molte</span>
          </p>
          <p className="mt-1 min-h-5 text-center text-xs text-neutral-500 sm:text-left dark:text-neutral-400">
            {hoveredRow ? (
              <>
                <span className="font-medium text-foreground">{hoveredRow.label}</span>
                {` · ${formatIt(hoveredRow.total)}`}
              </>
            ) : null}
          </p>
        </div>

        {current ? (
          <RegionCard
            region={current}
            national={total}
            potenzaItalia={potenzaItalia}
            utenzeItalia={utenzeItalia}
          />
        ) : null}
      </div>

      <div className="mt-8 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">Configurazioni TIAD per regione</caption>
          <thead>
            <tr className="border-b border-neutral-200 text-left text-[11px] font-medium uppercase tracking-[0.08em] text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
              <th scope="col" className="py-2 pr-3 font-medium">
                Regione
              </th>
              <th scope="col" className="px-2 py-2 text-right font-medium" title="Configurazioni">
                Config
              </th>
              <th scope="col" className="px-2 py-2 text-right font-medium" title="Quota sull’Italia">
                Quota
              </th>
              <th scope="col" className="px-2 py-2 text-right font-medium">
                CER
              </th>
              <th scope="col" className="px-2 py-2 text-right font-medium" title="Potenza mediana">
                kW med
              </th>
              <th scope="col" className="px-2 py-2 text-right font-medium" title="Utenze mediane">
                Utenze med
              </th>
              <th
                scope="col"
                className="px-2 py-2 text-right font-medium"
                title="Potenza totale e quota sull’Italia"
              >
                kW tot
              </th>
              <th
                scope="col"
                className="py-2 pl-2 text-right font-medium"
                title="Utenze totali e quota sull’Italia"
              >
                Utenze tot
              </th>
            </tr>
          </thead>
          <tbody>
            {regions.map((region) => {
              const active = region.key === selected;
              const pct = total > 0 ? (region.total / total) * 100 : 0;
              return (
                <tr
                  key={region.key}
                  onClick={() => choose(region.key)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      choose(region.key);
                    }
                  }}
                  tabIndex={0}
                  aria-selected={active}
                  className={`cursor-pointer border-b border-neutral-200 last:border-b-0 dark:border-neutral-800 ${
                    active
                      ? "text-foreground"
                      : "text-neutral-600 hover:text-foreground dark:text-neutral-400 dark:hover:text-neutral-200"
                  }`}
                >
                  <th
                    scope="row"
                    className={`py-2 pr-3 text-left font-normal ${active ? "font-medium" : ""}`}
                  >
                    {region.label}
                  </th>
                  <td className="px-2 py-2 text-right tabular-nums">{formatIt(region.total)}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-neutral-400 dark:text-neutral-500">
                    {formatPct(pct)}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">{formatIt(region.cer)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {region.medianaPotenzaKw == null ? "—" : formatItNum(region.medianaPotenzaKw)}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {region.medianaUtenze == null ? "—" : formatItNum(region.medianaUtenze)}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {region.potenzaKwTotale == null ? (
                      "—"
                    ) : (
                      <>
                        {formatIt(region.potenzaKwTotale)}
                        {potenzaItalia > 0 ? (
                          <span className="ml-2 text-neutral-400 dark:text-neutral-500">
                            {formatPct((region.potenzaKwTotale / potenzaItalia) * 100)}
                          </span>
                        ) : null}
                      </>
                    )}
                  </td>
                  <td className="py-2 pl-2 text-right tabular-nums">
                    {region.utenzeTotale == null ? (
                      "—"
                    ) : (
                      <>
                        {formatIt(region.utenzeTotale)}
                        {utenzeItalia > 0 ? (
                          <span className="ml-2 text-neutral-400 dark:text-neutral-500">
                            {formatPct((region.utenzeTotale / utenzeItalia) * 100)}
                          </span>
                        ) : null}
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function RegionCard({
  region,
  national,
  potenzaItalia,
  utenzeItalia,
}: {
  region: CerRegionStat;
  national: number;
  potenzaItalia: number;
  utenzeItalia: number;
}) {
  const pct = national > 0 ? (region.total / national) * 100 : 0;
  const photo = regionPhoto(region.key);
  return (
    <aside id="cer-regione" aria-live="polite" className="min-w-0 sm:justify-self-end">
      <div key={region.key} className="cer-region-in">
        {photo ? (
          <img
            src={photo.src}
            alt={photo.alt}
            width={1200}
            height={340}
            decoding="async"
            className="aspect-1200/340 h-auto w-full rounded-xl object-cover object-center"
          />
        ) : null}
        <p className={`${photo ? "mt-3" : ""} text-base font-medium tracking-tight`}>{region.label}</p>
        <p className="mt-2 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
          <span className="inline-flex max-w-full flex-wrap items-baseline gap-x-1.5 rounded-full bg-neutral-900 px-2.5 py-1 text-white dark:bg-neutral-100 dark:text-neutral-900">
            <span className="text-lg font-semibold tabular-nums leading-none">
              {formatIt(region.cer)}
            </span>
            <span className="text-xs font-semibold">comunità energetiche (CER)</span>
          </span>
        </p>
        {region.cabinePrimarie != null ? (
          <p className="mt-1 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
            su{" "}
            <strong className="font-medium text-foreground">
              {formatIt(region.cabinePrimarie)} cabine primarie
            </strong>
          </p>
        ) : null}
        <p className="mt-2 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
          <strong className="font-medium text-foreground">
            {formatIt(region.total)} configurazioni
          </strong>
          {` · ${formatPct(pct)} dell’Italia`}
        </p>
        {medianLine(region) ? (
          <p className="mt-1 text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">
            {medianLine(region)}
          </p>
        ) : null}
        {totalsLine(region, potenzaItalia, utenzeItalia) ? (
          <p className="mt-1 text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">
            {totalsLine(region, potenzaItalia, utenzeItalia)}
          </p>
        ) : null}
      </div>
    </aside>
  );
}

function medianLine(region: CerRegionStat) {
  const bits: string[] = [];
  if (region.medianaPotenzaKw != null) {
    bits.push(`mediana ${formatItNum(region.medianaPotenzaKw)} kW`);
  }
  if (region.medianaUtenze != null) {
    bits.push(`${formatItNum(region.medianaUtenze)} utenze`);
  }
  return bits.length > 0 ? bits.join(" · ") : null;
}

function totalsLine(region: CerRegionStat, potenzaItalia: number, utenzeItalia: number) {
  const bits: string[] = [];
  if (region.potenzaKwTotale != null) {
    const share =
      potenzaItalia > 0
        ? ` (${formatPct((region.potenzaKwTotale / potenzaItalia) * 100)})`
        : "";
    bits.push(`${formatIt(region.potenzaKwTotale)} kW tot${share}`);
  }
  if (region.utenzeTotale != null) {
    const share =
      utenzeItalia > 0
        ? ` (${formatPct((region.utenzeTotale / utenzeItalia) * 100)})`
        : "";
    bits.push(`${formatIt(region.utenzeTotale)} utenze tot${share}`);
  }
  return bits.length > 0 ? bits.join(" · ") : null;
}

function formatIt(value: number) {
  const sign = value < 0 ? "−" : "";
  const abs = Math.round(Math.abs(value));
  return sign + String(abs).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function formatItNum(value: number) {
  const rounded = Math.round(value * 10) / 10;
  if (Number.isInteger(rounded)) return formatIt(rounded);
  const [int, dec] = rounded.toFixed(1).split(".");
  return `${formatIt(Number(int))},${dec}`;
}

function formatPct(value: number) {
  const rounded = value >= 10 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${new Intl.NumberFormat("it-IT", { maximumFractionDigits: 1 }).format(rounded)}%`;
}
