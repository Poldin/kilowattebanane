import type { NextRequest } from "next/server";

export function authorizeCron(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  const authHeader = request.headers.get("authorization")?.trim();
  const customHeader = request.headers.get("x-cron-secret")?.trim();

  // STAMPA NEI LOG DI VERCEL
  console.log("--- DEBUG CRON AUTH ---");
  console.log("Secret in process.env:", secret ? `${secret.slice(0, 6)}... (lunghezza ${secret.length})` : "ASSENTE/UNDEFINED");
  console.log("Header Authorization ricevuto:", authHeader);
  console.log("Header x-cron-secret ricevuto:", customHeader);

  if (!secret) return false;

  const expectedBearer = `Bearer ${secret}`;
  const isValidBearer = authHeader === expectedBearer;
  const isValidCustom = customHeader === secret;

  console.log("Esito controllo:", { isValidBearer, isValidCustom });

  return isValidBearer || isValidCustom;
}