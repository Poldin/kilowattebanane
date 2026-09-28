"use client";

import {
  LOOKBACK_RANGES,
  type LookbackRangeId,
} from "@/lib/lookback";

export function LookbackRangeTabs({
  value,
  onChange,
  ariaLabel,
  ranges = LOOKBACK_RANGES,
}: {
  value: LookbackRangeId;
  onChange: (id: LookbackRangeId) => void;
  ariaLabel: string;
  ranges?: readonly { id: LookbackRangeId; label: string }[];
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="flex min-w-0 flex-1 gap-1 overflow-x-auto pb-1"
    >
      {ranges.map((item) => {
        const active = item.id === value;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.id)}
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
  );
}
