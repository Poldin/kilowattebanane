import { NextRequest, NextResponse } from "next/server";
import { learnAdminGuard, jsonError } from "@/lib/learn/admin-guard";
import { createLearnChapter, listLearnChaptersWithCounts } from "@/lib/learn/db";
import { revalidateLearn } from "@/lib/learn/revalidate";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const denied = learnAdminGuard(request);
  if (denied) return denied;
  try {
    const chapters = await listLearnChaptersWithCounts();
    return NextResponse.json({ chapters });
  } catch (error) {
    return jsonError(error, "Non riesco a caricare i capitoli.");
  }
}

export async function POST(request: NextRequest) {
  const denied = learnAdminGuard(request);
  if (denied) return denied;
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
    const chapter = await createLearnChapter({
      slug: String(body.slug ?? ""),
      title: String(body.title ?? ""),
      blurb: typeof body.blurb === "string" ? body.blurb : "",
      cover_url: typeof body.cover_url === "string" ? body.cover_url : null,
      takeaway: typeof body.takeaway === "string" ? body.takeaway : "",
      sort: typeof body.sort === "number" ? body.sort : Number(body.sort ?? 0) || 0,
      active: body.active !== false,
      slideIds: Array.isArray(body.slideIds)
        ? body.slideIds.map((id) => String(id)).filter(Boolean)
        : [],
    });
    revalidateLearn(chapter.slug);
    return NextResponse.json({ chapter });
  } catch (error) {
    return jsonError(error, "Salvataggio fallito.");
  }
}
