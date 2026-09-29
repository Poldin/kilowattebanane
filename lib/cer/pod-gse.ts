import {
  isAreaConvenzionaleCode,
  parsePod,
  type PodLookupMiss,
  type PodLookupOk,
} from "@/lib/cer/pod-parse";

/** Same FeatureServer table the GSE “Cerca POD 2025” widget queries. */
export const GSE_POD_TABLE_URL =
  "https://mappe.gse.it/srvf/rest/services/TIAD2/POD_AC_2025/FeatureServer/13/query";

/** Area-convenzionale polygons (gestore) on the public ArcGIS Online item. */
export const GSE_AC_LAYER_URL =
  "https://services-eu1.arcgis.com/sawHMGY9o8rHlY2j/arcgis/rest/services/AC_Comuni_2025/FeatureServer/0/query";

const GSE_TIMEOUT_MS = 25_000;

type ArcgisQueryResponse = {
  features?: { attributes?: Record<string, unknown> }[];
  error?: { message?: string; code?: number };
};

export type GsePodHit = Omit<PodLookupOk, "cer">;
export type GsePodResult = GsePodHit | PodLookupMiss;

export function sqlLiteral(value: string) {
  return `'${value.replaceAll("'", "''")}'`;
}

function text(value: unknown) {
  if (value == null) return null;
  const s = String(value).trim();
  return s.length > 0 ? s : null;
}

export async function gseQuery(
  url: string,
  params: Record<string, string>,
  options?: { userAgent?: string },
) {
  const target = new URL(url);
  for (const [key, value] of Object.entries(params)) {
    target.searchParams.set(key, value);
  }
  target.searchParams.set("f", "json");
  const headers = new Headers();
  if (options?.userAgent) {
    headers.set("user-agent", options.userAgent);
    headers.set("accept", "application/json");
  }
  const response = await fetch(target, {
    ...(headers.has("user-agent") ? { headers } : {}),
    cache: "no-store",
    credentials: "omit",
    signal: AbortSignal.timeout(GSE_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`GSE HTTP ${response.status}`);
  }
  const page = (await response.json()) as ArcgisQueryResponse;
  if (page.error) {
    throw new Error(page.error.message ?? `GSE ${page.error.code}`);
  }
  return page.features ?? [];
}

export async function lookupGestoreOnGse(
  codice: string,
  options?: { userAgent?: string },
) {
  const rows = await gseQuery(
    GSE_AC_LAYER_URL,
    {
      where: `COD_AC = ${sqlLiteral(codice)}`,
      outFields: "COD_AC,RAG_SOC",
      returnGeometry: "false",
      resultRecordCount: "1",
    },
    options,
  );
  return text(rows[0]?.attributes?.RAG_SOC);
}

export async function lookupPodOnGse(
  raw: string,
  options?: { userAgent?: string },
): Promise<GsePodResult> {
  const parsed = parsePod(raw);
  if (!parsed.ok) {
    throw new Error(parsed.error);
  }

  const rows = await gseQuery(
    GSE_POD_TABLE_URL,
    {
      where: `COD_POD = ${sqlLiteral(parsed.pod)}`,
      outFields: "COD_AC",
      returnGeometry: "false",
      resultRecordCount: "1",
    },
    options,
  );
  const codice = text(rows[0]?.attributes?.COD_AC)?.toUpperCase() ?? null;
  if (!codice || !isAreaConvenzionaleCode(codice)) {
    return { found: false, pod: parsed.pod };
  }

  const gestore = await lookupGestoreOnGse(codice, options).catch(() => null);
  return {
    found: true,
    pod: parsed.pod,
    codice,
    gestore,
  };
}
