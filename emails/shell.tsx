import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "react-email";
import type { ReactNode } from "react";

type EmailShellProps = {
  preview: string;
  unsubscribeUrl: string;
  children: ReactNode;
};

export function EmailShell({ preview, unsubscribeUrl, children }: EmailShellProps) {
  return (
    <Html lang="it">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Text style={styles.brand}>kilowatt e banane</Text>
          <Section style={styles.main}>{children}</Section>
          <Hr style={styles.hr} />
          <Text style={styles.footer}>
            Questo è il prezzo all&apos;ingrosso, non la bolletta. Puoi annullare
            l&apos;iscrizione quando vuoi.
          </Text>
          <Text style={styles.footer}>
            <Link href={unsubscribeUrl} style={styles.link}>
              Annulla iscrizione
            </Link>
            {" · "}
            <Link href="https://kilowattebanane.it" style={styles.link}>
              kilowattebanane.it
            </Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

const styles = {
  body: {
    backgroundColor: "#fafafa",
    color: "#111111",
    fontFamily:
      'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    margin: 0,
    padding: "24px 12px",
  },
  container: {
    backgroundColor: "#ffffff",
    border: "1px solid #e5e5e5",
    borderRadius: "8px",
    margin: "0 auto",
    maxWidth: "560px",
    padding: "28px 24px",
  },
  brand: {
    color: "#111111",
    fontSize: "16px",
    fontWeight: 600,
    letterSpacing: "-0.02em",
    margin: "0 0 20px",
  },
  main: {
    margin: 0,
    padding: 0,
  },
  hr: {
    borderColor: "#e5e5e5",
    margin: "28px 0 16px",
  },
  footer: {
    color: "#737373",
    fontSize: "12px",
    lineHeight: "18px",
    margin: "0 0 8px",
  },
  link: {
    color: "#111111",
    textDecoration: "underline",
  },
} as const;
