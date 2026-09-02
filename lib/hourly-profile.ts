import type { ZoneDay } from "@/lib/day-ahead-query";
import { joinItalian, toEurocentPerKwh } from "@/lib/insights";
import { toHourlyAverages } from "@/lib/prices";

export const MIN_HOURLY_PROFILE_DAYS = 1;
const TOP_HOURS_PER_DAY = 3;
const SHAPE_SPAN_SHARE = 0.22;
const MAX_SHAPE_HOURS = 8;
const FREQ_CAPTION_SHARE = 0.3;

export type ProfileBand = {
  start: number;
  end: number;
};

export type HourProfile = {
  hour: number;
  avg: number;
  cheapDays: number;
  expensiveDays: number;
  samples: number;
};

export type HourlyProfile = {
  hours: HourProfile[];
  dayCount: number;
  cheapBands: ProfileBand[];
  peakBands: ProfileBand[];
};

export function mergeHourIndices(hours: number[]): ProfileBand[] {
  if (hours.length === 0) return [];
  const sorted = [...new Set(hours)].sort((a, b) => a - b);
  const bands: ProfileBand[] = [];
  let start = sorted[0];
  let prev = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === prev + 1) {
      prev = sorted[i];
      continue;
    }
    bands.push({ start, end: prev + 1 });
    start = sorted[i];
    prev = sorted[i];
  }
  bands.push({ start, end: prev + 1 });
  return bands;
}

export function mergeHourIndicesCircular(hours: number[]): ProfileBand[] {
  const set = new Set(hours);
  const bands = mergeHourIndices(hours);
  if (
    bands.length >= 2 &&
    set.has(0) &&
    set.has(23) &&
    bands[0].start === 0 &&
    bands[bands.length - 1].end === 24
  ) {
    const first = bands[0];
    const last = bands[bands.length - 1];
    return [{ start: last.start, end: first.end + 24 }, ...bands.slice(1, -1)];
  }
  return bands;
}

export function hourInProfileBands(hour: number, bands: ProfileBand[]) {
  return bands.some((band) => {
    if (band.end <= 24) return hour >= band.start && hour < band.end;
    return hour >= band.start || hour < band.end - 24;
  });
}

function padClockHour(hour: number) {
  const wrapped = hour === 24 ? 24 : ((hour % 24) + 24) % 24;
  if (hour === 24) return "24:00";
  return `${String(wrapped).padStart(2, "0")}:00`;
}

export function formatProfileHourSpan(band: ProfileBand) {
  const to = band.end > 24 ? band.end - 24 : band.end;
  return `dalle ${padClockHour(band.start)} alle ${padClockHour(to)}`;
}

function shapeHours(hours: HourProfile[], mode: "cheap" | "expensive") {
  if (hours.length === 0) return [];
  const avgs = hours.map((hour) => hour.avg);
  const min = Math.min(...avgs);
  const max = Math.max(...avgs);
  const span = max - min;
  if (span <= 0.05) return [];
  const picked = hours
    .filter((hour) =>
      mode === "cheap"
        ? (hour.avg - min) / span <= SHAPE_SPAN_SHARE
        : (max - hour.avg) / span <= SHAPE_SPAN_SHARE,
    )
    .map((hour) => hour.hour);
  if (picked.length === 0 || picked.length > MAX_SHAPE_HOURS) return [];
  return mergeHourIndicesCircular(picked);
}

export type HourlyDay = {
  deliveryDate: string;
  hours: (number | null)[];
};

export function typicalHourlyProfileFromHours(days: HourlyDay[]): HourlyProfile | null {
  if (days.length < MIN_HOURLY_PROFILE_DAYS) return null;

  const sums = Array.from({ length: 24 }, () => 0);
  const counts = Array.from({ length: 24 }, () => 0);
  const cheapDays = Array.from({ length: 24 }, () => 0);
  const expensiveDays = Array.from({ length: 24 }, () => 0);
  let dayCount = 0;

  for (const day of days) {
    const hourly = day.hours.map((hour) =>
      hour == null || !Number.isFinite(hour) ? NaN : toEurocentPerKwh(hour),
    );
    if (hourly.filter((value) => Number.isFinite(value)).length < 23) continue;
    dayCount += 1;

    const ranked = hourly
      .map((price, hour) => ({ hour, price }))
      .filter((item) => Number.isFinite(item.price))
      .sort((a, b) => a.price - b.price);
    const take = Math.min(TOP_HOURS_PER_DAY, ranked.length);
    const cheap = new Set(ranked.slice(0, take).map((item) => item.hour));
    const expensive = new Set(ranked.slice(-take).map((item) => item.hour));

    for (let hour = 0; hour < hourly.length; hour++) {
      if (!Number.isFinite(hourly[hour])) continue;
      sums[hour] += hourly[hour];
      counts[hour] += 1;
      if (cheap.has(hour)) cheapDays[hour] += 1;
      if (expensive.has(hour)) expensiveDays[hour] += 1;
    }
  }

  const hours: HourProfile[] = [];
  for (let hour = 0; hour < 24; hour++) {
    if (counts[hour] === 0) continue;
    hours.push({
      hour,
      avg: sums[hour] / counts[hour],
      cheapDays: cheapDays[hour],
      expensiveDays: expensiveDays[hour],
      samples: counts[hour],
    });
  }

  if (hours.length < 20 || dayCount < MIN_HOURLY_PROFILE_DAYS) return null;

  return {
    hours,
    dayCount,
    cheapBands: shapeHours(hours, "cheap"),
    peakBands: shapeHours(hours, "expensive"),
  };
}

export function typicalHourlyProfile(days: ZoneDay[]): HourlyProfile | null {
  return typicalHourlyProfileFromHours(
    days.map((day) => ({
      deliveryDate: day.deliveryDate,
      hours: toHourlyAverages(day.prices),
    })),
  );
}

export function formatTypicalHoursCaption(profile: HourlyProfile) {
  if (profile.cheapBands.length === 0) {
    return profile.dayCount === 1
      ? "Quel giorno i minimi non si concentrano in un orario chiaro."
      : "Non c'è un orario fisso: i minimi si spostano di giorno in giorno.";
  }

  const ranges = joinItalian(
    profile.cheapBands.map((band) => formatProfileHourSpan(band)),
  );
  if (profile.dayCount === 1) {
    return `Conviene ${ranges}.`;
  }

  const strongest = profile.hours.reduce((best, hour) =>
    hour.cheapDays > best.cheapDays ? hour : best,
  );
  const share = strongest.cheapDays / strongest.samples;

  if (share >= FREQ_CAPTION_SHARE && strongest.samples >= 5) {
    return `Di solito conviene ${ranges}. Alle ${padClockHour(strongest.hour)} è tra le più basse in ${strongest.cheapDays} giorni su ${strongest.samples}.`;
  }

  return `Di solito conviene ${ranges}.`;
}
