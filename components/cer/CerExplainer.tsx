import { CerPodCta } from "@/components/cer/CerPodCta";
import { CerRoleFlowIcon, type CerRoleFlowKind } from "@/components/cer/CerRoleFlowIcon";

const DEFINITIONS: {
  title: string;
  body: string;
  flowKind: CerRoleFlowKind;
}[] = [
  {
    title: "Consumatore",
    flowKind: "consumatore",
    body: "Preleva energia dalla rete. In una CER riceve una quota dell’energia condivisa e l’incentivo, senza dover installare pannelli o cambiare fornitore.",
  },
  {
    title: "Produttore",
    flowKind: "produttore",
    body: "Ha un impianto rinnovabile e immette energia in rete, nella stessa cabina primaria degli altri membri. Riceve incentivi se l'energia che immette viene consumata dalla CER.",
  },
  {
    title: "Prosumatore",
    flowKind: "prosumatore",
    body: "Produce e consuma: usa prima l’energia dei propri pannelli e condivide il surplus con la comunità. È produttore e consumatore insieme.",
  },
];

export function CerExplainer() {
  return (
    <section className="mt-14 sm:mt-16" aria-label="Ruoli in una comunità energetica">
      <dl className="flex flex-col gap-8">
        {DEFINITIONS.map((item) => (
          <div key={item.title}>
            <dt className="flex items-center gap-3 text-3xl font-bold tracking-tight sm:gap-3.5 sm:text-4xl">
              <span>{item.title}</span>
              <CerRoleFlowIcon kind={item.flowKind} className="mt-1 h-7 sm:h-8" />
            </dt>
            <dd className="mt-1.5 max-w-xl text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
              {item.body}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-10 max-w-xl text-pretty text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
        L’energia condivisa esiste solo se viene usata nello stesso momento in cui viene
        prodotta. I pannelli lavorano di giorno: è allora che conviene accendere lavatrice,
        lavastoviglie o caricare l’auto. Più i consumi coincidono con il sole, più incentivo
        riceve la comunità.
      </p>
      <CerPodCta className="mt-3" />
    </section>
  );
}

export function CerSchema() {
  return (
    <div className="mt-5 w-full sm:mt-6">
      <div
        className="cer-schema relative overflow-hidden py-1 sm:py-2"
        role="img"
        aria-label="Schema di una comunità energetica: dal pannello solare del produttore l’energia passa per la cabina primaria e arriva ai consumatori."
      >
        <svg
          viewBox="0 0 760 322"
          className="mx-auto h-auto w-full max-w-184 text-foreground"
        >
          <title>
            L’energia parte dal pannello solare del produttore, passa dalla cabina primaria e arriva ai consumatori
          </title>
          <defs>
            <filter id="cer-glow" x="-300%" y="-300%" width="700%" height="700%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <g className="cer-day-sun">
            <g className="cer-sun">
              <circle cx="102" cy="61" r="23" className="fill-[#F5D547]/15" />
              <circle cx="102" cy="61" r="10" className="fill-[#F5D547]" />
              {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
                <line
                  key={deg}
                  x1="102"
                  y1="43"
                  x2="102"
                  y2="34"
                  className="stroke-[#F5D547]"
                  strokeWidth="2"
                  strokeLinecap="round"
                  transform={`rotate(${deg} 102 61)`}
                />
              ))}
            </g>
          </g>
          <g className="cer-night-moon">
            <circle cx="102" cy="61" r="16" className="fill-current opacity-90" />
            <circle cx="109" cy="55" r="16" className="fill-background" />
            <circle cx="75" cy="49" r="1.5" className="fill-current" />
            <circle cx="133" cy="42" r="1.2" className="fill-current" />
            <circle cx="126" cy="79" r="1.7" className="fill-current" />
            <circle cx="81" cy="84" r="1" className="fill-current" />
          </g>

          <g className="cer-day-energy">
            <path id="cer-energy-in" d="M178 185 C232 185 258 188 317 189" className="cer-energy-track" />
            <path id="cer-energy-out-1" d="M410 188 C460 178 493 146 534 139" className="cer-energy-track" />
            <path id="cer-energy-out-2" d="M410 190 C482 192 522 185 578 181" className="cer-energy-track" />
            <path id="cer-energy-out-3" d="M410 193 C486 211 562 222 644 215" className="cer-energy-track" />

            <path d="M178 185 C232 185 258 188 317 189" className="cer-energy-line" />
            <path d="M410 188 C460 178 493 146 534 139" className="cer-energy-line" />
            <path d="M410 190 C482 192 522 185 578 181" className="cer-energy-line" />
            <path d="M410 193 C486 211 562 222 644 215" className="cer-energy-line" />

            <EnergyPulse path="cer-energy-in" begin="0s" />
            <EnergyPulse path="cer-energy-in" begin="-1.3s" />
            <EnergyPulse path="cer-energy-out-1" begin="-.2s" />
            <EnergyPulse path="cer-energy-out-2" begin="-1s" />
            <EnergyPulse path="cer-energy-out-3" begin="-1.8s" />
          </g>

          <g>
            <House x={65} y={130} />
            <SolarPanel x={83} y={137} />
            <g className="cer-day-energy">
              <g className="cer-panel-spark" filter="url(#cer-glow)">
                <circle cx="145" cy="155" r="3.5" className="fill-[#F5D547]" />
              </g>
            </g>
            <Label x={121} title="Produttore" />
          </g>

          <g className="cer-hub">
            <circle cx="364" cy="190" r="67" className="fill-[#165B44]/6 stroke-[#165B44]/10 dark:fill-[#F5D547]/5 dark:stroke-[#F5D547]/10" />
            <Cabina x={324} y={133} />
            <g className="cer-day-energy">
              <circle cx="364" cy="190" r="54" className="cer-hub-ring fill-none stroke-[#165B44]/25 dark:stroke-[#F5D547]/25" />
              <circle cx="364" cy="190" r="5" className="cer-hub-core fill-[#F5D547]" filter="url(#cer-glow)" />
            </g>
            <Label x={364} title="Cabina primaria" />
          </g>

          <g className="cer-community">
            <CommunityHouse x={510} y={103} delay="0s" />
            <CommunityHouse x={555} y={146} delay=".45s" />
            <CommunityHouse x={620} y={177} delay=".9s" />
            <Label x={594} title="Consumatore" />
          </g>

        </svg>
      </div>
      <p className="mt-5 max-w-2xl text-pretty text-base leading-relaxed text-neutral-600 sm:text-lg dark:text-neutral-400">
        Una comunità energetica rinnovabile (CER) è un gruppo di persone e imprese
        collegate alla stessa cabina primaria. L'UE <FlagEu /> e lo Stato Italiano{" "}
        <FlagIt /> incentivano il l'energia prodotta e consumata nella CER.
      </p>
      <p className="mt-3 max-w-2xl text-pretty text-xl font-bold tracking-tight text-foreground sm:text-2xl">
        se consumi o produci energia all&apos;interno di una CER ti vengono dati soldi💰{" "}
        <CerPodCta className="align-baseline" />
      </p>
      <p className="mt-3 max-w-2xl text-pretty text-base leading-relaxed text-neutral-600 sm:text-lg dark:text-neutral-400">
        per iscriverti a una CER non devi cambiare fornitore di energia ne pagare:
        devi solo capire a quale CER puoi iscriverti con il tuo POD. Scopri qual' è la tua cabina primaria 👇👇👇
      </p>
    </div>
  );
}

function FlagEu() {
  const stars = Array.from({ length: 12 }, (_, i) => {
    const angle = ((i * 30 - 90) * Math.PI) / 180;
    return { x: 15 + Math.cos(angle) * 5.4, y: 10 + Math.sin(angle) * 5.4 };
  });

  return (
    <svg
      aria-hidden
      viewBox="0 0 30 20"
      className="mb-px inline-block h-[0.85em] w-[1.275em] overflow-hidden rounded-xs align-baseline ring-1 ring-black/12 dark:ring-white/20"
    >
      <rect width="30" height="20" fill="#003399" />
      {stars.map((star) => (
        <polygon
          key={`${star.x}-${star.y}`}
          fill="#FFCC00"
          points={starPoints(star.x, star.y, 1.35)}
        />
      ))}
    </svg>
  );
}

function FlagIt() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 30 20"
      className="mb-px inline-block h-[0.85em] w-[1.275em] overflow-hidden rounded-xs align-baseline ring-1 ring-black/12 dark:ring-white/20"
    >
      <rect width="10" height="20" fill="#009246" />
      <rect x="10" width="10" height="20" fill="#fff" />
      <rect x="20" width="10" height="20" fill="#CE2B37" />
    </svg>
  );
}

