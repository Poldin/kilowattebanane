import { createAdminClient } from "@/lib/supabase/admin";
import { createSecretClient } from "@/lib/supabase/secret";
import { loadMixCoverage, planMixRecovery } from "@/lib/generation/coverage";
import {
  loadStoredMixSlots,
  mixDaysFromSlots,
  upsertMixDayStats,
} from "@/lib/generation/day-stats";
import { fetchItalyGeneration } from "@/lib/generation/fetch";
import { revalidateGeneration } from "@/lib/generation/revalidate";
import { romeToday } from "@/lib/generation/time";
import type {
  GenerationLookbackSummary,
  GenerationPullSummary,
  GenerationSlot,
} from "@/lib/generation/types";

const UPSERT_CHUNK = 500;

function chunk<T>(items: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function latestStoredSlot() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("generation_mix")
    .select("slot_start")
    .order("slot_start", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.slot_start ? String(data.slot_start) : null;
}

async function upsertSlots(slots: GenerationSlot[]) {
  if (slots.length === 0) return 0;
  const supabase = createSecretClient();
  const fetchedAt = new Date().toISOString();
  let upserted = 0;

  for (const group of chunk(slots, UPSERT_CHUNK)) {
    const { error, data } = await supabase
      .from("generation_mix")
      .upsert(
        group.map((slot) => ({
          slot_start: slot.slotStart.toISOString(),
          delivery_date: slot.deliveryDate,
          source_type: slot.sourceType,
          mw: Math.round(slot.mw * 10) / 10,
          fetched_at: fetchedAt,
        })),
        { onConflict: "slot_start,source_type" },
      )
      .select("id");

    if (error) throw new Error(error.message);
    upserted += data?.length ?? group.length;
  }

  return upserted;
}

async function storeSlots(slots: GenerationSlot[]) {
  const upserted = await upsertSlots(slots);
  const days = mixDaysFromSlots(slots);
  const written = await upsertMixDayStats(days);
  if (upserted > 0 || written > 0) revalidateGeneration();
  return { upserted, days: days.length };
}

export async function pullItalyGeneration(daysBack = 1): Promise<GenerationPullSummary> {
  const today = romeToday();
  const plan = planMixRecovery(await loadMixCoverage(), today, daysBack);
  const previousLatest = await latestStoredSlot();
  let upserted = 0;
  let from = today;
  let to = today;
  let latestMs = previousLatest ? Date.parse(previousLatest) : Number.NaN;
  let latestSlot = Number.isNaN(latestMs) ? null : new Date(latestMs).toISOString();

  for (const range of plan.ranges) {
    const slots = await fetchItalyGeneration(range.from, range.to, 40_000);
    upserted += (await storeSlots(slots)).upserted;
    if (range.from < from) from = range.from;
    if (range.to > to) to = range.to;
    for (const slot of slots) {
      const ms = slot.slotStart.getTime();
      if (Number.isNaN(latestMs) || ms > latestMs) {
        latestMs = ms;
        latestSlot = slot.slotStart.toISOString();
      }
    }
  }

  const previousMs = previousLatest ? Date.parse(previousLatest) : Number.NaN;
  return {
    from,
    to,
    upserted,
    latestSlot,
    previousLatest,
    updated: Boolean(latestSlot && (Number.isNaN(previousMs) || latestMs !== previousMs)),
    source: "energy-charts",
    pendingFrom: plan.pendingFrom,
  };
}

export async function rebuildItalyMixDayStatsFromStored(): Promise<GenerationLookbackSummary> {
  const days = mixDaysFromSlots(await loadStoredMixSlots());
  const upserted = await upsertMixDayStats(days);
  return {
    from: days[0]?.date ?? null,
    to: days.at(-1)?.date ?? null,
    days: upserted,
    source: "stored",
  };
}

export async function pullItalyMixLookback(
  from: string,
  to: string,
): Promise<GenerationLookbackSummary> {
  const slots = await fetchItalyGeneration(from, to, 40_000);
  const stored = await storeSlots(slots);
  return { from, to, days: stored.days, source: "energy-charts" };
}
