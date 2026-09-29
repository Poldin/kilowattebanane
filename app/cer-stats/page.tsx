import type { Metadata } from "next";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { CerStats } from "@/components/cer/CerStats";
import { PodBanner } from "@/components/cer/PodBanner";
import { SignupProvider, SignupSlot } from "@/components/SignupForm";
import { publicSiteUrl } from "@/lib/app-url";
import { GSE_MAPPA_URL } from "@/lib/cer/public-types";
import { loadCerStats } from "@/lib/cer/stats";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Statistiche CER e autoconsumo",
  description:
    "Quante configurazioni TIAD ci sono sulla mappa GSE, e come si dividono: CER, autoconsumo collettivo, regione, potenza e utenze.",
  alternates: { canonical: `${publicSiteUrl()}/cer-stats` },
};

export default async function CerStatsPage() {
  const stats = await loadCerStats();

  return (
    <SignupProvider>
      <div className="flex min-h-full flex-1 flex-col bg-background font-sans text-foreground">
        <Header />
        <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-1 pb-16 pt-10 sm:px-6 sm:pt-12">
          <p className="text-[11px] uppercase tracking-[0.16em] text-neutral-500 dark:text-neutral-400">
            Dati{" "}
            <a
              href={GSE_MAPPA_URL}
              target="_blank"
              rel="noreferrer"
              className="underline decoration-neutral-300 underline-offset-2 hover:text-foreground dark:decoration-neutral-600"
            >
              GSE
            </a>
            <span className="normal-case tracking-normal"> · mappa pubblica, uso informativo</span>
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            Statistiche CER
          </h1>
          <PodBanner />
          <CerStats stats={stats} />
          <SignupSlot className="mt-16 w-full scroll-mt-20 sm:mt-20" />
        </main>
        <Footer />
      </div>
    </SignupProvider>
  );
}
