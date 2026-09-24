"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LearnArrows } from "@/components/learn/LearnArrows";
import { LearnChapterCard } from "@/components/learn/LearnChapterCard";
import { LearnRichText } from "@/components/learn/LearnRichText";
import { patchLearnEvent, startLearnEvent } from "@/components/learn/learn-log";
import { learnChapterPath } from "@/lib/learn/types";
import type {
  LearnChapter,
  LearnChapterWithSlides,
  LearnMultiplePayload,
  LearnOpenPayload,
  LearnSinglePayload,
  LearnSlide,
} from "@/lib/learn/types";

function isQuestionSlide(slide: LearnSlide) {
  return slide.type !== "info";
}

function resumeFrom(
  slides: LearnSlide[],
  resume?: { after?: string; ok?: string },
) {
  if (!resume?.after) {
    return { index: 0, done: false, results: {} as Record<string, boolean | "open"> };
  }
  const position = slides.findIndex((item) => item.id === resume.after);
  if (position < 0) {
    return { index: 0, done: false, results: {} as Record<string, boolean | "open"> };
  }
  const scored =
    resume.ok === "1" ? true : resume.ok === "0" ? false : resume.ok === "open" ? "open" : undefined;
  const results: Record<string, boolean | "open"> =
    scored === undefined ? {} : { [resume.after]: scored };
  if (position + 1 >= slides.length) {
    return { index: 0, done: true, results };
  }
  return { index: position + 1, done: false, results };
}

