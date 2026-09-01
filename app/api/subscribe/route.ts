import { NextRequest } from "next/server";
import { ITALIAN_REGIONS, type ItalianRegion } from "@/lib/market-zones";
import { buildPriceMailModel } from "@/lib/mail/content";
import { sendWelcomeEmail } from "@/lib/mail/send";
import { upsertSubscriber } from "@/lib/subscribers";
import { romeToday } from "@/lib/day-ahead-query";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  let body: {
    email?: string;
    region?: string;
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
  const region = body.region?.trim() ?? "";

  if (!EMAIL_RE.test(email) || email.length > 254) {
    return Response.json({ error: "Inserisci un'email valida." }, { status: 400 });
  }
  if (!ITALIAN_REGIONS.includes(region as ItalianRegion)) {
    return Response.json({ error: "Scegli una regione." }, { status: 400 });
  }

  try {
    const { subscriber, created, reactivated } = await upsertSubscriber(
      email,
      region as ItalianRegion,
    );

    if (created || reactivated) {
      const model = await buildPriceMailModel(
        subscriber.region,
        subscriber.zone,
        romeToday(),
      );
      try {
        await sendWelcomeEmail(subscriber, model);
      } catch {
        // Iscrizione ok anche se Resend non ha ancora il dominio verificato.
      }
    }

    return Response.json({ ok: true });
  } catch {
    return Response.json(
      { error: "Non è stato possibile completare l'iscrizione. Riprova." },
      { status: 500 },
    );
  }
}
