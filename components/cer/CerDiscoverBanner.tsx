import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function CerDiscoverBanner({ className }: { className?: string }) {
  return (
    <Link
      href="/comunita-energetiche"
      className={`inline-flex w-fit max-w-full items-center gap-1.5 rounded-full bg-[#165B44] px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90 sm:text-sm${className ? ` ${className}` : ""}`}
    >
      scopri le Comunità Energetiche Rinnovabili
      <ArrowRight aria-hidden className="cer-arrow-nudge h-3.5 w-3.5 shrink-0" strokeWidth={2} />
    </Link>
  );
}
