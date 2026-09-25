export const MIX_SOURCE_IDS = [
  "solar",
  "wind",
  "hydro",
  "gas",
  "coal",
  "oil",
  "geothermal",
  "biomass",
  "battery",
  "other",
] as const;

export type MixSourceId = (typeof MIX_SOURCE_IDS)[number];

export type MixShare = {
  id: MixSourceId;
  emoji: string;
  label: string;
  mw: number;
  share: number;
};

export type MixHourPoint = {
  slotStart: string;
  hour: number;
  mw: Partial<Record<MixSourceId, number>>;
  totalMw: number;
};

export type ItalyMixPayload = {
  slotStart: string;
  date: string;
  shares: MixShare[];
  totalMw: number;
  hours: MixHourPoint[];
};

export type GenerationSlot = {
  slotStart: Date;
  deliveryDate: string;
  sourceType: MixSourceId;
  mw: number;
};

export type GenerationPullSummary = {
  from: string;
  to: string;
  upserted: number;
  latestSlot: string | null;
  previousLatest: string | null;
  updated: boolean;
  source: "energy-charts";
};
