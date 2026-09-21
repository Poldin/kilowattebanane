import { NextRequest, NextResponse } from "next/server";
import { learnAdminGuard, jsonError } from "@/lib/learn/admin-guard";
import { deleteLearnSlide, getLearnSlide, updateLearnSlide } from "@/lib/learn/db";
import { parseSlidePayload, parseSlideType } from "@/lib/learn/payload";
import { revalidateLearn } from "@/lib/learn/revalidate";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: RouteContext<"/api/admin/learn/slides/[id]">,
) {
  const denied = learnAdminGuard(request);
  if (denied) return denied;
  const { id } = await params;
  try {
    const slide = await getLearnSlide(id);
    if (!slide) return NextResponse.json({ error: "Lezione non trovata." }, { status: 404 });
    return NextResponse.json({ slide });
  } catch (error) {
    return jsonError(error, "Non riesco a caricare la lezione.");
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: RouteContext<"/api/admin/learn/slides/[id]">,
) {
  const denied = learnAdminGuard(request);
  if (denied) return denied;
  const { id } = await params;
  try {
    const current = await getLearnSlide(id);
    if (!current) return NextResponse.json({ error: "Lezione non trovata." }, { status: 404 });
    const body = (await request.json()) as {
      type?: unknown;
      payload?: unknown;
      active?: unknown;
    };
    const type = body.type != null ? parseSlideType(body.type) : current.type;
    const payload =
      body.payload != null ? parseSlidePayload(type, body.payload) : current.payload;
    const slide = await updateLearnSlide(id, {
      type,
      payload,
      active: typeof body.active === "boolean" ? body.active : undefined,
    });
    revalidateLearn();
    return NextResponse.json({ slide });
  } catch (error) {
    return jsonError(error, "Salvataggio fallito.");
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: RouteContext<"/api/admin/learn/slides/[id]">,
) {
  const denied = learnAdminGuard(request);
  if (denied) return denied;
  const { id } = await params;
  try {
    await deleteLearnSlide(id);
    revalidateLearn();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error, "Eliminazione fallita.");
  }
}
