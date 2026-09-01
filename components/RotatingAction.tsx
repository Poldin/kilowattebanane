"use client";

import { useSyncedTick } from "@/lib/use-synced-tick";
import { useTypewriter } from "@/lib/use-typewriter";

const ACTIONS = [
  "attaccare la lavatrice🧼?",
  "caricare l'auto elettrica🚗?",
  "lanciare la lavastoviglie🍽️?",
  "stirare i vestiti👚?",
  "consumare il meno possibile💰?",
] as const;

export function RotatingAction() {
  const tick = useSyncedTick(10_000);
  const current = ACTIONS[tick % ACTIONS.length];
  const { text: typed, isTyping } = useTypewriter(current, 38);

  return (
    <span className="relative inline-grid align-baseline">
      {ACTIONS.map((action) => (
        <span
          key={action}
          className="invisible col-start-1 row-start-1 sm:whitespace-nowrap"
          aria-hidden
        >
          {action}
        </span>
      ))}
      <span
        className="col-start-1 row-start-1 underline decoration-neutral-300 underline-offset-4 sm:whitespace-nowrap dark:decoration-neutral-600"
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
