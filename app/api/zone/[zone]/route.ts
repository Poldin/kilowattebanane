import { loadZoneHome } from "@/lib/zone-home";
import { dateFromParam, zoneFromParam } from "@/lib/market-zones";

export const revalidate = 3600;

export async function GET(
  request: Request,
  { params }: RouteContext<"/api/zone/[zone]">,
) {
  const { zone: zoneParam } = await params;
  const zone = zoneFromParam(zoneParam);
  if (!zone) {
    return Response.json({ error: "Zona non valida" }, { status: 404 });
  }

  const url = new URL(request.url);
  const date = dateFromParam(url.searchParams.get("date") ?? undefined);

  try {
    const data = await loadZoneHome(zone, date);
    return Response.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Caricamento fallito";
    return Response.json({ error: message }, { status: 500 });
  }
}
