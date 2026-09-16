import { NextRequest } from "next/server";
import { fetchZoneHourlyStatsSince } from "@/lib/day-ahead-query";
import { loadPunForwardBlend } from "@/lib/offerte/forward";
import { mailOutlookHistoryFrom } from "@/lib/mail/outlook-chart";
import { mailOutlookChartImageResponse } from "@/lib/mail/outlook-chart-image";
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
    const [hourlyRows, forward] = await Promise.all([
      fetchZoneHourlyStatsSince(zone, mailOutlookHistoryFrom(date)),
      loadPunForwardBlend(date),
    ]);
    const hourly = hourlyRows
      .filter((row) => row.hours.length === 24)
      .map((row) => ({ date: row.deliveryDate, hours: row.hours }));

    return mailOutlookChartImageResponse({
      anchorDate: date,
      hourly,
      tariff,
      forwardMonths: forward.months,
      forwardAsOf: forward.asOf,
      forwardSource: forward.source,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Chart failed";
    return new Response(message, { status: 500 });
  }
}
