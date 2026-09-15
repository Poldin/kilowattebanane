import { NextRequest } from "next/server";
import { adminAuthConfigured, adminTokenFromRequest } from "@/lib/offerte/admin-auth";
import { dateFromParam } from "@/lib/market-zones";
import { romeToday } from "@/lib/offerte/dates";
import { fetchOpenDataFile, type OfferteKind } from "@/lib/offerte/source";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const KINDS = new Set<OfferteKind>(["placet_e", "ml_e", "parametri_e"]);

export async function GET(request: NextRequest) {
  if (!adminAuthConfigured()) {
    return Response.json({ error: "Upload non configurato." }, { status: 503 });
  }
  if (!adminTokenFromRequest(request)) {
    return Response.json({ error: "Non autorizzato." }, { status: 401 });
  }

  const kindRaw = request.nextUrl.searchParams.get("kind") ?? "";
  if (!KINDS.has(kindRaw as OfferteKind)) {
    return Response.json({ error: "Tipo file non valido." }, { status: 400 });
  }
  const kind = kindRaw as OfferteKind;
  const date =
    dateFromParam(request.nextUrl.searchParams.get("giorno") ?? undefined) ?? romeToday();

  try {
    const file = await fetchOpenDataFile(kind, date);
    return new Response(new Uint8Array(file.buffer), {
      headers: {
        "Content-Type": file.contentType,
        "Content-Disposition": `attachment; filename="${file.filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Download fallito.";
    return Response.json({ error: message }, { status: 502 });
  }
}
