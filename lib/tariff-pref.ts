import {
  MAIL_DEFAULT_TARIFF_PLAN,
  TARIFF_PLANS,
  type TariffPlanId,
} from "@/lib/fasce";

export const TARIFF_PREF_KEY = "kwb-bolletta";
export const TARIFF_PREF_EVENT = "kwb-tariff-pref";
const TARIFF_PREF_MAX_AGE = 60 * 60 * 24 * 365;

const VALID_TARIFFS = new Set<TariffPlanId>(TARIFF_PLANS.map((plan) => plan.id));

export function tariffFromParam(value: string | undefined): TariffPlanId | undefined {
  if (!value || !VALID_TARIFFS.has(value as TariffPlanId)) return undefined;
  return value as TariffPlanId;
}

export function resolveMailTariff(value: string | null | undefined): TariffPlanId {
  return tariffFromParam(value ?? undefined) ?? MAIL_DEFAULT_TARIFF_PLAN;
}

export function readTariffPref(): TariffPlanId | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const stored = tariffFromParam(
      window.localStorage.getItem(TARIFF_PREF_KEY) ?? undefined,
    );
    if (stored) return stored;
  } catch {
    // private mode / disabled storage
  }
  return tariffFromParam(readCookie(TARIFF_PREF_KEY));
}

export function persistTariffPref(tariff: TariffPlanId) {
  if (!tariffFromParam(tariff) || typeof document === "undefined") return;
  try {
    window.localStorage.setItem(TARIFF_PREF_KEY, tariff);
  } catch {
    // private mode / disabled storage
  }
  document.cookie = `${TARIFF_PREF_KEY}=${encodeURIComponent(tariff)}; Path=/; Max-Age=${TARIFF_PREF_MAX_AGE}; SameSite=Lax`;
  window.dispatchEvent(new CustomEvent<TariffPlanId>(TARIFF_PREF_EVENT, { detail: tariff }));
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
