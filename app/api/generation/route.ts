import { NextRequest } from "next/server";
import { loadItalyMix } from "@/lib/generation/load";

export const revalidate = 3600;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get("date");
  if (date && !DATE_RE.test(date)) {
    return Response.json({ error: "Data non valida" }, { status: 400 });
  }

  try {
    const data = await loadItalyMix(date ?? undefined);
    if (!data) {
      return Response.json({ error: "Mix non disponibile" }, { status: 404 });
    }
    return Response.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Caricamento fallito";
    return Response.json({ error: message }, { status: 500 });
  }
}
