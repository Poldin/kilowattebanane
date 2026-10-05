import { Body, Container, Head, Hr, Html, Link, Preview, Text } from "react-email";

export function CerSignupOtpEmail({ code }: { code: string }) {
  return (
    <Html lang="it">
      <Head />
      <Preview>Il tuo codice è {code}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Text style={styles.brand}>kilowatt e banane</Text>
          <Text style={styles.heading}>Il tuo codice</Text>
          <Text style={styles.lead}>
            Usalo per confermare l&apos;email dell&apos;iscrizione a una CER. Scade tra
            10 minuti.
          </Text>
          <Text style={styles.code}>{code}</Text>
          <Hr style={styles.hr} />
          <Text style={styles.footer}>
            Se non hai chiesto tu questo codice, ignora il messaggio.{" "}
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
  heading: {
    color: "#111111",
    fontSize: "22px",
    fontWeight: 600,
    letterSpacing: "-0.02em",
    margin: "0 0 8px",
  },
  lead: {
    color: "#404040",
    fontSize: "15px",
    lineHeight: "22px",
    margin: "0 0 20px",
  },
  code: {
    color: "#111111",
    fontSize: "32px",
    fontWeight: 700,
    letterSpacing: "0.28em",
    margin: "0 0 8px",
    textAlign: "center" as const,
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
