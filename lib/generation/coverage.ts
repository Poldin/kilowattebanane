import { createAdminClient } from "@/lib/supabase/admin";
import { addCalendarDays, romeHour } from "@/lib/generation/time";

/** A Rome day is closed once the 23:00 quarter is stored. */
const COMPLETE_HOUR = 23;
const MAX_DAYS_PER_FETCH = 14;
const MAX_FETCHES = 2;

export type MixCoverageDay = {
  date: string;
  lastSlot: string;
};

export type MixFetchRange = {
  from: string;
  to: string;
};

export type MixRecoveryPlan = {
  ranges: MixFetchRange[];
  pendingFrom: string | null;
};

function daysBetween(from: string, to: string) {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  return Math.round((end - start) / 86_400_000);
}

function packRanges(dates: string[], maxDays: number): MixFetchRange[] {
  const ranges: MixFetchRange[] = [];
  let index = 0;
  while (index < dates.length) {
    const from = dates[index];
    let to = from;
    let next = index;
    while (next + 1 < dates.length) {
      const candidate = dates[next + 1];
      if (daysBetween(from, candidate) + 1 > maxDays) break;
      to = candidate;
      next += 1;
    }
    ranges.push({ from, to });
    index = next + 1;
  }
  return ranges;
}

export function planMixRecovery(
  coverage: MixCoverageDay[],
  today: string,
  daysBack: number,
): MixRecoveryPlan {
  const lastByDate = new Map(coverage.map((row) => [row.date, row.lastSlot]));
  const needed = new Set<string>();
  const overlap = Math.max(0, Math.trunc(daysBack));

  for (let i = 0; i <= overlap; i += 1) {
    needed.add(addCalendarDays(today, -i));
  }

  if (coverage.length > 0) {
    const earliest = coverage.reduce(
      (min, row) => (row.date < min ? row.date : min),
      coverage[0].date,
    );
    for (let date = earliest; date < today; date = addCalendarDays(date, 1)) {
      const lastSlot = lastByDate.get(date);
      if (!lastSlot || romeHour(lastSlot) < COMPLETE_HOUR) needed.add(date);
    }
  }

  const newestFirst = [...needed].sort((a, b) => b.localeCompare(a));
  const budget = MAX_DAYS_PER_FETCH * MAX_FETCHES;
  const chosen = newestFirst.slice(0, budget).sort();
  const deferred = newestFirst.slice(budget);

  const packed = packRanges(chosen, MAX_DAYS_PER_FETCH).sort((a, b) =>
    b.to.localeCompare(a.to),
  );
  const ranges = packed.slice(0, MAX_FETCHES);
  const dropped = packed.slice(MAX_FETCHES);
  const pendingDates = [...deferred];
  for (const range of dropped) {
    for (let date = range.from; date <= range.to; date = addCalendarDays(date, 1)) {
      pendingDates.push(date);
    }
  }

  const pendingFrom = pendingDates.length
    ? pendingDates.reduce((min, date) => (date < min ? date : min))
    : null;

  return { ranges, pendingFrom };
}

export async function loadMixCoverage(): Promise<MixCoverageDay[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("list_generation_mix_coverage");
  if (error) throw new Error(error.message);
  if (!data?.length) return [];

  const days: MixCoverageDay[] = [];
  for (const row of data as { delivery_date?: unknown; last_slot?: unknown }[]) {
    const date = String(row.delivery_date ?? "").slice(0, 10);
    const rawSlot = String(row.last_slot ?? "");
    const parsed = new Date(rawSlot.includes("T") ? rawSlot : rawSlot.replace(" ", "T"));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(parsed.getTime())) continue;
    days.push({ date, lastSlot: parsed.toISOString() });
  }
  return days;
}
