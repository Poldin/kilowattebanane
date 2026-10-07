import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { createSecretClient } from "@/lib/supabase/secret";

export const CER_OTP_TTL_MS = 10 * 60 * 1000;
export const CER_SIGNUP_PROOF_COOKIE = "cer_signup_proof";

const VERIFIED_WINDOW_MS = 2 * 60 * 60 * 1000;
const ISSUE_WINDOW_MS = 60 * 60 * 1000;
const MAX_ISSUES_PER_WINDOW = 5;
const MIN_ISSUE_GAP_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type OtpRow = {
  id: string;
  otp: string;
  attempts: number;
  created_at: string;
  verified_at: string | null;
  invalidated_at: string | null;
};

export type OtpIssueResult =
  | { ok: true; id: string; otp: string }
  | { ok: false; error: string; status: number };

export type OtpVerifyResult =
  | { ok: true; id: string }
  | { ok: false; error: string; status: number };

function pepper() {
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!key) throw new Error("Missing SUPABASE_SECRET_KEY");
  return key;
}

function hmac(label: string, value: string) {
  return createHmac("sha256", pepper()).update(`${label}:${value}`).digest();
}

function hashOtp(otp: string) {
  return hmac("otp", otp).toString("hex");
}

function hashMatches(stored: string, otp: string) {
  const left = Buffer.from(stored, "hex");
  const right = hmac("otp", otp);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function generateOtp() {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function cerSignupProofCookieOptions(maxAge = VERIFIED_WINDOW_MS / 1000) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/api/cer",
    maxAge,
  };
}

export function createCerSignupProof(id: string, email: string) {
  const exp = Date.now() + VERIFIED_WINDOW_MS;
  const body = Buffer.from(JSON.stringify({ id, email, exp })).toString("base64url");
  const sig = hmac("proof", body).toString("base64url");
  return `${body}.${sig}`;
}

function readCerSignupProof(token: string | undefined) {
  if (!token) return null;
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = hmac("proof", body).toString("base64url");
  const left = Buffer.from(sig);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;

  let parsed: { id?: unknown; email?: unknown; exp?: unknown };
  try {
    parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as {
      id?: unknown;
      email?: unknown;
      exp?: unknown;
    };
  } catch {
    return null;
  }

  const id = typeof parsed.id === "string" ? parsed.id : "";
  const email = typeof parsed.email === "string" ? parsed.email : "";
  const exp = typeof parsed.exp === "number" ? parsed.exp : NaN;
  if (!UUID_RE.test(id) || !email || !Number.isFinite(exp) || Date.now() > exp) return null;
  return { id, email };
}

export async function issueCerSignupOtp(email: string): Promise<OtpIssueResult> {
  const supabase = createSecretClient();
  const since = new Date(Date.now() - ISSUE_WINDOW_MS).toISOString();
  const { data: recent, error: recentError } = await supabase
    .from("cer_signup_otp")
    .select("created_at")
    .eq("email", email)
    .gte("created_at", since)
    .order("created_at", { ascending: false });
  if (recentError) throw new Error(recentError.message);

  const rows = recent ?? [];
  if (rows.length >= MAX_ISSUES_PER_WINDOW) {
    return {
      ok: false,
      status: 429,
      error: "Hai chiesto troppi codici. Riprova tra un'ora.",
    };
  }
  const latest = rows[0]?.created_at;
  if (latest && Date.now() - new Date(latest).getTime() < MIN_ISSUE_GAP_MS) {
    return {
      ok: false,
      status: 429,
      error: "Aspetta un minuto prima di chiedere un altro codice.",
    };
  }

  const otp = generateOtp();
  const { data, error: insertError } = await supabase
    .from("cer_signup_otp")
    .insert({ email, otp: hashOtp(otp), attempts: 0 })
    .select("id")
    .single();
  if (insertError) throw new Error(insertError.message);
  return { ok: true, id: (data as { id: string }).id, otp };
}

