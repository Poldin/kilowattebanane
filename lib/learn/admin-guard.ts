import { NextRequest, NextResponse } from "next/server";
import { adminAuthConfigured, adminTokenFromRequest } from "@/lib/offerte/admin-auth";

export function learnAdminGuard(request: NextRequest) {
  if (!adminAuthConfigured()) {
    return NextResponse.json({ error: "Admin non configurato." }, { status: 503 });
  }
  if (!adminTokenFromRequest(request)) {
    return NextResponse.json({ error: "Non autorizzato." }, { status: 401 });
  }
  return null;
}

export function jsonError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  const status = message.includes("non trovato") ? 404 : 400;
  return NextResponse.json({ error: message }, { status });
}
