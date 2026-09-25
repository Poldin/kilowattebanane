import { NextRequest } from "next/server";
import { loadItalyMix } from "@/lib/generation/load";
import { mailMixChartImageResponse } from "@/lib/mail/mix-chart-image";
import { dateFromParam } from "@/lib/market-zones";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const date = dateFromParam(request.nextUrl.searchParams.get("giorno") ?? undefined);
  if (!date) {
    return new Response("Parametri non validi", { status: 400 });
  }

  try {
    const mix = await loadItalyMix(date);
    if (!mix || mix.date !== date) {
      return new Response("Grafico non disponibile", { status: 404 });
    }
    return mailMixChartImageResponse(mix);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Chart failed";
    return new Response(message, { status: 500 });
  }
}
