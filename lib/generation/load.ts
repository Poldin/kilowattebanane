import { unstable_cache } from "next/cache";
import { fetchItalyMixForDate, fetchLatestItalyMix } from "@/lib/generation/query";
import type { ItalyMixPayload } from "@/lib/generation/types";

export type { ItalyMixPayload } from "@/lib/generation/types";

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
