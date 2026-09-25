import { createAdminClient } from "@/lib/supabase/admin";
import { sharesFromMw } from "@/lib/generation/sources";
import { romeHour } from "@/lib/generation/time";
import {
  MIX_SOURCE_IDS,
  type ItalyMixPayload,
  type MixDayPoint,
  type MixHourPoint,
  type MixSourceId,
} from "@/lib/generation/types";

function asSource(value: string): MixSourceId | null {
  return MIX_SOURCE_IDS.includes(value as MixSourceId) ? (value as MixSourceId) : null;
}

type MixRow = {
  slot_start: string;
  delivery_date: string;
  source_type: MixSourceId;
  mw: number;
};

function groupByStart(rows: MixRow[]) {
  const byStart = new Map<string, MixRow[]>();
  for (const row of rows) {
    const list = byStart.get(row.slot_start) ?? [];
    list.push(row);
    byStart.set(row.slot_start, list);
  }
  return byStart;
}

function isUsableSlot(group: MixRow[]) {
  const mw = group.reduce((sum, row) => sum + row.mw, 0);
  const sources = new Set(group.map((row) => row.source_type));
  return mw >= 5_000 && sources.has("gas") && sources.has("other");
}

function sharesForGroup(group: MixRow[]) {
  const bySource: Partial<Record<MixSourceId, number>> = {};
  for (const row of group) {
    bySource[row.source_type] = (bySource[row.source_type] ?? 0) + row.mw;
  }
  const shares = sharesFromMw(bySource);
  const totalMw = shares.reduce((sum, row) => sum + row.mw, 0);
  return { bySource, shares, totalMw };
}

function hourlySeries(groups: MixRow[][]): MixHourPoint[] {
  const buckets = new Map<
    number,
    { slotStart: string; sums: Partial<Record<MixSourceId, number>>; n: number }
  >();

  for (const group of groups) {
    const hour = romeHour(group[0].slot_start);
    const { bySource } = sharesForGroup(group);
    const current = buckets.get(hour) ?? {
      slotStart: group[0].slot_start,
      sums: {},
      n: 0,
    };
    if (group[0].slot_start < current.slotStart) current.slotStart = group[0].slot_start;
    for (const id of MIX_SOURCE_IDS) {
      current.sums[id] = (current.sums[id] ?? 0) + (bySource[id] ?? 0);
    }
    current.n += 1;
    buckets.set(hour, current);
  }

  return [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([hour, bucket]) => {
      const mw: Partial<Record<MixSourceId, number>> = {};
      let totalMw = 0;
      for (const id of MIX_SOURCE_IDS) {
        const value = (bucket.sums[id] ?? 0) / bucket.n;
        if (value > 0) {
          mw[id] = value;
          totalMw += value;
        }
      }
      return { slotStart: bucket.slotStart, hour, mw, totalMw };
    })
    .filter((point) => point.totalMw >= 5_000);
}

function payloadFromRows(rows: MixRow[]): ItalyMixPayload | null {
  const byStart = groupByStart(rows);
  const usable = [...byStart.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .filter(([, group]) => isUsableSlot(group));
  const latestGroup = usable.at(-1)?.[1] ?? [];
  if (!latestGroup.length) return null;

  const latestMix = sharesForGroup(latestGroup);
  if (!latestMix.totalMw) return null;

  return {
    slotStart: latestGroup[0].slot_start,
    date: latestGroup[0].delivery_date,
    shares: latestMix.shares,
    totalMw: latestMix.totalMw,
    hours: hourlySeries(usable.map(([, group]) => group)),
  };
}

async function rowsForDate(date: string): Promise<MixRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("generation_mix")
    .select("slot_start, delivery_date, source_type, mw")
    .eq("delivery_date", date)
    .order("slot_start", { ascending: true });

  if (error) throw new Error(error.message);
  if (!data?.length) return [];

  const rows: MixRow[] = [];
  for (const row of data) {
    const source = asSource(String(row.source_type));
    if (!source) continue;
    rows.push({
      slot_start: String(row.slot_start),
      delivery_date: String(row.delivery_date),
      source_type: source,
      mw: Number(row.mw),
    });
  }
  return rows;
}

export async function fetchItalyMixForDate(date: string): Promise<ItalyMixPayload | null> {
  return payloadFromRows(await rowsForDate(date));
}

export async function fetchLatestItalyMix(): Promise<ItalyMixPayload | null> {
  const supabase = createAdminClient();
  const { data: latest, error: latestError } = await supabase
    .from("generation_mix")
    .select("delivery_date")
    .order("slot_start", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestError) throw new Error(latestError.message);
  if (!latest?.delivery_date) return null;
  return fetchItalyMixForDate(String(latest.delivery_date));
}

function mapDayStat(row: {
  delivery_date: unknown;
  mwh: unknown;
  total_mwh: unknown;
  renewable_share: unknown;
  fossil_share: unknown;
  peak_mw: unknown;
  peak_hour: unknown;
  cleanest_hour: unknown;
  cleanest_share: unknown;
  hour_count: unknown;
}): MixDayPoint | null {
  const date = String(row.delivery_date ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const raw = row.mwh && typeof row.mwh === "object" ? row.mwh : {};
  const mwh: Partial<Record<MixSourceId, number>> = {};
  for (const id of MIX_SOURCE_IDS) {
    const value = Number((raw as Record<string, unknown>)[id]);
    if (Number.isFinite(value) && value > 0) mwh[id] = value;
  }
  const totalMwh = Number(row.total_mwh);
  if (!(totalMwh > 0)) return null;
  return {
    date,
    mwh,
    totalMwh,
    renewableShare: Number(row.renewable_share) || 0,
    fossilShare: Number(row.fossil_share) || 0,
    peakMw: Number(row.peak_mw) || 0,
    peakHour: Number(row.peak_hour) || 0,
    cleanestHour: Number(row.cleanest_hour) || 0,
    cleanestShare: Number(row.cleanest_share) || 0,
    hourCount: Number(row.hour_count) || 0,
  };
}

export async function fetchItalyMixDays(): Promise<MixDayPoint[]> {
  const supabase = createAdminClient();
  const days: MixDayPoint[] = [];
  let from = 0;
  const page = 1000;

  while (true) {
    const { data, error } = await supabase
      .from("generation_mix_day_stats")
      .select(
        "delivery_date, mwh, total_mwh, renewable_share, fossil_share, peak_mw, peak_hour, cleanest_hour, cleanest_share, hour_count",
      )
      .order("delivery_date", { ascending: true })
      .range(from, from + page - 1);

    if (error) throw new Error(error.message);
    if (!data?.length) break;

    for (const row of data) {
      const mapped = mapDayStat(row);
      if (mapped) days.push(mapped);
    }
    if (data.length < page) break;
    from += page;
  }

  return days;
}