function starPoints(cx: number, cy: number, r: number) {
  return Array.from({ length: 10 }, (_, i) => {
    const angle = ((i * 36 - 90) * Math.PI) / 180;
    const radius = i % 2 === 0 ? r : r * 0.4;
    return `${cx + Math.cos(angle) * radius},${cy + Math.sin(angle) * radius}`;
  }).join(" ");
}

function EnergyPulse({
  path,
  begin = "0s",
}: {
  path: string;
  begin?: string;
}) {
  return (
    <g className="cer-energy-dot" filter="url(#cer-glow)">
      <circle r="8" className="fill-[#F5D547]/20" />
      <circle r="3.5" className="fill-[#F5D547]">
        <animate attributeName="r" values="3;4.5;3" dur="1.2s" repeatCount="indefinite" />
      </circle>
      <animateMotion dur="2.7s" begin={begin} repeatCount="indefinite" calcMode="spline" keyTimes="0;1" keySplines=".4 0 .2 1">
        <mpath href={`#${path}`} />
      </animateMotion>
    </g>
  );
}

function Label({ x, title }: { x: number; title: string }) {
  return (
    <text x={x} y="278" textAnchor="middle" className="fill-current text-[13px] font-bold">
      {title}
    </text>
  );
}

function House({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`} strokeLinejoin="round">
      <path d="M5 45 L56 7 L107 45 V105 H5Z" className="fill-white/70 stroke-current dark:fill-white/5" strokeWidth="1.7" />
      <rect x="46" y="67" width="20" height="38" rx="2" className="fill-[#165B44]/12 stroke-current dark:fill-white/5" strokeWidth="1.4" />
      <rect x="76" y="57" width="17" height="16" rx="2" className="cer-consumer-light fill-[#F5D547]/75 stroke-current" strokeWidth="1.2" />
    </g>
  );
}

function SolarPanel({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(-8 35 20)`}>
      <path d="M0 8 L58 0 L70 35 L11 43Z" className="fill-[#165B44] stroke-[#F5D547]" strokeWidth="1.5" />
      <path d="M20 5 L30 40 M40 3 L50 37 M5 20 L64 12 M8 32 L67 24" className="fill-none stroke-[#F5D547]/75" strokeWidth="1" />
    </g>
  );
}