export function LearnQuiz({
  chapter,
  following,
  resume,
}: {
  chapter: LearnChapterWithSlides;
  following?: LearnChapter;
  resume?: { after?: string; ok?: string };
}) {
  const slides = chapter.slides;
  const total = slides.length;
  const questionSlides = slides.filter(isQuestionSlide);
  const started = resumeFrom(slides, resume);

  const [index, setIndex] = useState(started.index);
  const [done, setDone] = useState(started.done);
  const [results, setResults] = useState<Record<string, boolean | "open">>(started.results);

  const slide = slides[index];
  const scored = Object.values(results).filter(
    (value): value is boolean => typeof value === "boolean",
  );
  const correctCount = scored.filter(Boolean).length;
  const scoredTotal = scored.length;

  useEffect(() => {
    document
      .getElementById("learn-quiz")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [index, done]);

  function restart() {
    setIndex(0);
    setDone(false);
    setResults({});
  }

  function recordResult(slideId: string, correct: boolean | null) {
    setResults((prev) => {
      if (slideId in prev) return prev;
      return { ...prev, [slideId]: correct == null ? "open" : correct };
    });
  }

  function goNext() {
    if (index + 1 >= total) {
      setDone(true);
      return;
    }
    setIndex((n) => n + 1);
  }

  function skipNext() {
    if (index + 1 >= total) return;
    setIndex((n) => n + 1);
  }

  function skipPrev() {
    if (index <= 0) return;
    setIndex((n) => n - 1);
  }

  return (
    <div id="learn-quiz" className="mx-auto w-full max-w-xl scroll-mt-20">
      {done ? (
        <Done
          chapter={chapter}
          correctCount={correctCount}
          scoredTotal={scoredTotal}
          following={following}
          onRestart={restart}
        />
      ) : slide ? (
        <Play
          key={slide.id}
          chapter={chapter}
          slide={slide}
          index={index}
          total={total}
          questionSlides={questionSlides}
          results={results}
          onResult={recordResult}
          onNext={goNext}
          onPrev={skipPrev}
          onSkip={skipNext}
        />
      ) : (
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Questo capitolo non ha ancora lezioni attive.
        </p>
      )}
    </div>
  );
}

function Play({
  chapter,
  slide,
  index,
  total,
  questionSlides,
  results,
  onResult,
  onNext,
  onPrev,
  onSkip,
}: {
  chapter: LearnChapterWithSlides;
  slide: LearnSlide;
  index: number;
  total: number;
  questionSlides: LearnSlide[];
  results: Record<string, boolean | "open">;
  onResult: (slideId: string, correct: boolean | null) => void;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
}) {
  const last = index + 1 === total;
  const hasOptions = slide.type === "single" || slide.type === "multiple";
  const [revealed, setRevealed] = useState(slide.type === "info");
  const [eventId, setEventId] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const leaveTimer = useRef<number>(0);

  useEffect(() => {
    let cancelled = false;
    void startLearnEvent({
      slideId: slide.id,
      chapterId: chapter.id,
      interactions: { shown: true, type: slide.type },
    }).then((id) => {
      if (!cancelled) setEventId(id);
    });
    return () => {
      cancelled = true;
      window.clearTimeout(leaveTimer.current);
    };
  }, [chapter.id, slide.id, slide.type]);

  function leaveThen(action: () => void) {
    if (leaving) return;
    if (
      !hasOptions ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      action();
      return;
    }
    setLeaving(true);
    leaveTimer.current = window.setTimeout(action, 170);
  }

  function log(interactions: Record<string, unknown>) {
    if (!eventId) return;
    void patchLearnEvent(eventId, {
      shown: true,
      type: slide.type,
      ...interactions,
    });
  }

  function reveal(correct: boolean | null, interactions: Record<string, unknown>) {
    if (revealed && slide.type !== "info") return;
    onResult(slide.id, correct);
    log(interactions);
    if (slide.type === "open") {
      onNext();
      return;
    }
    if (slide.type === "single" && correct === false) return;
    setRevealed(true);
  }

  const body = (
    <>
      <p className="mt-5 text-xs font-medium tracking-wide text-neutral-500 uppercase dark:text-neutral-400">
        {chapter.title}
        {isQuestionSlide(slide) && questionSlides.length > 0 ? (
          <>
            <span className="mx-1.5 font-normal text-neutral-400">·</span>
            {questionSlides.findIndex((item) => item.id === slide.id) + 1} di{" "}
            {questionSlides.length}
          </>
        ) : null}
      </p>
      <h1
        id="learn-title"
        className={`mt-2 font-bold tracking-tight leading-tight text-foreground ${
          hasOptions ? "text-3xl sm:text-4xl" : "text-2xl sm:text-3xl"
        }`}
      >
        <LearnRichText
          text={
            hasOptions && "question" in slide.payload
              ? slide.payload.question
              : slide.payload.title
          }
          inline
        />
      </h1>

      {slide.payload.image ? (
        <img
          src={slide.payload.image}
          alt=""
          className="mt-5 w-full rounded-lg object-cover"
        />
      ) : null}

      {slide.type === "info" ? (
        <LearnRichText
          text={slide.payload.text}
          className="mt-5 text-base leading-relaxed text-neutral-700 dark:text-neutral-300"
        />
      ) : null}

      {slide.type === "single" ? (
        <SinglePlay
          payload={slide.payload}
          revealed={revealed}
          onReveal={reveal}
          hideQuestion
        />
      ) : null}

      {slide.type === "multiple" ? (
        <MultiplePlay
          payload={slide.payload}
          revealed={revealed}
          onReveal={reveal}
          hideQuestion
        />
      ) : null}

      {slide.type === "open" ? (
        <OpenPlay payload={slide.payload} onReveal={reveal} />
      ) : null}

      {revealed ? (
        <button
          type="button"
          onClick={() => leaveThen(onNext)}
          className="mt-5 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-foreground px-4 text-sm font-medium text-background transition-opacity hover:opacity-90 sm:w-auto"
        >
          {last ? "Vedi com'è andata" : "Avanti"}
          <ArrowIcon />
        </button>
      ) : null}
    </>
  );

  return (
    <section
      aria-labelledby="learn-title"
      className={hasOptions ? undefined : "insight-content-in"}
    >
      <LearnArrows
        canPrev={index > 0}
        canNext={!last}
        onPrev={() => leaveThen(onPrev)}
        onNext={() => leaveThen(onSkip)}
      />

      {questionSlides.length > 0 ? (
        <div className="mt-4">
          <Progress
            slides={questionSlides}
            currentId={slide.id}
            results={results}
          />
        </div>
      ) : null}

      {hasOptions ? (
        <div className={leaving ? "learn-q-out" : "learn-q-in"}>{body}</div>
      ) : (
        body
      )}
    </section>
  );
}

function shuffleOptions<T>(items: T[]) {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const current = next[i];
    const swap = next[j];
    if (current === undefined || swap === undefined) continue;
    next[i] = swap;
    next[j] = current;
  }
  return next;
}

