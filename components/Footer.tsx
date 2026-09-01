"use client";

import { ShareButton } from "@/components/ShareButton";

const SHARE_TITLE = "kilowatt e banane🍌🍌🍌";
const SHARE_TEXT =
  "Ricevi ogni giorno i prezzi dell'energia nella tua zona. Sai già al mattino quando conviene consumare. Gratis.";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-neutral-200 dark:border-neutral-800">
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-1 py-6 text-xs text-neutral-500 sm:px-6">
        <span>kilowatt e banane🍌🍌🍌</span>
        <span className="hidden sm:inline">consuma meglio l&apos;energia</span>
        <ShareButton
          getUrl={() => new URL("/", window.location.origin).toString()}
          title={SHARE_TITLE}
          text={SHARE_TEXT}
          ariaLabel="Condividi kilowatt e banane"
        />
      </div>
    </footer>
  );
}
