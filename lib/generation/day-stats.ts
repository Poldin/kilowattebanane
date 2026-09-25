import { createAdminClient } from "@/lib/supabase/admin";
import { MIX_FOSSIL_IDS, MIX_RENEWABLE_IDS } from "@/lib/generation/sources";
import { romeHour } from "@/lib/generation/time";
import {
  MIX_SOURCE_IDS,
  type GenerationSlot,
  type MixDayPoint,
  type MixSourceId,
} from "@/lib/generation/types";

const UPSERT_CHUNK = 200;
const ROW_PAGE = 1000;
const MIN_SLOT_MW = 5_000;
const MIN_DAY_HOURS = 12;

type SlotGroup = {
  start: number;
  date: string;
  mw: Partial<Record<MixSourceId, number>>;
};

function asSource(value: string): MixSourceId | null {
  return MIX_SOURCE_IDS.includes(value as MixSourceId)
    ? (value as MixSourceId)
    : null;
}

function totalMw(mw: Partial<Record<MixSourceId, number>>) {
  return MIX_SOURCE_IDS.reduce((sum, id) => sum + (mw[id] ?? 0), 0);
}

function isUsableMw(mw: Partial<Record<MixSourceId, number>>) {
  return totalMw(mw) >= MIN_SLOT_MW && (mw.gas ?? 0) > 0;
}

function groupSlots(slots: GenerationSlot[]): SlotGroup[] {
  const byStart = new Map<string, SlotGroup>();
  for (const slot of slots) {
    const start = slot.slotStart.getTime();
    if (!Number.isFinite(start)) continue;
    const key = String(start);
    const group = byStart.get(key) ?? {
      start,
      date: slot.deliveryDate,
      mw: {},
    };
    group.mw[slot.sourceType] = (group.mw[slot.sourceType] ?? 0) + slot.mw;
    byStart.set(key, group);
  }
  return [...byStart.values()].sort((a, b) => a.start - b.start);
}

function slotStepHours(groups: SlotGroup[]) {
  if (groups.length < 2) return 1;
  const dt = (groups[1].start - groups[0].start) / 3_600_000;
  if (dt <= 0.4) return 0.25;
  if (dt <= 1.5) return 1;
  return Math.min(dt, 2);
}

function mixDayFromGroups(date: string, groups: SlotGroup[]): MixDayPoint | null {
  const usable = groups.filter((group) => isUsableMw(group.mw));
  if (usable.length === 0) return null;

  const step = slotStepHours(usable);
  const mwh: Partial<Record<MixSourceId, number>> = {};
  let totalMwh = 0;
  const hours = new Map<
    number,
    { mw: Partial<Record<MixSourceId, number>>; n: number }
  >();

  for (const group of usable) {
    const hour = romeHour(new Date(group.start).toISOString());
    const bucket = hours.get(hour) ?? { mw: {}, n: 0 };
    for (const id of MIX_SOURCE_IDS) {
      const value = group.mw[id] ?? 0;
      if (value > 0) {
        mwh[id] = (mwh[id] ?? 0) + value * step;
        totalMwh += value * step;
        bucket.mw[id] = (bucket.mw[id] ?? 0) + value;
      }
    }
    bucket.n += 1;
    hours.set(hour, bucket);
  }

  if (!(totalMwh > 0) || hours.size < MIN_DAY_HOURS) return null;

  let peakHour = 0;
  let peakMw = 0;
  let cleanestHour = 0;
  let cleanestShare = 0;
  for (const [hour, bucket] of hours) {
    const mw: Partial<Record<MixSourceId, number>> = {};
    let total = 0;
    for (const id of MIX_SOURCE_IDS) {
      const value = (bucket.mw[id] ?? 0) / bucket.n;
      if (value > 0) {
        mw[id] = value;
        total += value;
      }
    }
    if (!(total > 0)) continue;
    if (total > peakMw) {
      peakMw = total;
      peakHour = hour;
    }
    const renewable =
      MIX_RENEWABLE_IDS.reduce((sum, id) => sum + (mw[id] ?? 0), 0) / total;
    if (
      renewable > cleanestShare + 1e-6 ||
      (Math.abs(renewable - cleanestShare) <= 1e-6 && hour < cleanestHour)
    ) {
      cleanestShare = renewable;
      cleanestHour = hour;
    }
  }

  const renewableMwh = MIX_RENEWABLE_IDS.reduce(
    (sum, id) => sum + (mwh[id] ?? 0),
    0,
  );
  const fossilMwh = MIX_FOSSIL_IDS.reduce((sum, id) => sum + (mwh[id] ?? 0), 0);

  return {
    date,
    mwh,
    totalMwh,
    renewableShare: renewableMwh / totalMwh,
    fossilShare: fossilMwh / totalMwh,
    peakMw,
    peakHour,
    cleanestHour,
    cleanestShare,
    hourCount: hours.size,
  };
}

