import type { ReactNode } from "react";
import { CerPodCta } from "@/components/cer/CerPodCta";

const CARDS: {
  title: string;
  body: string;
  art: () => ReactNode;
}[] = [
  {
    title: "Privati senza pannelli",
    body: "Entri come consumatore, senza cambiare fornitore.",
    art: ArtHouse,
  },
  {
    title: "Privati con i pannelli",
    body: "Usi la tua energia e condividi il surplus.",
    art: ArtHouseSolar,
  },
  {
    title: "Aziende con i pannelli",
    body: "L’impianto immette in comunità e prende l’incentivo.",
    art: ArtFactorySolar,
  },
  {
    title: "Aziende consumatrici",
    body: "Niente impianto: usi l’energia condivisa.",
    art: ArtFactory,
  },
  {
    title: "Una sola CER",
    body: "Non è possibile iscriversi a più di una.",
    art: ArtOneCer,
  },
];

export function CerWhoCanJoin() {
  return (
    <section className="mt-10 w-full sm:mt-12" aria-labelledby="cer-who-title">
      <h2
        id="cer-who-title"
        className="text-3xl font-bold tracking-tight sm:text-4xl"
      >
        Chi può iscriversi a una CER??
      </h2>
      <div className="cer-marquee cer-who-marquee mt-5">
        <div className="cer-marquee-track">
          <ul className="cer-marquee-set m-0 list-none pl-0">
            {CARDS.map((card) => (
              <WhoCard key={card.title} card={card} />
            ))}
          </ul>
          <ul className="cer-marquee-set m-0 list-none pl-0" aria-hidden>
            {CARDS.map((card) => (
              <WhoCard key={`${card.title}-loop`} card={card} />
            ))}
          </ul>
        </div>
      </div>
      <CerPodCta className="mt-3" />
    </section>
  );
}

function WhoCard({
  card,
}: {
  card: (typeof CARDS)[number];
}) {
  return (
    <li className="w-[9.75rem] shrink-0 sm:w-[10.25rem]">
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

function ArtHouse() {
  return (
    <>
      <Sky x={118} y={38} />
      <House x={28} y={58} />
      <Person x={64} y={148} />
    </>
  );
}

function ArtHouseSolar() {
  return (
    <>
      <Sky x={28} y={36} />
      <House x={28} y={58} />
      <SolarRoof x={42} y={68} />
      <g className="cer-day-energy">
        <circle cx="92" cy="82" r="3.2" className="cer-panel-spark fill-[#F5D547]" />
      </g>
    </>
  );
}

function ArtFactorySolar() {
  return (
    <>
      <Sky x={26} y={34} />
      <Factory x={18} y={78} solar />
    </>
  );
}

function ArtFactory() {
  return (
    <>
      <Sky x={128} y={36} />
      <Factory x={18} y={78} />
    </>
  );
}

function ArtOneCer() {
  return (
    <>
      <Sky x={80} y={30} />
      <g transform="translate(22 46)">
        <MiniHouse />
        <circle cx="44" cy="78" r="11" className="fill-[#F5D547]" />
        <path
          d="M39 78 l3.2 3.4 7-7"
          className="fill-none stroke-[#165B44]"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <g transform="translate(86 58)" opacity="0.42">
        <MiniHouse />
      </g>
      <g transform="translate(86 58)">
        <path
          d="M18 22 L70 86 M70 22 L18 86"
          className="stroke-current"
          strokeWidth="4"
          strokeLinecap="round"
        />
      </g>
    </>
  );
}

function Sky({ x, y }: { x: number; y: number }) {
  return (
    <>
      <g className="cer-day-sun" transform={`translate(${x} ${y})`}>
        <g className="cer-who-sun">
          <circle r="12" className="fill-[#F5D547]/18" />
          <circle r="7" className="fill-[#F5D547]" />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
            <line
              key={deg}
              y1="-11"
              y2="-15.5"
              className="stroke-[#F5D547]"
              strokeWidth="1.6"
              strokeLinecap="round"
              transform={`rotate(${deg})`}
            />
          ))}
        </g>
      </g>
      <g className="cer-night-moon">
        <g transform={`translate(${x} ${y})`}>
          <circle r="9" className="fill-current opacity-90" />
          <circle
            cx="4"
            cy="-3.5"
            r="9"
            className="fill-neutral-50 dark:fill-neutral-900"
          />
        </g>
        <circle cx="24" cy="28" r="1.1" className="fill-current" />
        <circle cx="138" cy="48" r="1.3" className="fill-current" />
        <circle cx="48" cy="22" r="0.9" className="fill-current" />
        <circle cx="118" cy="26" r="1" className="fill-current" />
      </g>
    </>
  );
}

