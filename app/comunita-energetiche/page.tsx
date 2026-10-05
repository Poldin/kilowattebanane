import type { Metadata } from "next";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { CerExplainer, CerSchema } from "@/components/cer/CerExplainer";
import { CerItalyMap } from "@/components/cer/CerItalyMap";
import { CerShowcaseBanner } from "@/components/cer/CerShowcaseBanner";
import { PodBanner } from "@/components/cer/PodBanner";
import { CerSignupProvider } from "@/components/cer/CerSignupProvider";
import { SignupProvider } from "@/components/SignupForm";
import { publicSiteUrl } from "@/lib/app-url";
import { GSE_MAPPA_URL } from "@/lib/cer/public-types";
import { loadTopCers } from "@/lib/cer/showcase";
import { loadCerStats } from "@/lib/cer/stats";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Comunità energetiche rinnovabili (CER)",
  description:
    "Scopri la tua cabina primaria con il POD, quante comunità energetiche ci sono in Italia e come funziona una CER.",
  alternates: { canonical: `${publicSiteUrl()}/comunita-energetiche` },
};

export default async function ComunitaEnergetichePage() {
  const [stats, topCers] = await Promise.all([loadCerStats(), loadTopCers()]);

  return (
    <SignupProvider>
      <CerSignupProvider>
        <div className="flex min-h-full flex-1 flex-col bg-background font-sans text-foreground">
          <Header />
          <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-1 pb-16 pt-10 sm:px-6 sm:pt-12">
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
              Comunità energetiche rinnovabili (CER)
            </h1>
            <CerSchema />
            <PodBanner />
            {stats.cer > 0 ? <CerShowcaseBanner count={stats.cer} cers={topCers} /> : null}
            {stats.regioni.length > 0 ? (
              <CerItalyMap regions={stats.regioni} total={stats.total} showTable={false} />
            ) : null}
            <CerExplainer />
          </main>
          <Footer />
        </div>
      </CerSignupProvider>
    </SignupProvider>
  );
}