function Cabina({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`} fill="none" stroke="currentColor" strokeLinejoin="round">
      <path d="M5 35 H75 V93 H5Z" className="fill-[#f7f4e8] dark:fill-[#101713]" strokeWidth="1.7" />
      <path d="M1 35 H79 L68 20 H12Z" strokeWidth="1.7" />
      <rect x="29" y="57" width="22" height="36" rx="2" className="fill-[#165B44]/10" strokeWidth="1.4" />
      <path d="M20 20 V7 M60 20 V7" strokeWidth="1.4" />
      <circle cx="20" cy="5" r="4" className="fill-[#F5D547] stroke-[#165B44] dark:stroke-[#F5D547]" strokeWidth="1.2" />
      <circle cx="60" cy="5" r="4" className="fill-[#F5D547] stroke-[#165B44] dark:stroke-[#F5D547]" strokeWidth="1.2" />
    </g>
  );
}

function CommunityHouse({ x, y, delay }: { x: number; y: number; delay: string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d="M0 24 L25 5 L50 24 V57 H0Z" className="fill-white/65 stroke-current dark:fill-white/5" strokeWidth="1.5" strokeLinejoin="round" />
      <rect x="20" y="37" width="11" height="20" rx="1.5" className="fill-[#165B44]/10 stroke-current" strokeWidth="1" />
      <rect x="7" y="30" width="9" height="9" rx="1.5" className="cer-consumer-window fill-[#F5D547] stroke-current" style={{ animationDelay: delay }} strokeWidth=".8" />
      <circle cx="25" cy="5" r="3" className="cer-house-signal fill-[#F5D547]" style={{ animationDelay: delay }} />
    </g>
  );
}
