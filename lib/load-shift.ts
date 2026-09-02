import type { ZoneDay } from "@/lib/day-ahead-query";
import { isCompleteDay, toEurocentPerKwh } from "@/lib/insights";
import { QUARTERS_PER_HOUR } from "@/lib/prices";
import type { ZoneHourlyPayload } from "@/lib/zone-home-types";

export type SimLoad = {
  label: string;
  kWh: number;
  durationHours: number;
  cyclesPerDay: number;
};

export type SimAppliance = {
  id: string;
  label: string;
  loads: SimLoad[];
};

export const SIM_APPLIANCES: SimAppliance[] = [
  {
    id: "washer",
    label: "Lavatrice",
    loads: [
      {
        label: "ciclo misto 40–60 °C, 7–8 kg",
        kWh: 1,
        durationHours: 2.5,
        cyclesPerDay: 1,
      },
    ],
  },
  {
    id: "dishwasher",
    label: "Lavastoviglie",
    loads: [
      {
        label: "programma eco, 14 coperti",
        kWh: 0.85,
        durationHours: 3.25,
        cyclesPerDay: 1,
      },
    ],
  },
  {
    id: "washer-dishwasher",
    label: "Lavatrice + lavastoviglie",
    loads: [
      {
        label: "lavatrice",
        kWh: 1,
        durationHours: 2.5,
        cyclesPerDay: 1,
      },
      {
        label: "lavastoviglie",
        kWh: 0.85,
        durationHours: 3.25,
        cyclesPerDay: 1,
      },
    ],
  },
  {
    id: "dryer",
    label: "Asciugatrice",
    loads: [
      {
        label: "pompa di calore, 8 kg",
        kWh: 1.8,
        durationHours: 2,
        cyclesPerDay: 1,
      },
    ],
  },
  {
    id: "boiler",
    label: "Boiler elettrico",
    loads: [
      {
        label: "serbatoio 80 L, un rabbocco",
        kWh: 2.5,
        durationHours: 2,
        cyclesPerDay: 1,
      },
    ],
  },
  {
    id: "oven",
    label: "Forno",
    loads: [
      {
        label: "200 °C, circa 1 ora compreso il preriscaldo",
        kWh: 1.2,
        durationHours: 1,
        cyclesPerDay: 1,
      },
    ],
  },
  {
    id: "ev",
    label: "Ricarica auto (50 km)",
    loads: [
      {
        label: "wallbox 3,7 kW, circa 16 kWh/100 km",
        kWh: 8,
        durationHours: 2.5,
        cyclesPerDay: 1,
      },
    ],
  },
  {
    id: "ac",
    label: "Condizionatore (3 ore)",
    loads: [
      {
        label: "9000 BTU, raffrescamento",
        kWh: 2.4,
        durationHours: 3,
        cyclesPerDay: 1,
      },
    ],
  },
];

export const DEFAULT_SIM_APPLIANCE = SIM_APPLIANCES[0].id;

export type CycleWindowCosts = {
  min: number;
  mid: number;
  max: number;
};

export type LoadShiftResult = {
  min: number;
  mid: number;
  max: number;
  days: number;
  cycles: number;
};

export function applianceById(id: string) {
  return SIM_APPLIANCES.find((item) => item.id === id) ?? SIM_APPLIANCES[0];
}

export function durationSlots(hours: number) {
  return Math.max(1, Math.round(hours * QUARTERS_PER_HOUR));
}

export function durationHoursRounded(hours: number) {
  return Math.max(1, Math.round(hours));
}

export function cycleWindowCosts(
  pricesEurMwh: number[],
  kWh: number,
  durationHours: number,
): CycleWindowCosts | null {
  const n = durationSlots(durationHours);
  if (pricesEurMwh.length < n || kWh <= 0) return null;

  const cents = pricesEurMwh.map(toEurocentPerKwh);
  let min = Infinity;
  let max = -Infinity;

  for (let start = 0; start <= cents.length - n; start++) {
    let windowSum = 0;
    for (let i = 0; i < n; i++) windowSum += cents[start + i];
    const cost = (kWh / n) * windowSum;
    if (cost < min) min = cost;
    if (cost > max) max = cost;
  }

  const avg =
    cents.reduce((sum, value) => sum + value, 0) / cents.length;
  return { min, mid: kWh * avg, max };
}

export function simulateLoadShift(
  days: ZoneDay[],
  appliance: SimAppliance,
): LoadShiftResult | null {
  let min = 0;
  let mid = 0;
  let max = 0;
  let used = 0;
  let cycles = 0;

  for (const day of days) {
    if (!isCompleteDay(day.prices.length)) continue;

    let dayMin = 0;
    let dayMid = 0;
    let dayMax = 0;
    let dayCycles = 0;
    let ok = true;

    for (const load of appliance.loads) {
      const costs = cycleWindowCosts(
        day.prices,
        load.kWh,
        load.durationHours,
      );
      if (!costs) {
        ok = false;
        break;
      }
      dayMin += costs.min * load.cyclesPerDay;
      dayMid += costs.mid * load.cyclesPerDay;
      dayMax += costs.max * load.cyclesPerDay;
      dayCycles += load.cyclesPerDay;
    }

    if (!ok) continue;
    min += dayMin;
    mid += dayMid;
    max += dayMax;
    cycles += dayCycles;
    used += 1;
  }

  if (used === 0) return null;
  return { min, mid, max, days: used, cycles };
}

