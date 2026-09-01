import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { SignupSlot } from "@/components/SignupForm";
import { archiveIndexJsonLd, loadArchiveIndex } from "@/lib/day-archive";
import { formatEurocent } from "@/lib/insights";
import { archiveDayPath } from "@/lib/market-zones";
import { publicSiteUrl } from "@/lib/app-url";
import { romeToday } from "@/lib/day-ahead-query";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Quando consumare energia, giorno per giorno",
  description:
    "Archivio dei prezzi all'ingrosso dell'energia in Italia. Per ogni giornata: ore più convenienti, ore da evitare, minimo e massimo per zona. Fonte ENTSO-E.",
  alternates: { canonical: `${publicSiteUrl()}/prezzi` },
  openGraph: {
    title: "Quando consumare energia, giorno per giorno",
    description:
      "Archivio dei prezzi day-ahead italiani. Ore 🍌 e ore 🐵, zona per zona.",
    locale: "it_IT",
    type: "website",
  },
};

export default async function PrezziIndexPage() {
  const items = await loadArchiveIndex();
  const today = romeToday();

  return (
    <>
      <JsonLd data={archiveIndexJsonLd(items)} />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-1 pb-16 pt-10 sm:px-6 sm:pt-14">
        <nav
          aria-label="Percorso"
          className="text-xs text-neutral-500 dark:text-neutral-400"
        >
          <Link href="/" className="transition-colors hover:text-foreground">
            Home
          </Link>
          <span aria-hidden className="mx-1.5">
            /
          </span>
          <span className="text-foreground">Prezzi</span>
        </nav>

        <h1 className="mt-5 max-w-2xl text-balance text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
          Quando conviene consumare, giorno per giorno
        </h1>
        <p className="mt-4 max-w-xl text-pretty text-base leading-relaxed text-neutral-600 sm:text-lg dark:text-neutral-400">
          Ogni pagina è una giornata di prezzi all&apos;ingrosso: minimo,
          medio, massimo e le ore in cui conviene accendere. Sette zone
          italiane, fonte ENTSO-E.
        </p>

        {items.length === 0 ? (
          <p className="mt-10 text-sm text-neutral-500 dark:text-neutral-400">
            Ancora nessuna giornata completa. Torna più tardi.
          </p>
        ) : (
          <ol className="mt-10 divide-y divide-neutral-200 border-y border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
            {items.map((item) => {
              const badge =
                item.date === today
                  ? "oggi"
                  : item.date > today
                    ? "domani"
                    : null;
              return (
                <li key={item.date}>
                  <Link
                    href={archiveDayPath(item.date)}
                    className="flex flex-col gap-3 py-4 transition-colors hover:bg-neutral-50 sm:flex-row sm:items-center sm:justify-between sm:gap-6 dark:hover:bg-neutral-950"
                  >
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 font-medium tracking-tight text-foreground">
                        <span>{item.dateTitle}</span>
                        {badge ? (
                          <span className="inline-flex items-center rounded-full bg-[#F5D547] px-2 py-0.5 text-[11px] font-medium text-[#111111]">
                            {badge}
                          </span>
                        ) : null}
                      </p>
                      <p className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">
                        c€/kWh all&apos;ingrosso
                      </p>
                    </div>
                    <div className="grid grid-cols-3 gap-4 sm:w-64">
                      <div>
                        <p className="text-[11px] font-medium tracking-wider text-neutral-500 uppercase">
                          min
                        </p>
                        <p className="text-xl font-semibold tabular-nums tracking-tight text-foreground">
                          {formatEurocent(item.min)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] font-medium tracking-wider text-neutral-500 uppercase">
                          medio
                        </p>
                        <p className="text-xl font-semibold tabular-nums tracking-tight text-foreground">
                          {formatEurocent(item.avg)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] font-medium tracking-wider text-neutral-500 uppercase">
                          max
                        </p>
                        <p className="text-xl font-semibold tabular-nums tracking-tight text-foreground">
                          {formatEurocent(item.max)}
                        </p>
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ol>
        )}

        <p className="mt-8 text-sm text-neutral-500 dark:text-neutral-400">
          Una nuova pagina nasce quando i prezzi day-ahead sono completi, di
          solito nel pomeriggio per il giorno dopo.
        </p>

        <SignupSlot />
      </main>
    </>
  );
}
