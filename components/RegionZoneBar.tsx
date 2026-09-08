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
}: {
  region: ItalianRegion;
  onRegionChange: (value: string) => void;
  children: ReactNode;
  afterSelect?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3 ${className}`}
    >
      <div className="flex min-w-0 items-center gap-1.5 sm:flex-1 sm:gap-2">
        {children}
      </div>
      <div className="flex w-full flex-col gap-2 sm:w-auto sm:shrink-0 sm:flex-row sm:items-center">
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
