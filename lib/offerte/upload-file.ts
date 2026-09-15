import { pathParts } from "@/lib/offerte/dates";
import { sha256 } from "@/lib/offerte/hash";
import type { DownloadedFile, OfferteKind } from "@/lib/offerte/source";

const KIND_PATTERNS: { kind: OfferteKind; pattern: RegExp }[] = [
  { kind: "placet_e", pattern: /PO_Offerte_E_PLACET_(\d{8})\.csv$/i },
  { kind: "ml_e", pattern: /PO_Offerte_E_MLIBERO_(\d{8})\.xml$/i },
  { kind: "parametri_e", pattern: /PO_Parametri_E_(\d{8})\.csv$/i },
];

export function detectUploadedOfferteFile(name: string) {
  const base = name.split(/[/\\]/).pop()?.trim() ?? "";
  for (const { kind, pattern } of KIND_PATTERNS) {
    const match = base.match(pattern);
    if (!match) continue;
    const ymd = match[1];
    const snapshotDate = `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`;
    pathParts(snapshotDate);
    return { kind, snapshotDate, filename: base };
  }
  return null;
}

export function uploadedOfferteFile(
  name: string,
  bytes: Buffer,
  sourceName?: string,
): DownloadedFile {
  const detected = detectUploadedOfferteFile(name);
  if (!detected) {
    throw new Error(
      `File non riconosciuto: ${name}. Attesi PO_Offerte_E_PLACET_YYYYMMDD.csv, PO_Offerte_E_MLIBERO_YYYYMMDD.xml, PO_Parametri_E_YYYYMMDD.csv`,
    );
  }
  return {
    kind: detected.kind,
    url: sourceName ? `upload:${sourceName}` : `upload:${detected.filename}`,
    snapshotDate: detected.snapshotDate,
    bytes: bytes.length,
    sha256: sha256(bytes),
    lastModified: null,
    text: bytes.toString("utf8"),
  };
}
