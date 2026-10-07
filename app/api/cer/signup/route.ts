import { NextRequest, NextResponse } from "next/server";
import {
  CER_SIGNUP_PROOF_COOKIE,
  cerSignupProofCookieOptions,
  claimCerSignupProof,
  releaseCerSignupProof,
} from "@/lib/cer/otp";
import {
  insertCerSignupRequest,
  updateCerSignupMailResult,
  type CerEnrollmentPath,
  type CerSignupAnswers,
  type CerSignupChoice,
  type CerSignupImpianto,
  type CerSignupRequest,
  type CerSignupRole,
  type CerSignupSoggetto,
} from "@/lib/cer/signup";
import { sendCerSignupConfirmationEmail } from "@/lib/mail/send";
import { isAreaConvenzionaleCode, parsePod } from "@/lib/cer/pod-parse";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseChoices(raw: unknown): CerSignupChoice[] | null {
  if (!Array.isArray(raw)) return null;
  const choices: CerSignupChoice[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") return null;
    const row = item as Record<string, unknown>;
    const id = typeof row.id === "string" ? row.id.trim() : "";
    const kind = row.kind === "waitlist" || row.kind === "cer" ? row.kind : null;
    const label = typeof row.label === "string" ? row.label.trim() : "";
    const enabled = row.enabled === true;
    const rank = typeof row.rank === "number" && Number.isFinite(row.rank) ? Math.trunc(row.rank) : null;
    if (!id || !kind || !label || rank == null) return null;
    choices.push({ id, kind, label, enabled, rank });
  }
  return choices.sort((a, b) => a.rank - b.rank);
}

function parseSoggetto(raw: unknown): CerSignupSoggetto | null {
  return raw === "privato" || raw === "azienda" ? raw : null;
}

function parseRole(raw: unknown): CerSignupRole | null {
  return raw === "consumatore" || raw === "produttore" ? raw : null;
}

function parseImpianto(raw: unknown): CerSignupImpianto | null {
  return raw === "attivo" || raw === "progetto" ? raw : null;
}

function parsePotenzaKw(raw: unknown): number | null | undefined {
  if (raw == null) return null;
  if (typeof raw !== "number" || !Number.isFinite(raw)) return undefined;
  if (raw < 0 || raw > 50_000) return undefined;
  return Math.round(raw * 10) / 10;
}

function parseAnswers(role: CerSignupRole, raw: unknown): CerSignupAnswers | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const soggetto = parseSoggetto(row.soggetto);
  if (!soggetto) return null;
  if (role === "consumatore") return { soggetto };
  const impianto = parseImpianto(row.impianto);
  const potenzaKw = parsePotenzaKw(row.potenzaKw);
  const prosumer = row.prosumer;
  if (!impianto || potenzaKw === undefined || typeof prosumer !== "boolean") {
    return null;
  }
  return { soggetto, impianto, potenzaKw, prosumer };
}

function parseEnrollmentPath(raw: unknown): CerEnrollmentPath | null {
  return raw === "nocol" || raw === "1col" || raw === "morecol" ? raw : null;
}

function pathMatchesChoices(path: CerEnrollmentPath, choices: CerSignupChoice[]) {
  const enabled = choices.filter((choice) => choice.enabled);
  if (enabled.length === 0) return false;
  if (path === "nocol") {
    return enabled.length === 1 && enabled[0]?.kind === "waitlist";
  }
  if (path === "1col") {
    return enabled.length === 1 && enabled[0]?.kind === "cer";
  }
  return enabled.some((choice) => choice.kind === "cer");
}

export async function POST(request: NextRequest) {
  let body: {
    email?: string;
    pod?: string;
    cabinaCodice?: string;
    role?: unknown;
    answers?: unknown;
    choices?: unknown;
    enrollmentPath?: unknown;
    website?: string;
  };

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Richiesta non valida." }, { status: 400 });
  }

  if (body.website) {
    return Response.json({ ok: true });
  }

  const email = body.email?.trim().toLowerCase() ?? "";
  const cabinaRaw = body.cabinaCodice?.trim().toUpperCase() ?? "";
  const cabinaCodice = cabinaRaw || null;
  const podRaw = body.pod?.trim().toUpperCase() ?? "";
  const role = parseRole(body.role);
  const choices = parseChoices(body.choices);
  const answers = role ? parseAnswers(role, body.answers) : null;
  const enrollmentPath = parseEnrollmentPath(body.enrollmentPath);

  if (!role) {
    return Response.json({ error: "Scegli se sei un consumatore o un produttore." }, { status: 400 });
  }
  if (!answers) {
    return Response.json({ error: "Completa le domande sul tuo impianto." }, { status: 400 });
  }
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return Response.json({ error: "Inserisci un'email valida." }, { status: 400 });
  }
  if (cabinaCodice && !isAreaConvenzionaleCode(cabinaCodice)) {
    return Response.json({ error: "Cabina primaria non valida." }, { status: 400 });
  }
  if (!choices) {
    return Response.json({ error: "Scegli almeno un'opzione." }, { status: 400 });
  }
  if (choices.length > 0 && !choices.some((choice) => choice.enabled)) {
    return Response.json({ error: "Attiva almeno una CER." }, { status: 400 });
  }
  if (!enrollmentPath || !pathMatchesChoices(enrollmentPath, choices)) {
    return Response.json({ error: "Scegli almeno un'opzione." }, { status: 400 });
  }

  let pod: string | null = null;
  if (podRaw) {
    const parsed = parsePod(podRaw);
    if (!parsed.ok) {
      return Response.json({ error: parsed.error }, { status: 400 });
    }
    pod = parsed.pod;
  }

  try {
    const proof = await claimCerSignupProof(
      email,
      request.cookies.get(CER_SIGNUP_PROOF_COOKIE)?.value,
    );
    if (!proof) {
      return Response.json(
        { error: "Conferma l'email con il codice che ti abbiamo inviato." },
        { status: 400 },
      );
    }
    const signup: CerSignupRequest = {
      email,
      pod,
      cabinaCodice,
      role,
      answers,
      choices,
      enrollmentPath,
    };
    let id: string;
    try {
      id = await insertCerSignupRequest(signup);
    } catch (error) {
      await releaseCerSignupProof(proof.id, proof.claimedAt).catch((releaseError) => {
        console.error("cer signup proof release", releaseError);
      });
      throw error;
    }
    try {
      const resendId = await sendCerSignupConfirmationEmail(signup);
      await updateCerSignupMailResult(id, { sent: true, resendId });
    } catch (error) {
      console.error("cer signup confirmation mail", error);
      const message = error instanceof Error ? error.message : "Invio mail non riuscito.";
      await updateCerSignupMailResult(id, { sent: false, error: message }).catch((updateError) => {
        console.error("cer signup confirmation mail result", updateError);
      });
    }
    const response = NextResponse.json({ ok: true });
    response.cookies.set(CER_SIGNUP_PROOF_COOKIE, "", {
      ...cerSignupProofCookieOptions(),
      maxAge: 0,
    });
    return response;
  } catch (error) {
    console.error("cer signup", error);
    return Response.json(
      { error: "Non è stato possibile completare l'iscrizione. Riprova." },
      { status: 500 },
    );
  }
}
