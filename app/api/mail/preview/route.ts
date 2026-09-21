import { NextRequest } from "next/server";
import { romeToday } from "@/lib/day-ahead-core";
import { withCronRoute } from "@/lib/cron-route";
import { buildPriceMailModel } from "@/lib/mail/content";
import { sendDigestPreview } from "@/lib/mail/send";
import {
  dateFromParam,
  DEFAULT_REGION,
  regionFromParam,
  zoneForRegion,
} from "@/lib/market-zones";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function handle(request: NextRequest) {
  return withCronRoute("mail/preview", request, async () => {
    const params = request.nextUrl.searchParams;
    const to = params.get("to")?.trim() || "oloapiccoli@gmail.com";
    const region = regionFromParam(params.get("regione") ?? undefined) ?? DEFAULT_REGION;
    const zone = zoneForRegion(region);
    const date = dateFromParam(params.get("giorno") ?? undefined) ?? romeToday();

    if (!zone) {
      return Response.json({ error: "Zona non valida" }, { status: 400 });
    }

    const model = await buildPriceMailModel(region, zone, date);
    if (!model) {
      return Response.json({ error: "Nessun dato per il giorno richiesto" }, { status: 404 });
    }

    const id = await sendDigestPreview(to, model);
    return Response.json({ ok: true, to, date, zone, id });
  });
}

export function GET(request: NextRequest) {
  return handle(request);
}

export function POST(request: NextRequest) {
  return handle(request);
}
