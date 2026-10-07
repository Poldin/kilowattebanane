import type { ReactNode } from "react";

const CARDS: {
  title: string;
  body: string;
  art: () => ReactNode;
}[] = [
  {
    title: "Risparmio",
    body: "Incentivo sull’energia rinnovabile condivisa.",
    art: ArtRisparmio,
  },
  {
    title: "Nuovi impianti",
    body: "Supporto per installare il fotovoltaico.",
    art: ArtImpianti,
  },
  {
    title: "Meno CO₂",
    body: "Più rinnovabili in zona, meno emissioni.",
    art: ArtCo2,
  },
  {
    title: "Ingresso semplice",
    body: "Basta un POD nella zona della comunità.",
    art: ArtPod,
  },
  {
    title: "Detrazioni",
    body: "Agevolazioni fiscali sul fotovoltaico nuovo.",
    art: ArtDetrazioni,
  },
  {
    title: "Stesso fornitore",
    body: "La bolletta resta con il tuo venditore.",
    art: ArtFornitore,
  },
];

export function CerWhyJoin() {
  return (
    <section className="mt-14 w-full sm:mt-16" aria-labelledby="cer-why-title">
      <h2
        id="cer-why-title"
        className="text-3xl font-bold tracking-tight sm:text-4xl"
      >
        Perché aderire a una CER?
      </h2>
      <div className="cer-marquee cer-who-marquee cer-why-marquee mt-5">
        <div className="cer-marquee-track">
          <ul className="cer-marquee-set m-0 list-none pl-0">
            {CARDS.map((card) => (
              <WhyCard key={card.title} card={card} />
            ))}
          </ul>
          <ul className="cer-marquee-set m-0 list-none pl-0" aria-hidden>
            {CARDS.map((card) => (
              <WhyCard key={`${card.title}-loop`} card={card} />
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function WhyCard({ card }: { card: (typeof CARDS)[number] }) {
  return (
    <li className="w-[10.25rem] shrink-0 sm:w-[10.75rem]">
      <article className="flex h-full flex-col">
        <div className="overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900">
          <svg
            viewBox="0 0 160 214"
            className="block h-auto w-full text-foreground"
            aria-hidden
          >
            {card.art()}
          </svg>
        </div>
        <h3 className="mt-2.5 text-sm font-bold leading-snug tracking-tight">
          {card.title}
        </h3>
        <p className="mt-1 text-xs leading-relaxed text-neutral-600 dark:text-neutral-400">
          {card.body}
        </p>
      </article>
    </li>
  );
}

function ArtRisparmio() {
  return (
    <>
      <g transform="translate(80 107)">
        <g className="cer-why-coin">
          <circle r="34" className="fill-[#F5D547]/25" />
          <circle r="26" className="fill-[#F5D547]" />
          <circle r="19" fill="none" className="stroke-current" strokeWidth="1.5" />
          <path
            d="M7 -10 A11 11 0 1 0 7 10"
            fill="none"
            className="stroke-current"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <line
            x1="-4"
            y1="-3.2"
            x2="8"
            y2="-3.2"
            className="stroke-current"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <line
            x1="-4"
            y1="3.2"
            x2="8"
            y2="3.2"
            className="stroke-current"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </g>
      </g>
    </>
  );
}

function ArtImpianti() {
  return (
    <>
      <g transform="translate(18 62)" strokeLinejoin="round">
        <path
          d="M8 62 L62 14 L116 62 V150 H8Z"
          className="fill-white/80 stroke-current dark:fill-white/5"
          strokeWidth="1.8"
        />
        <g transform="translate(22 28) rotate(-38 22 10)">
          <rect
            width="46"
            height="22"
            rx="1.5"
            className="fill-[#165B44]/25 stroke-current"
            strokeWidth="1.3"
          />
          <line x1="15.5" y1="0" x2="15.5" y2="22" className="stroke-current" strokeWidth="1" />
          <line x1="31" y1="0" x2="31" y2="22" className="stroke-current" strokeWidth="1" />
          <line x1="0" y1="11" x2="46" y2="11" className="stroke-current" strokeWidth="1" />
          <g transform="translate(38 4)">
            <g className="cer-panel-spark">
              <circle r="3.2" className="fill-[#F5D547]" />
            </g>
          </g>
        </g>
        <rect
          x="50"
          y="108"
          width="22"
          height="42"
          rx="2"
          className="fill-[#165B44]/12 stroke-current dark:fill-white/5"
          strokeWidth="1.4"
        />
        <rect
          x="82"
          y="88"
          width="18"
          height="16"
          rx="2"
          className="cer-who-window fill-[#F5D547] stroke-current"
          strokeWidth="1.2"
        />
      </g>
    </>
  );
}

function ArtCo2() {
  return (
    <>
      <g transform="translate(108 48)">
        <g className="cer-why-cloud">
          <path
            d="M8 28 H34 A12 12 0 0 0 34 8 A14 14 0 0 0 10 12 A10 10 0 0 0 8 28Z"
            className="fill-white/80 stroke-current dark:fill-white/5"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <line
            x1="6"
            y1="30"
            x2="38"
            y2="6"
            className="stroke-[#165B44]"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </g>
      </g>
      <g transform="translate(48 78)">
        <rect
          x="26"
          y="78"
          width="12"
          height="48"
          rx="2"
          className="fill-[#165B44]/35 stroke-current"
          strokeWidth="1.3"
        />
        <g className="cer-why-leaf">
          <circle cx="32" cy="62" r="28" className="fill-[#165B44]" />
          <circle cx="14" cy="78" r="18" className="fill-[#165B44]" />
          <circle cx="50" cy="76" r="18" className="fill-[#165B44]" />
          <circle cx="32" cy="48" r="16" className="fill-[#1d7a59]" />
        </g>
      </g>
    </>
  );
}

function ArtPod() {
  return (
    <>
      <g transform="translate(36 48)" strokeLinejoin="round">
        <rect
          width="88"
          height="128"
          rx="8"
          className="fill-white/80 stroke-current dark:fill-white/5"
          strokeWidth="1.8"
        />
        <rect
          x="16"
          y="18"
          width="56"
          height="28"
          rx="3"
          className="fill-[#165B44]/10 stroke-current dark:fill-white/5"
          strokeWidth="1.3"
        />
        <line x1="24" y1="28" x2="52" y2="28" className="stroke-current" strokeWidth="1.4" strokeLinecap="round" />
        <line x1="24" y1="36" x2="42" y2="36" className="stroke-[#165B44]" strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="44" cy="78" r="16" fill="none" className="stroke-current" strokeWidth="1.5" />
        <line
          x1="44"
          y1="78"
          x2="44"
          y2="68"
          className="stroke-current"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <line
          x1="44"
          y1="78"
          x2="52"
          y2="82"
          className="stroke-current"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
        <rect x="38" y="112" width="12" height="16" rx="1.5" className="fill-[#165B44]/20 stroke-current" strokeWidth="1.2" />
      </g>
      <g transform="translate(96 132)">
        <g className="cer-why-badge">
          <circle r="16" className="fill-[#165B44]" />
          <path
            d="M-7 1 L-2 6 L8 -5"
            fill="none"
            className="stroke-white"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      </g>
    </>
  );
}

function ArtDetrazioni() {
  return (
    <>
      <g transform="translate(36 52)" strokeLinejoin="round">
        <path
          d="M8 8 H62 L80 26 V148 H8Z"
          className="fill-white/80 stroke-current dark:fill-white/5"
          strokeWidth="1.7"
        />
        <path
          d="M62 8 V26 H80"
          fill="none"
          className="stroke-current"
          strokeWidth="1.4"
        />
        {[48, 64, 80, 96].map((y) => (
          <line
            key={y}
            x1="20"
            y1={y}
            x2={y === 96 ? 48 : 66}
            y2={y}
            className="stroke-current"
            strokeWidth="1.3"
            strokeLinecap="round"
            opacity="0.55"
          />
        ))}
      </g>
      <g transform="translate(108 148)">
        <g className="cer-why-badge">
          <circle r="22" className="fill-[#F5D547]" />
          <circle cx="-6" cy="-6" r="3.2" fill="none" className="stroke-current" strokeWidth="1.6" />
          <circle cx="6" cy="6" r="3.2" fill="none" className="stroke-current" strokeWidth="1.6" />
          <line
            x1="7"
            y1="-8"
            x2="-7"
            y2="8"
            className="stroke-current"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </g>
      </g>
    </>
  );
}

function ArtFornitore() {
  return (
    <>
      <g transform="translate(28 58)" strokeLinejoin="round">
        <rect
          x="8"
          y="8"
          width="52"
          height="64"
          rx="6"
          className="fill-white/80 stroke-current dark:fill-white/5"
          strokeWidth="1.7"
        />
        <rect x="22" y="24" width="8" height="16" rx="3" className="fill-[#165B44]/15 stroke-current" strokeWidth="1.3" />
        <rect x="38" y="24" width="8" height="16" rx="3" className="fill-[#165B44]/15 stroke-current" strokeWidth="1.3" />
        <path
          d="M18 72 H50 V96 H40 L34 108 L28 96 H18Z"
          className="fill-white/80 stroke-current dark:fill-white/5"
          strokeWidth="1.6"
        />
        <path
          d="M34 108 V156"
          fill="none"
          className="stroke-current"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </g>
      <g transform="translate(92 78)">
        <rect
          width="40"
          height="52"
          rx="3"
          className="fill-white/80 stroke-current dark:fill-white/5"
          strokeWidth="1.5"
        />
        <line x1="8" y1="14" x2="32" y2="14" className="stroke-current" strokeWidth="1.2" strokeLinecap="round" opacity="0.5" />
        <line x1="8" y1="22" x2="26" y2="22" className="stroke-current" strokeWidth="1.2" strokeLinecap="round" opacity="0.5" />
        <line x1="8" y1="30" x2="30" y2="30" className="stroke-current" strokeWidth="1.2" strokeLinecap="round" opacity="0.5" />
        <g transform="translate(28 40)">
          <g className="cer-why-badge">
            <circle r="10" className="fill-[#165B44]" />
            <path
              d="M-4 0.5 L-1.2 3.4 L4.2 -2.6"
              fill="none"
              className="stroke-white"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        </g>
      </g>
    </>
  );
}
