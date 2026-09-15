import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { OfferteExplorer } from "@/components/offerte/OfferteExplorer";
import { SignupProvider, SignupSlot } from "@/components/SignupForm";
import { publicSiteUrl } from "@/lib/app-url";
import { loadOfferteHeadlineStats } from "@/lib/offerte/stats";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Confronta offerte luce",
  description:
    "Confronta le offerte luce del Portale Offerte per CAP, consumo e potenza. Stima di spesa annua su futures CME Italian Power Baseload (GME), rete, oneri e imposte.",
  alternates: { canonical: `${publicSiteUrl()}/offer-compare` },
};

export default async function OfferComparePage({
  searchParams,
}: {
  searchParams: Promise<{ cap?: string | string[] }>;
}) {
  const params = await searchParams;
  const capRaw = typeof params.cap === "string" ? params.cap : "";
  const initialCap = capRaw.replace(/\D/g, "").slice(0, 5);
  const stats = await loadOfferteHeadlineStats();

  return (
    <SignupProvider>
      <div className="flex min-h-full flex-1 flex-col bg-background font-sans text-foreground">
        <Header />
        <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-1 pb-16 pt-10 sm:px-6 sm:pt-12">
          <nav aria-label="Percorso" className="text-xs text-neutral-500 dark:text-neutral-400">
            <Link href="/" className="transition-colors hover:text-foreground">
              Home
            </Link>
            <span aria-hidden className="mx-1.5">
              /
            </span>
            <span className="text-foreground">Confronta offerte</span>
          </nav>
          <OfferteExplorer stats={stats} initialCap={initialCap} />
          <SignupSlot className="mx-auto mt-16 w-full max-w-md scroll-mt-20 sm:mt-20" />
        </main>
        <Footer />
      </div>
    </SignupProvider>
  );
}
