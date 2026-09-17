"use client";

import { useState } from "react";

const SHARE_TITLE = "kilowatt e banane🍌🍌🍌";
const SHARE_TEXT =
  "Ricevi ogni giorno i prezzi dell'energia nella tua zona. Sai già al mattino quando conviene consumare. Gratis.";

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

export function ShareBanner() {
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
    <button
      type="button"
      onClick={share}
      className="relative w-full overflow-hidden rounded-lg bg-[#111111] p-5 text-left text-[#f5f5f5] transition-opacity hover:opacity-90 sm:p-6"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <span className="absolute top-1/2 left-1/2 w-[220%] origin-center -translate-x-1/2 -translate-y-1/2 -rotate-[18deg] text-center text-3xl leading-[1.85] opacity-[0.14]">
          {Array.from({ length: 9 }, (_, row) => (
            <span
              key={row}
              className={`block ${row % 2 === 1 ? "translate-x-8" : ""}`}
            >
              {Array.from({ length: 14 }, (_, i) => (i % 2 === 0 ? "💡" : "🍌")).join(
                "  ",
              )}
            </span>
          ))}
        </span>
      </span>
      <span className="relative">
        <span className="block text-3xl font-bold tracking-tight leading-tight sm:text-4xl">
          Condividi kilowatt e banane
        </span>
        <span className="mt-2 block text-sm text-neutral-300">
          parlane a chi può trarne beneficio 😮🙂😍
        </span>
        <span className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-[#f5f5f5] px-4 text-sm font-medium text-[#111111] sm:w-auto">
          {copied ? "Link copiato" : "Condividi"}
          <svg
            aria-hidden
            viewBox="0 0 16 16"
            className="h-4 w-4 shrink-0"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
          >
            <path d="M3.5 8h9M9 4.5 12.5 8 9 11.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </span>
    </button>
  );
}
