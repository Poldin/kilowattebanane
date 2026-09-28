"use client";

const BUTTON_CLASS =
  "flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-neutral-200 text-2xl leading-none text-neutral-700 transition-colors hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-30 sm:h-8 sm:w-8 sm:text-lg dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-900";

export function DayShiftControls({
  label,
  onPrev,
  onNext,
  disablePrev,
  disableNext,
}: {
  label: string;
  onPrev: () => void;
  onNext: () => void;
  disablePrev: boolean;
  disableNext: boolean;
}) {
  return (
    <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
      <button
        type="button"
        onClick={onPrev}
        disabled={disablePrev}
        aria-label="Giorno precedente"
        className={BUTTON_CLASS}
      >
        ‹
      </button>
      <button
        type="button"
        onClick={onNext}
        disabled={disableNext}
        aria-label="Giorno successivo"
        className={BUTTON_CLASS}
      >
        ›
      </button>
      <p
        className="min-w-0 truncate text-sm font-medium capitalize tracking-tight text-foreground sm:text-base"
        aria-live="polite"
      >
        {label}
      </p>
    </div>
  );
}
