import type { Metadata } from "next";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { SignupProvider } from "@/components/SignupForm";
import { PORTALE_OFFERTE_URL } from "@/lib/offerte/public-types";
import { publicSiteUrl } from "@/lib/app-url";

export const metadata: Metadata = {
  title: "Statistiche offerte luce",
  description:
    "Statistiche sulle offerte elettriche pubblicate nel Portale Offerte. In arrivo.",
  alternates: { canonical: `${publicSiteUrl()}/offer-stats` },
};

export default function OfferStatsPage() {
  return (
    <SignupProvider>
      <div className="flex min-h-full flex-1 flex-col bg-background font-sans text-foreground">
        <Header />
        <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-1 pb-16 pt-12 sm:px-6 sm:pt-16">
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
          <p className="mt-4 max-w-xl text-base leading-relaxed text-neutral-600 dark:text-neutral-400">
            Qui arriverà il quadro nel tempo: quante offerte entrano ed escono,
            chi pubblica di più, quanto restano visibili. Per ora il confronto
            vive nel modulo in home.
          </p>
        </main>
        <Footer />
      </div>
    </SignupProvider>
  );
}