export function cycleWindowCostsHourly(
  hoursEurMwh: (number | null)[],
  kWh: number,
  durationHours: number,
): CycleWindowCosts | null {
  const n = durationHoursRounded(durationHours);
  if (kWh <= 0 || hoursEurMwh.length < n) return null;

  const cents = hoursEurMwh.map((hour) =>
    hour == null || !Number.isFinite(hour) ? null : toEurocentPerKwh(hour),
  );
  if (cents.filter((value) => value != null).length < 23) return null;

  let min = Infinity;
  let max = -Infinity;
  let sum = 0;
  let count = 0;

  for (const value of cents) {
    if (value == null) continue;
    sum += value;
    count += 1;
  }
  if (count === 0) return null;

  for (let start = 0; start <= cents.length - n; start++) {
    let windowSum = 0;
    let ok = true;
    for (let i = 0; i < n; i++) {
      const value = cents[start + i];
      if (value == null) {
        ok = false;
        break;
      }
      windowSum += value;
    }
    if (!ok) continue;
    const cost = (kWh / n) * windowSum;
    if (cost < min) min = cost;
    if (cost > max) max = cost;
  }

  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
  return { min, mid: kWh * (sum / count), max };
}

export function simulateLoadShiftFromHours(
  days: ZoneHourlyPayload[],
  appliance: SimAppliance,
): LoadShiftResult | null {
  let min = 0;
  let mid = 0;
  let max = 0;
  let used = 0;
  let cycles = 0;

  for (const day of days) {
    let dayMin = 0;
    let dayMid = 0;
    let dayMax = 0;
    let dayCycles = 0;
    let ok = true;

    for (const load of appliance.loads) {
      const costs = cycleWindowCostsHourly(
        day.hours,
        load.kWh,
        load.durationHours,
      );
      if (!costs) {
        ok = false;
        break;
      }
      dayMin += costs.min * load.cyclesPerDay;
      dayMid += costs.mid * load.cyclesPerDay;
      dayMax += costs.max * load.cyclesPerDay;
      dayCycles += load.cyclesPerDay;
    }

    if (!ok) continue;
    min += dayMin;
    mid += dayMid;
    max += dayMax;
    cycles += dayCycles;
    used += 1;
  }

  if (used === 0) return null;
  return { min, mid, max, days: used, cycles };
}

export function formatEuroFromCents(cents: number) {
  const euros = Math.round(cents) / 100;
  return `${euros.toLocaleString("it-IT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} €`;
}

export function formatKwh(value: number) {
  return `${value.toLocaleString("it-IT", {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 1,
    maximumFractionDigits: 2,
  })} kWh`;
}

export function formatDurationHours(hours: number) {
  const minutes = Math.round(hours * 60);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return h === 1 ? "1 ora" : `${h} ore`;
  return `${h} h ${m} min`;
}

export function formatCyclesPerDay(appliance: SimAppliance) {
  const total = appliance.loads.reduce(
    (sum, load) => sum + load.cyclesPerDay,
    0,
  );
  if (appliance.loads.length === 1) {
    return total === 1 ? "1 ciclo al giorno" : `${total} cicli al giorno`;
  }
  return appliance.loads
    .map((load) => `${load.cyclesPerDay} ${load.label}/giorno`)
    .join(", ");
}

export function formatSimulationParams(appliance: SimAppliance) {
  const loads = appliance.loads
    .map((load) => {
      const body = `${formatKwh(load.kWh)}, ${formatDurationHours(load.durationHours)}`;
      return appliance.loads.length > 1
        ? `${load.label} ${body}`
        : `${body} (${load.label})`;
    })
    .join(" · ");

  const independent =
    appliance.loads.length > 1
      ? " Ogni carico cerca la propria finestra, anche se si sovrappongono."
      : "";

  return (
    `${formatCyclesPerDay(appliance)} · ${loads}. ` +
    `Potenza costante sulla durata del ciclo. ` +
    `Bassi e alti: finestra consecutiva più conveniente e più cara (ore medie). ` +
    `Medio: prezzo medio del giorno × kWh.` +
    independent +
    ` All'ingrosso, non bolletta. Valori tipici di targa/uso, non il tuo elettrodomestico.`
  );
}

export function formatLoadShiftCaption(result: LoadShiftResult) {
  const vsHigh = result.max - result.min;
  const vsMid = result.mid - result.min;
  if (vsHigh < 1) {
    return {
      before: "In questo periodo spostare i cicli ",
      mark: "cambia poco",
      after: ": i prezzi sono piatti.",
      tone: "mid" as const,
    };
  }

  const vsHighLabel = formatEuroFromCents(vsHigh);
  if (vsMid >= 1) {
    return {
      before: "Fare i cicli negli orari bassi invece che in quelli alti vale ",
      mark: vsHighLabel,
      after: ` all'ingrosso.`,
      tone: "cheap" as const,
    };
  }

  return {
    before: "Fare i cicli negli orari bassi invece che in quelli alti vale ",
    mark: vsHighLabel,
    after: " all'ingrosso.",
    tone: "cheap" as const,
  };
}
