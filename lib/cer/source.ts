import { sha256 } from "@/lib/offerte/hash";
import { parsePortalDate } from "@/lib/offerte/dates";
import type { CerTipologiaKind } from "@/lib/cer/public-types";

const GSE_ORG_SERVICES =
  "https://services-eu1.arcgis.com/sawHMGY9o8rHlY2j/arcgis/rest/services";
const UA = "kilowattebanane/cer-ingest (informational reuse; https://kilowattebanane.it)";
const PAGE_SIZE = 2000;
const ESE_NAME = /^Config_auto_diff_(\d{2})_(\d{2})_(\d{2})_TIAD_VETRINA_Ese$/i;

const SENSITIVE_FIELD =
  /email|e_mail|pec|telefono|phone|cellulare|pod|codice_fiscale|referente|contatto|nominativo|statuto|se_anno_cad/i;

export type CerLayerKind = {
  kind: CerTipologiaKind;
  inVetrina: boolean;
};

export type DiscoveredCerSource = {
  featureServerUrl: string;
  name: string;
  snapshotDate: string | null;
  sourceItemId: string | null;
  itemModifiedAt: string | null;
  layers: DiscoveredCerLayer[];
};

export type DiscoveredCerLayer = {
  id: number;
  name: string;
  kind: CerTipologiaKind;
  inVetrina: boolean;
};

export type CerSourceFeature = {
  layerId: number;
  layerName: string;
  kind: CerTipologiaKind;
  inVetrina: boolean;
  attributes: Record<string, unknown>;
  x: number | null;
  y: number | null;
};

async function gseJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: { "user-agent": UA, accept: "application/json" },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`GSE ArcGIS HTTP ${response.status} at ${url}`);
  }
  return (await response.json()) as T;
}

function parseServiceDate(name: string) {
  const match = name.match(ESE_NAME);
  if (!match) return null;
  const [, dd, mm, yy] = match;
  return `20${yy}-${mm}-${dd}`;
}

function fold(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
}

export function classifyLayer(name: string): CerLayerKind | null {
  const n = fold(name);
  if (n.includes("comunita energetica") && n.includes("contatti disponibili")) {
    return { kind: "cer", inVetrina: true };
  }
  if (n.includes("comunita energetica")) {
    return { kind: "cer", inVetrina: false };
  }
  if (n.includes("autoconsumatori")) return { kind: "auc", inVetrina: false };
  if (n.includes("autoconsumatore individuale")) {
    return { kind: "individuale", inVetrina: false };
  }
  if (n.includes("gruppo di clienti attivi")) {
    return { kind: "gruppo_clienti", inVetrina: false };
  }
  if (n.includes("cliente attivo a distanza")) {
    return { kind: "cliente_attivo", inVetrina: false };
  }
  return null;
}

export function stripSensitiveAttributes(attrs: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(attrs).filter(([key, value]) => {
      if (SENSITIVE_FIELD.test(key)) return false;
      if (typeof value === "string" && value.includes("@") && /mail/i.test(key)) {
        return false;
      }
      return true;
    }),
  );
}

export async function discoverCerFeatureServer(): Promise<DiscoveredCerSource> {
  const catalog = await gseJson<{
    services?: { name: string; type: string }[];
  }>(`${GSE_ORG_SERVICES}?f=json`);

  const ese = (catalog.services ?? [])
    .filter((service) => service.type === "FeatureServer" && ESE_NAME.test(service.name))
    .map((service) => ({
      name: service.name,
      snapshotDate: parseServiceDate(service.name),
    }))
    .sort((a, b) => (b.snapshotDate ?? "").localeCompare(a.snapshotDate ?? ""));

  const picked = ese[0];
  if (!picked) {
    throw new Error("Nessun FeatureServer GSE TIAD Vetrina (Ese) trovato");
  }

  const featureServerUrl = `${GSE_ORG_SERVICES}/${picked.name}/FeatureServer`;
  const meta = await gseJson<{
    serviceItemId?: string;
    layers?: { id: number; name: string }[];
  }>(`${featureServerUrl}?f=json`);

  const layers = (meta.layers ?? [])
    .map((layer) => {
      const classified = classifyLayer(layer.name);
      if (!classified) return null;
      return {
        id: layer.id,
        name: layer.name,
        kind: classified.kind,
        inVetrina: classified.inVetrina,
      };
    })
    .filter((layer): layer is DiscoveredCerLayer => layer != null);

  if (layers.length === 0) {
    throw new Error(`Nessun layer TIAD classificato su ${featureServerUrl}`);
  }

  return {
    featureServerUrl,
    name: picked.name,
    snapshotDate: picked.snapshotDate,
    sourceItemId: meta.serviceItemId ?? null,
    itemModifiedAt: null,
    layers,
  };
}

type ArcgisQueryResponse = {
  features?: {
    attributes?: Record<string, unknown>;
    geometry?: { x?: number; y?: number };
  }[];
  exceededTransferLimit?: boolean;
  error?: { message?: string; code?: number };
};

async function queryLayerPage(
  featureServerUrl: string,
  layerId: number,
  offset: number,
) {
  const url = new URL(`${featureServerUrl}/${layerId}/query`);
  url.searchParams.set("where", "1=1");
  url.searchParams.set("outFields", "*");
  url.searchParams.set("returnGeometry", "true");
  url.searchParams.set("outSR", "4326");
  url.searchParams.set("resultOffset", String(offset));
  url.searchParams.set("resultRecordCount", String(PAGE_SIZE));
  url.searchParams.set("f", "json");
  return gseJson<ArcgisQueryResponse>(url.toString());
}

export async function fetchCerFeatures(source: DiscoveredCerSource) {
  const features: CerSourceFeature[] = [];
  const payloadParts: string[] = [];

  for (const layer of source.layers) {
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const page = await queryLayerPage(source.featureServerUrl, layer.id, offset);
      if (page.error) {
        throw new Error(
          `ArcGIS layer ${layer.id}: ${page.error.message ?? page.error.code}`,
        );
      }
      const rows = page.features ?? [];
      for (const row of rows) {
        const attributes = stripSensitiveAttributes(row.attributes ?? {});
        features.push({
          layerId: layer.id,
          layerName: layer.name,
          kind: layer.kind,
          inVetrina: layer.inVetrina,
          attributes,
          x: typeof row.geometry?.x === "number" ? row.geometry.x : null,
          y: typeof row.geometry?.y === "number" ? row.geometry.y : null,
        });
      }
      payloadParts.push(`${layer.id}:${offset}:${rows.length}`);
      if (rows.length < PAGE_SIZE && !page.exceededTransferLimit) break;
      if (rows.length === 0) break;
    }
  }

  return {
    features,
    contentSha256: sha256(payloadParts.join("|") + String(features.length)),
  };
}

export function gseDateFromAttributes(attrs: Record<string, unknown>) {
  const raw = attrs.Data_Aggiornamento;
  if (typeof raw !== "string") return null;
  return parsePortalDate(raw);
}
