import type { Metadata } from "next";
import Link from "next/link";
import {
  LEARN_CHAPTERS,
  learnChapterPath,
} from "@/lib/learn/questions";
import { publicSiteUrl } from "@/lib/app-url";

export const metadata: Metadata = {
  title: "Studia il mercato elettrico",
  description:
    "Capitoli corti sul mercato dell'energia elettrica. Scegli cosa faresti, poi ti spieghiamo perché.",
  alternates: { canonical: `${publicSiteUrl()}/learn` },
};

const SHOW_LEARN_CHAPTERS = false;

export default function LearnPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-1 pb-16 pt-10 sm:px-6 sm:pt-14">
      <h1 className="max-w-2xl text-balance text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
        Non ci capisci una mazza?!🏏
      </h1>
      <p className="mt-4 max-w-xl text-pretty text-base leading-relaxed text-neutral-600 sm:text-lg dark:text-neutral-400">
        Sei in buona compagnia. Parti da qui!
      </p>

      <p className="mt-10 text-2xl font-semibold tracking-tight sm:text-3xl">
        Stiamo costruendo ..... 🔨 torna tra qualche giorno!
      </p>

      {SHOW_LEARN_CHAPTERS ? (
      <ul className="mt-10 grid grid-cols-2 gap-3 sm:gap-4">
        {LEARN_CHAPTERS.map((chapter) => (
          <li key={chapter.id}>
            <Link
              href={learnChapterPath(chapter.id)}
              className="relative block aspect-[1.618/1] overflow-hidden rounded-lg border border-neutral-200 transition-opacity hover:opacity-90 dark:border-neutral-800"
            >
              <img
                src={chapter.coverUrl}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div className="absolute inset-x-0 bottom-0 p-3 sm:p-4">
                <h2 className="inline rounded-md bg-black/70 px-1.5 box-decoration-clone text-lg font-bold tracking-tight text-white sm:text-xl">
                  {chapter.title}
                </h2>
                <p className="mt-1">
                  <span className="line-clamp-2 rounded-md bg-black/70 px-1.5 box-decoration-clone text-xs leading-snug text-white/80">
                    {chapter.blurb}
                  </span>
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
      ) : null}
    </main>
  );
}
