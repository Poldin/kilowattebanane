import { regionFromParam, regionToSlug, type ItalianRegion } from "@/lib/market-zones";

export const REGION_PREF_KEY = "kwb-regione";
const REGION_PREF_MAX_AGE = 60 * 60 * 24 * 365;

export function readRegionPref(): ItalianRegion | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const stored = regionFromParam(
      window.localStorage.getItem(REGION_PREF_KEY) ?? undefined,
    );
    if (stored) return stored;
  } catch {
    // private mode / disabled storage
  }
  return regionFromParam(readCookie(REGION_PREF_KEY));
}

export function persistRegionPref(region: string) {
  const parsed = regionFromParam(region);
  if (!parsed || typeof document === "undefined") return;
  const slug = regionToSlug(parsed);
  try {
    window.localStorage.setItem(REGION_PREF_KEY, slug);
  } catch {
    // private mode / disabled storage
  }
  document.cookie = `${REGION_PREF_KEY}=${encodeURIComponent(slug)}; Path=/; Max-Age=${REGION_PREF_MAX_AGE}; SameSite=Lax`;
}

function readCookie(name: string) {
  const prefix = `${name}=`;
  const match = document.cookie.split("; ").find((row) => row.startsWith(prefix));
  if (!match) return undefined;
  try {
    return decodeURIComponent(match.slice(prefix.length));
  } catch {
    return match.slice(prefix.length);
  }
}
