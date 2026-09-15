import { NextRequest, NextResponse } from "next/server";
import { adminAuthConfigured, adminTokenFromRequest } from "@/lib/offerte/admin-auth";
import {
  deleteOfferteUploads,
  downloadOfferteUpload,
} from "@/lib/offerte/admin-storage";
import { ingestUploadedOfferteFiles } from "@/lib/offerte/ingest-upload";
import { uploadedOfferteFile } from "@/lib/offerte/upload-file";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

type UploadRef = {
  path: string;
  filename: string;
};

export async function POST(request: NextRequest) {
  if (!adminAuthConfigured()) {
    return Response.json({ error: "Upload non configurato." }, { status: 503 });
  }
  if (!adminTokenFromRequest(request)) {
    return Response.json({ error: "Non autorizzato." }, { status: 401 });
  }

  let uploads: UploadRef[] = [];
  try {
    const body = (await request.json()) as { uploads?: UploadRef[] };
    uploads = (body.uploads ?? [])
      .map((item) => ({
        path: String(item.path ?? "").trim(),
        filename: String(item.filename ?? "").trim(),
      }))
      .filter((item) => item.path && item.filename);
  } catch {
    return Response.json({ error: "Richiesta non valida." }, { status: 400 });
  }

  if (uploads.length === 0) {
    return Response.json({ error: "Nessun file da importare." }, { status: 400 });
  }

  const paths = uploads.map((item) => item.path);

  try {
    const parsed = await Promise.all(
      uploads.map(async (item) => {
        const downloaded = await downloadOfferteUpload(item.path);
        return uploadedOfferteFile(item.filename, downloaded.bytes, item.filename);
      }),
    );

    const summaries = await ingestUploadedOfferteFiles(parsed);
    await deleteOfferteUploads(paths);
    return Response.json({ ok: true, summaries });
  } catch (error) {
    await deleteOfferteUploads(paths).catch(() => undefined);
    const message = error instanceof Error ? error.message : "Import fallito.";
    return Response.json({ error: message }, { status: 500 });
  }
}
