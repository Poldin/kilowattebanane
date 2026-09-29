import { NextRequest } from "next/server";
import { withCronRoute } from "@/lib/cron-route";
import { ingestCerMap } from "@/lib/cer/ingest";
import { revalidateCer } from "@/lib/cer/revalidate";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function handle(request: NextRequest) {
  return withCronRoute("cer/pull", request, async () => {
    try {
      const result = await ingestCerMap();
      if (result.status === "ok") revalidateCer();
      return Response.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "CER pull failed";
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
