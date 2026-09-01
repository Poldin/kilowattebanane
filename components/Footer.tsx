"use client";

import { useState } from "react";

const SHARE_TITLE = "kilowatt & banane";
const SHARE_TEXT =
  "Ricevi ogni giorno i prezzi dell'energia nella tua zona. Sai già al mattino quando conviene consumare. Gratis.";

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

export function Footer() {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = new URL("/", window.location.origin).toString();
    const data = { title: SHARE_TITLE, text: SHARE_TEXT, url };

    if (typeof navigator.share === "function") {
      try {
        await navigator.share(data);
        return;
      } catch (error) {
        if (isAbortError(error)) return;
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked; ignore so the button never throws.
    }
  }

  return (
    <footer className="mt-auto border-t border-neutral-200 dark:border-neutral-800">
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-1 py-6 text-xs text-neutral-500 sm:px-6">
        <span>kilowatt &amp; banane</span>
        <span className="hidden sm:inline">consuma meglio l&apos;energia</span>
        <button
          type="button"
          onClick={share}
          aria-label="Condividi kilowatt e banane"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-neutral-200 px-2.5 py-1.5 text-xs text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-foreground dark:border-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-900 dark:hover:text-neutral-200"
        >
          <svg
            aria-hidden
            viewBox="0 0 16 16"
            className="h-3.5 w-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path
              d="M8 2.5v7"
              strokeLinecap="round"
            />
            <path
              d="M5.5 4.5 8 2l2.5 2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M3.5 7.5V12A1.5 1.5 0 0 0 5 13.5h6A1.5 1.5 0 0 0 12.5 12V7.5"
              strokeLinecap="round"
            />
          </svg>
          {copied ? "Link copiato" : "Condividi"}
        </button>
      </div>
    </footer>
  );
}
