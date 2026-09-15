import type { DayAheadRow } from "@/lib/day-ahead-core";
import type { LookbackDayPoint } from "@/lib/lookback";
import type { PunMonthPoint } from "@/lib/offerte/forward";
import type { MarketZoneId } from "@/lib/market-zones";

export type ZoneForwardPayload = {
  asOf: string | null;
  source: string | null;
  months: PunMonthPoint[];
};

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
  forward: ZoneForwardPayload;
};
