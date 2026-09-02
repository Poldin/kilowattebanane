import type { NextRequest } from "next/server";


export function authorizeCron(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  console.log("CRON_SECRET presente su Vercel?:", !!secret);
  console.log("Header ricevuto:", authHeader);

  if (!secret) return false;
  return authHeader === `Bearer ${secret}`;
}
