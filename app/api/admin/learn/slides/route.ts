import { NextRequest, NextResponse } from "next/server";
import { learnAdminGuard, jsonError } from "@/lib/learn/admin-guard";
import { createLearnSlide, listLearnSlides } from "@/lib/learn/db";
import { parseSlidePayload, parseSlideType } from "@/lib/learn/payload";
import { revalidateLearn } from "@/lib/learn/revalidate";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const denied = learnAdminGuard(request);
  if (denied) return denied;
  try {
    const slides = await listLearnSlides(true);
    return NextResponse.json({ slides });
  } catch (error) {
    return jsonError(error, "Non riesco a caricare le lezioni.");
  }
}

export async function POST(request: NextRequest) {
  const denied = learnAdminGuard(request);
  if (denied) return denied;
  try {
    const body = (await request.json()) as {
      type?: unknown;
      payload?: unknown;
      active?: unknown;
    };
    const type = parseSlideType(body.type);
    const slide = await createLearnSlide({
      type,
      payload: parseSlidePayload(type, body.payload),
      active: body.active !== false,
    });
    revalidateLearn();
    return NextResponse.json({ slide });
  } catch (error) {
    return jsonError(error, "Salvataggio fallito.");
  }
}
