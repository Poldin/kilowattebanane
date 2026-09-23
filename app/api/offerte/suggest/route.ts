import { parseCatalogFilters, suggestOfferte } from "@/lib/offerte/suggest";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? "";
  const vendor = url.searchParams.get("vendor");
  try {
    const result = await suggestOfferte(q, vendor, parseCatalogFilters(url.searchParams));
    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Suggest failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
