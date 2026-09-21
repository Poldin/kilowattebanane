import { NextRequest, NextResponse } from "next/server";
import { learnAdminGuard, jsonError } from "@/lib/learn/admin-guard";
import { createLearnImageSlot } from "@/lib/learn/storage";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const denied = learnAdminGuard(request);
  if (denied) return denied;
  try {
    const body = (await request.json()) as {
      filename?: unknown;
      contentType?: unknown;
    };
    const filename = String(body.filename ?? "").trim();
    const contentType = String(body.contentType ?? "").trim();
    if (!filename) {
      return NextResponse.json({ error: "Nome file mancante." }, { status: 400 });
    }
    const upload = await createLearnImageSlot(filename, contentType);
    return NextResponse.json({ upload });
  } catch (error) {
    return jsonError(error, "Preparazione upload fallita.");
  }
}
