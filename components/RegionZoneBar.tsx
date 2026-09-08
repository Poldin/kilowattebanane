"use client";

import type { ReactNode } from "react";
import { RegionSelect } from "@/components/RegionSelect";
import type { ItalianRegion } from "@/lib/market-zones";

export function RegionZoneBar({
  region,
  onRegionChange,
  children,
  afterSelect,
  className = "mt-4",
  stacked = false,
}: {
  region: ItalianRegion;
  onRegionChange: (value: string) => void;
  children: ReactNode;
  afterSelect?: ReactNode;
  className?: string;
  /** Keep selects on a row below children (desktop); default puts them beside on sm+. */
  stacked?: boolean;
}) {
  return (
    <div
      className={`flex flex-col gap-2 sm:gap-3 ${
        stacked
          ? ""
          : "sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
      } ${className}`}
    >
      <div
        className={`flex min-w-0 items-center gap-1.5 sm:gap-2 ${
          stacked ? "" : "sm:flex-1"
        }`}
      >
        {children}
      </div>
      <div
        className={`flex w-full gap-2 ${
          stacked
            ? "flex-col sm:flex-row sm:items-center"
            : "flex-col sm:w-auto sm:shrink-0 sm:flex-row sm:items-center"
        }`}
      >
        <RegionSelect
          value={region}
          onChange={onRegionChange}
          variant="banana"
          compact
          hideLabel
          align="right"
        />
        {afterSelect}
      </div>
    </div>
  );
}
