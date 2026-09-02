"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { SIM_APPLIANCES, formatKwh } from "@/lib/load-shift";

type ApplianceSelectProps = {
  value: string;
  onChange: (value: string) => void;
};

function applianceHint(id: string) {
  const item = SIM_APPLIANCES.find((appliance) => appliance.id === id);
  if (!item) return "";
  const kWh = item.loads.reduce(
    (sum, load) => sum + load.kWh * load.cyclesPerDay,
    0,
  );
  return formatKwh(kWh);
}

export function ApplianceSelect({ value, onChange }: ApplianceSelectProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();
  const labelId = useId();
  const selected = SIM_APPLIANCES.find((item) => item.id === value);
  const selectedLabel = selected?.label ?? "Scegli un carico";

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
    const selectedIndex = SIM_APPLIANCES.findIndex((item) => item.id === value);
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
    setOpen(true);
  }

  function selectAppliance(id: string) {
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
      setActiveIndex((i) => Math.min(i + 1, SIM_APPLIANCES.length - 1));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      const item = SIM_APPLIANCES[activeIndex];
      if (item) selectAppliance(item.id);
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      setActiveIndex(0);
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      setActiveIndex(SIM_APPLIANCES.length - 1);
    }
  }

  return (
    <div ref={rootRef} className="relative w-full sm:max-w-sm">
      <span id={labelId} className="sr-only">
        Carico da simulare
      </span>

      <select
        tabIndex={-1}
        aria-hidden
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="pointer-events-none absolute h-0 w-0 opacity-0"
      >
        {SIM_APPLIANCES.map((item) => (
          <option key={item.id} value={item.id}>
            {item.label}
          </option>
        ))}
      </select>

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
        className="flex h-10 w-full items-center justify-between gap-2 rounded-md border border-neutral-800 bg-[#111111] px-2.5 text-left text-sm text-neutral-100 outline-none transition-colors hover:bg-neutral-900"
      >
        <span className="truncate font-medium">{selectedLabel}</span>
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
        <div className="absolute left-0 z-30 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-md border border-neutral-800 bg-[#111111]">
          <div className="border-b border-neutral-800 px-3 py-2">
            <p className="text-[11px] font-medium tracking-wide text-neutral-400 uppercase">
              Carico
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
            className="region-select-list-banana max-h-52 overflow-y-auto py-1 outline-none"
          >
            {SIM_APPLIANCES.map((item, index) => {
              const isSelected = item.id === value;
              const active = index === activeIndex;
              const hint = applianceHint(item.id);
              return (
                <li
                  key={item.id}
                  id={`${listId}-opt-${index}`}
                  role="option"
                  aria-selected={isSelected}
                  data-index={index}
                >
                  <button
                    type="button"
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => selectAppliance(item.id)}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                      active
                        ? "bg-neutral-800 text-neutral-100"
                        : "text-neutral-300"
                    }`}
                  >
                    <span
                      className={`min-w-0 flex-1 truncate ${
                        isSelected ? "font-medium" : ""
                      }`}
                    >
                      {item.label}
                    </span>
                    {hint ? (
                      <span className="shrink-0 text-[11px] font-medium text-[#F5D547]">
                        {hint}
                      </span>
                    ) : null}
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
