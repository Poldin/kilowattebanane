import Link from "next/link";
import { learnChapterPath, type LearnChapter } from "@/lib/learn/types";

export function LearnChapterCard({
  chapter,
  className = "",
  fallbackClassName = "bg-[#F5D547]",
}: {
  chapter: LearnChapter;
  className?: string;
  fallbackClassName?: string;
}) {
  return (
    <Link
      href={learnChapterPath(chapter.slug)}
      className={`relative block aspect-[1.618/1] overflow-hidden rounded-lg border border-neutral-200 transition-opacity hover:opacity-90 dark:border-neutral-800 ${className}`}
    >
      {chapter.cover_url ? (
        <img
          src={chapter.cover_url}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div className={`absolute inset-0 ${fallbackClassName}`} />
      )}
      <div className="absolute inset-x-0 bottom-0 p-3 sm:p-4">
        <h2 className="inline rounded-md bg-black/70 px-1.5 box-decoration-clone text-lg font-bold tracking-tight text-white sm:text-xl">
          {chapter.title}
        </h2>
        {chapter.blurb ? (
          <p className="mt-1">
            <span className="line-clamp-2 rounded-md bg-black/70 px-1.5 box-decoration-clone text-xs leading-snug text-white/80">
              {chapter.blurb}
            </span>
          </p>
        ) : null}
      </div>
    </Link>
  );
}
