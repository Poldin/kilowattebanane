"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LearnRichText } from "@/components/learn/LearnRichText";
import { ArrowIcon, MultiplePlay, SinglePlay } from "@/components/learn/LearnQuiz";
import { patchLearnEvent, startLearnEvent } from "@/components/learn/learn-log";
import { learnChapterContinuePath } from "@/lib/learn/types";
import type { LearnChapter, LearnSlide } from "@/lib/learn/types";

export function LearnLandingHook({
  chapter,
  slide,
}: {
  chapter: LearnChapter;
  slide: Extract<LearnSlide, { type: "single" | "multiple" }>;
}) {
  const router = useRouter();
  const [revealed, setRevealed] = useState(false);
  const [result, setResult] = useState<boolean | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [eventId, setEventId] = useState<string | null>(null);
  const leaveTimer = useRef(0);

  useEffect(() => {
    let cancelled = false;
    void startLearnEvent({
      slideId: slide.id,
      chapterId: chapter.id,
      interactions: { shown: true, type: slide.type, hook: true },
    }).then((id) => {
      if (!cancelled) setEventId(id);
    });
    return () => {
      cancelled = true;
      window.clearTimeout(leaveTimer.current);
    };
  }, [chapter.id, slide.id, slide.type]);

  function reveal(correct: boolean, interactions: Record<string, unknown>) {
    if (revealed) return;
    setResult(correct);
    if (eventId) {
      void patchLearnEvent(eventId, {
        shown: true,
        type: slide.type,
        hook: true,
        ...interactions,
      });
    }
    if (slide.type === "single" && correct === false) return;
    setRevealed(true);
  }

  function goChapter() {
    if (leaving) return;
    const ok = result === true ? "1" : result === false ? "0" : "open";
    const href = learnChapterContinuePath(chapter.slug, slide.id, ok);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      router.push(href);
      return;
    }
    setLeaving(true);
    leaveTimer.current = window.setTimeout(() => {
      router.push(href);
    }, 170);
  }

  return (
    <section
      aria-labelledby="learn-hook-title"
      className="mt-10 max-w-xl"
    >
      <div className={leaving ? "learn-q-out" : "learn-q-in"}>
        <p className="text-xs font-medium tracking-wide text-neutral-500 uppercase dark:text-neutral-400">
          Domanda a bruciapelo 🤬
        </p>
        <h2
          id="learn-hook-title"
          className="mt-2 text-3xl font-bold tracking-tight leading-tight text-foreground sm:text-4xl"
        >
          <LearnRichText text={slide.payload.question} inline />
        </h2>
        {slide.payload.image ? (
          <img
            src={slide.payload.image}
            alt=""
            className="mt-5 w-full rounded-lg object-cover"
          />
        ) : null}
        {slide.type === "single" ? (
          <SinglePlay
            payload={slide.payload}
            revealed={revealed}
            onReveal={reveal}
            hideQuestion
          />
        ) : (
          <MultiplePlay
            payload={slide.payload}
            revealed={revealed}
            onReveal={reveal}
            hideQuestion
          />
        )}
        {revealed ? (
          <button
            type="button"
            onClick={goChapter}
            className="mt-5 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-foreground px-4 text-sm font-medium text-background transition-opacity hover:opacity-90 sm:w-auto"
          >
            Continua in {chapter.title}
            <ArrowIcon />
          </button>
        ) : null}
      </div>
    </section>
  );
}