export async function invalidatePreviousCerSignupOtps(email: string, keepId: string) {
  const supabase = createSecretClient();
  const { error } = await supabase
    .from("cer_signup_otp")
    .update({ invalidated_at: new Date().toISOString() })
    .eq("email", email)
    .is("invalidated_at", null)
    .neq("id", keepId);
  if (error) throw new Error(error.message);
}

export async function deleteCerSignupOtp(id: string) {
  const supabase = createSecretClient();
  const { error } = await supabase.from("cer_signup_otp").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function verifyCerSignupOtp(email: string, otp: string): Promise<OtpVerifyResult> {
  const supabase = createSecretClient();
  const { data, error } = await supabase
    .from("cer_signup_otp")
    .select("id, otp, attempts, created_at, verified_at, invalidated_at")
    .eq("email", email)
    .is("invalidated_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const row = data as OtpRow | null;
  if (!row) {
    return { ok: false, status: 400, error: "Chiedi prima un codice." };
  }
  if (row.attempts >= MAX_ATTEMPTS) {
    await invalidateOtp(row.id);
    return {
      ok: false,
      status: 400,
      error: "Troppi tentativi. Richiedi un nuovo codice.",
    };
  }
  if (Date.now() - new Date(row.created_at).getTime() > CER_OTP_TTL_MS) {
    return {
      ok: false,
      status: 400,
      error: "Il codice è scaduto. Richiedine uno nuovo.",
    };
  }
  if (!hashMatches(row.otp, otp)) {
    const attempts = row.attempts + 1;
    if (attempts >= MAX_ATTEMPTS) {
      const { error: updateError } = await supabase
        .from("cer_signup_otp")
        .update({ attempts, invalidated_at: new Date().toISOString() })
        .eq("id", row.id)
        .is("invalidated_at", null);
      if (updateError) throw new Error(updateError.message);
      return {
        ok: false,
        status: 400,
        error: "Troppi tentativi. Richiedi un nuovo codice.",
      };
    }
    const { error: updateError } = await supabase
      .from("cer_signup_otp")
      .update({ attempts })
      .eq("id", row.id)
      .is("invalidated_at", null);
    if (updateError) throw new Error(updateError.message);
    return { ok: false, status: 400, error: "Codice non valido." };
  }
  if (!row.verified_at) {
    const { error: updateError } = await supabase
      .from("cer_signup_otp")
      .update({ verified_at: new Date().toISOString() })
      .eq("id", row.id)
      .is("invalidated_at", null);
    if (updateError) throw new Error(updateError.message);
  }
  return { ok: true, id: row.id };
}

async function invalidateOtp(id: string) {
  const supabase = createSecretClient();
  const { error } = await supabase
    .from("cer_signup_otp")
    .update({ invalidated_at: new Date().toISOString() })
    .eq("id", id)
    .is("invalidated_at", null);
  if (error) throw new Error(error.message);
}

export async function claimCerSignupProof(email: string, token: string | undefined) {
  const proof = readCerSignupProof(token);
  if (!proof || proof.email !== email) return null;

  const supabase = createSecretClient();
  const since = new Date(Date.now() - VERIFIED_WINDOW_MS).toISOString();
  const { data, error } = await supabase
    .from("cer_signup_otp")
    .update({ invalidated_at: new Date().toISOString() })
    .eq("id", proof.id)
    .eq("email", email)
    .not("verified_at", "is", null)
    .is("invalidated_at", null)
    .gte("verified_at", since)
    .select("id, invalidated_at")
    .maybeSingle();
  if (error) throw new Error(error.message);
  const row = data as { id: string; invalidated_at: string } | null;
  if (!row?.invalidated_at) return null;
  return { id: row.id, claimedAt: row.invalidated_at };
}

export async function releaseCerSignupProof(id: string, claimedAt: string) {
  const supabase = createSecretClient();
  const { error } = await supabase
    .from("cer_signup_otp")
    .update({ invalidated_at: null })
    .eq("id", id)
    .eq("invalidated_at", claimedAt);
  if (error) throw new Error(error.message);
}
