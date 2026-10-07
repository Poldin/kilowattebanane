import type { ReactNode } from "react";
import { CerPodCta } from "@/components/cer/CerPodCta";

const CARDS: {
  title: string;
  body: string;
  art: () => ReactNode;
}[] = [
  {
    title: "Privati",
    body: "Casa, famiglia o persona fisica.",
    art: ArtPrivati,
  },
  {
    title: "Aziende",
    body: "Impresa, attività o società.",
    art: ArtAziende,
  },
  {
    title: "Enti no profit",
    body: "Associazioni, cooperative e fondazioni.",
    art: ArtNonprofit,
  },
  {
    title: "Pubbliche amministrazioni",
    body: "Comuni, scuole ed enti pubblici.",
    art: ArtPubblica,
  },
];

export function CerWhoCanJoin() {
  return (
    <section className="mt-10 w-full sm:mt-12" aria-labelledby="cer-who-title">
      <h2
        id="cer-who-title"
        className="text-3xl font-bold tracking-tight sm:text-4xl"
      >
        Chi può iscriversi a una CER?
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

function ArtPrivati() {
  return (
    <>
      <Sun x={28} y={36} />
      <House x={18} y={58} />
      <Person x={112} y={146} wave />
    </>
  );
}

function ArtAziende() {
  return (
    <>
      <Sun x={128} y={32} />
      <Factory x={16} y={44} />
    </>
  );
}

function ArtNonprofit() {
  return (
    <>
      <Sun x={26} y={34} />
      <g transform="translate(22 52)" strokeLinejoin="round">
        <path
          d="M8 64 L58 22 L108 64 V128 H8Z"
          className="fill-white/80 stroke-current dark:fill-white/5"
          strokeWidth="1.8"
        />
        <rect
          x="48"
          y="88"
          width="20"
          height="40"
          rx="2"
          className="fill-[#165B44]/12 stroke-current dark:fill-white/5"
          strokeWidth="1.4"
        />
        <rect
          x="20"
          y="78"
          width="16"
          height="14"
          rx="2"
          className="fill-[#F5D547]/70 stroke-current"
          strokeWidth="1.1"
        />
        <rect
          x="80"
          y="78"
          width="16"
          height="14"
          rx="2"
          className="fill-[#F5D547]/70 stroke-current"
          strokeWidth="1.1"
        />
        <g transform="translate(49 48)">
          <g className="cer-who-heart">
            <path
              d="M10 6 C10 2 14 0 18 4 C22 0 26 2 26 6 C26 12 18 18 18 18 C18 18 10 12 10 6Z"
              className="fill-[#165B44] stroke-[#165B44]"
              strokeWidth="1"
            />
          </g>
        </g>
      </g>
      <g className="cer-who-gather-l">
        <Person x={28} y={158} />
      </g>
      <g className="cer-who-gather-r">
        <Person x={96} y={158} />
      </g>
    </>
  );
}

function ArtPubblica() {
  return (
    <>
      <Sun x={26} y={32} />
      <g transform="translate(18 54)" strokeLinejoin="round">
        <path
          d="M8 78 H116 V138 H8Z"
          className="fill-white/80 stroke-current dark:fill-white/5"
          strokeWidth="1.7"
        />
        <path
          d="M44 28 H80 V78 H44Z"
          className="fill-white/80 stroke-current dark:fill-white/5"
          strokeWidth="1.7"
        />
        <path
          d="M40 28 L62 8 L84 28Z"
          className="fill-[#165B44]/18 stroke-current"
          strokeWidth="1.5"
        />
        <rect
          x="54"
          y="38"
          width="16"
          height="16"
          rx="8"
          className="fill-white stroke-current dark:fill-white/5"
          strokeWidth="1.2"
        />
        <g transform="translate(62 46)">
          <g className="cer-who-clock-h">
            <line
              x1="0"
              y1="0"
              x2="0"
              y2="-5"
              className="stroke-current"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </g>
          <g className="cer-who-clock-m">
            <line
              x1="0"
              y1="0"
              x2="4.5"
              y2="0"
              className="stroke-current"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
          </g>
        </g>
        <line
          x1="86"
          y1="8"
          x2="86"
          y2="-10"
          className="stroke-current"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <g transform="translate(86 -10)">
          <g className="cer-who-flag">
            <path
              d="M0 0 H22 L18 7 H0Z"
              className="fill-[#165B44] stroke-[#165B44]"
              strokeWidth="0.8"
            />
            <path d="M0 7 H18 L22 14 H0Z" className="fill-[#F5D547] stroke-[#F5D547]" strokeWidth="0.8" />
          </g>
        </g>
        {[18, 38, 86, 106].map((left) => (
          <rect
            key={left}
            x={left}
            y="90"
            width="12"
            height="14"
            rx="1.5"
            className="fill-[#F5D547]/80 stroke-current"
            strokeWidth="1"
          />
        ))}
        <rect
          x="52"
          y="108"
          width="20"
          height="30"
          rx="2"
          className="fill-[#165B44]/12 stroke-current dark:fill-white/5"
          strokeWidth="1.3"
        />
      </g>
    </>
  );
}

function Sun({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
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
        className="cer-who-window fill-[#F5D547] stroke-current"
        strokeWidth="1.2"
      />
    </g>
  );
}

function Factory({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`} strokeLinejoin="round">
      <g transform="translate(103 20)">
        <g className="cer-who-smoke">
          <ellipse cx="0" cy="0" rx="10" ry="6" className="fill-current" />
        </g>
      </g>
      <g transform="translate(111 10)">
        <g className="cer-who-smoke cer-who-smoke-b">
          <ellipse cx="0" cy="0" rx="8" ry="5" className="fill-current" />
        </g>
      </g>
      <g transform="translate(95 6)">
        <g className="cer-who-smoke cer-who-smoke-c">
          <ellipse cx="0" cy="0" rx="7" ry="4.5" className="fill-current" />
        </g>
      </g>
      <path
        d="M0 48 H86 V148 H0Z"
        className="fill-white/80 stroke-current dark:fill-white/5"
        strokeWidth="1.7"
      />
      <path
        d="M86 64 H128 V148 H86Z"
        className="fill-white/80 stroke-current dark:fill-white/5"
        strokeWidth="1.7"
      />
      <rect x="96" y="28" width="14" height="36" className="fill-[#165B44]/20 stroke-current" strokeWidth="1.3" />
      <path d="M93 28 h20 l-4 -12 h-12Z" className="fill-[#165B44]/25 stroke-current" strokeWidth="1.2" />
      {[16, 36, 56].map((left) => (
        <rect
          key={left}
          x={left}
          y="68"
          width="14"
          height="12"
          rx="1.5"
          className="fill-[#F5D547] stroke-current"
          strokeWidth="1"
        />
      ))}
      <rect
        x="98"
        y="82"
        width="14"
        height="12"
        rx="1.5"
        className="fill-[#F5D547] stroke-current"
        strokeWidth="1"
      />
      <rect
        x="18"
        y="112"
        width="22"
        height="36"
        rx="2"
        className="fill-[#165B44]/12 stroke-current dark:fill-white/5"
        strokeWidth="1.3"
      />
    </g>
  );
}

function Person({
  x,
  y,
  wave = false,
}: {
  x: number;
  y: number;
  wave?: boolean;
}) {
  return (
    <g transform={`translate(${x} ${y})`} className="stroke-current" fill="none">
      <circle cx="16" cy="8" r="7" className="fill-white/80 dark:fill-white/5" strokeWidth="1.6" />
      <path
        d="M16 16 v8 M8 42 L16 24 L24 42"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {wave ? (
        <>
          <path d="M16 24 L27 34" strokeWidth="1.7" strokeLinecap="round" />
          <g transform="translate(16 22)">
            <g className="cer-who-wave">
              <path
                d="M0 0 L-7 -13 L-1 -17"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
          </g>
        </>
      ) : (
        <path d="M6 28 H26" strokeWidth="1.7" strokeLinecap="round" />
      )}
    </g>
  );
}
