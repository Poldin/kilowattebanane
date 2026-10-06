"use client";

import { ArrowRight } from "lucide-react";
import { useState } from "react";
import {
  CER_SHARE_HIGHLIGHT,
  CER_SHARE_LEAD,
  CER_SHARE_REST,
  CER_SHARE_TEXT,
  CER_SHARE_TITLE,
} from "@/lib/cer/signup";

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

export function CerShareBlock({ className }: { className?: string }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = new URL("/comunita-energetiche", window.location.origin).toString();
    const data = { title: CER_SHARE_TITLE, text: CER_SHARE_TEXT, url };

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
    <section className={className ? `max-w-xl ${className}` : "max-w-xl"} aria-label="Condividi">
      <p className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
        <span className="text-[#165B44] dark:text-[#F5D547]">{CER_SHARE_HIGHLIGHT}</span>{" "}
        {CER_SHARE_REST}
      </p>
      <p className="mt-2 text-base leading-relaxed text-foreground">{CER_SHARE_LEAD}</p>
      <div className="mt-5">
        <button
          type="button"
          onClick={() => void share()}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-[#165B44] px-5 text-sm font-medium text-white transition-opacity hover:opacity-90 sm:w-auto sm:min-w-48"
        >
          {copied ? "Link copiato" : "Condividi"}
          {copied ? null : (
            <ArrowRight aria-hidden className="h-4 w-4 shrink-0" strokeWidth={1.75} />
          )}
        </button>
      </div>
    </section>
  );
}
