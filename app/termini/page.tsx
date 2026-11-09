import type { Metadata } from "next";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { SignupProvider } from "@/components/SignupForm";
import { publicSiteUrl } from "@/lib/app-url";

export const metadata: Metadata = {
  title: "Termini e condizioni",
  description:
    "Termini e condizioni per l’uso di kilowatt e banane, inclusa l’iscrizione a una comunità energetica.",
  alternates: { canonical: `${publicSiteUrl()}/termini` },
};

export default function TerminiPage() {
  return (
    <SignupProvider>
      <div className="flex min-h-full flex-1 flex-col bg-background font-sans text-foreground">
        <Header />
        <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 pb-16 pt-10 sm:px-6 sm:pt-12">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Termini e condizioni
          </h1>
          <div className="mt-6 space-y-4 text-pretty text-base leading-relaxed text-neutral-600 sm:text-lg dark:text-neutral-400">
            <p>
              Questi termini regolano l’uso di kilowatt e banane, incluso il
              percorso di iscrizione digitale a una comunità energetica.
            </p>
            <p>
              Il servizio è gratuito. Non vendiamo energia e non chiediamo un
              pagamento per iscriverti.
            </p>
            <p>
              I dati che ci invii servono a completare l’iscrizione e a
              metterti in contatto con la comunità. Restano il tuo venditore e
              la bolletta di sempre.
            </p>
          </div>
        </main>
        <Footer />
      </div>
    </SignupProvider>
  );
}
