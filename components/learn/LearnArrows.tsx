"use client";

import Link from "next/link";

const ARROW_BTN =
  "flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-neutral-200 text-2xl leading-none text-neutral-700 transition-colors hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-30 sm:h-8 sm:w-8 sm:text-lg dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-900";

const BACK_BTN =
  "inline-flex h-11 items-center rounded-md border border-neutral-200 px-3 text-sm text-neutral-700 transition-colors hover:bg-neutral-100 sm:h-8 dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-900";

export function LearnArrows({
  canPrev,
  canNext,
  onPrev,
  onNext,
}: {
  canPrev: boolean;
  canNext: boolean;
  onPrev?: () => void;
  onNext?: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Link href="/learn" className={BACK_BTN}>
        torna ai capitoli
      </Link>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={!canPrev}
          onClick={onPrev}
          aria-label="Domanda precedente"
          className={ARROW_BTN}
        >
          ‹
        </button>
        <button
          type="button"
          disabled={!canNext}
          onClick={onNext}
          aria-label="Domanda successiva"
          className={ARROW_BTN}
        >
          ›
        </button>
      </div>
    </div>
  );
}
