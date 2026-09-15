import { NextRequest, NextResponse } from "next/server";
import { adminAuthConfigured, adminTokenFromRequest } from "@/lib/offerte/admin-auth";
import { rebuildOfferKernels } from "@/lib/offerte/ingest-kernels";
import { revalidateOfferte } from "@/lib/offerte/revalidate";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  if (!adminAuthConfigured()) {
    return NextResponse.json({ error: "Non configurato." }, { status: 503 });
  }
  if (!adminTokenFromRequest(request)) {
    return NextResponse.json({ error: "Non autorizzato." }, { status: 401 });
  }

  try {
    const result = await rebuildOfferKernels();
    revalidateOfferte();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Rebuild fallito.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
