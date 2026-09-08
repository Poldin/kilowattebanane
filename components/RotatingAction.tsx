"use client";

import { useSyncedTick } from "@/lib/use-synced-tick";
import { useTypewriter } from "@/lib/use-typewriter";

const ACTIONS = [
  "Quanto costa l'energia elettrica 💡 oggi?",
  "Quando devo attaccare la lavatrice🧼?",
  "Quando devo caricare l'auto elettrica🚗?",
  "Quando devo lanciare la lavastoviglie🍽️?",
  "Quando devo stirare i vestiti👚?",
  "Quando devo consumare il meno possibile💰?",
] as const;

const LONGEST_ACTION = ACTIONS.reduce((longest, action) =>
  action.length > longest.length ? action : longest,
);

export function RotatingAction() {
  const tick = useSyncedTick(10_000);
  const current = ACTIONS[tick % ACTIONS.length];
  const { text: typed, isTyping } = useTypewriter(current, 38);

  return (
    <span className="relative grid w-full justify-items-center text-center">
      <span
        className="invisible col-start-1 row-start-1 w-full text-balance"
        aria-hidden
      >
        {LONGEST_ACTION}
      </span>
      <span
        className="col-start-1 row-start-1 w-full text-balance underline decoration-neutral-300 underline-offset-4 dark:decoration-neutral-600"
        aria-live="polite"
      >
        {typed}
        {isTyping ? (
          <span
            className="ml-px inline-block h-[0.9em] w-[2px] translate-y-[0.12em] bg-current align-baseline opacity-70"
            aria-hidden
          />
        ) : null}
      </span>
    </span>
  );
}
