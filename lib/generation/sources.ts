import { MIX_SOURCE_IDS, type MixSourceId, type MixShare } from "@/lib/generation/types";

export const MIX_STACK_ORDER = [
  "coal",
  "oil",
  "gas",
  "other",
  "biomass",
  "geothermal",
  "hydro",
  "battery",
  "wind",
  "solar",
] as const satisfies readonly MixSourceId[];

export const MIX_RENEWABLE_IDS = [
  "solar",
  "wind",
  "hydro",
  "geothermal",
  "biomass",
] as const satisfies readonly MixSourceId[];

export const MIX_FOSSIL_IDS = ["coal", "oil", "gas"] as const satisfies readonly MixSourceId[];

export const MIX_SOURCE_META: Record<
  MixSourceId,
  { emoji: string; label: string; color: string }
> = {
  coal: { emoji: "🪨", label: "Carbone", color: "#3F3F46" },
  oil: { emoji: "🛢️", label: "Olio", color: "#52525B" },
  gas: { emoji: "🔥", label: "Gas", color: "#8B8680" },
  other: { emoji: "🔌", label: "Altro", color: "#C4C0B8" },
  biomass: { emoji: "🌿", label: "Biomasse", color: "#84CC16" },
  geothermal: { emoji: "🌋", label: "Geotermico", color: "#FB7185" },
  hydro: { emoji: "💧", label: "Idro", color: "#3B82F6" },
  battery: { emoji: "🔋", label: "Batterie", color: "#A78BFA" },
  wind: { emoji: "💨", label: "Eolico", color: "#22D3EE" },
  solar: { emoji: "☀️", label: "Solare", color: "#F5D547" },
};

const ENERGY_CHARTS_SOURCE: Record<string, MixSourceId> = {
  "Hydro Run-of-River": "hydro",
  "Hydro water reservoir": "hydro",
  "Hydro pumped storage": "hydro",
  Biomass: "biomass",
  "Fossil hard coal": "coal",
  "Fossil oil": "oil",
  "Fossil coal-derived gas": "gas",
  "Fossil gas": "gas",
  Geothermal: "geothermal",
  Battery: "battery",
  Others: "other",
  "Wind offshore": "wind",
  "Wind onshore": "wind",
  Solar: "solar",
};

export function mapEnergyChartsSource(name: string): MixSourceId | null {
  return ENERGY_CHARTS_SOURCE[name] ?? null;
}

export function sharesFromMw(bySource: Partial<Record<MixSourceId, number>>): MixShare[] {
  const raw = MIX_SOURCE_IDS.map((id) => ({
    id,
    mw: Math.max(0, bySource[id] ?? 0),
  }));
  const totalMw = raw.reduce((sum, row) => sum + row.mw, 0);
  if (!totalMw) return [];

  const notable: MixShare[] = [];
  let otherMw = 0;
  for (const row of raw) {
    const share = row.mw / totalMw;
    if (row.id === "other" || share < 0.015) {
      otherMw += row.mw;
      continue;
    }
    const meta = MIX_SOURCE_META[row.id];
    notable.push({
      id: row.id,
      emoji: meta.emoji,
      label: meta.label,
      mw: row.mw,
      share,
    });
  }

  if (otherMw > 0) {
    notable.push({
      id: "other",
      emoji: MIX_SOURCE_META.other.emoji,
      label: MIX_SOURCE_META.other.label,
      mw: otherMw,
      share: otherMw / totalMw,
    });
  }

  return notable.sort((a, b) => b.mw - a.mw);
}