function House({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`} strokeLinejoin="round">
      <path
        d="M6 58 L52 16 L98 58 V118 H6Z"
        className="fill-white/80 stroke-current dark:fill-white/5"
        strokeWidth="1.8"
      />
      <rect
        x="42"
        y="78"
        width="18"
        height="40"
        rx="2"
        className="fill-[#165B44]/12 stroke-current dark:fill-white/5"
        strokeWidth="1.4"
      />
      <rect
        x="68"
        y="70"
        width="16"
        height="15"
        rx="2"
        className="cer-who-night-glow fill-[#F5D547] stroke-current"
        strokeWidth="1.2"
      />
    </g>
  );
}

function SolarRoof({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(-18 36 18)`}>
      <path
        d="M0 10 L62 0 L74 32 L11 42Z"
        className="fill-[#165B44] stroke-[#F5D547]"
        strokeWidth="1.5"
      />
      <path
        d="M22 6 L32 38 M42 3 L52 35 M6 22 L68 12 M9 32 L71 22"
        className="fill-none stroke-[#F5D547]/75"
        strokeWidth="1"
      />
    </g>
  );
}

function Factory({
  x,
  y,
  solar = false,
}: {
  x: number;
  y: number;
  solar?: boolean;
}) {
  return (
    <g transform={`translate(${x} ${y})`} strokeLinejoin="round">
      <path
        d="M0 48 H86 V116 H0Z"
        className="fill-white/80 stroke-current dark:fill-white/5"
        strokeWidth="1.7"
      />
      <path
        d="M86 64 H124 V116 H86Z"
        className="fill-white/80 stroke-current dark:fill-white/5"
        strokeWidth="1.7"
      />
      <rect x="96" y="36" width="14" height="28" className="fill-[#165B44]/20 stroke-current" strokeWidth="1.3" />
      <path d="M93 36 h20 l-4 -12 h-12Z" className="fill-[#165B44]/25 stroke-current" strokeWidth="1.2" />
      {solar ? <RoofSolar /> : null}
      {[16, 36, 56].map((left) => (
        <rect
          key={left}
          x={left}
          y="64"
          width="14"
          height="12"
          rx="1.5"
          className="cer-who-night-glow fill-[#F5D547] stroke-current"
          strokeWidth="1"
        />
      ))}
      <rect
        x="96"
        y="78"
        width="14"
        height="12"
        rx="1.5"
        className="cer-who-night-glow fill-[#F5D547] stroke-current"
        strokeWidth="1"
      />
      <rect
        x="18"
        y="88"
        width="22"
        height="28"
        rx="2"
        className="fill-[#165B44]/12 stroke-current dark:fill-white/5"
        strokeWidth="1.3"
      />
    </g>
  );
}

function RoofSolar() {
  return (
    <g>
      <path
        d="M8 48 L80 48 L74 36 L14 36Z"
        className="fill-[#165B44] stroke-[#F5D547]"
        strokeWidth="1.4"
      />
      <path
        d="M21 48 L26 36 M40 48 L44 36 M59 48 L62 36 M8 42 H77"
        className="fill-none stroke-[#F5D547]/75"
        strokeWidth="1"
      />
      <g className="cer-day-energy">
        <circle cx="46" cy="41" r="3" className="cer-panel-spark fill-[#F5D547]" />
      </g>
    </g>
  );
}

function MiniHouse() {
  return (
    <g strokeLinejoin="round">
      <path
        d="M8 52 L44 18 L80 52 V96 H8Z"
        className="fill-white/80 stroke-current dark:fill-white/5"
        strokeWidth="1.7"
      />
      <rect
        x="36"
        y="64"
        width="14"
        height="32"
        rx="1.5"
        className="fill-[#165B44]/12 stroke-current dark:fill-white/5"
        strokeWidth="1.2"
      />
      <rect
        x="56"
        y="58"
        width="12"
        height="12"
        rx="1.5"
        className="cer-who-night-glow fill-[#F5D547] stroke-current"
        strokeWidth="1"
      />
    </g>
  );
}

function Person({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`} className="stroke-current" fill="none">
      <circle cx="16" cy="8" r="7" className="fill-white/80 dark:fill-white/5" strokeWidth="1.6" />
      <path d="M16 16 v8 M8 42 L16 24 L24 42 M6 28 H26" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  );
}
