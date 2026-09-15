import type { Metadata } from "next";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { OfferteAdminUpload } from "@/components/offerte/OfferteAdminUpload";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Carica offerte",
  robots: { index: false, follow: false },
};

export default function OfferteAdminPage() {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-background font-sans text-foreground">
      <Header />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-1 pb-16 pt-10 sm:px-6 sm:pt-12">
        <p className="text-[11px] uppercase tracking-[0.16em] text-neutral-500 dark:text-neutral-400">
          Admin
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          Carica offerte luce
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
          Scarica i file open data dal Portale Offerte e importali qui. La password resta salvata
          su questo browser per un mese.
        </p>
        <OfferteAdminUpload />
      </main>
      <Footer />
    </div>
  );
}
