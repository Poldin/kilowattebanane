import type { DayAheadRow } from "@/lib/day-ahead-core";
import type { LookbackDayPoint } from "@/lib/lookback";
import type { MarketZoneId } from "@/lib/market-zones";

export type ZoneHourlyPayload = {
  date: string;
  hours: (number | null)[];
};

export type ZoneHomePayload = {
  zone: MarketZoneId;
  date: string | null;
  slots: DayAheadRow[];
  dates: string[];
  points: LookbackDayPoint[];
  hourly: ZoneHourlyPayload[];
};
