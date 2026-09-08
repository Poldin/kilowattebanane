import { NextRequest } from "next/server";
import { fetchZoneDayPrices, groupZoneDays } from "@/lib/day-ahead-query";
import { isCompleteDay } from "@/lib/insights";
import { mailChartImageResponse } from "@/lib/mail/chart-image";
import { dateFromParam, zoneFromParam } from "@/lib/market-zones";
import { resolveMailTariff } from "@/lib/tariff-pref";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const zone = zoneFromParam(params.get("zona") ?? undefined);
  const date = dateFromParam(params.get("giorno") ?? undefined);
  const tariff = resolveMailTariff(params.get("piano"));

  if (!zone || !date) {
    return new Response("Parametri non validi", { status: 400 });
  }

  try {
    const rows = await fetchZoneDayPrices(zone, date);
    if (!isCompleteDay(rows.length)) {
      return new Response("Grafico non disponibile", { status: 404 });
    }
    const day = groupZoneDays(rows)[0];
    if (!day) {
      return new Response("Grafico non disponibile", { status: 404 });
    }
    return mailChartImageResponse(day.prices, date, tariff);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Chart failed";
    return new Response(message, { status: 500 });
  }
}
