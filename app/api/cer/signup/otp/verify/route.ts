import { NextRequest } from "next/server";
import { verifyCerSignupOtp } from "@/lib/cer/otp";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OTP_RE = /^\d{6}$/;

export async function POST(request: NextRequest) {
  let body: { email?: string; otp?: string; website?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Richiesta non valida." }, { status: 400 });
  }

  if (body.website) {
    return Response.json({ ok: true });
  }

  const email = body.email?.trim().toLowerCase() ?? "";
  const otp = body.otp?.trim() ?? "";
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return Response.json({ error: "Inserisci un'email valida." }, { status: 400 });
  }
  if (!OTP_RE.test(otp)) {
    return Response.json({ error: "Inserisci il codice a 6 cifre." }, { status: 400 });
  }

  try {
    const verified = await verifyCerSignupOtp(email, otp);
    if (!verified.ok) {
      return Response.json({ error: verified.error }, { status: verified.status });
    }
    return Response.json({ ok: true });
  } catch {
    return Response.json(
      { error: "Non è stato possibile verificare il codice. Riprova." },
      { status: 500 },
    );
  }
}
