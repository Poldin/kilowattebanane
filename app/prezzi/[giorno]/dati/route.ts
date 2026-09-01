import { archiveDayJson, listArchiveDates, loadArchiveDay } from "@/lib/day-archive";
import { dateFromParam } from "@/lib/market-zones";

export const dynamicParams = true;
export const revalidate = 3600;

export async function generateStaticParams() {
  try {
    const dates = await listArchiveDates();
    return dates.map((giorno) => ({ giorno }));
  } catch {
    return [];
  }
}

export async function GET(
  _request: Request,
  { params }: RouteContext<"/prezzi/[giorno]/dati">,
) {
  const { giorno } = await params;
  if (!dateFromParam(giorno)) {
    return Response.json({ error: "Data non valida" }, { status: 400 });
  }

  const day = await loadArchiveDay(giorno);
  if (!day) {
    return Response.json({ error: "Giornata non trovata" }, { status: 404 });
  }

  return Response.json(archiveDayJson(day), {
    headers: {
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
