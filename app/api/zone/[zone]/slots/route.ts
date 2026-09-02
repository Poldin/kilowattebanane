import { loadZoneSlots } from "@/lib/zone-home";
import { dateFromParam, zoneFromParam } from "@/lib/market-zones";

export const revalidate = 3600;

export async function GET(
  request: Request,
  { params }: RouteContext<"/api/zone/[zone]/slots">,
) {
  const { zone: zoneParam } = await params;
  const zone = zoneFromParam(zoneParam);
  if (!zone) {
    return Response.json({ error: "Zona non valida" }, { status: 404 });
  }

  const url = new URL(request.url);
  const from = dateFromParam(url.searchParams.get("from") ?? undefined);
  const to = dateFromParam(url.searchParams.get("to") ?? undefined);
  if (!from || !to || from > to) {
    return Response.json({ error: "Intervallo non valido" }, { status: 400 });
  }

  try {
    const rows = await loadZoneSlots(zone, from, to);
    return Response.json(
      { rows },
      {
        headers: {
          "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
        },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Caricamento fallito";
    return Response.json({ error: message }, { status: 500 });
  }
}
