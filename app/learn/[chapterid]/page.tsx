import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LearnQuiz } from "@/components/learn/LearnQuiz";
import { getLearnChapterBySlug, randomOtherChapter } from "@/lib/learn/db";
import { learnChapterPath } from "@/lib/learn/types";
import { publicSiteUrl } from "@/lib/app-url";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/learn/[chapterid]">): Promise<Metadata> {
  const { chapterid } = await params;
  const chapter = await getLearnChapterBySlug(chapterid);
  if (!chapter) {
    return { title: "Capitolo non trovato" };
  }

  return {
    title: chapter.title,
    description: chapter.blurb || undefined,
    alternates: { canonical: `${publicSiteUrl()}${learnChapterPath(chapter.slug)}` },
  };
}

export default async function LearnChapterPage({
  params,
  searchParams,
}: PageProps<"/learn/[chapterid]">) {
  const { chapterid } = await params;
  const query = await searchParams;
  const chapter = await getLearnChapterBySlug(chapterid);
  if (!chapter) notFound();
  const following = (await randomOtherChapter(chapter.slug)) ?? chapter;
  const after = typeof query.da === "string" ? query.da : undefined;
  const ok = typeof query.ok === "string" ? query.ok : undefined;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-1 pb-16 pt-10 sm:px-6 sm:pt-14">
      <LearnQuiz
        chapter={chapter}
        following={following}
        resume={after ? { after, ok } : undefined}
      />
    </main>
  );
}
