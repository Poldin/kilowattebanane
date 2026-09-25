import { NextRequest } from "next/server";
import { withCronRoute } from "@/lib/cron-route";
import {
  pullItalyGeneration,
  pullItalyMixLookback,
  rebuildItalyMixDayStatsFromStored,
} from "@/lib/generation/pull";
import { revalidateGeneration } from "@/lib/generation/revalidate";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function handle(request: NextRequest) {
  return withCronRoute("generation/pull", request, async () => {
    const rebuild = request.nextUrl.searchParams.get("rebuild") === "1";
    const from = request.nextUrl.searchParams.get("from");
    const to = request.nextUrl.searchParams.get("to");
    const daysParam = Number(request.nextUrl.searchParams.get("days") ?? "1");
    const daysBack = Number.isFinite(daysParam)
      ? Math.min(7, Math.max(0, Math.trunc(daysParam)))
      : 1;

    try {
      if (rebuild) {
        const summary = await rebuildItalyMixDayStatsFromStored();
        console.log("generation rebuild", summary);
        if (summary.days > 0) revalidateGeneration();
        return Response.json(summary);
      }

      if (from && to) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to) {
          return Response.json({ error: "Intervallo non valido" }, { status: 400 });
        }
        const fromMs = Date.parse(`${from}T00:00:00Z`);
        const toMs = Date.parse(`${to}T00:00:00Z`);
        if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || toMs - fromMs > 31 * 86_400_000) {
          return Response.json({ error: "Intervallo massimo 31 giorni" }, { status: 400 });
        }
        const summary = await pullItalyMixLookback(from, to);
        console.log("generation lookback", summary);
        if (summary.days > 0) revalidateGeneration();
        return Response.json(summary);
      }

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
