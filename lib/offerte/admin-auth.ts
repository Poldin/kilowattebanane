import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { OFFERTE_ADMIN_COOKIE } from "@/lib/offerte/admin-constants";

export { OFFERTE_ADMIN_COOKIE, OFFERTE_ADMIN_TOKEN_KEY } from "@/lib/offerte/admin-constants";
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

function adminPassword() {
  return process.env.OFFERTE_ADMIN_PASSWORD?.trim() ?? "";
}

export function adminAuthConfigured() {
  return adminPassword().length > 0;
}

export function verifyAdminPassword(password: string) {
  const expected = adminPassword();
  if (!expected) return false;
  const left = Buffer.from(password);
  const right = Buffer.from(expected);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function issueAdminToken() {
  const key = adminPassword();
  if (!key) throw new Error("OFFERTE_ADMIN_PASSWORD not configured");
  const exp = String(Date.now() + TTL_MS);
  const sig = createHmac("sha256", key).update(exp).digest("hex");
  return `${exp}.${sig}`;
}

export function verifyAdminToken(token: string | null | undefined) {
  if (!token) return false;
  const key = adminPassword();
  if (!key) return false;
  const dot = token.indexOf(".");
  if (dot <= 0) return false;
  const exp = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expMs = Number(exp);
  if (!Number.isFinite(expMs) || Date.now() > expMs) return false;
  const expected = createHmac("sha256", key).update(exp).digest("hex");
  if (sig.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}

export function adminTokenFromRequest(request: NextRequest) {
  const cookie = request.cookies.get(OFFERTE_ADMIN_COOKIE)?.value?.trim();
  if (verifyAdminToken(cookie)) return cookie!;
  const header = request.headers.get("authorization")?.trim();
  if (header?.startsWith("Bearer ")) {
    const token = header.slice("Bearer ".length).trim();
    if (verifyAdminToken(token)) return token;
  }
  const custom = request.headers.get("x-offerte-admin-token")?.trim();
  if (verifyAdminToken(custom)) return custom;
  return null;
}

export function adminCookieOptions(maxAge = TTL_MS / 1000) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}
