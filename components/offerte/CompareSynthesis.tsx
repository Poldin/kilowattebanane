"use client";

import type {
  CompareSynthesisResult,
  SynthesisLine,
  SynthesisPart,
} from "@/lib/offerte/compare-synthesis";

function OfferBadge({
  id,
  label,
  color,
  onFocus,
}: {
  id: string;
  label: string;
  color: string;
  onFocus?: (id: string) => void;
}) {
  return (
    <button
      type="button"
      title={label}
      onClick={() => onFocus?.(id)}
      className="mx-0.5 inline-flex max-w-[min(100%,16rem)] translate-y-[-0.05em] items-center rounded-full px-2.5 py-0.5 text-sm font-medium text-white align-baseline transition-opacity hover:opacity-90"
      style={{ backgroundColor: color }}
    >
      <span className="truncate">{label}</span>
    </button>
  );
}

function SynthesisContent({
  parts,
  colors,
  onFocus,
}: {
  parts: SynthesisPart[];
  colors: Record<string, string>;
  onFocus?: (id: string) => void;
}) {
  return (
    <>
      {parts.map((part, index) =>
        part.kind === "text" ? (
          <span key={index}>{part.value}</span>
        ) : (
          <OfferBadge
            key={`${part.id}-${index}`}
            id={part.id}
            label={part.label}
            color={colors[part.id] ?? "#64748b"}
            onFocus={onFocus}
          />
        ),
      )}
    </>
  );
}

function SynthesisItem({
  line,
  colors,
  onFocus,
}: {
  line: SynthesisLine;
  colors: Record<string, string>;
  onFocus?: (id: string) => void;
}) {
  return (
    <li className="py-2.5 first:pt-0 last:pb-0">
      <p
        className={`text-sm leading-relaxed ${
          line.tone === "strong"
            ? "text-neutral-100 dark:text-neutral-900"
            : "text-neutral-300 dark:text-neutral-600"
        }`}
      >
        <SynthesisContent parts={line.parts} colors={colors} onFocus={onFocus} />
      </p>
    </li>
  );
}

export function CompareSynthesis({
  synthesis,
  colors,
  onFocus,
}: {
  synthesis: CompareSynthesisResult | null;
  colors: Record<string, string>;
  onFocus?: (id: string) => void;
}) {
  if (!synthesis) return null;

  const lines = [
    ...synthesis.sure,
    ...(synthesis.showConditional || synthesis.conditional.length > 0 ? synthesis.conditional : []),
  ];
  if (lines.length === 0) return null;

  return (
    <section
      aria-label="Sintesi comparativa"
      className="mt-8 rounded-xl bg-neutral-900 p-5 text-neutral-100 sm:p-6 dark:bg-neutral-100 dark:text-neutral-900"
    >
      <h3 className="text-2xl font-semibold tracking-tight sm:text-3xl">Quindi??!</h3>
      <ul className="mt-6 divide-y divide-neutral-700/60 dark:divide-neutral-300/60">
        {lines.map((line) => (
          <SynthesisItem key={line.id} line={line} colors={colors} onFocus={onFocus} />
        ))}
      </ul>
    </section>
  );
}
