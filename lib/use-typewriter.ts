"use client";

import { useEffect, useRef, useState } from "react";

/** Types out `target` character-by-character when it changes. */
export function useTypewriter(target: string, msPerChar = 42) {
  const [activeTarget, setActiveTarget] = useState(target);
  const [charCount, setCharCount] = useState(() => Array.from(target).length);
  const skipInitialEffect = useRef(true);

  if (target !== activeTarget) {
    setActiveTarget(target);
    setCharCount(0);
  }

  useEffect(() => {
    if (skipInitialEffect.current) {
      skipInitialEffect.current = false;
      return;
    }

    const chars = Array.from(target);
    const len = chars.length;

    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduceMotion) {
      const timeoutId = window.setTimeout(() => setCharCount(len), 0);
      return () => window.clearTimeout(timeoutId);
    }

    let i = 0;
    const intervalId = window.setInterval(() => {
      i += 1;
      setCharCount(i);
      if (i >= len) window.clearInterval(intervalId);
    }, msPerChar);

    return () => window.clearInterval(intervalId);
  }, [target, msPerChar]);

  const resetting = target !== activeTarget;
  const text = resetting
    ? ""
    : Array.from(target).slice(0, charCount).join("");
  const isTyping = !resetting && charCount < Array.from(target).length;

  return { text, isTyping };
}
