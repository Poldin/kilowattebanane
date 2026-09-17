"use client";

import { useTypewriter } from "@/lib/use-typewriter";

const HERO_TITLE = "Quanto costa l'elettricità??";

export function RotatingAction() {
  const { text: typed, isTyping } = useTypewriter(HERO_TITLE, 38);

  return (
    <span className="relative grid w-full justify-items-center text-center">
      <span
        className="invisible col-start-1 row-start-1 w-full text-balance"
        aria-hidden
      >
        {HERO_TITLE}
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
