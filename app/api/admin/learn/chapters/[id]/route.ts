import { NextRequest, NextResponse } from "next/server";
import { learnAdminGuard, jsonError } from "@/lib/learn/admin-guard";
import {
  deleteLearnChapter,
  getLearnChapterById,
  updateLearnChapter,
} from "@/lib/learn/db";
import { revalidateLearn } from "@/lib/learn/revalidate";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: RouteContext<"/api/admin/learn/chapters/[id]">,
) {
  const denied = learnAdminGuard(request);
  if (denied) return denied;
  const { id } = await params;
  try {
    const chapter = await getLearnChapterById(id);
    if (!chapter) return NextResponse.json({ error: "Capitolo non trovato." }, { status: 404 });
    return NextResponse.json({ chapter });
  } catch (error) {
    return jsonError(error, "Non riesco a caricare il capitolo.");
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: RouteContext<"/api/admin/learn/chapters/[id]">,
) {
  const denied = learnAdminGuard(request);
  if (denied) return denied;
  const { id } = await params;
  try {
    const body = (await request.json()) as {
      slug?: unknown;
      title?: unknown;
      blurb?: unknown;
      cover_url?: unknown;
      takeaway?: unknown;
      sort?: unknown;
      active?: unknown;
      slideIds?: unknown;
    };
    const chapter = await updateLearnChapter(id, {
      slug: typeof body.slug === "string" ? body.slug : undefined,
      title: typeof body.title === "string" ? body.title : undefined,
      blurb: typeof body.blurb === "string" ? body.blurb : undefined,
      cover_url:
        body.cover_url === null
          ? null
          : typeof body.cover_url === "string"
            ? body.cover_url
            : undefined,
      takeaway: typeof body.takeaway === "string" ? body.takeaway : undefined,
      sort: typeof body.sort === "number" ? body.sort : undefined,
      active: typeof body.active === "boolean" ? body.active : undefined,
      slideIds: Array.isArray(body.slideIds)
        ? body.slideIds.map((slideId) => String(slideId)).filter(Boolean)
        : undefined,
    });
    revalidateLearn(chapter.slug);
    return NextResponse.json({ chapter });
  } catch (error) {
    return jsonError(error, "Salvataggio fallito.");
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: RouteContext<"/api/admin/learn/chapters/[id]">,
) {
  const denied = learnAdminGuard(request);
  if (denied) return denied;
  const { id } = await params;
  try {
    await deleteLearnChapter(id);
    revalidateLearn();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error, "Eliminazione fallita.");
  }
}
