import { NextRequest } from "next/server";
import { withCronRoute } from "@/lib/cron-route";
import { pullItalyGeneration } from "@/lib/generation/pull";
import { revalidateGeneration } from "@/lib/generation/revalidate";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function handle(request: NextRequest) {
  return withCronRoute("generation/pull", request, async () => {
    const daysParam = Number(request.nextUrl.searchParams.get("days") ?? "1");
    const daysBack = Number.isFinite(daysParam)
      ? Math.min(7, Math.max(0, Math.trunc(daysParam)))
      : 1;

    try {
      const summary = await pullItalyGeneration(daysBack);
      console.log("generation pull", summary);
      if (summary.updated || summary.upserted > 0) {
        revalidateGeneration();
      }
      return Response.json(summary);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Pull failed";
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
