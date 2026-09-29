import { lookupPod } from "@/lib/cer/pod";
import { POD_FORMAT_HINT, parsePod } from "@/lib/cer/pod-parse";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "private, no-store" };

export async function POST(request: Request) {
  let raw = "";
  try {
    const body = (await request.json()) as { pod?: unknown };
    raw = typeof body.pod === "string" ? body.pod : "";
  } catch {
    return Response.json({ error: "Richiesta non valida" }, { status: 400, headers: NO_STORE });
  }

  const parsed = parsePod(raw);
  if (!parsed.ok) {
    return Response.json({ error: POD_FORMAT_HINT }, { status: 400, headers: NO_STORE });
  }

  try {
    const result = await lookupPod(parsed.pod);
    return Response.json(result, { headers: NO_STORE });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Lookup failed";
    const status = message.startsWith("GSE") ? 502 : 500;
    return Response.json(
      { error: "Il GSE non risponde. Riprova tra un attimo." },
      { status, headers: NO_STORE },
    );
  }
}
