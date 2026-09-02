"use client";

import { useMemo, useState } from "react";
import {
  DEFAULT_SIM_APPLIANCE,
  applianceById,
  formatEuroFromCents,
  formatLoadShiftCaption,
  formatSimulationParams,
  simulateLoadShiftFromHours,
} from "@/lib/load-shift";
import { ApplianceSelect } from "@/components/ApplianceSelect";
import { FAQ_POCKET_ID, FAQ_POCKET_Q } from "@/components/Faq";
import {
  DEFAULT_LOOKBACK_RANGE,
  LOOKBACK_RANGES,
  formatLookbackCaptionFromDates,
  lookbackEndDateFromDates,
  lookbackRangeById,
  sliceLookbackDates,
  type LookbackRangeId,
} from "@/lib/lookback";
import { RegionZoneBar } from "@/components/RegionZoneBar";
import type { ItalianRegion } from "@/lib/market-zones";
import type { ZoneHourlyPayload } from "@/lib/zone-home-types";

const BANANA = "#F5D547";
const MID = "#A3A3A3";
const SIM_LOOKBACK_RANGES = LOOKBACK_RANGES.filter((item) => item.id !== "max");

export function LoadShiftSim({
  hourly,
  region,
  onRegionChange,
}: {
  hourly: ZoneHourlyPayload[];
  region: ItalianRegion;
  onRegionChange: (value: string) => void;
}) {
  const [rangeId, setRangeId] = useState<LookbackRangeId>(DEFAULT_LOOKBACK_RANGE);
  const [applianceId, setApplianceId] = useState(DEFAULT_SIM_APPLIANCE);
  const dates = hourly.map((day) => day.date);
  const endDate = lookbackEndDateFromDates(dates);
  const range = lookbackRangeById(rangeId);
  const windowHourly = useMemo(() => {
    if (!endDate) return [];
    const allowed = new Set(sliceLookbackDates(dates, range.days, endDate));
    return hourly.filter((day) => allowed.has(day.date));
  }, [hourly, dates, endDate, range.days]);
  const appliance = applianceById(applianceId);
  const result = useMemo(
    () => simulateLoadShiftFromHours(windowHourly, appliance),
    [windowHourly, appliance],
  );

  if (!endDate) return null;

  const periodCaption =
    windowHourly.length > 0
      ? formatLookbackCaptionFromDates(windowHourly.map((day) => day.date))
      : "";
  const copy = result ? formatLoadShiftCaption(result) : null;
  const perCycle = result && result.cycles > 0;

  return (
    <section
      aria-labelledby="load-shift-heading"
      className="mt-10 scroll-mt-20 border-t border-neutral-200 pt-8 dark:border-neutral-800"
    >
      <h3
        id="load-shift-heading"
        className="text-lg font-medium tracking-tight text-foreground sm:text-xl"
      >
        Quanto mi resta in tasca?
      </h3>
      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
        Un carico al giorno, nella tua zona: quanto costa all&apos;ingrosso se
        lo fai negli orari più bassi, medi o alti.
      </p>

      <RegionZoneBar region={region} onRegionChange={onRegionChange}>
        <div
          role="tablist"
          aria-label="Periodo della simulazione"
          className="flex min-w-0 flex-1 gap-1 overflow-x-auto pb-1"
        >
          {SIM_LOOKBACK_RANGES.map((item) => {
            const active = item.id === rangeId;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setRangeId(item.id)}
                className={
                  active
                    ? "shrink-0 rounded-md bg-[#F5D547] px-2.5 py-1.5 text-xs font-semibold text-[#111111]"
                    : "shrink-0 rounded-md px-2.5 py-1.5 text-xs font-medium text-neutral-600 transition-colors hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-900"
                }
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </RegionZoneBar>

      <div className="mt-3">
        <ApplianceSelect value={applianceId} onChange={setApplianceId} />
      </div>

      {result ? (
        <>
          <div
            className="mt-5"
            aria-label="Costo all'ingrosso negli orari bassi, medi e alti"
          >
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  {
                    id: "low",
                    label: "orari bassi",
                    value: formatEuroFromCents(result.min),
                    each: formatEuroFromCents(
                      result.min /
                        (appliance.loads.length > 1
                          ? result.days
                          : result.cycles),
                    ),
                    eachSuffix:
                      appliance.loads.length > 1 ? "al giorno" : "a ciclo",
                    mark: "banana" as const,
                  },
                  {
                    id: "mid",
                    label: "orari medi",
                    value: formatEuroFromCents(result.mid),
                    each: formatEuroFromCents(
                      result.mid /
                        (appliance.loads.length > 1
                          ? result.days
                          : result.cycles),
                    ),
                    eachSuffix:
                      appliance.loads.length > 1 ? "al giorno" : "a ciclo",
                    mark: null,
                  },
                  {
                    id: "high",
                    label: "orari alti",
                    value: formatEuroFromCents(result.max),
                    each: formatEuroFromCents(
                      result.max /
                        (appliance.loads.length > 1
                          ? result.days
                          : result.cycles),
                    ),
                    eachSuffix:
                      appliance.loads.length > 1 ? "al giorno" : "a ciclo",
                    mark: "monkey" as const,
                  },
                ] as const
              ).map((stat) => (
                <div key={stat.id}>
                  <p className="text-[11px] font-medium tracking-wider text-neutral-500 uppercase">
                    {stat.label}
                  </p>
                  <p className="text-xl font-semibold tabular-nums tracking-tight text-foreground">
                    {stat.mark === "banana" ? (
                      <span className="mr-0.5 text-base" aria-hidden>
                        🍌
                      </span>
                    ) : null}
                    {stat.mark === "monkey" ? (
                      <span className="mr-0.5 text-base" aria-hidden>
                        🐵
                      </span>
                    ) : null}
                    {stat.value}
                  </p>
                  {perCycle && result.days > 1 ? (
                    <p className="mt-0.5 text-[11px] tabular-nums text-neutral-400 dark:text-neutral-500">
                      {stat.each} {stat.eachSuffix}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
            {periodCaption ? (
              <p className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">
                all&apos;ingrosso · {periodCaption}
              </p>
            ) : null}
            {copy ? (
              <p className="mt-3 text-sm font-medium text-foreground">
                {copy.before}
                <span
                  className="underline decoration-2 underline-offset-2"
                  style={{
                    textDecorationColor:
                      copy.tone === "cheap" ? BANANA : MID,
                  }}
                >
                  {copy.mark}
                </span>
                {copy.after}
              </p>
            ) : null}
            <a
              href={`#${FAQ_POCKET_ID}`}
              className="mt-3 inline-flex max-w-full items-center rounded-full border border-neutral-200 bg-neutral-100 px-3 py-1 text-left text-xs text-neutral-600 transition-colors hover:border-neutral-300 hover:bg-neutral-200/80 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400 dark:hover:border-neutral-700 dark:hover:bg-neutral-800"
            >
              😯{FAQ_POCKET_Q.toLowerCase()}
            </a>
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-neutral-400 dark:text-neutral-500">
            {formatSimulationParams(appliance)}
          </p>
        </>
      ) : (
        <p className="mt-4 text-sm text-neutral-500 dark:text-neutral-400">
          Ancora pochi dati per simulare questo periodo.
        </p>
      )}
    </section>
  );
}
