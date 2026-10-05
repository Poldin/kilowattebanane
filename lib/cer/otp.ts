import { randomInt, timingSafeEqual } from "node:crypto";
import { createSecretClient } from "@/lib/supabase/secret";

export const CER_OTP_TTL_MS = 10 * 60 * 1000;
const VERIFIED_WINDOW_MS = 2 * 60 * 60 * 1000;

type OtpRow = {
  id: string;
  otp: string;
  created_at: string;
  verified_at: string | null;
  invalidated_at: string | null;
};

export type OtpIssueResult =
  | { ok: true; id: string; otp: string }
  | { ok: false; error: string; status: number };

export type OtpVerifyResult =
  | { ok: true }
  | { ok: false; error: string; status: number };

function generateOtp() {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

function otpMatches(expected: string, given: string) {
  const left = Buffer.from(expected);
  const right = Buffer.from(given);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export async function issueCerSignupOtp(email: string): Promise<OtpIssueResult> {
  const supabase = createSecretClient();
  const otp = generateOtp();
  const { data, error: insertError } = await supabase
    .from("cer_signup_otp")
    .insert({ email, otp })
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
    .is("verified_at", null)
    .is("invalidated_at", null)
    .neq("id", keepId);
  if (error) throw new Error(error.message);
}

export async function deleteCerSignupOtp(id: string) {
  const supabase = createSecretClient();
  const { error } = await supabase.from("cer_signup_otp").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function verifyCerSignupOtp(
  email: string,
  otp: string,
): Promise<OtpVerifyResult> {
  const supabase = createSecretClient();
  const { data, error } = await supabase
    .from("cer_signup_otp")
    .select("id, otp, created_at, verified_at, invalidated_at")
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
  if (Date.now() - new Date(row.created_at).getTime() > CER_OTP_TTL_MS) {
    return {
      ok: false,
      status: 400,
      error: "Il codice è scaduto. Richiedine uno nuovo.",
    };
  }
  if (!otpMatches(row.otp, otp)) {
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
  return { ok: true };
}

export async function hasVerifiedCerSignupOtp(email: string) {
  const supabase = createSecretClient();
  const since = new Date(Date.now() - VERIFIED_WINDOW_MS).toISOString();
  const { data, error } = await supabase
    .from("cer_signup_otp")
    .select("id")
    .eq("email", email)
    .not("verified_at", "is", null)
    .is("invalidated_at", null)
    .gte("verified_at", since)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return Boolean(data);
}
