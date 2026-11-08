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

export type HeaderPartner = {
  name: string;
  logoSrc: string;
  href?: string;
};

export function Header({ partner }: { partner?: HeaderPartner } = {}) {
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

  const wordmark = (
    <KilowattWordmark
      typed={logoReady ? typed : LOGO_TEXT}
      isTyping={logoReady && isTyping}
      live={logoReady}
    />
  );

  return (
    <header className="sticky top-0 z-50 border-b border-neutral-200/80 bg-background/80 backdrop-blur-md dark:border-neutral-800/80">
      {partner ? (
        <div className="mx-auto flex h-14 w-full max-w-4xl items-center justify-center px-1 sm:h-16 sm:px-6">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            {wordmark}
            <span
              aria-hidden
              className="shrink-0 select-none text-sm text-neutral-400 sm:text-base"
            >
              ×
            </span>
            {partner.href ? (
              <a
                href={partner.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={partner.name}
                className="shrink-0"
              >
                <PartnerMark name={partner.name} src={partner.logoSrc} />
              </a>
            ) : (
              <PartnerMark name={partner.name} src={partner.logoSrc} />
            )}
          </div>
        </div>
      ) : (
        <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between px-1 sm:h-16 sm:px-6">
          {wordmark}
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
      )}
    </header>
  );
}

function KilowattWordmark({
  typed,
  isTyping,
  live,
}: {
  typed: string;
  isTyping: boolean;
  live: boolean;
}) {
  return (
    <Link
      href="/"
      className="relative inline-grid min-w-0 shrink-0 font-medium tracking-tight text-foreground"
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
        aria-live={live ? "polite" : "off"}
        suppressHydrationWarning
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
  );
}

function PartnerMark({ name, src }: { name: string; src: string }) {
  return (
    <span className="relative inline-block h-7 w-[10.9rem] shrink-0 sm:h-8 sm:w-[12.45rem]">
      <img
        src={src}
        alt={name}
        width={1300}
        height={209}
        className="h-full w-full object-contain object-left dark:invert"
      />
    </span>
  );
}
