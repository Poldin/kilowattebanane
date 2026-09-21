import { NextRequest, NextResponse } from "next/server";
import { learnAdminGuard, jsonError } from "@/lib/learn/admin-guard";
import { listLearnImages } from "@/lib/learn/storage";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const denied = learnAdminGuard(request);
  if (denied) return denied;
  try {
    const images = await listLearnImages();
    return NextResponse.json({ images });
  } catch (error) {
    return jsonError(error, "Non riesco a caricare le immagini.");
  }
}
