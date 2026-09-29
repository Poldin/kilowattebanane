import { cerReadClient } from "@/lib/cer/client";
import {
  isAreaConvenzionaleCode,
  type PodCerHit,
  type PodLookupResult,
  parsePod,
} from "@/lib/cer/pod-parse";

export {
  POD_FORMAT_HINT,
  normalizePodInput,
  parsePod,
  type PodCerHit,
  type PodLookupMiss,
  type PodLookupOk,
  type PodLookupResult,
} from "@/lib/cer/pod-parse";

const UA = "kilowattebanane/cer-pod (informational reuse; https://kilowattebanane.it)";
const POD_TABLE_URL =
  "https://mappe.gse.it/srvf/rest/services/TIAD2/POD_AC_2025/FeatureServer/13/query";
const AC_LAYER_URL =
  "https://services-eu1.arcgis.com/sawHMGY9o8rHlY2j/arcgis/rest/services/AC_Comuni_2025/FeatureServer/0/query";

type ArcgisQueryResponse = {
  features?: { attributes?: Record<string, unknown> }[];
  error?: { message?: string; code?: number };
};

function sqlLiteral(value: string) {
  return `'${value.replaceAll("'", "''")}'`;
}

async function gseQuery(url: string, params: Record<string, string>) {
  const target = new URL(url);
  for (const [key, value] of Object.entries(params)) {
    target.searchParams.set(key, value);
  }
  target.searchParams.set("f", "json");
  const response = await fetch(target, {
    headers: { "user-agent": UA, accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
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

function text(value: unknown) {
  if (value == null) return null;
  const s = String(value).trim();
  return s.length > 0 ? s : null;
}

async function lookupGestore(codice: string) {
  const rows = await gseQuery(AC_LAYER_URL, {
    where: `COD_AC = ${sqlLiteral(codice)}`,
    outFields: "COD_AC,RAG_SOC",
    returnGeometry: "false",
    resultRecordCount: "1",
  });
  return text(rows[0]?.attributes?.RAG_SOC);
}

async function lookupCerInArea(codice: string): Promise<PodCerHit[]> {
  try {
    const { data, error } = await cerReadClient()
      .from("cer_configurazioni_live")
      .select("denominazione, comune, in_vetrina")
      .eq("area_convenzionale", codice)
      .eq("tipologia_kind", "cer")
      .order("in_vetrina", { ascending: false })
      .limit(8);
    if (error) return [];
    return (data ?? []).map((row) => ({
      denominazione: text(row.denominazione),
      comune: text(row.comune),
      inVetrina: Boolean(row.in_vetrina),
    }));
  } catch {
    return [];
  }
}

export async function lookupPod(raw: string): Promise<PodLookupResult> {
  const parsed = parsePod(raw);
  if (!parsed.ok) {
    throw new Error(parsed.error);
  }

  const rows = await gseQuery(POD_TABLE_URL, {
    where: `COD_POD = ${sqlLiteral(parsed.pod)}`,
    outFields: "COD_AC",
    returnGeometry: "false",
    resultRecordCount: "1",
  });
  const codice = text(rows[0]?.attributes?.COD_AC)?.toUpperCase() ?? null;
  if (!codice || !isAreaConvenzionaleCode(codice)) {
    return { found: false, pod: parsed.pod };
  }

  const [gestore, cer] = await Promise.all([
    lookupGestore(codice).catch(() => null),
    lookupCerInArea(codice),
  ]);

  return {
    found: true,
    pod: parsed.pod,
    codice,
    gestore,
    cer,
  };
}
