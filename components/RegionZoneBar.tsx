"use client";

import type { ReactNode } from "react";
import { RegionSelect } from "@/components/RegionSelect";
import { zoneNameForRegion, type ItalianRegion } from "@/lib/market-zones";

export function RegionZoneBar({
  region,
  onRegionChange,
  children,
  className = "mt-4",
}: {
  region: ItalianRegion;
  onRegionChange: (value: string) => void;
  children: ReactNode;
  className?: string;
}) {
  const zoneName = zoneNameForRegion(region);

  return (
    <>
      <div
        className={`flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3 ${className}`}
      >
        <div className="flex min-w-0 items-center gap-1.5 sm:flex-1 sm:gap-2">
          {children}
        </div>
        <div className="w-full sm:w-auto sm:shrink-0">
          <RegionSelect
            value={region}
            onChange={onRegionChange}
            variant="banana"
            compact
            hideLabel
            align="right"
          />
        </div>
      </div>
      {zoneName ? (
        <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
          Zona di mercato:
          <span className="inline-flex items-center rounded-full bg-[#F5D547] px-2 py-0.5 font-medium text-[#111111]">
            {zoneName}
          </span>
        </p>
      ) : null}
    </>
  );
}
