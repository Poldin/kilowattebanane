import { addIsoDays, pathParts, romeToday } from "@/lib/offerte/dates";
import { sha256 } from "@/lib/offerte/hash";

const HOST = "https://www.ilportaleofferte.it";
const UA = "kilowattebanane/offerte-ingest (open-data CC-BY; https://kilowattebanane.it)";

export type OfferteKind = "placet_e" | "ml_e" | "parametri_e";

export type DownloadedFile = {
  kind: OfferteKind;
  url: string;
  snapshotDate: string;
  bytes: number;
  sha256: string;
  lastModified: string | null;
  text: string;
};

export function openDataFileUrl(kind: OfferteKind, isoDate: string) {
  const { year, month, ymd } = pathParts(isoDate);
  const stamp = `${year}_${month}`;
  if (kind === "placet_e") {
    return `${HOST}/portaleOfferte/resources/opendata/csv/offerte/${stamp}/PO_Offerte_E_PLACET_${ymd}.csv`;
  }
  if (kind === "parametri_e") {
    return `${HOST}/portaleOfferte/resources/opendata/csv/parametri/${stamp}/PO_Parametri_E_${ymd}.csv`;
  }
  return `${HOST}/portaleOfferte/resources/opendata/csv/offerteML/${stamp}/PO_Offerte_E_MLIBERO_${ymd}.xml`;
}

export function openDataFileLabel(kind: OfferteKind, isoDate: string) {
  const { ymd } = pathParts(isoDate);
  if (kind === "placet_e") return `PO_Offerte_E_PLACET_${ymd}.csv`;
  if (kind === "parametri_e") return `PO_Parametri_E_${ymd}.csv`;
  return `PO_Offerte_E_MLIBERO_${ymd}.xml`;
}

function fileUrl(kind: OfferteKind, isoDate: string) {
  return openDataFileUrl(kind, isoDate);
}

async function getFile(url: string) {
  const response = await fetch(url, {
    headers: { "user-agent": UA, accept: "*/*" },
    cache: "no-store",
  });
  return response;
}

export async function downloadOfferteFile(
  kind: OfferteKind,
  preferredDate = romeToday(),
): Promise<DownloadedFile> {
  const candidates = [preferredDate, addIsoDays(preferredDate, -1)];
  let lastStatus = 0;
  let lastUrl = "";

  for (const snapshotDate of candidates) {
    const url = fileUrl(kind, snapshotDate);
    lastUrl = url;
    const response = await getFile(url);
    lastStatus = response.status;
    if (response.status === 404) continue;
    if (!response.ok) {
      throw new Error(`Open data ${kind} HTTP ${response.status} at ${url}`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    return {
      kind,
      url,
      snapshotDate,
      bytes: buffer.length,
      sha256: sha256(buffer),
      lastModified: response.headers.get("last-modified"),
      text: buffer.toString("utf8"),
    };
  }

  throw new Error(`Open data ${kind} not found (${lastStatus}) at ${lastUrl}`);
}
