import { Text } from "react-email";
import { EmailShell } from "@/emails/shell";
import { PriceDigestBody } from "@/emails/price-body";
import type { PriceMailModel } from "@/lib/mail/content";

export function WelcomeEmail({
  unsubscribeUrl,
  model,
}: {
  unsubscribeUrl: string;
  model: PriceMailModel | null;
}) {
  return (
    <EmailShell
      preview="Iscrizione confermata."
      unsubscribeUrl={unsubscribeUrl}
    >
      <Text style={heading}>Iscrizione confermata.</Text>
      <Text style={lead}>
        Ogni giorno ti mandiamo i prezzi dell&apos;energia nella tua zona, così
        sai già quando conviene consumare.
      </Text>
      {model ? (
        <PriceDigestBody
          model={model}
          intro="Ecco quelli di oggi."
        />
      ) : (
        <Text style={lead}>
          I prezzi di oggi non sono ancora in tabella: ti arrivano appena pronti,
          poi ogni giorno quando il mercato pubblica il giorno nuovo.
        </Text>
      )}
    </EmailShell>
  );
}

const heading = {
  color: "#111111",
  fontSize: "22px",
  fontWeight: 600,
  letterSpacing: "-0.02em",
  margin: "0 0 8px",
};

const lead = {
  color: "#404040",
  fontSize: "15px",
  lineHeight: "22px",
  margin: "0 0 20px",
};
