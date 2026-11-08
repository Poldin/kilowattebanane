const PALETTE = [
  { bg: "#e8f0ea", fg: "#165B44", accent: "#2d8a66" },
  { bg: "#f3ebe3", fg: "#6b4f3a", accent: "#a67c52" },
  { bg: "#e6eef5", fg: "#2a4a6b", accent: "#4a7aa8" },
  { bg: "#f0ebe8", fg: "#4a4038", accent: "#8a7560" },
  { bg: "#eaf2ee", fg: "#1f4d38", accent: "#3d9970" },
] as const;

function paletteFor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash + id.charCodeAt(i) * (i + 1)) % PALETTE.length;
  }
  return PALETTE[hash]!;
}

export function DonorPortrait({
  donorId,
  size = "md",
  className = "",
}: {
  donorId: string;
  size?: "sm" | "md" | "lg" | "hero";
  className?: string;
}) {
  const { bg, fg, accent } = paletteFor(donorId);
  const dim =
    size === "hero"
      ? "h-40 w-40 sm:h-48 sm:w-48"
      : size === "lg"
        ? "h-24 w-24 sm:h-28 sm:w-28"
        : size === "sm"
          ? "h-14 w-14"
          : "h-20 w-20";

  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-xl ${dim}${className ? ` ${className}` : ""}`}
      aria-hidden
    >
      <svg viewBox="0 0 160 160" className="h-full w-full">
        <rect width="160" height="160" fill={bg} />
        <circle cx="80" cy="58" r="28" fill={accent} opacity="0.35" />
        <ellipse cx="80" cy="118" rx="44" ry="36" fill={accent} opacity="0.25" />
        <circle cx="80" cy="56" r="22" fill={fg} />
        <path
          d="M48 132c6-18 20-28 32-28s26 10 32 28"
          fill={fg}
          opacity="0.85"
        />
        <PortraitMotif id={donorId} fg={fg} accent={accent} />
      </svg>
    </div>
  );
}

function PortraitMotif({
  id,
  fg,
  accent,
}: {
  id: string;
  fg: string;
  accent: string;
}) {
  switch (id) {
    case "beretta":
      return (
        <g>
          <ellipse cx="80" cy="38" rx="26" ry="8" fill={accent} opacity="0.5" />
          <rect x="62" y="88" width="36" height="14" rx="4" fill={accent} />
        </g>
      );
    case "giulia":
      return (
        <path
          d="M58 48c8-12 36-12 44 0"
          stroke={accent}
          strokeWidth="4"
          fill="none"
          strokeLinecap="round"
        />
      );
    case "neri":
      return (
        <g stroke={accent} strokeWidth="3" fill="none">
          <circle cx="68" cy="54" r="8" />
          <circle cx="92" cy="54" r="8" />
          <path d="M64 54h32" />
        </g>
      );
    case "marco":
      return (
        <rect x="70" y="78" width="20" height="28" rx="2" fill={accent} opacity="0.6" />
      );
    case "anna":
      return (
        <g fill={accent} opacity="0.55">
          <circle cx="68" cy="52" r="10" />
          <circle cx="92" cy="52" r="10" />
        </g>
      );
    case "sole":
      return (
        <g stroke={accent} strokeWidth="2">
          <circle cx="80" cy="28" r="6" fill={accent} stroke="none" />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
            <line
              key={deg}
              x1="80"
              y1="28"
              x2={80 + 14 * Math.cos((deg * Math.PI) / 180)}
              y2={28 + 14 * Math.sin((deg * Math.PI) / 180)}
            />
          ))}
        </g>
      );
    case "porto":
      return (
        <path d="M50 100h60l-8 20H58z" fill={accent} opacity="0.5" />
      );
    case "conte":
      return (
        <ellipse cx="80" cy="105" rx="30" ry="8" fill={accent} opacity="0.45" />
      );
    case "bar":
      return (
        <rect x="64" y="92" width="32" height="10" rx="5" fill={accent} opacity="0.55" />
      );
    case "fontana":
      return (
        <g fill={accent} opacity="0.45">
          <rect x="55" y="95" width="8" height="22" />
          <rect x="76" y="88" width="8" height="29" />
          <rect x="97" y="95" width="8" height="22" />
        </g>
      );
    case "frantoio":
      return (
        <ellipse cx="80" cy="100" rx="18" ry="22" fill={accent} opacity="0.4" />
      );
    case "preview":
      return (
        <text
          x="80"
          y="90"
          textAnchor="middle"
          fontSize="28"
          fill={fg}
          opacity="0.35"
          fontFamily="system-ui,sans-serif"
        >
          ?
        </text>
      );
    default:
      return (
        <circle cx="80" cy="100" r="6" fill={fg} opacity="0.2" />
      );
  }
}
