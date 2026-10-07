export type CerRoleFlowKind = "consumatore" | "produttore" | "prosumatore";

const KIND_LABEL: Record<CerRoleFlowKind, string> = {
  consumatore: "Consumatore: preleva energia dalla rete",
  produttore: "Produttore: immette energia in rete",
  prosumatore: "Prosumatore: produce e consuma",
};

export function CerRoleFlowIcon({
  kind,
  className = "h-14 w-14 sm:h-16 sm:w-16",
}: {
  kind: CerRoleFlowKind;
  className?: string;
}) {
  return (
    <span
      className={`inline-block shrink-0 overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 ${className}`}
      aria-hidden
      title={KIND_LABEL[kind]}
    >
      <svg
        viewBox="0 0 88 88"
        className="block h-full w-full text-foreground"
      >
        {kind === "consumatore" ? (
          <ArtConsumatore />
        ) : kind === "produttore" ? (
          <ArtProduttore />
        ) : (
          <ArtProsumatore />
        )}
      </svg>
    </span>
  );
}

function ArtConsumatore() {
  return (
    <>
      <House x={4} y={14} lit />
      <EnergyIn />
    </>
  );
}

function ArtProduttore() {
  return (
    <>
      <Sun x={18} y={16} />
      <House x={6} y={16} />
      <Panel x={36} y={18} />
      <EnergyOut />
    </>
  );
}

function ArtProsumatore() {
  return (
    <>
      <Sun x={16} y={15} />
      <House x={5} y={15} lit />
      <Panel x={35} y={17} />
      <EnergyOut />
      <EnergyIn />
    </>
  );
}

function Sun({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <g className="cer-who-sun">
        <circle r="9" className="fill-[#F5D547]/18" />
        <circle r="5" className="fill-[#F5D547]" />
        {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
          <line
            key={deg}
            y1="-8"
            y2="-11.5"
            className="stroke-[#F5D547]"
            strokeWidth="1.5"
            strokeLinecap="round"
            transform={`rotate(${deg})`}
          />
        ))}
      </g>
    </g>
  );
}

function House({
  x,
  y,
  lit = false,
}: {
  x: number;
  y: number;
  lit?: boolean;
}) {
  return (
    <g transform={`translate(${x} ${y})`} strokeLinejoin="round">
      <path
        d="M6 42 L38 12 L70 42 V74 H6Z"
        className="fill-white/80 stroke-current dark:fill-white/5"
        strokeWidth="1.7"
      />
      <rect
        x="30"
        y="50"
        width="13"
        height="24"
        rx="1.5"
        className="fill-[#165B44]/12 stroke-current dark:fill-white/5"
        strokeWidth="1.3"
      />
      <rect
        x="50"
        y="44"
        width="12"
        height="11"
        rx="1.5"
        className={
          lit
            ? "cer-who-window fill-[#F5D547] stroke-current"
            : "fill-[#165B44]/10 stroke-current dark:fill-white/5"
        }
        strokeWidth="1.15"
      />
    </g>
  );
}

function Panel({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(-9 16 10)`}>
      <path
        d="M0 5 L28 0 L33 18 L5 22Z"
        className="fill-[#165B44] stroke-[#F5D547]"
        strokeWidth="1.3"
      />
      <path
        d="M10 3 L14 20 M20 2 L24 19 M3 11 L30 6 M4 16 L31 11"
        className="fill-none stroke-[#F5D547]/75"
        strokeWidth="0.85"
      />
      <g className="cer-panel-spark" transform="translate(34 8)">
        <circle r="3.2" className="fill-[#F5D547]/25" />
        <circle r="1.7" className="fill-[#F5D547]" />
      </g>
    </g>
  );
}

function EnergyIn() {
  return (
    <g>
      <path
        d="M84 52 C72 52 66 54 60 56"
        className="cer-energy-line"
        strokeWidth="1.6"
      />
      <g transform="translate(82 52)">
        <g className="cer-role-dot-in">
          <Dot />
        </g>
      </g>
      <g transform="translate(82 52)">
        <g className="cer-role-dot-in cer-role-dot-b">
          <Dot />
        </g>
      </g>
    </g>
  );
}

function EnergyOut() {
  return (
    <g>
      <path
        d="M58 26 C68 24 76 30 84 34"
        className="cer-energy-line"
        strokeWidth="1.6"
      />
      <g transform="translate(58 26)">
        <g className="cer-role-dot-out">
          <Dot />
        </g>
      </g>
      <g transform="translate(58 26)">
        <g className="cer-role-dot-out cer-role-dot-b">
          <Dot />
        </g>
      </g>
    </g>
  );
}

function Dot() {
  return (
    <>
      <circle r="4" className="fill-[#F5D547]/25" />
      <circle r="2" className="fill-[#F5D547]" />
    </>
  );
}
