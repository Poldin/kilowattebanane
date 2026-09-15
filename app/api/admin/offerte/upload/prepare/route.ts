import { NextRequest, NextResponse } from "next/server";
import { adminAuthConfigured, adminTokenFromRequest } from "@/lib/offerte/admin-auth";
import { createOfferteUploadSlots } from "@/lib/offerte/admin-storage";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!adminAuthConfigured()) {
    return NextResponse.json({ error: "Upload non configurato." }, { status: 503 });
  }
  if (!adminTokenFromRequest(request)) {
    return NextResponse.json({ error: "Non autorizzato." }, { status: 401 });
  }

  let filenames: string[] = [];
  try {
    const body = (await request.json()) as { files?: { name?: string }[] };
    filenames = (body.files ?? [])
      .map((file) => String(file.name ?? "").trim())
      .filter(Boolean);
  } catch {
    return NextResponse.json({ error: "Richiesta non valida." }, { status: 400 });
  }

  if (filenames.length === 0) {
    return NextResponse.json({ error: "Seleziona almeno un file." }, { status: 400 });
  }

  try {
    const uploads = await createOfferteUploadSlots(filenames);
    return NextResponse.json({ uploads });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Preparazione upload fallita.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
