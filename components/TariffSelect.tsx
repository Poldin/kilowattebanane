"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import {
  fasciaBadgeLabel,
  fasciaBadgesForPlan,
  FASCIA_LEGEND_COLOR,
  TARIFF_PLANS,
  type FasciaStatId,
  type TariffPlanId,
} from "@/lib/fasce";

function FasciaBadge({ id }: { id: FasciaStatId }) {
  return (
    <span
      className="inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-medium text-[#111111]"
      style={{ backgroundColor: FASCIA_LEGEND_COLOR[id] }}
    >
      {fasciaBadgeLabel(id)}
    </span>
  );
}

function FasciaBadgeGroup({ planId }: { planId: TariffPlanId }) {
  const badges = fasciaBadgesForPlan(planId);
  if (badges.length === 0) return null;

  return (
    <span className="flex shrink-0 items-center gap-1">
      {badges.map((id) => (
        <FasciaBadge key={id} id={id} />
      ))}
    </span>
  );
}

export function TariffSelect({
  value,
  onChange,
  align = "right",
}: {
  value: TariffPlanId;
  onChange: (value: TariffPlanId) => void;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();
  const labelId = useId();
  const selected = TARIFF_PLANS.find((plan) => plan.id === value) ?? TARIFF_PLANS[0];

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (!open || activeIndex < 0) return;
    const option = listRef.current?.querySelector<HTMLElement>(
      `[data-index="${activeIndex}"]`,
    );
    option?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  function openList() {
    const selectedIndex = TARIFF_PLANS.findIndex((plan) => plan.id === value);
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
    setOpen(true);
  }

  function selectPlan(id: TariffPlanId) {
    onChange(id);
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
      setActiveIndex((i) => Math.min(i + 1, TARIFF_PLANS.length - 1));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      const plan = TARIFF_PLANS[activeIndex];
      if (plan) selectPlan(plan.id);
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      setActiveIndex(0);
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      setActiveIndex(TARIFF_PLANS.length - 1);
    }
  }

  return (
    <div ref={rootRef} className="relative w-full sm:w-auto">
      <span id={labelId} className="sr-only">
        Tipo di tariffa
      </span>

      <button
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
        className="flex h-10 w-full items-center justify-between gap-2 rounded-md border border-neutral-800 bg-[#111111] px-2.5 text-left text-sm text-neutral-100 outline-none transition-colors hover:bg-neutral-900 sm:h-8 sm:min-w-[12rem] sm:w-auto"
      >
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <span className="truncate font-medium">{selected.label}</span>
          <FasciaBadgeGroup planId={selected.id} />
        </span>
        <svg
          aria-hidden
          viewBox="0 0 16 16"
          className={`h-4 w-4 shrink-0 text-neutral-400 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open ? (
        <div
          className={`absolute z-30 mt-2 w-[min(18rem,calc(100vw-2rem))] overflow-hidden rounded-md border border-neutral-800 bg-[#111111] ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          <div className="border-b border-neutral-800 px-3 py-2">
            <p className="text-[11px] font-medium tracking-wide text-neutral-400 uppercase">
              Contratto
            </p>
          </div>
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
            className="region-select-list-banana py-1 outline-none"
          >
            {TARIFF_PLANS.map((plan, index) => {
              const isSelected = plan.id === value;
              const active = index === activeIndex;
              return (
                <li
                  key={plan.id}
                  id={`${listId}-opt-${index}`}
                  role="option"
                  aria-selected={isSelected}
                  data-index={index}
                >
                  <button
                    type="button"
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => selectPlan(plan.id)}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                      active ? "bg-neutral-800 text-neutral-100" : "text-neutral-300"
                    }`}
                  >
                    <span
                      className={`min-w-0 flex-1 truncate ${
                        isSelected ? "font-medium" : ""
                      }`}
                    >
                      {plan.label}
                    </span>
                    <FasciaBadgeGroup planId={plan.id} />
                    <svg
                      aria-hidden
                      viewBox="0 0 16 16"
                      className={`h-3.5 w-3.5 shrink-0 text-neutral-100 ${
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
        </div>
      ) : null}
    </div>
  );
}
