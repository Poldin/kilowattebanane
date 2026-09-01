import { NextRequest } from "next/server";
import { authorizeCron } from "@/lib/cron-auth";
import { sendDailyDigest } from "@/lib/mail/digest";
import { dateFromParam } from "@/lib/market-zones";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function handle(request: NextRequest) {
  if (!authorizeCron(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const date = dateFromParam(request.nextUrl.searchParams.get("giorno") ?? undefined);

  try {
    const summary = await sendDailyDigest(date);
    return Response.json(summary);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Digest failed";
    return Response.json({ error: message }, { status: 500 });
  }
}

export function GET(request: NextRequest) {
  return handle(request);
}

export function POST(request: NextRequest) {
  return handle(request);
}
