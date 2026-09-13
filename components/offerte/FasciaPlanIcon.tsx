import { DINAMICA_COLOR, FASCIA_COLOR, FASCIA_LEGEND_COLOR } from "@/lib/fasce";
import type { OfferteFasciaPlan } from "@/lib/offerte/metrics";

export function FasciaPlanIcon({ plan }: { plan: OfferteFasciaPlan }) {
  if (plan === "dinamica") {
    return (
      <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden>
        <rect x="1" y="10" width="2" height="4" rx="0.4" fill={DINAMICA_COLOR} />
        <rect x="4" y="6" width="2" height="8" rx="0.4" fill={DINAMICA_COLOR} />
        <rect x="7" y="3" width="2" height="11" rx="0.4" fill={DINAMICA_COLOR} />
        <rect x="10" y="7.5" width="2" height="6.5" rx="0.4" fill={DINAMICA_COLOR} />
        <rect x="13" y="5" width="2" height="9" rx="0.4" fill={DINAMICA_COLOR} />
      </svg>
    );
  }

  if (plan === "monoraria") {
    const color = FASCIA_LEGEND_COLOR.Fmonoraria;
    return (
      <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden>
        <rect x="2" y="8" width="12" height="6" fill={color} opacity="0.35" />
        <line
          x1="2"
          x2="14"
          y1="8"
          y2="8"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  if (plan === "bioraria") {
    return (
      <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden>
        <rect x="1" y="3" width="7" height="10" rx="1" fill={FASCIA_COLOR.F2} />
        <rect x="8" y="3" width="7" height="10" rx="1" fill={FASCIA_COLOR.F3} />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden>
      <rect x="1" y="2" width="4" height="12" rx="1" fill={FASCIA_COLOR.F3} />
      <rect x="6" y="2" width="4" height="12" rx="1" fill={FASCIA_COLOR.F2} />
      <rect x="11" y="2" width="4" height="12" rx="1" fill={FASCIA_COLOR.F1} />
    </svg>
  );
}

export function fasciaPlanLabel(plan: OfferteFasciaPlan) {
  if (plan === "dinamica") return "Dinamica";
  if (plan === "monoraria") return "Mono";
  if (plan === "bioraria") return "Bi";
  return "Tri";
}
