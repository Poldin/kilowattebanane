import { exploreRandomOffers } from "@/lib/offerte/suggest";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const limitRaw = Number(new URL(request.url).searchParams.get("limit") ?? "10");
  const limit = Number.isFinite(limitRaw) ? Math.min(20, Math.max(1, Math.floor(limitRaw))) : 10;

  try {
    const items = await exploreRandomOffers(limit);
    return Response.json({ items });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Explore failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
