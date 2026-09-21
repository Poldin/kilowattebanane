import { NextRequest, NextResponse } from "next/server";
import { insertLearnEvent } from "@/lib/learn/db";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function asUuid(value: unknown) {
  const text = typeof value === "string" ? value.trim() : "";
  return UUID_RE.test(text) ? text : null;
}

function asInteractions(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      sessionId?: unknown;
      slideId?: unknown;
      chapterId?: unknown;
      interactions?: unknown;
    };
    const sessionId = asUuid(body.sessionId);
    const slideId = asUuid(body.slideId);
    if (!sessionId || !slideId) {
      return NextResponse.json({ error: "Dati non validi." }, { status: 400 });
    }
    const id = await insertLearnEvent({
      sessionId,
      slideId,
      chapterId: asUuid(body.chapterId),
      interactions: asInteractions(body.interactions),
    });
    return NextResponse.json({ id });
  } catch {
    return NextResponse.json({ error: "Log non salvato." }, { status: 500 });
  }
}
