export type ChartResolution = "h" | "15m";

export const CHART_RESOLUTION_PREF_KEY = "kwb-chart-resolution";
export const DEFAULT_CHART_RESOLUTION: ChartResolution = "h";

const VALID = new Set<ChartResolution>(["h", "15m"]);

export function chartResolutionFromParam(
  value: string | null | undefined,
): ChartResolution | undefined {
  if (!value || !VALID.has(value as ChartResolution)) return undefined;
  return value as ChartResolution;
}

export function readChartResolutionPref(): ChartResolution | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    return chartResolutionFromParam(
      window.localStorage.getItem(CHART_RESOLUTION_PREF_KEY),
    );
  } catch {
    return undefined;
  }
}

export function persistChartResolutionPref(resolution: ChartResolution) {
  if (!chartResolutionFromParam(resolution) || typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(CHART_RESOLUTION_PREF_KEY, resolution);
  } catch {
    // private mode / disabled storage
  }
}
