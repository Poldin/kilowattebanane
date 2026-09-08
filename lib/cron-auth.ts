import type { NextRequest } from "next/server";

export function authorizeCron(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;

  const authHeader = request.headers.get("authorization")?.trim();
  const customHeader = request.headers.get("x-cron-secret")?.trim();

  return authHeader === `Bearer ${secret}` || customHeader === secret;
}