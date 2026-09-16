import { NextRequest } from "next/server";
import { withCronRoute } from "@/lib/cron-route";
import { romeToday } from "@/lib/offerte/dates";
import { pullForwardStack } from "@/lib/offerte/ingest-forwards";
import { revalidateOfferte } from "@/lib/offerte/revalidate";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

async function handle(request: NextRequest) {
  return withCronRoute("offerte/forwards/pull", request, async () => {
    const snapshotDate = request.nextUrl.searchParams.get("giorno") ?? romeToday();
    try {
      const result = await pullForwardStack(snapshotDate);
      revalidateOfferte();
      const status =
        result.forwardError && !result.forwards && result.gmeError && !result.gme
          ? 502
          : 200;
      return Response.json(result, { status });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Forward pull failed";
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
