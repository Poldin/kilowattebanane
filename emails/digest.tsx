import { EmailShell } from "@/emails/shell";
import { PriceDigestBody } from "@/emails/price-body";
import type { PriceMailModel } from "@/lib/mail/content";

export function DigestEmail({
  unsubscribeUrl,
  model,
}: {
  unsubscribeUrl: string;
  model: PriceMailModel;
}) {
  return (
    <EmailShell
      preview={`${model.bestTip} · zona ${model.zoneName}`}
      unsubscribeUrl={unsubscribeUrl}
    >
      <PriceDigestBody model={model} />
    </EmailShell>
  );
}
