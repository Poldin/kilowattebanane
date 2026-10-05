import { lookupCersInArea, lookupPod } from "@/lib/cer/pod";
import { isAreaConvenzionaleCode, parseLookupInput } from "@/lib/cer/pod-parse";

export const dynamic = "force-dynamic";
export const maxDuration = 30;
export const preferredRegion = "fra1";

const NO_STORE = { "Cache-Control": "private, no-store" };

export async function POST(request: Request) {
  let podRaw = "";
  let codiceRaw = "";
  try {
    const body = (await request.json()) as { pod?: unknown; codice?: unknown };
    podRaw = typeof body.pod === "string" ? body.pod : "";
    codiceRaw = typeof body.codice === "string" ? body.codice.trim().toUpperCase() : "";
  } catch {
    return Response.json({ error: "Richiesta non valida" }, { status: 400, headers: NO_STORE });
  }

  if (codiceRaw) {
    if (!isAreaConvenzionaleCode(codiceRaw)) {
      return Response.json({ error: "Codice area non valido" }, { status: 400, headers: NO_STORE });
    }
    const cer = await lookupCersInArea(codiceRaw);
    return Response.json({ cer }, { headers: NO_STORE });
  }

  const parsed = parseLookupInput(podRaw);
  if (!parsed.ok) {
    return Response.json({ error: parsed.error }, { status: 400, headers: NO_STORE });
  }

  try {
    const result = await lookupPod(podRaw);
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
