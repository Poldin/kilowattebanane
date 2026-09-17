import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LearnQuiz } from "@/components/learn/LearnQuiz";
import {
  LEARN_CHAPTERS,
  chapterById,
  learnChapterPath,
} from "@/lib/learn/questions";
import { publicSiteUrl } from "@/lib/app-url";

export function generateStaticParams() {
  return LEARN_CHAPTERS.map((chapter) => ({ chapterid: chapter.id }));
}

export async function generateMetadata({
  params,
}: PageProps<"/learn/[chapterid]">): Promise<Metadata> {
  const { chapterid } = await params;
  const chapter = chapterById(chapterid);
  if (!chapter) {
    return { title: "Capitolo non trovato" };
  }

  return {
    title: chapter.title,
    description: chapter.blurb,
    alternates: { canonical: `${publicSiteUrl()}${learnChapterPath(chapter.id)}` },
  };
}

export default async function LearnChapterPage({
  params,
}: PageProps<"/learn/[chapterid]">) {
  const { chapterid } = await params;
  const chapter = chapterById(chapterid);
  if (!chapter) notFound();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-1 pb-16 pt-10 sm:px-6 sm:pt-14">
      <LearnQuiz chapter={chapter} />
    </main>
  );
}
