import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { MarketLearnBanner } from "@/components/MarketLearnBanner";
import { OpposizioniBanner } from "@/components/OpposizioniBanner";
import { OfferteExplorer } from "@/components/offerte/OfferteExplorer";
import { SignupProvider, SignupSlot } from "@/components/SignupForm";
import { publicSiteUrl } from "@/lib/app-url";
import { paretoCarouselFromStats } from "@/lib/offerte/pareto-cluster";
import { loadOfferteClusterStats } from "@/lib/offerte/stats";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Confronta offerte luce",
  description:
    "Confronta le offerte luce del Portale Offerte per CAP, consumo e potenza. Stima di spesa annua su futures CME Italian Power Baseload (GME), rete, oneri e imposte.",
  alternates: { canonical: `${publicSiteUrl()}/offer-compare` },
};

export default async function OfferComparePage({
  searchParams,
}: {
  searchParams: Promise<{ cap?: string | string[]; tab?: string | string[] }>;
}) {
  const params = await searchParams;
  if (params.cap || params.tab) redirect("/offer-compare");
  const stats = await loadOfferteClusterStats();

  return (
    <SignupProvider>
      <div className="flex min-h-full flex-1 flex-col bg-background font-sans text-foreground">
        <Header />
        <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-1 pb-16 pt-8 sm:px-6 sm:pt-5">
          <OfferteExplorer stats={stats} carousel={paretoCarouselFromStats(stats.pareto)} />
          <div className="mt-16 flex w-full flex-col gap-3 sm:mt-20">
            <OpposizioniBanner />
            <MarketLearnBanner />
            <SignupSlot className="w-full scroll-mt-20" />
          </div>
        </main>
        <Footer />
      </div>
    </SignupProvider>
  );
}
