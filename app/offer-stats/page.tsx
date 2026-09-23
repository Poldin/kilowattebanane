import type { Metadata } from "next";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { OfferteStats } from "@/components/offerte/OfferteStats";
import { SignupProvider, SignupSlot } from "@/components/SignupForm";
import { publicSiteUrl } from "@/lib/app-url";
import { PORTALE_OFFERTE_URL } from "@/lib/offerte/public-types";
import { loadOfferteClusterStats } from "@/lib/offerte/stats";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Statistiche offerte luce",
  description:
    "Quante offerte luce ci sono sul Portale Offerte, e come si dividono: casa o partita IVA, fisso o variabile, PLACET o libero, e per quanti mesi.",
  alternates: { canonical: `${publicSiteUrl()}/offer-stats` },
};

export default async function OfferStatsPage() {
  const stats = await loadOfferteClusterStats();

  return (
    <SignupProvider>
      <div className="flex min-h-full flex-1 flex-col bg-background font-sans text-foreground">
        <Header />
        <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-1 pb-16 pt-10 sm:px-6 sm:pt-12">
          <p className="text-[11px] uppercase tracking-[0.16em] text-neutral-500 dark:text-neutral-400">
            Dati{" "}
            <a
              href={PORTALE_OFFERTE_URL}
              target="_blank"
              rel="noreferrer"
              className="underline decoration-neutral-300 underline-offset-2 hover:text-foreground dark:decoration-neutral-600"
            >
              Portale Offerte
            </a>
            <span className="normal-case tracking-normal"> · open data CC-BY</span>
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            Statistiche offerte
          </h1>
          <OfferteStats stats={stats} />

          <SignupSlot className="mt-16 w-full scroll-mt-20 sm:mt-20" />
        </main>
        <Footer />
      </div>
    </SignupProvider>
  );
}
