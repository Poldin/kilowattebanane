"use client";

import Link from "next/link";
import { useSignup } from "@/components/SignupForm";
import { useSyncedTick } from "@/lib/use-synced-tick";
import { useTypewriter } from "@/lib/use-typewriter";

const LOGO_TEXT = "kilowatt & banane";
const LOGO_EMOJI = "🔌💡& 🍌🍌🍌";

export function Header() {
  const { openSignup } = useSignup();
  const tick = useSyncedTick(10_000);
  const showEmoji = tick % 2 === 1;
  const current = showEmoji ? LOGO_EMOJI : LOGO_TEXT;
  const { text: typed, isTyping } = useTypewriter(current, 55);

  return (
    <header className="sticky top-0 z-50 border-b border-neutral-200/80 bg-background/80 backdrop-blur-md dark:border-neutral-800/80">
      <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between px-1 sm:h-16 sm:px-6">
        <Link
          href="/"
          className="relative inline-grid min-w-0 font-medium tracking-tight text-foreground"
          aria-label="kilowatt & banane"
        >
          <span className="invisible col-start-1 row-start-1 whitespace-nowrap text-sm sm:text-base">
            {LOGO_TEXT}
          </span>
          <span className="invisible col-start-1 row-start-1 whitespace-nowrap text-sm sm:text-base">
            {LOGO_EMOJI}
          </span>
          <span
            className="col-start-1 row-start-1 truncate whitespace-nowrap text-sm sm:text-base"
            aria-live="polite"
          >
            {typed}
            {isTyping ? (
              <span
                className="ml-px inline-block h-[1em] w-px translate-y-[0.1em] bg-current align-baseline opacity-70"
                aria-hidden
              />
            ) : null}
          </span>
        </Link>

        <button
          type="button"
          onClick={openSignup}
          className="shrink-0 rounded-md border border-neutral-200 bg-transparent px-3 py-1.5 text-sm text-neutral-700 transition-colors hover:bg-neutral-100 dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-900"
        >
          Iscriviti
        </button>
      </div>
    </header>
  );
}
