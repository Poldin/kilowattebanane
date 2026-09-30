import type { CerShowcaseCard } from "@/lib/cer/public-types";

function formatKw(value: number) {
  if (value >= 1000) {
    const mw = value / 1000;
    const rounded = mw >= 10 ? Math.round(mw) : Math.round(mw * 10) / 10;
    const label = Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(".", ",");
    return `${label} MW`;
  }
  const rounded = Math.round(value * 10) / 10;
  const label = Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(".", ",");
  return `${label} kW`;
}

function formatItInt(value: number) {
  return String(Math.trunc(Math.abs(value))).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function BoltMark() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      className="h-3.5 w-3.5 shrink-0 text-emerald-200"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M8.8 1.75 3.75 9.1h4.1L7.2 14.25l5.05-7.35h-4.1Z" strokeLinejoin="round" />
    </svg>
  );
}

function UtenzeMark() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      className="h-3.5 w-3.5 shrink-0 text-emerald-200"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <circle cx="8" cy="5" r="2.1" />
      <path d="M3.5 13.25c.4-2.2 2-3.4 4.5-3.4s4.1 1.2 4.5 3.4" strokeLinecap="round" />
    </svg>
  );
}

function CerCard({ cer }: { cer: CerShowcaseCard }) {
  return (
    <article className="flex w-54 shrink-0 flex-col rounded-lg border border-emerald-200/25 bg-emerald-950/35 p-3">
      <p className="line-clamp-2 min-h-10 text-sm font-medium leading-snug text-[#f5f5f5]">
        {cer.denominazione}
      </p>
      <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-emerald-100">
        {cer.potenzaKw != null ? (
          <span className="inline-flex items-center gap-1">
            <BoltMark />
            {formatKw(cer.potenzaKw)}
          </span>
        ) : null}
        {cer.nUtenze != null ? (
          <span className="inline-flex items-center gap-1">
            <UtenzeMark />
            {formatItInt(cer.nUtenze)}
            <span> utenze</span>
          </span>
        ) : null}
      </p>
    </article>
  );
}

export function CerShowcaseBanner({
  count,
  cers,
}: {
  count: number;
  cers: CerShowcaseCard[];
}) {
  return (
    <section className="mt-10 w-full overflow-hidden rounded-lg bg-[#111111] p-5 text-[#f5f5f5] sm:mt-12 sm:p-6">
      <p className="text-lg font-medium leading-tight text-emerald-100 sm:text-xl">
        in Italia sono attive
      </p>
      <p className="mt-1 text-5xl font-bold tabular-nums tracking-tight sm:text-6xl">
        {formatItInt(count)}
      </p>
      <p className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
        comunità energetiche
      </p>
      {cers.length > 0 ? (
        <div className="cer-marquee mt-6" aria-hidden>
          <div className="cer-marquee-track">
            <div className="cer-marquee-set">
              {cers.map((cer) => (
                <CerCard key={cer.denominazione} cer={cer} />
              ))}
            </div>
            <div className="cer-marquee-set">
              {cers.map((cer) => (
                <CerCard key={`${cer.denominazione}-loop`} cer={cer} />
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
