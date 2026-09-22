import { loadCompareOfferProfile } from "@/lib/offerte/compare-profile";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const sourceRaw = params.get("source");
  const cod = params.get("cod") ?? "";
  const source = sourceRaw === "placet" || sourceRaw === "ml" ? sourceRaw : null;

  if (!source || !cod.trim()) {
    return Response.json({ error: "Parametri non validi" }, { status: 400 });
  }

  try {
    const profile = await loadCompareOfferProfile(source, cod);
    if (!profile) return Response.json({ error: "Offerta non trovata" }, { status: 404 });
    return Response.json({ profile });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Compare failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