function useShuffledOptions<T>(items: T[]) {
  const [options, setOptions] = useState(items);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setOptions(shuffleOptions(items));
    setReady(true);
  }, [items]);

  return { options, ready };
}

export function SinglePlay({
  payload,
  revealed,
  onReveal,
  hideQuestion = false,
}: {
  payload: LearnSinglePayload;
  revealed: boolean;
  onReveal: (correct: boolean, interactions: Record<string, unknown>) => void;
  hideQuestion?: boolean;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const [misses, setMisses] = useState<string[]>([]);
  const { options, ready } = useShuffledOptions(payload.options);

  return (
    <>
      {hideQuestion ? null : (
        <LearnRichText
          text={payload.question}
          className="mt-5 text-base leading-relaxed text-neutral-700 dark:text-neutral-300"
        />
      )}
      <div
        role="radiogroup"
        className={`mt-6 flex flex-col gap-2 ${ready ? "" : "invisible"}`}
      >
        {options.map((option, optionIndex) => {
          const selected = picked === option.id;
          const isCorrect = option.id === payload.correctId;
          const missed = misses.includes(option.id);
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={revealed || missed}
              style={ready ? { animationDelay: `${optionIndex * 32}ms` } : undefined}
              onClick={() => {
                setPicked(option.id);
                if (!isCorrect) {
                  setMisses((prev) =>
                    prev.includes(option.id) ? prev : [...prev, option.id],
                  );
                }
                onReveal(isCorrect, {
                  picked: option.id,
                  correct: isCorrect,
                  misses: isCorrect ? misses : [...misses, option.id],
                });
              }}
              className={`${optionClass({
                revealed,
                selected,
                isCorrect,
                missed,
              })}${ready ? " learn-option-in" : ""}`}
            >
              <LearnRichText text={option.label} inline />
            </button>
          );
        })}
      </div>
      {misses.length > 0 && !revealed ? (
        <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
          Non è questa. Riprova.
        </p>
      ) : null}
    </>
  );
}

