import { NextRequest } from "next/server";
import { authorizeCron } from "@/lib/cron-auth";
import { pullOfferte, type PullOfferteOptions } from "@/lib/offerte/pull";
import type { ImportKind } from "@/lib/offerte/types";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const KINDS = new Set<ImportKind>(["geo", "parametri_e", "placet_e", "ml_e"]);

async function handle(request: NextRequest) {
  if (!authorizeCron(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sourcesParam = request.nextUrl.searchParams.get("source") ?? "all";
  const sources = sourcesParam
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean) as PullOfferteOptions["sources"];
  const unknown = (sources ?? []).filter(
    (source) => source !== "all" && !KINDS.has(source as ImportKind),
  );
  if (unknown.length > 0) {
    return Response.json({ error: `Unknown source: ${unknown.join(",")}` }, { status: 400 });
  }

  const snapshotDate = request.nextUrl.searchParams.get("giorno") ?? undefined;
  const refreshGeo = request.nextUrl.searchParams.get("refreshGeo") === "1";

  try {
    const result = await pullOfferte({ sources, snapshotDate, refreshGeo });
    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Offerte pull failed";
    return Response.json({ error: message }, { status: 500 });
  }
}

export function GET(request: NextRequest) {
  return handle(request);
}

export function POST(request: NextRequest) {
  return handle(request);
}
