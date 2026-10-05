import { NextRequest } from "next/server";
import { deleteCerSignupOtp, invalidatePreviousCerSignupOtps, issueCerSignupOtp } from "@/lib/cer/otp";
import { sendCerSignupOtpEmail } from "@/lib/mail/send";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  let body: { email?: string; website?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Richiesta non valida." }, { status: 400 });
  }

  if (body.website) {
    return Response.json({ ok: true });
  }

  const email = body.email?.trim().toLowerCase() ?? "";
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return Response.json({ error: "Inserisci un'email valida." }, { status: 400 });
  }

  try {
    const issued = await issueCerSignupOtp(email);
    if (!issued.ok) {
      return Response.json({ error: issued.error }, { status: issued.status });
    }
    try {
      await sendCerSignupOtpEmail(email, issued.otp);
    } catch (error) {
      console.error("cer signup otp mail", error);
      await deleteCerSignupOtp(issued.id).catch((cleanupError) => {
        console.error("cer signup otp cleanup", cleanupError);
      });
      return Response.json(
        { error: "Non è stato possibile inviare il codice. Riprova." },
        { status: 500 },
      );
    }
    await invalidatePreviousCerSignupOtps(email, issued.id).catch((error) => {
      console.error("cer signup otp invalidate", error);
    });
    return Response.json({ ok: true });
  } catch (error) {
    console.error("cer signup otp", error);
    return Response.json(
      { error: "Non è stato possibile inviare il codice. Riprova." },
      { status: 500 },
    );
  }
}
