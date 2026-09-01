"use client";

import { useEffect, useState } from "react";

/** Wall-clock tick so independent components stay in sync every `intervalMs`. */
export function useSyncedTick(intervalMs = 10_000) {
  const [tick, setTick] = useState(() => Math.floor(Date.now() / intervalMs));

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | undefined;

    const sync = () => setTick(Math.floor(Date.now() / intervalMs));

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
