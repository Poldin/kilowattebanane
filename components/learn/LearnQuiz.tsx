"use client";

import { useEffect, useState } from "react";
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

export function LearnQuiz({
  chapter,
  following,
}: {
  chapter: LearnChapterWithSlides;
  following?: LearnChapter;
}) {
  const slides = chapter.slides;
  const total = slides.length;

  const [index, setIndex] = useState(0);
  const [done, setDone] = useState(false);
  const [results, setResults] = useState<boolean[]>([]);

  const slide = slides[index];
  const correctCount = results.filter(Boolean).length;
  const scoredTotal = results.length;

  useEffect(() => {
    document
      .getElementById("learn-quiz")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [index, done]);

  function restart() {
    setIndex(0);
    setDone(false);
    setResults([]);
  }

  function recordResult(correct: boolean | null) {
    if (correct == null) return;
    setResults((prev) => [...prev, correct]);
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
  onResult,
  onNext,
  onPrev,
  onSkip,
}: {
  chapter: LearnChapterWithSlides;
  slide: LearnSlide;
  index: number;
  total: number;
  onResult: (correct: boolean | null) => void;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
}) {
  const last = index + 1 === total;
  const [revealed, setRevealed] = useState(slide.type === "info");
  const [eventId, setEventId] = useState<string | null>(null);

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
    };
  }, [chapter.id, slide.id, slide.type]);

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
    onResult(correct);
    log(interactions);
    if (slide.type === "open") {
      onNext();
      return;
    }
    setRevealed(true);
  }

  return (
    <section aria-labelledby="learn-title" className="insight-content-in">
      <LearnArrows
        canPrev={index > 0}
        canNext={!last}
        onPrev={onPrev}
        onNext={onSkip}
      />

      <div className="mt-4">
        <Progress total={total} current={index} revealed={revealed} />
      </div>

      <p className="mt-5 text-xs font-medium tracking-wide text-neutral-500 uppercase dark:text-neutral-400">
        {chapter.title}
        <span className="mx-1.5 font-normal text-neutral-400">·</span>
        {index + 1} di {total}
      </p>
      <h1
        id="learn-title"
        className="mt-2 text-2xl font-bold tracking-tight leading-tight text-foreground sm:text-3xl"
      >
        <LearnRichText text={slide.payload.title} inline />
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
        />
      ) : null}

      {slide.type === "multiple" ? (
        <MultiplePlay
          payload={slide.payload}
          revealed={revealed}
          onReveal={reveal}
        />
      ) : null}

      {slide.type === "open" ? (
        <OpenPlay payload={slide.payload} onReveal={reveal} />
      ) : null}

      {revealed ? (
        <button
          type="button"
          onClick={onNext}
          className="mt-5 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-foreground px-4 text-sm font-medium text-background transition-opacity hover:opacity-90 sm:w-auto"
        >
          {last ? "Vedi com'è andata" : "Avanti"}
          <ArrowIcon />
        </button>
      ) : null}
    </section>
  );
}

function SinglePlay({
  payload,
  revealed,
  onReveal,
}: {
  payload: LearnSinglePayload;
  revealed: boolean;
  onReveal: (correct: boolean, interactions: Record<string, unknown>) => void;
}) {
  const [picked, setPicked] = useState<string | null>(null);

  return (
    <>
      <LearnRichText
        text={payload.question}
        className="mt-5 text-base leading-relaxed text-neutral-700 dark:text-neutral-300"
      />
      <div role="radiogroup" className="mt-6 flex flex-col gap-2">
        {payload.options.map((option) => {
          const selected = picked === option.id;
          const isCorrect = option.id === payload.correctId;
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={revealed}
              onClick={() => {
                setPicked(option.id);
                onReveal(isCorrect, {
                  picked: option.id,
                  correct: isCorrect,
                });
              }}
              className={optionClass({ revealed, selected, isCorrect })}
            >
              <LearnRichText text={option.label} inline />
            </button>
          );
        })}
      </div>
    </>
  );
}

