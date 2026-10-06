"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { CER_SIGNUP_BUTTON_CLASS } from "@/components/cer/CerPodCta";
import { useCerSignupOptional } from "@/components/cer/CerSignupProvider";
import { useSignup } from "@/components/SignupForm";
import { useSyncedTick } from "@/lib/use-synced-tick";
import { useTypewriter } from "@/lib/use-typewriter";

const LOGO_TEXT = "kilowatt e banane";
const LOGO_EMOJI = "💡e 🍌🍌🍌";
const CER_HEADER_PATHS = new Set(["/comunita-energetiche", "/cer-stats"]);

export function Header() {
  const pathname = usePathname();
  const isCerPage = CER_HEADER_PATHS.has(pathname);
  const { openSignup } = useSignup();
  const cerSignup = useCerSignupOptional();
  const [logoReady, setLogoReady] = useState(false);
  const tick = useSyncedTick(10_000);
  const showEmoji = logoReady && tick % 2 === 1;
  const current = showEmoji ? LOGO_EMOJI : LOGO_TEXT;
  const { text: typed, isTyping } = useTypewriter(logoReady ? current : LOGO_TEXT, 55);

  useEffect(() => {
    setLogoReady(true);
  }, []);

  return (
    <header className="sticky top-0 z-50 border-b border-neutral-200/80 bg-background/80 backdrop-blur-md dark:border-neutral-800/80">
      <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between px-1 sm:h-16 sm:px-6">
        <Link
          href="/"
          className="relative inline-grid min-w-0 font-medium tracking-tight text-foreground"
          aria-label="kilowatt e banane🍌🍌🍌"
        >
          <span className="invisible col-start-1 row-start-1 whitespace-nowrap text-sm sm:text-base">
            {LOGO_TEXT}
          </span>
          <span className="invisible col-start-1 row-start-1 whitespace-nowrap text-sm sm:text-base">
            {LOGO_EMOJI}
          </span>
          <span
            className="col-start-1 row-start-1 truncate whitespace-nowrap text-sm sm:text-base"
            aria-live={logoReady ? "polite" : "off"}
            suppressHydrationWarning
          >
            {logoReady ? typed : LOGO_TEXT}
            {logoReady && isTyping ? (
              <span
                className="ml-px inline-block h-[1em] w-px translate-y-[0.1em] bg-current align-baseline opacity-70"
                aria-hidden
              />
            ) : null}
          </span>
        </Link>

        <div className="flex shrink-0 items-center gap-3 sm:gap-4">
          <Link
            href="/offer-compare"
            className="hidden text-sm text-neutral-700 transition-colors hover:text-foreground dark:text-neutral-300 dark:hover:text-neutral-200"
          >
            offerte
          </Link>
          <button
            type="button"
            onClick={() => {
              if (isCerPage && cerSignup) {
                cerSignup.openSignup();
                return;
              }
              openSignup();
            }}
            className={
              isCerPage
                ? CER_SIGNUP_BUTTON_CLASS
                : "rounded-md border border-neutral-200 bg-transparent px-3 py-1.5 text-sm text-neutral-700 transition-colors hover:bg-neutral-100 dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-900"
            }
          >
            {isCerPage ? "Iscriviti a una CER" : "Iscriviti gratis"}
          </button>
        </div>
      </div>
    </header>
  );
}
