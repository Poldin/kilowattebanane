import { render } from "react-email";
import { Resend } from "resend";
import { DigestEmail } from "@/emails/digest";
import { WelcomeEmail } from "@/emails/welcome";
import { resendFrom, unsubscribeApiUrl, unsubscribePageUrl } from "@/lib/app-url";
import {
  digestSubjectLine,
  priceMailModelForRegion,
  type PriceMailModel,
  type ZoneMailContent,
} from "@/lib/mail/content";
import type { Subscriber } from "@/lib/subscribers";
import type { MarketZoneId } from "@/lib/market-zones";

function getResend() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("Missing RESEND_API_KEY");
  return new Resend(apiKey);
}

function unsubscribeHeaders(token: string) {
  const apiUrl = unsubscribeApiUrl(token);
  return {
    "List-Unsubscribe": `<${apiUrl}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

export async function sendWelcomeEmail(
  subscriber: Subscriber,
  model: PriceMailModel | null,
) {
  const pageUrl = unsubscribePageUrl(subscriber.unsubscribe_token);
  const html = await render(
    WelcomeEmail({ unsubscribeUrl: pageUrl, model }),
  );
  const text = await render(
    WelcomeEmail({ unsubscribeUrl: pageUrl, model }),
    { plainText: true },
  );

  const { data, error } = await getResend().emails.send({
    from: resendFrom(),
    to: subscriber.email,
    subject: "Iscrizione confermata a kilowatt e banane🍌🍌🍌",
    html,
    text,
    headers: unsubscribeHeaders(subscriber.unsubscribe_token),
  });

  if (error) throw new Error(error.message);
  return data?.id;
}

export async function sendZoneDigest(
  deliveryDate: string,
  zone: MarketZoneId,
  recipients: Subscriber[],
  content: ZoneMailContent,
) {
  const resend = getResend();
  const payload = [];

  for (const subscriber of recipients) {
    const model = priceMailModelForRegion(content, subscriber.region);
    const pageUrl = unsubscribePageUrl(subscriber.unsubscribe_token);
    const html = await render(
      DigestEmail({ unsubscribeUrl: pageUrl, model }),
    );
    const text = await render(
      DigestEmail({ unsubscribeUrl: pageUrl, model }),
      { plainText: true },
    );
    payload.push({
      from: resendFrom(),
      to: [subscriber.email],
      subject: digestSubjectLine(model),
      html,
      text,
      headers: unsubscribeHeaders(subscriber.unsubscribe_token),
    });
  }

  const ids: (string | null)[] = [];
  for (let i = 0; i < payload.length; i += 100) {
    const chunk = payload.slice(i, i + 100);
    const { data, error } = await resend.batch.send(chunk, {
      idempotencyKey: `digest:${deliveryDate}:${zone}:${i}`,
    });
    if (error) throw new Error(error.message);
    ids.push(...(data?.data?.map((item) => item.id) ?? chunk.map(() => null)));
  }

  return ids;
}
