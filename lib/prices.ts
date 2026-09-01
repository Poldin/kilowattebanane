export const QUARTERS_PER_HOUR = 4;
export const QUARTERS_PER_DAY = 24 * QUARTERS_PER_HOUR;

export type HourWindow = {
  startHour: number;
  endHour: number;
};

export type PriceBands = {
  cheapStart: number;
  cheapEnd: number;
  peakStart: number;
  peakEnd: number;
};

export function toHourlyAverages(quarters: number[]) {
  const hours: number[] = [];
  for (let hour = 0; hour < quarters.length / QUARTERS_PER_HOUR; hour++) {
    const start = hour * QUARTERS_PER_HOUR;
    const slice = quarters.slice(start, start + QUARTERS_PER_HOUR);
    hours.push(slice.reduce((sum, value) => sum + value, 0) / slice.length);
  }
  return hours;
}

export function hourRangeToQuarters(startHour: number, endHour: number) {
  return {
    start: startHour * QUARTERS_PER_HOUR,
    end: endHour * QUARTERS_PER_HOUR + (QUARTERS_PER_HOUR - 1),
  };
}

function windowAverage(hourly: number[], startHour: number, size: number) {
  let sum = 0;
  for (let i = startHour; i < startHour + size; i++) {
    sum += hourly[i];
  }
  return sum / size;
}

export function hourWindowsOverlap(a: HourWindow, b: HourWindow) {
  return a.startHour <= b.endHour && b.startHour <= a.endHour;
}

export function findBestHourWindow(
  hourly: number[],
  size: number,
  mode: "min" | "max",
  exclude?: HourWindow,
): HourWindow | null {
  if (hourly.length < size) return null;

  let best: HourWindow | null = null;
  let bestAvg = mode === "min" ? Infinity : -Infinity;

  for (let h = 0; h <= hourly.length - size; h++) {
    const candidate = { startHour: h, endHour: h + size - 1 };
    if (exclude && hourWindowsOverlap(candidate, exclude)) continue;

    const avg = windowAverage(hourly, h, size);
    const isBetter = mode === "min" ? avg < bestAvg : avg > bestAvg;
    if (isBetter) {
      bestAvg = avg;
      best = candidate;
    }
  }

  return best;
}

export function computePriceBands(
  quarterPrices: number[],
  options?: { cheapWindowHours?: number; peakWindowHours?: number },
): PriceBands {
  const cheapWindowHours = options?.cheapWindowHours ?? 4;
  const peakWindowHours = options?.peakWindowHours ?? 3;
  const hourly = toHourlyAverages(quarterPrices);

  const cheapWindow =
    findBestHourWindow(hourly, cheapWindowHours, "min") ??
    ({ startHour: 0, endHour: cheapWindowHours - 1 } satisfies HourWindow);

  const peakWindow =
    findBestHourWindow(hourly, peakWindowHours, "max", cheapWindow) ??
    findBestHourWindow(hourly, peakWindowHours, "max") ??
    cheapWindow;

  const cheap = hourRangeToQuarters(cheapWindow.startHour, cheapWindow.endHour);
  const peak = hourRangeToQuarters(peakWindow.startHour, peakWindow.endHour);

  return {
    cheapStart: cheap.start,
    cheapEnd: cheap.end,
    peakStart: peak.start,
    peakEnd: peak.end,
  };
}

export function quarterIndexToHour(index: number) {
  return Math.floor(index / QUARTERS_PER_HOUR);
}

export function formatHourRange(startHour: number, endHour: number) {
  return `${startHour}–${endHour}`;
}

export function formatQuarterSlot(index: number) {
  const startMin = index * 15;
  const endMin = startMin + 15;
  return `${formatClock(startMin)}–${formatMinutes(endMin)}`;
}

export function formatQuarterSlotFull(index: number) {
  const startMin = index * 15;
  const endMin = startMin + 15;
  return `${formatClock(startMin)}–${formatClock(endMin)}`;
}

function formatMinutes(totalMinutes: number) {
  if (totalMinutes >= 24 * 60) return "00";
  return String(totalMinutes % 60).padStart(2, "0");
}

function formatClock(totalMinutes: number) {
  if (totalMinutes >= 24 * 60) return "24:00";
  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}
