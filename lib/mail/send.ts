import { render } from "react-email";
import { Resend } from "resend";
import { DigestEmail } from "@/emails/digest";
import { WelcomeEmail } from "@/emails/welcome";
import { resendFrom, unsubscribeApiUrl, unsubscribePageUrl } from "@/lib/app-url";
import { digestSubjectLine, type PriceMailModel } from "@/lib/mail/content";
import type { Subscriber } from "@/lib/subscribers";

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
    subject: model
      ? `Iscrizione confermata`
      : "Iscrizione confermata",
    html,
    text,
    headers: unsubscribeHeaders(subscriber.unsubscribe_token),
  });

  if (error) throw new Error(error.message);
  return data?.id;
}

export async function sendDigestBatch(
  deliveryDate: string,
  recipients: Subscriber[],
  modelByKey: Map<string, PriceMailModel>,
) {
  const resend = getResend();
  const payload = [];

  for (const subscriber of recipients) {
    const model = modelByKey.get(`${subscriber.zone}:${subscriber.region}`);
    if (!model) continue;
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
      idempotencyKey: `digest:${deliveryDate}:${i}`,
    });
    if (error) throw new Error(error.message);
    ids.push(...(data?.data?.map((item) => item.id) ?? chunk.map(() => null)));
  }

  return ids;
}
