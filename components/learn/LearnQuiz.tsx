"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { LearnArrows } from "@/components/learn/LearnArrows";
import { SignupSlot } from "@/components/SignupForm";
import {
  learnChapterPath,
  nextChapter,
  type LearnChapter,
  type LearnHourQuestion,
  type LearnQuestion,
} from "@/lib/learn/questions";

const BANANA = "#F5D547";

export function LearnQuiz({ chapter }: { chapter: LearnChapter }) {
  const questions = chapter.questions;
  const total = questions.length;
  const following = nextChapter(chapter.id);

  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<string | number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [results, setResults] = useState<boolean[]>([]);
  const [done, setDone] = useState(false);

  const question = questions[index];
  const correctCount = results.filter(Boolean).length;

  useEffect(() => {
    document
      .getElementById("learn-quiz")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [index, done]);

  function restart() {
    setIndex(0);
    setPicked(null);
    setRevealed(false);
    setResults([]);
    setDone(false);
  }

  function lockAnswer(next: string | number, correct: boolean) {
    if (revealed) return;
    setPicked(next);
    setRevealed(true);
    setResults((prev) => [...prev, correct]);
  }

  function goNext() {
    if (index + 1 >= total) {
      setDone(true);
      return;
    }
    setIndex((n) => n + 1);
    setPicked(null);
    setRevealed(false);
  }

  function skipNext() {
    if (index + 1 >= total) return;
    setIndex((n) => n + 1);
    setPicked(null);
    setRevealed(false);
  }

  function skipPrev() {
    if (index <= 0) return;
    setIndex((n) => n - 1);
    setPicked(null);
    setRevealed(false);
  }

  return (
    <div id="learn-quiz" className="mx-auto w-full max-w-xl scroll-mt-20">
      {done ? (
        <Done
          chapter={chapter}
          correctCount={correctCount}
          total={total}
          following={following}
          onRestart={restart}
        />
      ) : question ? (
        <Play
          chapterTitle={chapter.title}
          question={question}
          index={index}
          total={total}
          picked={picked}
          revealed={revealed}
          onPick={lockAnswer}
          onNext={goNext}
          onPrev={skipPrev}
          onSkip={skipNext}
        />
      ) : null}
    </div>
  );
}

function Play({
  chapterTitle,
  question,
  index,
  total,
  picked,
  revealed,
  onPick,
  onNext,
  onPrev,
  onSkip,
}: {
  chapterTitle: string;
  question: LearnQuestion;
  index: number;
  total: number;
  picked: string | number | null;
  revealed: boolean;
  onPick: (next: string | number, correct: boolean) => void;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
}) {
  const last = index + 1 === total;

  return (
    <section
      aria-labelledby="learn-prompt"
      className="insight-content-in"
      key={question.id}
    >
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
        {chapterTitle}
        <span className="mx-1.5 font-normal text-neutral-400">·</span>
        {index + 1} di {total}
      </p>
      <h1
        id="learn-prompt"
        className="mt-2 text-2xl font-bold tracking-tight leading-tight text-foreground sm:text-3xl"
      >
        {question.prompt}
      </h1>

      {question.kind === "choice" ? (
        <div
          role="radiogroup"
          aria-labelledby="learn-prompt"
          className="mt-6 flex flex-col gap-2"
        >
          {question.options.map((option) => {
            const selected = picked === option.id;
            const isCorrect = option.id === question.correctId;
            return (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={revealed}
                onClick={() =>
                  onPick(option.id, option.id === question.correctId)
                }
                className={optionClass(revealed, selected, isCorrect)}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      ) : (
        <HourPicker
          question={question}
          picked={typeof picked === "number" ? picked : null}
          revealed={revealed}
          onPick={onPick}
        />
      )}

      {revealed ? (
        <div className="mt-5 rounded-lg border border-neutral-200 bg-neutral-50 p-4 sm:p-5 dark:border-neutral-800 dark:bg-neutral-950">
          <p className="text-sm font-medium text-foreground">
            {resultsLine(question, picked)}
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
            {question.explanation}
          </p>
        </div>
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

function HourPicker({
  question,
  picked,
  revealed,
  onPick,
}: {
  question: LearnHourQuestion;
  picked: number | null;
  revealed: boolean;
  onPick: (next: number, correct: boolean) => void;
}) {
  const layout = useMemo(() => hourLayout(question.prices), [question.prices]);

  return (
    <div className="mt-6">
      <p className="mb-2 text-sm text-neutral-500 dark:text-neutral-400">
        {question.hint}
      </p>
      <div className="relative overflow-hidden rounded-lg border border-neutral-800 bg-[#111111]">
        <svg
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          className="block h-44 w-full sm:h-52"
          role="img"
          aria-hidden
        >
          <rect width={layout.width} height={layout.height} fill="#111111" />
          {picked !== null ? (
            <rect
              x={layout.padX + picked * layout.colW}
              y={layout.padY}
              width={layout.colW}
              height={layout.innerH}
              fill={
                question.cheapHours.includes(picked) ? BANANA : "#EF4444"
              }
              opacity={0.22}
            />
          ) : null}
          <path d={layout.area} fill={BANANA} opacity="0.16" />
          <path
            d={layout.line}
            fill="none"
            stroke={BANANA}
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {picked !== null ? (
            <circle
              cx={layout.padX + (picked + 0.5) * layout.colW}
              cy={layout.yAt(question.prices[picked] ?? 0)}
              r="4.5"
              fill={BANANA}
              stroke="#111111"
              strokeWidth="2"
            />
          ) : null}
        </svg>
        <div
          className="absolute inset-0 grid"
          style={{ gridTemplateColumns: "repeat(24, minmax(0, 1fr))" }}
          role="radiogroup"
          aria-label="Scegli un'ora"
        >
          {question.prices.map((_, hour) => (
            <button
              key={hour}
              type="button"
              role="radio"
              aria-checked={picked === hour}
              disabled={revealed}
              aria-label={`${String(hour).padStart(2, "0")}:00`}
              onClick={() =>
                onPick(hour, question.cheapHours.includes(hour))
              }
              className="min-h-11 transition-colors hover:bg-white/6 disabled:hover:bg-transparent"
            />
          ))}
        </div>
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-neutral-500 dark:text-neutral-500">
        <span>00</span>
        <span>12</span>
        <span>24</span>
      </div>
    </div>
  );
}

function Done({
  chapter,
  correctCount,
  total,
  following,
  onRestart,
}: {
  chapter: LearnChapter;
  correctCount: number;
  total: number;
  following: LearnChapter | undefined;
  onRestart: () => void;
}) {
  const headline =
    correctCount === total
      ? "Banana. Le hai prese tutte."
      : correctCount === 0
        ? "Sei in buona compagnia."
        : "Ci sei quasi, e sei in ottima compagnia.";

  return (
    <section className="insight-content-in">
      <LearnArrows canPrev={false} canNext={false} />
      <div className="mt-4 rounded-lg bg-[#F5D547] p-5 text-[#111111] sm:p-6">
        <p className="text-xs font-medium tracking-wide uppercase">
          {correctCount} su {total} · {chapter.title}
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight leading-tight sm:text-4xl">
          {headline}
        </h1>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-neutral-800">
          {chapter.takeaway}
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {following ? (
            <Link
              href={learnChapterPath(following.id)}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[#111111] px-4 text-sm font-medium text-[#F5D547] transition-opacity hover:opacity-90"
            >
              {following.title}
              <ArrowIcon />
            </Link>
          ) : (
            <Link
              href="/learn"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[#111111] px-4 text-sm font-medium text-[#F5D547] transition-opacity hover:opacity-90"
            >
              Tutti i capitoli
              <ArrowIcon />
            </Link>
          )}
          <button
            type="button"
            onClick={onRestart}
            className="inline-flex h-10 items-center justify-center rounded-md border border-[#111111]/20 px-4 text-sm font-medium text-[#111111] transition-colors hover:bg-[#111111]/8"
          >
            Rifai
          </button>
          {following ? (
            <Link
              href="/learn"
              className="inline-flex h-10 items-center justify-center px-1 text-sm font-medium text-[#111111]/70 transition-colors hover:text-[#111111] sm:px-2"
            >
              Tutti i capitoli
            </Link>
          ) : null}
        </div>
      </div>

      <SignupSlot className="mt-6 w-full scroll-mt-20" />
    </section>
  );
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

function resultsLine(question: LearnQuestion, picked: string | number | null) {
  if (question.kind === "hour") {
    if (typeof picked !== "number") return "Ok.";
    const hour = `${String(picked).padStart(2, "0")}:00`;
    if (question.cheapHours.includes(picked)) {
      return `🍌 ${hour}: sei sulla banana.`;
    }
    return `🐵 ${hour}: ora cara. La banana era intorno alle 13.`;
  }
  if (picked === question.correctId) return "Esatto.";
  return "Quasi. Sei in buona compagnia.";
}

function optionClass(revealed: boolean, selected: boolean, isCorrect: boolean) {
  const base =
    "w-full rounded-md border px-4 py-3 text-left text-sm leading-snug transition-colors disabled:cursor-default";
  if (!revealed) {
    return `${base} border-neutral-200 bg-background text-foreground hover:border-neutral-400 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:border-neutral-600 dark:hover:bg-neutral-900`;
  }
  if (isCorrect) {
    return `${base} border-[#F5D547] bg-[#F5D547] text-[#111111]`;
  }
  if (selected) {
    return `${base} border-neutral-300 bg-neutral-100 text-neutral-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-400`;
  }
  return `${base} border-neutral-200 bg-background text-neutral-400 dark:border-neutral-800 dark:text-neutral-600`;
}

function hourLayout(prices: number[]) {
  const width = 320;
  const height = 140;
  const padX = 0;
  const padY = 12;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;
  const colW = innerW / 24;
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const span = Math.max(max - min, 1);
  const yAt = (price: number) => padY + ((max - price) / span) * innerH;
  const points = prices.map((price, hour) => {
    const x = padX + (hour + 0.5) * colW;
    const y = yAt(price);
    return `${hour === 0 ? "M" : "L"} ${x} ${y}`;
  });
  const line = points.join(" ");
  const area = `${line} L ${padX + innerW} ${padY + innerH} L ${padX} ${padY + innerH} Z`;
  return { width, height, padX, padY, innerH, colW, line, area, yAt };
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
