import type { ItalyMixPayload } from "@/lib/generation/types";

export async function fetchItalyMix(date?: string) {
  const url = date ? `/api/generation?date=${encodeURIComponent(date)}` : "/api/generation";
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(res.status === 404 ? "Mix non disponibile" : "Caricamento fallito");
  }
  return res.json() as Promise<ItalyMixPayload>;
}
