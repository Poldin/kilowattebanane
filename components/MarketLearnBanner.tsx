import Link from "next/link";

export function MarketLearnBanner() {
  return (
    <aside className="w-full rounded-lg bg-[#F5D547] p-5 text-[#111111] sm:p-6">
      <p className="text-3xl font-bold tracking-tight leading-tight sm:text-4xl">
        Non ci capisci una mazza?!🏏
      </p>
      <p className="mt-2 text-sm text-neutral-800">Sei in buona compagnia.</p>
      <Link
        href="/learn"
        className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-neutral-900 px-4 text-sm font-medium text-yellow-50 transition-opacity hover:opacity-90 sm:w-auto"
      >
        studia il mercato elettrico
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
      </Link>
    </aside>
  );
}
