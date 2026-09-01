"use client";

import Link from "next/link";
import { ShareButton } from "@/components/ShareButton";
import { useSignup } from "@/components/SignupForm";
import { PRICES_SECTION_ID, SHOW_TODAY_PRICES_EVENT } from "@/lib/market-zones";

const SHARE_TITLE = "kilowatt e banane🍌🍌🍌";
const SHARE_TEXT =
  "Ricevi ogni giorno i prezzi dell'energia nella tua zona. Sai già al mattino quando conviene consumare. Gratis.";

const itemClass =
  "text-left text-sm text-neutral-500 transition-colors hover:text-foreground dark:text-neutral-400 dark:hover:text-neutral-200";

export function Footer() {
  const { openSignup } = useSignup();

  function showTodayPrices() {
    window.dispatchEvent(new Event(SHOW_TODAY_PRICES_EVENT));
    document.getElementById(PRICES_SECTION_ID)?.scrollIntoView({
      behavior: "smooth",
    });
  }

  return (
    <footer className="mt-auto border-t border-neutral-200 dark:border-neutral-800">
      <div className="mx-auto grid w-full max-w-3xl gap-8 px-1 py-8 sm:px-6 md:grid-cols-3 md:items-start md:gap-6 md:py-10">
        <div>
          <Link
            href="/"
            className="inline-block font-medium tracking-tight text-foreground text-sm sm:text-base"
          >
            kilowatt e banane
          </Link>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            consuma meglio l&apos;energia
          </p>
        </div>

        <nav aria-labelledby="footer-risorse">
          <h2
            id="footer-risorse"
            className="text-sm font-medium text-foreground"
          >
            Risorse
          </h2>
          <ul className="mt-3 flex flex-col items-start gap-2">
            <li>
              <button type="button" onClick={openSignup} className={itemClass}>
                Iscriviti gratis
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={showTodayPrices}
                className={itemClass}
              >
                Vedi prezzi di oggi
              </button>
            </li>
            <li>
              <span className="text-sm text-neutral-500 dark:text-neutral-400">
                Privacy
              </span>
            </li>
            <li>
              <span className="text-sm text-neutral-500 dark:text-neutral-400">
                Termini e condizioni
              </span>
            </li>
          </ul>
        </nav>

        <section aria-labelledby="footer-aiutaci">
          <h2
            id="footer-aiutaci"
            className="text-sm font-medium text-foreground"
          >
            Aiutaci
          </h2>
          <ul className="mt-3 flex flex-col gap-3">
            <li className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-neutral-500 dark:text-neutral-400">
                Condividi a chi è utile
              </span>
              <ShareButton
                getUrl={() => new URL("/", window.location.origin).toString()}
                title={SHARE_TITLE}
                text={SHARE_TEXT}
                ariaLabel="Condividi kilowatt e banane"
              />
            </li>
            <li className="text-sm text-neutral-500 dark:text-neutral-400">
              Come miglioriamo? Scrivici a{" "}
              <a
                href="mailto:oloapiccoli@gmail.com"
                className="break-all text-foreground underline decoration-neutral-300 underline-offset-2 transition-colors hover:decoration-neutral-500 dark:decoration-neutral-700 dark:hover:decoration-neutral-500"
              >
                oloapiccoli@gmail.com
              </a>
            </li>
          </ul>
        </section>
      </div>
    </footer>
  );
}
