import { NextRequest } from "next/server";
import { pullDayAheadPrices } from "@/lib/day-ahead";
import { MARKET_ZONES, type MarketZoneId } from "@/lib/market-zones";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorize(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

async function handle(request: NextRequest) {
  if (!authorize(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const daysParam = Number(request.nextUrl.searchParams.get("days") ?? "0");
  const daysBack = Number.isFinite(daysParam) ? Math.min(31, Math.max(0, Math.trunc(daysParam))) : 0;
  const zoneParam = request.nextUrl.searchParams.get("zone");
  let zoneIds: MarketZoneId[] | undefined;
  if (zoneParam) {
    if (!(zoneParam in MARKET_ZONES)) {
      return Response.json({ error: "Unknown zone" }, { status: 400 });
    }
    zoneIds = [zoneParam as MarketZoneId];
  }

  try {
    const summary = await pullDayAheadPrices(daysBack, 1, zoneIds);
    const status = summary.errors.length > 0 && summary.upserted === 0 ? 502 : 200;
    return Response.json(summary, { status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Pull failed";
    return Response.json({ error: message }, { status: 500 });
  }
}

export function GET(request: NextRequest) {
  return handle(request);
}

export function POST(request: NextRequest) {
  return handle(request);
}
