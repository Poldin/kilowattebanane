import { NextRequest, NextResponse } from "next/server";
import { updateLearnEvent } from "@/lib/learn/db";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function PATCH(
  request: NextRequest,
  { params }: RouteContext<"/api/learn/events/[id]">,
) {
  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Dati non validi." }, { status: 400 });
  }
  try {
    const body = (await request.json()) as { interactions?: unknown };
    if (!body.interactions || typeof body.interactions !== "object" || Array.isArray(body.interactions)) {
      return NextResponse.json({ error: "Dati non validi." }, { status: 400 });
    }
    const updated = await updateLearnEvent(id, body.interactions as Record<string, unknown>);
    if (!updated) return NextResponse.json({ error: "Evento non trovato." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Log non salvato." }, { status: 500 });
  }
}
