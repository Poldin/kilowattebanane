import { randomUUID } from "node:crypto";
import { createSecretClient } from "@/lib/supabase/secret";
import { detectUploadedOfferteFile } from "@/lib/offerte/upload-file";

export const OFFERTE_UPLOAD_BUCKET = "offerte-uploads";

export function offerteUploadPath(filename: string) {
  const safe = filename.replace(/[^a-zA-Z0-9._-]+/g, "_");
  const day = new Date().toISOString().slice(0, 10);
  return `manual/${day}/${randomUUID()}-${safe}`;
}

export async function createOfferteUploadSlots(filenames: string[]) {
  const client = createSecretClient();
  const slots = filenames.map((filename) => {
    const detected = detectUploadedOfferteFile(filename);
    if (!detected) {
      throw new Error(`File non riconosciuto: ${filename}`);
    }
    return {
      filename,
      kind: detected.kind,
      path: offerteUploadPath(filename),
    };
  });

  const kinds = new Set(slots.map((slot) => slot.kind));
  if (kinds.size !== slots.length) {
    throw new Error("Hai selezionato due file dello stesso tipo. Tienine uno per categoria.");
  }

  const uploads = await Promise.all(
    slots.map(async (slot) => {
      const { data, error } = await client.storage
        .from(OFFERTE_UPLOAD_BUCKET)
        .createSignedUploadUrl(slot.path, { upsert: true });
      if (error || !data?.signedUrl) {
        throw new Error(error?.message ?? `Impossibile preparare l'upload di ${slot.filename}`);
      }
      return {
        ...slot,
        signedUrl: data.signedUrl,
        token: data.token,
      };
    }),
  );

  return uploads;
}

export async function downloadOfferteUpload(path: string) {
  const client = createSecretClient();
  const { data, error } = await client.storage.from(OFFERTE_UPLOAD_BUCKET).download(path);
  if (error || !data) {
    throw new Error(error?.message ?? `File non trovato: ${path}`);
  }
  const filename = path.split("/").pop() ?? path;
  const bytes = Buffer.from(await data.arrayBuffer());
  return { filename, bytes };
}

export async function deleteOfferteUploads(paths: string[]) {
  if (paths.length === 0) return;
  const client = createSecretClient();
  const { error } = await client.storage.from(OFFERTE_UPLOAD_BUCKET).remove(paths);
  if (error) throw new Error(error.message);
}
