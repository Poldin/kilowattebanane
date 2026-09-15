import { NextRequest, NextResponse } from "next/server";
import { adminAuthConfigured, adminTokenFromRequest } from "@/lib/offerte/admin-auth";
import { ingestUploadedOfferteFiles } from "@/lib/offerte/ingest-upload";
import { uploadedOfferteFile } from "@/lib/offerte/upload-file";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  if (!adminAuthConfigured()) {
    return Response.json({ error: "Upload non configurato." }, { status: 503 });
  }
  if (!adminTokenFromRequest(request)) {
    return Response.json({ error: "Non autorizzato." }, { status: 401 });
  }

  const form = await request.formData();
  const files = form
    .getAll("files")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);

  if (files.length === 0) {
    return Response.json({ error: "Seleziona almeno un file." }, { status: 400 });
  }

  try {
    const parsed = await Promise.all(
      files.map(async (file) => {
        const bytes = Buffer.from(await file.arrayBuffer());
        return uploadedOfferteFile(file.name, bytes, file.name);
      }),
    );

    const kinds = new Set(parsed.map((file) => file.kind));
    if (kinds.size !== parsed.length) {
      return Response.json(
        { error: "Hai caricato due file dello stesso tipo. Tienine uno per categoria." },
        { status: 400 },
      );
    }

    const summaries = await ingestUploadedOfferteFiles(parsed);
    return Response.json({ ok: true, summaries });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Import fallito.";
    return Response.json({ error: message }, { status: 500 });
  }
}
