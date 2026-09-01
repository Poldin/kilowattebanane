"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { ITALIAN_REGIONS, zoneNameForRegion } from "@/lib/regions";

type RegionSelectProps = {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  variant?: "default" | "banana";
  compact?: boolean;
  hideLabel?: boolean;
  align?: "left" | "right";
};

export function RegionSelect({
  value,
  onChange,
  required,
  variant = "default",
  compact = false,
  hideLabel = false,
  align = "left",
}: RegionSelectProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();
  const labelId = useId();

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
    const selectedIndex = ITALIAN_REGIONS.findIndex((name) => name === value);
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
    setOpen(true);
  }

  function selectRegion(name: string) {
    onChange(name);
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
      setActiveIndex((i) => Math.min(i + 1, ITALIAN_REGIONS.length - 1));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      const name = ITALIAN_REGIONS[activeIndex];
      if (name) selectRegion(name);
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      setActiveIndex(0);
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      setActiveIndex(ITALIAN_REGIONS.length - 1);
    }
  }

  const isBanana = variant === "banana";

  return (
    <div ref={rootRef} className={`relative ${compact ? "w-full sm:w-auto" : ""}`}>
      <span
        id={labelId}
        className={
          hideLabel
            ? "sr-only"
            : "mb-1.5 block text-xs font-medium text-neutral-600 dark:text-neutral-400"
        }
      >
        Regione
      </span>

      <select
        required={required}
        tabIndex={-1}
        aria-hidden
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pointer-events-none absolute h-0 w-0 opacity-0"
      >
        <option value="" disabled>
          Seleziona regione
        </option>
        {ITALIAN_REGIONS.map((name) => (
          <option key={name} value={name}>
            {name}
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
        className={
          isBanana
            ? `flex items-center justify-between gap-2 rounded-md border border-neutral-800 bg-[#111111] text-left text-neutral-100 outline-none transition-colors hover:bg-neutral-900 ${
                compact
                  ? "h-10 w-full px-2.5 text-sm sm:h-8 sm:min-w-[11rem] sm:w-auto"
                  : "h-10 w-full px-3 text-sm"
              }`
            : `flex h-10 w-full items-center justify-between rounded-md border bg-background px-3 text-left text-sm outline-none transition-colors ${
                open
                  ? "border-neutral-400 dark:border-neutral-500"
                  : "border-neutral-200 hover:border-neutral-300 dark:border-neutral-800 dark:hover:border-neutral-700"
              }`
        }
      >
        <span
          className={
            isBanana
              ? "truncate font-medium"
              : value
                ? "text-foreground"
                : "text-neutral-400 dark:text-neutral-600"
          }
        >
          {value || "Seleziona regione"}
        </span>
        <svg
          aria-hidden
          viewBox="0 0 16 16"
          className={`h-4 w-4 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""} ${
            isBanana ? "text-neutral-400" : "text-neutral-500"
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
          className={`absolute z-30 mt-2 overflow-hidden rounded-md ${
            align === "right" ? "right-0" : "left-0"
          } ${
            isBanana
              ? "w-[min(22rem,calc(100vw-2rem))] border border-neutral-800 bg-[#111111]"
              : "w-full border border-neutral-200 bg-background dark:border-neutral-800"
          }`}
        >
          <div
            className={`border-b px-3 py-2 ${
              isBanana
                ? "border-neutral-800"
                : "border-neutral-200 dark:border-neutral-800"
            }`}
          >
            <p
              className={`text-[11px] font-medium tracking-wide uppercase ${
                isBanana ? "text-neutral-400" : "text-neutral-500"
              }`}
            >
              Zone di mercato
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
            className={`max-h-52 overflow-y-auto py-1 outline-none ${
              isBanana ? "region-select-list-banana" : "region-select-list"
            }`}
          >
            {ITALIAN_REGIONS.map((name, index) => {
              const selected = name === value;
              const active = index === activeIndex;
              const zoneName = zoneNameForRegion(name);
              return (
                <li
                  key={name}
                  id={`${listId}-opt-${index}`}
                  role="option"
                  aria-selected={selected}
                  data-index={index}
                >
                  <button
                    type="button"
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => selectRegion(name)}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                      isBanana
                        ? active
                          ? "bg-neutral-800 text-neutral-100"
                          : "text-neutral-300"
                        : active
                          ? "bg-neutral-100 text-foreground dark:bg-neutral-900"
                          : "text-neutral-700 dark:text-neutral-300"
                    }`}
                  >
                    <span
                      className={`min-w-0 flex-1 truncate ${
                        selected ? "font-medium" : ""
                      }`}
                    >
                      {name}
                    </span>
                    {zoneName && zoneName !== name ? (
                      <span
                        className={
                          isBanana
                            ? "shrink-0 text-[11px] font-medium text-[#F5D547]"
                            : "shrink-0 text-[11px] font-medium text-neutral-400 dark:text-neutral-500"
                        }
                      >
                        <span className="sr-only">zona </span>
                        {zoneName}
                      </span>
                    ) : null}
                    <svg
                      aria-hidden
                      viewBox="0 0 16 16"
                      className={`h-3.5 w-3.5 shrink-0 ${
                        selected ? "opacity-100" : "opacity-0"
                      } ${isBanana ? "text-neutral-100" : "text-foreground"}`}
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
