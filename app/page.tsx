import { Header } from "@/components/Header";
import { RotatingAction } from "@/components/RotatingAction";
import { SignupProvider, SignupSlot } from "@/components/SignupForm";
import { DailyInsight } from "@/components/DailyInsight";
import { Faq } from "@/components/Faq";
import { Footer } from "@/components/Footer";

export default function Home() {
  return (
    <SignupProvider>
      <div className="flex min-h-full flex-1 flex-col bg-background font-sans text-foreground">
        <Header />

        <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-1 pb-16 pt-12 sm:px-6 sm:pt-16">
          <section className="flex flex-col items-center text-center">
            <h1 className="max-w-2xl text-balance text-3xl font-semibold leading-tight tracking-tight sm:text-4xl md:text-5xl md:leading-[1.15]">
              Quando devo <RotatingAction />
            </h1>

            <p className="mt-6 max-w-xl text-pretty text-base leading-relaxed text-neutral-600 sm:text-lg dark:text-neutral-400">
              Ricevi ogni giorno una mail che ti mostra il costo dell&apos;energia
              nella tua zona. Così sai già al mattino quando consumare e quando no
              per risparmiare sulla bolletta. Gratis.
            </p>

            <a
              href="#faq"
              className="mt-5 inline-flex max-w-full items-center rounded-full border border-neutral-200 bg-neutral-100 px-3 py-1 text-left text-xs text-neutral-600 transition-colors hover:border-neutral-300 hover:bg-neutral-200/80 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400 dark:hover:border-neutral-700 dark:hover:bg-neutral-800"
            >
              😯come fate a sapere il costo dell&apos;energia durante la giornata??
            </a>
          </section>

          <SignupSlot />

          <div className="mx-auto mt-10 w-full max-w-xl sm:mt-12">
            <DailyInsight />
          </div>

          <div className="mt-16 sm:mt-20">
            <Faq />
          </div>
        </main>

        <Footer />
      </div>
    </SignupProvider>
  );
}
