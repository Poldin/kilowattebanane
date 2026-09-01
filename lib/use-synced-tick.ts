"use client";

import { useEffect, useState } from "react";

/** Wall-clock tick so independent components stay in sync every `intervalMs`. */
export function useSyncedTick(intervalMs = 10_000) {
  // Stay on 0 until mount so SSR HTML matches the first client render.
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | undefined;

    const sync = () => setTick(Math.floor(Date.now() / intervalMs));
    sync();

    const delay = intervalMs - (Date.now() % intervalMs);
    const timeoutId = setTimeout(() => {
      sync();
      intervalId = setInterval(sync, intervalMs);
    }, delay);

    return () => {
      clearTimeout(timeoutId);
      if (intervalId) clearInterval(intervalId);
    };
  }, [intervalMs]);

  return tick;
}
