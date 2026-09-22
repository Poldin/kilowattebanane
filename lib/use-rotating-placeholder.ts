"use client";

import { useEffect, useState } from "react";

/** Types in, holds, deletes, then rotates through sample strings. */
export function useRotatingPlaceholder(
  samples: readonly string[],
  cycleMs = 5000,
) {
  const [sampleIndex, setSampleIndex] = useState(0);
  const [text, setText] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    if (samples.length === 0) return;

    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const target = samples[sampleIndex % samples.length] ?? "";
    const len = target.length;

    if (reduceMotion) {
      setText(target);
      setIsTyping(false);
      const timeoutId = window.setTimeout(
        () => setSampleIndex((index) => (index + 1) % samples.length),
        cycleMs,
      );
      return () => window.clearTimeout(timeoutId);
    }

    const msPerCharIn = 110;
    const msPerCharOut = 70;
    const typeInMs = len * msPerCharIn;
    const typeOutMs = len * msPerCharOut;
    const holdMs = Math.max(1200, cycleMs - typeInMs - typeOutMs);
    const timeoutIds: number[] = [];

    const schedule = (fn: () => void, delayMs: number) => {
      timeoutIds.push(window.setTimeout(fn, delayMs));
    };

    setText("");
    setIsTyping(true);

    for (let i = 1; i <= len; i++) {
      schedule(() => {
        setText(target.slice(0, i));
        setIsTyping(i < len);
      }, i * msPerCharIn);
    }

    const deleteStart = typeInMs + holdMs;
    schedule(() => setIsTyping(true), deleteStart);

    for (let i = len - 1; i >= 0; i--) {
      schedule(() => {
        setText(target.slice(0, i));
        setIsTyping(i > 0);
      }, deleteStart + (len - i) * msPerCharOut);
    }

    schedule(() => setSampleIndex((index) => (index + 1) % samples.length), cycleMs);

    return () => {
      for (const id of timeoutIds) window.clearTimeout(id);
    };
  }, [sampleIndex, samples, cycleMs]);

  return { text, isTyping };
}
