"use client";

import { useSyncedTick } from "@/lib/use-synced-tick";
import { useTypewriter } from "@/lib/use-typewriter";

const ACTIONS = [
  "Quanto costa l'energia elettrica 💡 oggi?",
  "Quando è meglio attaccare la lavatrice🧼?",
  "Quando mi conviene caricare l'auto elettrica🚗?",
  "Quando devo lanciare la lavastoviglie🍽️?",
  "Quando dovrei stirare i vestiti👚?",
  "Quando dovrei consumare meno energia per risparmiare💰?",
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
        className="col-start-1 row-start-1 w-full text-balance"
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