export function MultiplePlay({
  payload,
  revealed,
  onReveal,
  hideQuestion = false,
}: {
  payload: LearnMultiplePayload;
  revealed: boolean;
  onReveal: (correct: boolean, interactions: Record<string, unknown>) => void;
  hideQuestion?: boolean;
}) {
  const [picked, setPicked] = useState<string[]>([]);
  const { options, ready } = useShuffledOptions(payload.options);

  function toggle(id: string) {
    if (revealed) return;
    setPicked((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  }

  function submit() {
    if (revealed) return;
    const exact =
      picked.length === payload.correctIds.length &&
      payload.correctIds.every((id) => picked.includes(id));
    onReveal(exact, { picked, correct: exact });
  }

  return (
    <>
      {hideQuestion ? null : (
        <LearnRichText
          text={payload.question}
          className="mt-5 text-base leading-relaxed text-neutral-700 dark:text-neutral-300"
        />
      )}
      <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
        Puoi selezionare più risposte.
      </p>
      <div className={`mt-4 flex flex-col gap-2 ${ready ? "" : "invisible"}`}>
        {options.map((option, optionIndex) => {
          const selected = picked.includes(option.id);
          const isCorrect = payload.correctIds.includes(option.id);
          return (
            <button
              key={option.id}
              type="button"
              role="checkbox"
              aria-checked={selected}
              disabled={revealed}
              style={ready ? { animationDelay: `${optionIndex * 32}ms` } : undefined}
              onClick={() => toggle(option.id)}
              className={`${optionClass({ revealed, selected, isCorrect, checkbox: true })}${
                ready ? " learn-option-in" : ""
              }`}
            >
              <CheckIcon checked={selected} />
              <LearnRichText text={option.label} inline />
            </button>
          );
        })}
      </div>
      {!revealed ? (
        <button
          type="button"
          onClick={submit}
          className="mt-4 inline-flex h-10 items-center justify-center rounded-md bg-foreground px-4 text-sm font-medium text-background transition-opacity hover:opacity-90"
        >
          Rispondi
        </button>
      ) : null}
    </>
  );
}

function OpenPlay({
  payload,
  onReveal,
}: {
  payload: LearnOpenPayload;
  onReveal: (correct: null, interactions: Record<string, unknown>) => void;
}) {
  const [text, setText] = useState("");

  return (
    <>
      <LearnRichText
        text={payload.question}
        className="mt-5 text-base leading-relaxed text-neutral-700 dark:text-neutral-300"
      />
      <label className="mt-6 block">
        <span className="sr-only">La tua risposta</span>
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={4}
          placeholder="Scrivi qui"
          className="w-full rounded-md border border-neutral-200 bg-transparent px-3 py-2 text-sm outline-none focus:border-neutral-400 dark:border-neutral-800 dark:focus:border-neutral-600"
        />
      </label>
      <button
        type="button"
        onClick={() => onReveal(null, { text: text.trim() })}
        className="mt-4 inline-flex h-10 items-center justify-center rounded-md bg-foreground px-4 text-sm font-medium text-background transition-opacity hover:opacity-90"
      >
        Invia
      </button>
    </>
  );
}

function Done({
  chapter,
  correctCount,
  scoredTotal,
  following,
  onRestart,
}: {
  chapter: LearnChapterWithSlides;
  correctCount: number;
  scoredTotal: number;
  following?: LearnChapter;
  onRestart: () => void;
}) {
  const percent =
    scoredTotal > 0 ? Math.round((correctCount / scoredTotal) * 100) : null;

  return (
    <section className="insight-content-in">
      <LearnArrows canPrev={false} canNext={false} />
      <div className="mt-4 rounded-lg bg-[#F5D547] p-5 text-[#111111] sm:p-6">
        <p className="text-xs font-medium tracking-wide uppercase">{chapter.title}</p>
        {percent != null ? (
          <h1 className="mt-3 text-5xl font-bold tracking-tight leading-none sm:text-6xl">
            {correctCount} su {scoredTotal} {percent}% {scoreEmoji(percent)}
          </h1>
        ) : (
          <h1 className="mt-2 text-3xl font-bold tracking-tight leading-tight sm:text-4xl">
            Fatto.
          </h1>
        )}
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {following ? (
            <Link
              href={learnChapterPath(following.slug)}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[#111111] px-4 text-sm font-medium text-[#F5D547] transition-opacity hover:opacity-90"
            >
              Vai a {following.title}
              <ArrowIcon />
            </Link>
          ) : null}
          <button
            type="button"
            onClick={onRestart}
            className="inline-flex h-10 items-center justify-center rounded-md border border-[#111111]/20 px-4 text-sm font-medium text-[#111111] transition-colors hover:bg-[#111111]/8"
          >
            Rifai
          </button>
          <Link
            href="/learn"
            className="inline-flex h-10 items-center justify-center rounded-md border border-[#111111]/20 px-4 text-sm font-medium text-[#111111] transition-colors hover:bg-[#111111]/8"
          >
            torna ai capitoli
          </Link>
        </div>
        {following ? (
          <LearnChapterCard
            chapter={following}
            className="mt-5 border-[#111111]/15"
            fallbackClassName="bg-[#111111]"
          />
        ) : null}
      </div>
    </section>
  );
}

function scoreEmoji(percent: number) {
  if (percent >= 100) return "🍌";
  if (percent >= 70) return "🤩";
  if (percent >= 40) return "😬";
  if (percent >= 1) return "🐵";
  return "🙈";
}

function Progress({
  slides,
  currentId,
  results,
}: {
  slides: LearnSlide[];
  currentId: string;
  results: Record<string, boolean | "open">;
}) {
  return (
    <ol className="flex items-center gap-1.5" aria-hidden>
      {slides.map((item) => {
        const result = results[item.id];
        const active = item.id === currentId && result === undefined;
        return (
          <li
            key={item.id}
            className="flex h-3 w-4 shrink-0 items-center justify-center"
          >
            {result === true ? (
              <ProgressTick />
            ) : result === false ? (
              <ProgressCross />
            ) : (
              <span
                className={`h-1 w-full rounded-full ${
                  result === "open"
                    ? "bg-[#F5D547]"
                    : active
                      ? "bg-neutral-400 dark:bg-neutral-500"
                      : "bg-neutral-200 dark:bg-neutral-800"
                }`}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function ProgressTick() {
  return (
    <svg
      viewBox="0 0 12 12"
      className="h-3 w-3 text-emerald-600 dark:text-emerald-400"
      fill="none"
      aria-hidden
    >
      <path
        d="M2.4 6.2 5 8.6 9.6 3.4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ProgressCross() {
  return (
    <svg
      viewBox="0 0 12 12"
      className="h-3 w-3 text-red-600 dark:text-red-400"
      fill="none"
      aria-hidden
    >
      <path
        d="M3.2 3.2 8.8 8.8M8.8 3.2 3.2 8.8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function optionClass({
  revealed,
  selected,
  isCorrect,
  checkbox = false,
  missed = false,
}: {
  revealed: boolean;
  selected: boolean;
  isCorrect: boolean;
  checkbox?: boolean;
  missed?: boolean;
}) {
  const base = checkbox
    ? "flex w-full items-start gap-3 rounded-md border px-4 py-3 text-left text-sm leading-snug transition-colors disabled:cursor-default"
    : "w-full rounded-md border px-4 py-3 text-left text-sm leading-snug transition-colors disabled:cursor-default";
  const wrong = "border-red-600 bg-red-600 text-white dark:border-red-600 dark:bg-red-600 dark:text-white";
  const right = "border-emerald-600 bg-emerald-600 text-white dark:border-emerald-600 dark:bg-emerald-600 dark:text-white";
  if (missed && !revealed) {
    return `${base} ${wrong}`;
  }
  if (!revealed) {
    if (selected && checkbox) {
      return `${base} border-neutral-400 bg-neutral-50 text-foreground dark:border-neutral-500 dark:bg-neutral-900`;
    }
    return `${base} border-neutral-200 bg-background text-foreground hover:border-neutral-400 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:border-neutral-600 dark:hover:bg-neutral-900`;
  }
  if (isCorrect) {
    return `${base} ${right}`;
  }
  if (selected || missed) {
    return `${base} ${wrong}`;
  }
  return `${base} border-neutral-200 bg-background text-neutral-400 dark:border-neutral-800 dark:text-neutral-600`;
}

function CheckIcon({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden
      className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] border ${
        checked
          ? "border-current bg-current"
          : "border-neutral-400 bg-transparent dark:border-neutral-500"
      }`}
    >
      {checked ? (
        <svg viewBox="0 0 12 12" className="h-3 w-3 text-background" fill="none">
          <path
            d="M2.5 6.2 5 8.5 9.5 3.5"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : null}
    </span>
  );
}

export function ArrowIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      className="h-4 w-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
    >
      <path
        d="M3.5 8h9M9 4.5 12.5 8 9 11.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
