const RPO_HREF = "https://registrodelleopposizioni.it/cittadino/";

export function OpposizioniCallout({ className }: { className?: string }) {
  return (
    <>
      <p className={className ?? "text-sm font-medium leading-relaxed"}>
        <span className="box-decoration-clone rounded-full bg-[#f5f5f5] px-2.5 py-0.5 text-[#165B44]">
          ti chiamano di continuo per proporti offerte e non ne puoi più?😩
        </span>
      </p>
      <a
        href={RPO_HREF}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-flex items-center gap-1 text-sm text-emerald-100 underline decoration-emerald-300/60 underline-offset-2 transition-colors hover:text-white hover:decoration-white/80"
      >
        clicca qui e iscriviti al registro delle opposizioni
        <svg
          aria-hidden
          viewBox="0 0 16 16"
          className="h-3.5 w-3.5 shrink-0"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
        >
          <path
            d="M4.5 11.5 11.5 4.5M6.5 4.5h5v5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </a>
    </>
  );
}

export function OpposizioniBanner() {
  return (
    <aside className="w-full rounded-lg bg-[#165B44] p-5 text-[#f5f5f5] sm:p-6">
      <OpposizioniCallout />
    </aside>
  );
}