export function mixDaysFromSlots(slots: GenerationSlot[]): MixDayPoint[] {
  const byDate = new Map<string, SlotGroup[]>();
  for (const group of groupSlots(slots)) {
    const list = byDate.get(group.date) ?? [];
    list.push(group);
    byDate.set(group.date, list);
  }

  const days: MixDayPoint[] = [];
  for (const date of [...byDate.keys()].sort((a, b) => a.localeCompare(b))) {
    const point = mixDayFromGroups(date, byDate.get(date) ?? []);
    if (point) days.push(point);
  }
  return days;
}

function compactMwh(mwh: Partial<Record<MixSourceId, number>>) {
  const out: Partial<Record<MixSourceId, number>> = {};
  for (const id of MIX_SOURCE_IDS) {
    const value = mwh[id] ?? 0;
    if (value > 0) out[id] = Math.round(value * 10) / 10;
  }
  return out;
}

export async function upsertMixDayStats(days: MixDayPoint[]) {
  if (days.length === 0) return 0;
  const supabase = createAdminClient();
  const updatedAt = new Date().toISOString();
  let upserted = 0;

  for (let i = 0; i < days.length; i += UPSERT_CHUNK) {
    const chunk = days.slice(i, i + UPSERT_CHUNK);
    const { error, data } = await supabase
      .from("generation_mix_day_stats")
      .upsert(
        chunk.map((day) => ({
          delivery_date: day.date,
          mwh: compactMwh(day.mwh),
          total_mwh: Math.round(day.totalMwh * 10) / 10,
          renewable_share: Math.round(day.renewableShare * 10_000) / 10_000,
          fossil_share: Math.round(day.fossilShare * 10_000) / 10_000,
          peak_mw: Math.round(day.peakMw * 10) / 10,
          peak_hour: day.peakHour,
          cleanest_hour: day.cleanestHour,
          cleanest_share: Math.round(day.cleanestShare * 10_000) / 10_000,
          hour_count: day.hourCount,
          updated_at: updatedAt,
        })),
        { onConflict: "delivery_date" },
      )
      .select("delivery_date");

    if (error) throw new Error(error.message);
    upserted += data?.length ?? chunk.length;
  }

  return upserted;
}

export async function loadStoredMixSlots(): Promise<GenerationSlot[]> {
  const supabase = createAdminClient();
  const slots: GenerationSlot[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("generation_mix")
      .select("slot_start, delivery_date, source_type, mw")
      .order("slot_start", { ascending: true })
      .range(from, from + ROW_PAGE - 1);

    if (error) throw new Error(error.message);
    if (!data?.length) break;

    for (const row of data) {
      const source = asSource(String(row.source_type));
      if (!source) continue;
      slots.push({
        slotStart: new Date(String(row.slot_start)),
        deliveryDate: String(row.delivery_date),
        sourceType: source,
        mw: Number(row.mw),
      });
    }

    if (data.length < ROW_PAGE) break;
    from += ROW_PAGE;
  }

  return slots;
}
