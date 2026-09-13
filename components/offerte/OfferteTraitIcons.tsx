import type { ReactNode } from "react";
import type { OfferteCliente, OfferteMercato, OffertePrezzo } from "@/lib/offerte/public-types";

const ICON = "h-3.5 w-3.5 shrink-0";

function StrokeIcon({
  className = ICON,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden fill="none">
      {children}
    </svg>
  );
}

function CasaIcon({ className = ICON }: { className?: string }) {
  return (
    <StrokeIcon className={className}>
      <path
        d="M3 7.5 8 3.5l5 4V13H10v-3.5H6V13H3V7.5Z"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinejoin="round"
      />
    </StrokeIcon>
  );
}

function BuildingIcon({ className = ICON }: { className?: string }) {
  return (
    <StrokeIcon className={className}>
      <rect
        x="4"
        y="2.5"
        width="8"
        height="11"
        rx="0.75"
        stroke="currentColor"
        strokeWidth="1.35"
      />
      <path
        d="M6.25 5.25h1.1M8.45 5.25h1.1M10.65 5.25h1.1M6.25 7.75h1.1M8.45 7.75h1.1M10.65 7.75h1.1M6.25 10.25h1.1M8.45 10.25h1.1M10.65 10.25h1.1"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
      <path
        d="M7.25 12.75h1.5"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
    </StrokeIcon>
  );
}

function TuttiIcon({ className = ICON }: { className?: string }) {
  return (
    <StrokeIcon className={className}>
      <rect x="2.5" y="2.5" width="4.5" height="4.5" rx="0.75" stroke="currentColor" strokeWidth="1.25" />
      <rect x="9" y="2.5" width="4.5" height="4.5" rx="0.75" stroke="currentColor" strokeWidth="1.25" />
      <rect x="2.5" y="9" width="4.5" height="4.5" rx="0.75" stroke="currentColor" strokeWidth="1.25" />
      <rect x="9" y="9" width="4.5" height="4.5" rx="0.75" stroke="currentColor" strokeWidth="1.25" />
    </StrokeIcon>
  );
}

function PlacetIcon({ className = ICON }: { className?: string }) {
  return (
    <StrokeIcon className={className}>
      <path
        d="M8 2.5 12.5 4.5V8c0 2.4-1.8 4.6-4.5 5.5C5.3 12.6 3.5 10.4 3.5 8V4.5L8 2.5Z"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinejoin="round"
      />
      <path d="M6.2 8.2 7.4 9.4 10 6.8" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" />
    </StrokeIcon>
  );
}

function MercatoLiberoIcon({ className = ICON }: { className?: string }) {
  return (
    <StrokeIcon className={className}>
      <path
        d="M4.5 5.5h7M4.5 10.5h7"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
      />
      <path
        d="M11.5 4v3M11.5 9v3M4.5 4v3M4.5 9v3"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </StrokeIcon>
  );
}

function PrezzoFissoIcon({ className = ICON }: { className?: string }) {
  return (
    <StrokeIcon className={className}>
      <path d="M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="3" cy="8" r="1.1" fill="currentColor" />
      <circle cx="13" cy="8" r="1.1" fill="currentColor" />
    </StrokeIcon>
  );
}

function PrezzoVariabileIcon({ className = ICON }: { className?: string }) {
  return (
    <StrokeIcon className={className}>
      <path
        d="M2.5 10.5c1.5-2.5 2.5-2.5 4-0s2.5 2.5 4 0 2.5-2.5 4-0"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </StrokeIcon>
  );
}

export function ClienteIcon({
  kind,
  className,
}: {
  kind: OfferteCliente | "condominio";
  className?: string;
}) {
  if (kind === "non domestico") return <BuildingIcon className={className} />;
  return <CasaIcon className={className} />;
}

export function MercatoIcon({
  kind,
  className,
}: {
  kind: OfferteMercato;
  className?: string;
}) {
  if (kind === "placet") return <PlacetIcon className={className} />;
  if (kind === "ml") return <MercatoLiberoIcon className={className} />;
  return <TuttiIcon className={className} />;
}

export function PrezzoIcon({
  kind,
  className,
}: {
  kind: OffertePrezzo | "prezzo fisso" | "prezzo variabile";
  className?: string;
}) {
  if (kind === "prezzo variabile") return <PrezzoVariabileIcon className={className} />;
  if (kind === "prezzo fisso") return <PrezzoFissoIcon className={className} />;
  return <TuttiIcon className={className} />;
}

export function clienteLabel(kind: OfferteCliente | "condominio") {
  if (kind === "non domestico") return "Partita IVA";
  if (kind === "condominio") return "Condominio";
  return "Casa";
}

export function mercatoLabel(kind: OfferteMercato | "placet" | "ml") {
  if (kind === "placet") return "PLACET";
  if (kind === "ml") return "Mercato libero";
  return "Tutti";
}

export function prezzoLabel(kind: OffertePrezzo | "prezzo fisso" | "prezzo variabile") {
  if (kind === "prezzo variabile") return "Variabile";
  if (kind === "prezzo fisso") return "Fisso";
  return "Tutti";
}

export function clienteKindFromTipo(tipoCliente: string | null): OfferteCliente | "condominio" | null {
  if (!tipoCliente) return null;
  if (tipoCliente.includes("non domestico")) return "non domestico";
  if (tipoCliente.includes("condominio")) return "condominio";
  if (tipoCliente.includes("domestico")) return "domestico";
  return null;
}

export function prezzoKindFromTipo(
  tipoOfferta: string,
): "prezzo fisso" | "prezzo variabile" | null {
  if (tipoOfferta.includes("variabile")) return "prezzo variabile";
  if (tipoOfferta.includes("fisso")) return "prezzo fisso";
  return null;
}
