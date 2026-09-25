import { unstable_cache } from "next/cache";
import {
  fetchItalyMixDays,
  fetchItalyMixForDate,
  fetchLatestItalyMix,
} from "@/lib/generation/query";
import { addCalendarDays, romeToday } from "@/lib/generation/time";
import type { ItalyMixPayload, MixDayPoint } from "@/lib/generation/types";

export type { ItalyMixPayload, MixDayPoint } from "@/lib/generation/types";

const CACHE: { revalidate: number; tags: string[] } = {
  revalidate: 3600,
  tags: ["generation"],
};

export async function loadItalyMix(date?: string): Promise<ItalyMixPayload | null> {
  const key = date ?? "latest";
  return unstable_cache(
    async () => (date ? fetchItalyMixForDate(date) : fetchLatestItalyMix()),
    ["italy-mix", key],
    CACHE,
  )();
}

export async function loadMailItalyMix(): Promise<ItalyMixPayload | null> {
  const yesterday = addCalendarDays(romeToday(), -1);
  const mix = await loadItalyMix(yesterday);
  if (mix?.hours.length) return mix;
  return loadItalyMix();
}

export async function loadItalyMixDays(): Promise<MixDayPoint[]> {
  return unstable_cache(fetchItalyMixDays, ["italy-mix-days"], CACHE)();
}
