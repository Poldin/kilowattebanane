import { exploreOffers, parseCatalogFilters } from "@/lib/offerte/suggest";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const limitRaw = Number(url.searchParams.get("limit") ?? "10");
  const limit = Number.isFinite(limitRaw) ? Math.min(20, Math.max(1, Math.floor(limitRaw))) : 10;

  try {
    const items = await exploreOffers(limit, parseCatalogFilters(url.searchParams));
    return Response.json({ items });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Explore failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
