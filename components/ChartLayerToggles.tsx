"use client";

import type { ReactNode } from "react";
import {
  FASCIA_COLOR,
  FASCIA_LEGEND_COLOR,
  type ChartLayers,
} from "@/lib/fasce";

const BANANA = "#F5D547";

function ChartLayerToggle({
  pressed,
  labelOn,
  labelOff,
  onClick,
  children,
}: {
  pressed: boolean;
  labelOn: string;
  labelOff: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-label={pressed ? labelOff : labelOn}
      title={pressed ? labelOff : labelOn}
      className={`flex h-8 w-8 items-center justify-center rounded-md border transition-colors ${
        pressed
          ? "border-neutral-300 bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900"
          : "border-neutral-200 hover:bg-neutral-100 dark:border-neutral-800 dark:hover:bg-neutral-900"
      }`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function FasciaToggleIcon({
  f1,
  f2,
  f3,
}: {
  f1: boolean;
  f2: boolean;
  f3: boolean;
}) {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden>
      <rect
        x="1"
        y="2"
        width="4"
        height="12"
        rx="1"
        fill={f3 ? FASCIA_COLOR.F3 : "#737373"}
      />
      <rect
        x="6"
        y="2"
        width="4"
        height="12"
        rx="1"
        fill={f2 ? FASCIA_COLOR.F2 : "#737373"}
      />
      <rect
        x="11"
        y="2"
        width="4"
        height="12"
        rx="1"
        fill={f1 ? FASCIA_COLOR.F1 : "#737373"}
      />
    </svg>
  );
}

function LineToggleIcon({ on }: { on: boolean }) {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden>
      <path
        d="M1.5 12.5 L5 7.5 L8.5 9.5 L14.5 3.5"
        fill="none"
        stroke={on ? BANANA : "#737373"}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function F23ToggleIcon({ on }: { on: boolean }) {
  const left = on ? FASCIA_COLOR.F2 : "#737373";
  const right = on ? FASCIA_COLOR.F3 : "#737373";
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden>
      <rect x="1" y="3" width="7" height="10" rx="1" fill={left} />
      <rect x="8" y="3" width="7" height="10" rx="1" fill={right} />
    </svg>
  );
}

function MonoToggleIcon({ on }: { on: boolean }) {
  const color = on ? FASCIA_LEGEND_COLOR.Fmonoraria : "#737373";
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden>
      <rect x="2" y="8" width="12" height="6" fill={color} opacity="0.35" />
      <line
        x1="2"
        x2="14"
        y1="8"
        y2="8"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function ChartLayerToggles({
  layers,
  onChange,
}: {
  layers: ChartLayers;
  onChange: (next: ChartLayers) => void;
}) {
  const showLine = layers.line;
  const showMono = layers.mono;
  const showF23 = layers.f23;
  const showAnyFascia = layers.f1 || layers.f2 || layers.f3;

  function patch(partial: Partial<ChartLayers>) {
    onChange({ ...layers, ...partial });
  }

  return (
    <div className="mb-1.5 flex justify-end gap-1.5">
      <ChartLayerToggle
        pressed={showLine}
        labelOn="Mostra linea del prezzo"
        labelOff="Nascondi linea del prezzo"
        onClick={() => patch({ line: !showLine })}
      >
        <LineToggleIcon on={showLine} />
      </ChartLayerToggle>
      <ChartLayerToggle
        pressed={showMono}
        labelOn="Mostra Fmonoraria"
        labelOff="Nascondi Fmonoraria"
        onClick={() => patch({ mono: !showMono })}
      >
        <MonoToggleIcon on={showMono} />
      </ChartLayerToggle>
      <ChartLayerToggle
        pressed={showF23}
        labelOn="Mostra F23"
        labelOff="Nascondi F23"
        onClick={() => patch({ f23: !showF23 })}
      >
        <F23ToggleIcon on={showF23} />
      </ChartLayerToggle>
      <ChartLayerToggle
        pressed={showAnyFascia}
        labelOn="Mostra fasce F1 F2 F3"
        labelOff="Nascondi fasce F1 F2 F3"
        onClick={() => {
          const next = !showAnyFascia;
          patch({ f1: next, f2: next, f3: next });
        }}
      >
        <FasciaToggleIcon f1={layers.f1} f2={layers.f2} f3={layers.f3} />
      </ChartLayerToggle>
    </div>
  );
}
