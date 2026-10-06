"use client";

import { useEffect, useRef, useState } from "react";

/** Types out `target` character-by-character when it changes. */
export function useTypewriter(target: string, msPerChar = 42) {
  const [charCount, setCharCount] = useState(() => Array.from(target).length);
  const seenTarget = useRef<string | null>(null);

  useEffect(() => {
    const chars = Array.from(target);
    const len = chars.length;

    if (seenTarget.current === null) {
      seenTarget.current = target;
      setCharCount(len);
      return;
    }

    if (seenTarget.current === target) return;
    seenTarget.current = target;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      setCharCount(len);
      return;
    }

    setCharCount(0);
    let i = 0;
    const intervalId = window.setInterval(() => {
      i += 1;
      setCharCount(i);
      if (i >= len) window.clearInterval(intervalId);
    }, msPerChar);

    return () => window.clearInterval(intervalId);
  }, [target, msPerChar]);

  const text = Array.from(target).slice(0, charCount).join("");
  const isTyping = charCount < Array.from(target).length;

  return { text, isTyping };
}
