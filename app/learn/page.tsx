import type { Metadata } from "next";
import { listLearnChapters, pickRandomLearnHook } from "@/lib/learn/db";
import { publicSiteUrl } from "@/lib/app-url";
import { LearnChapterCard } from "@/components/learn/LearnChapterCard";
import { LearnLandingHook } from "@/components/learn/LearnLandingHook";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Studia il mercato elettrico",
  description:
    "Capitoli corti sul mercato dell'energia elettrica. Scegli cosa faresti, poi ti spieghiamo perché.",
  alternates: { canonical: `${publicSiteUrl()}/learn` },
};

export default async function LearnPage() {
  const chapters = await listLearnChapters(false);
  const hook = chapters.length > 0 ? await pickRandomLearnHook() : null;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-1 pb-16 pt-10 sm:px-6 sm:pt-14">
      <h1 className="max-w-2xl text-balance text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
        Non ci capisci una mazza?!🏏
      </h1>
      <p className="mt-4 max-w-xl text-pretty text-base leading-relaxed text-neutral-600 sm:text-lg dark:text-neutral-400">
        Scopri le basi e il funzionamento del mercato dell'energia elettrica.
      </p>

      {chapters.length === 0 ? (
        <p className="mt-10 text-2xl font-semibold tracking-tight sm:text-3xl">
          Non ci sono ancora lezioni disponibili! Torna più tardi :)
        </p>
      ) : (
        <>
          {hook ? (
            <>
              <LearnLandingHook chapter={hook.chapter} slide={hook.slide} />
              <p className="mt-12 text-sm font-medium text-neutral-500 dark:text-neutral-400">
                Oppure scegli un capitolo
              </p>
            </>
          ) : null}
          <ul className={`${hook ? "mt-4" : "mt-10"} grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4`}>
            {chapters.map((chapter, index) => (
              <li
                key={chapter.id}
                className="learn-chapter-in"
                style={{ animationDelay: `${index * 75}ms` }}
              >
                <LearnChapterCard chapter={chapter} />
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
