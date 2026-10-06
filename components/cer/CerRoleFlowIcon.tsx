"use client";

import { ArrowRight, Minus, SeparatorVertical } from "lucide-react";

export type CerRoleFlowKind = "consumatore" | "produttore" | "prosumatore";

const KIND_LABEL: Record<CerRoleFlowKind, string> = {
  consumatore: "Consumatore: energia in entrata",
  produttore: "Produttore: energia in uscita",
  prosumatore: "Prosumatore: produce e consuma",
};

function RoleGlyphs({ kind }: { kind: CerRoleFlowKind }) {
  if (kind === "produttore") {
    return <ArrowRight className="h-[1em] w-[1em]" strokeWidth={2.25} />;
  }

  if (kind === "consumatore") {
    return (
      <>
        <Minus className="-mr-1.5 h-[1em] w-[1.15em]" strokeWidth={2.25} />
        <SeparatorVertical className="h-[1em] w-[0.5em]" strokeWidth={2.5} />
      </>
    );
  }

  return (
    <>
      <ArrowRight className="-mr-1.5 h-[1em] w-[1em]" strokeWidth={2.25} />
      <Minus className="-mr-1.5 h-[1em] w-[0.9em]" strokeWidth={2.25} />
      <SeparatorVertical className="h-[1em] w-[0.5em]" strokeWidth={2.5} />
    </>
  );
}

export function CerRoleFlowIcon({
  kind,
  className = "h-7 sm:h-8",
}: {
  kind: CerRoleFlowKind;
  className?: string;
}) {
  return (
    <span
      className={`cer-role-flow-icon ${className ?? ""}`}
      aria-hidden
      title={KIND_LABEL[kind]}
    >
      <span className="cer-role-flow-track cer-role-flow-base">
        <RoleGlyphs kind={kind} />
      </span>
      <span className="cer-role-flow-track cer-role-flow-sweep" aria-hidden>
        <RoleGlyphs kind={kind} />
      </span>
    </span>
  );
}
