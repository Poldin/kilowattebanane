import { NextRequest } from "next/server";
import { withCronRoute } from "@/lib/cron-route";
import { sendDailyDigest } from "@/lib/mail/digest";
import { dateFromParam } from "@/lib/market-zones";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function handle(request: NextRequest) {
  return withCronRoute("mail/digest", request, async () => {
    const date = dateFromParam(request.nextUrl.searchParams.get("giorno") ?? undefined);

    try {
      const summary = await sendDailyDigest(date);
      return Response.json(summary);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Digest failed";
      return Response.json({ error: message }, { status: 500 });
    }
  });
}

export function GET(request: NextRequest) {
  return handle(request);
}

export function POST(request: NextRequest) {
  return handle(request);
}
