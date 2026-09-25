import { createAdminClient } from "@/lib/supabase/admin";
import {
  loadStoredMixSlots,
  mixDaysFromSlots,
  upsertMixDayStats,
} from "@/lib/generation/day-stats";
import { fetchItalyGeneration } from "@/lib/generation/fetch";
import { addCalendarDays, romeToday } from "@/lib/generation/time";
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
  const supabase = createAdminClient();
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

export async function pullItalyGeneration(daysBack = 1): Promise<GenerationPullSummary> {
  const to = romeToday();
  const from = addCalendarDays(to, -Math.max(0, daysBack));
  const previousLatest = await latestStoredSlot();
  const slots = await fetchItalyGeneration(from, to);
  const upserted = await upsertSlots(slots);
  await upsertMixDayStats(mixDaysFromSlots(slots));
  const latestSlot =
    slots.reduce<Date | null>((latest, slot) => {
      if (!latest || slot.slotStart > latest) return slot.slotStart;
      return latest;
    }, null)?.toISOString() ?? previousLatest;

  return {
    from,
    to,
    upserted,
    latestSlot,
    previousLatest,
    updated: Boolean(latestSlot && latestSlot !== previousLatest),
    source: "energy-charts",
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
  const days = mixDaysFromSlots(slots);
  const upserted = await upsertMixDayStats(days);
  return { from, to, days: upserted, source: "energy-charts" };
}
