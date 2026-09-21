import { randomUUID } from "node:crypto";
import { createSecretClient } from "@/lib/supabase/secret";
import type { LearnImage } from "@/lib/learn/types";

export const LEARN_IMAGE_BUCKET = "learn";

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
]);

function learnStorage() {
  return createSecretClient().storage.from(LEARN_IMAGE_BUCKET);
}

export function learnImagePublicUrl(path: string) {
  return learnStorage().getPublicUrl(path).data.publicUrl;
}

export function learnUploadPath(filename: string) {
  const safe = filename.replace(/[^a-zA-Z0-9._-]+/g, "_");
  return `${randomUUID()}-${safe}`;
}

export async function createLearnImageSlot(filename: string, contentType: string) {
  if (!ALLOWED_TYPES.has(contentType)) {
    throw new Error("Formato immagine non supportato. Usa jpg, png, webp, gif o svg.");
  }
  const path = learnUploadPath(filename);
  const { data, error } = await learnStorage().createSignedUploadUrl(path);
  if (error || !data?.signedUrl) {
    throw new Error(error?.message ?? "Impossibile preparare l'upload.");
  }
  return {
    path,
    signedUrl: data.signedUrl,
    token: data.token,
    publicUrl: learnImagePublicUrl(path),
  };
}

export async function listLearnImages(): Promise<LearnImage[]> {
  const { data, error } = await learnStorage().list("", {
    limit: 200,
    sortBy: { column: "created_at", order: "desc" },
  });
  if (error) throw new Error(error.message);
  return (data ?? [])
    .filter((item) => item.name && !item.name.endsWith("/"))
    .map((item) => ({
      path: item.name,
      name: item.name.replace(/^[0-9a-f-]{36}-/i, ""),
      publicUrl: learnImagePublicUrl(item.name),
    }));
}
