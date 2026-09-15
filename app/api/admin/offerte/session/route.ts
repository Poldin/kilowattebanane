import { NextRequest, NextResponse } from "next/server";
import { OFFERTE_ADMIN_COOKIE, OFFERTE_ADMIN_TOKEN_KEY } from "@/lib/offerte/admin-constants";
import {
  adminAuthConfigured,
  adminCookieOptions,
  adminTokenFromRequest,
  issueAdminToken,
  verifyAdminPassword,
} from "@/lib/offerte/admin-auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!adminAuthConfigured()) {
    return NextResponse.json({ configured: false, authenticated: false }, { status: 503 });
  }
  return NextResponse.json({
    configured: true,
    authenticated: adminTokenFromRequest(request) != null,
  });
}

export async function POST(request: NextRequest) {
  if (!adminAuthConfigured()) {
    return NextResponse.json({ error: "Upload non configurato." }, { status: 503 });
  }

  let password = "";
  try {
    const body = (await request.json()) as { password?: string };
    password = String(body.password ?? "");
  } catch {
    return NextResponse.json({ error: "Password non valida." }, { status: 400 });
  }

  if (!verifyAdminPassword(password)) {
    return NextResponse.json({ error: "Password errata." }, { status: 401 });
  }

  const token = issueAdminToken();
  const response = NextResponse.json({
    ok: true,
    token,
    tokenKey: OFFERTE_ADMIN_TOKEN_KEY,
  });
  response.cookies.set(OFFERTE_ADMIN_COOKIE, token, adminCookieOptions());
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(OFFERTE_ADMIN_COOKIE, "", { ...adminCookieOptions(0), maxAge: 0 });
  return response;
}