function MultiplePlay({
  payload,
  revealed,
  onReveal,
}: {
  payload: LearnMultiplePayload;
  revealed: boolean;
  onReveal: (correct: boolean, interactions: Record<string, unknown>) => void;
}) {
  const [picked, setPicked] = useState<string[]>([]);

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
      <LearnRichText
        text={payload.question}
        className="mt-5 text-base leading-relaxed text-neutral-700 dark:text-neutral-300"
      />
      <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
        Puoi selezionare più risposte.
      </p>
      <div className="mt-4 flex flex-col gap-2">
        {payload.options.map((option) => {
          const selected = picked.includes(option.id);
          const isCorrect = payload.correctIds.includes(option.id);
          return (
            <button
              key={option.id}
              type="button"
              role="checkbox"
              aria-checked={selected}
              disabled={revealed}
              onClick={() => toggle(option.id)}
              className={optionClass({ revealed, selected, isCorrect, checkbox: true })}
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
          <>
            <h1 className="mt-3 text-5xl font-bold tracking-tight leading-none sm:text-6xl">
              {correctCount} su {scoredTotal} {percent}% {scoreEmoji(percent)}
            </h1>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-neutral-800 sm:text-base">
              {scoreLine(percent)}
            </p>
          </>
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

function scoreLine(percent: number) {
  if (percent >= 100) return "Banana piena. Ora puoi spiegare il PUN anche in ascensore.";
  if (percent >= 70) return "Quasi tutta banana. Un kWh di attenzione e sei a posto.";
  if (percent >= 40) return "Mezza banana. Sai dov'è il bosco, non ancora il sentiero.";
  if (percent >= 1) return "Più scimmia che banana. Il grafico non morde: riprova.";
  return "Zero banane. Il mercato ha vinto 1-0, ma il ritorno si gioca dopo.";
}

function Progress({
  total,
  current,
  revealed,
}: {
  total: number;
  current: number;
  revealed: boolean;
}) {
  return (
    <ol className="flex gap-1.5" aria-hidden>
      {Array.from({ length: total }, (_, i) => {
        const done = i < current || (i === current && revealed);
        const active = i === current && !revealed;
        return (
          <li
            key={i}
            className={`h-1 flex-1 rounded-full ${
              done
                ? "bg-[#F5D547]"
                : active
                  ? "bg-neutral-400 dark:bg-neutral-500"
                  : "bg-neutral-200 dark:bg-neutral-800"
            }`}
          />
        );
      })}
    </ol>
  );
}

function optionClass({
  revealed,
  selected,
  isCorrect,
  checkbox = false,
}: {
  revealed: boolean;
  selected: boolean;
  isCorrect: boolean;
  checkbox?: boolean;
}) {
  const base = checkbox
    ? "flex w-full items-start gap-3 rounded-md border px-4 py-3 text-left text-sm leading-snug transition-colors disabled:cursor-default"
    : "w-full rounded-md border px-4 py-3 text-left text-sm leading-snug transition-colors disabled:cursor-default";
  if (!revealed) {
    if (selected && checkbox) {
      return `${base} border-neutral-400 bg-neutral-50 text-foreground dark:border-neutral-500 dark:bg-neutral-900`;
    }
    return `${base} border-neutral-200 bg-background text-foreground hover:border-neutral-400 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:border-neutral-600 dark:hover:bg-neutral-900`;
  }
  if (isCorrect) {
    return `${base} border-emerald-600 bg-emerald-50 text-emerald-950 dark:border-emerald-500 dark:bg-emerald-950 dark:text-emerald-50`;
  }
  if (selected) {
    return `${base} border-red-600 bg-red-50 text-red-950 dark:border-red-500 dark:bg-red-950 dark:text-red-50`;
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

function ArrowIcon() {
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
