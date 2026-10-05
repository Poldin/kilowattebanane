import { Body, Button, Container, Head, Hr, Html, Link, Preview, Section, Text } from "react-email";
import type { CerSignupSummary } from "@/lib/cer/signup";

export function CerSignupConfirmationEmail({
  summary,
  shareUrl,
}: {
  summary: CerSignupSummary;
  shareUrl: string;
}) {
  return (
    <Html lang="it">
      <Head />
      <Preview>{summary.lead}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Text style={styles.brand}>kilowatt e banane</Text>
          <Text style={styles.heading}>{summary.title}</Text>
          <Text style={styles.lead}>{summary.lead}</Text>
          {summary.remember ? (
            <Text style={styles.remember}>
              <strong>Ricorda:</strong> {summary.remember}
            </Text>
          ) : null}

          <Section style={styles.table}>
            {summary.rows.map((row, index) => (
              <Section
                key={row.label}
                style={index === 0 ? styles.tableRowFirst : styles.tableRow}
              >
                <Text style={styles.rowLabel}>{row.label}</Text>
                <Text style={row.mono ? styles.rowValueMono : styles.rowValue}>{row.value}</Text>
              </Section>
            ))}
            {summary.preferences.length > 0 ? (
              <Section style={styles.tableRow}>
                <Text style={styles.rowLabel}>Preferenze</Text>
                {summary.preferences.map((label) => (
                  <Text key={label} style={styles.prefItem}>
                    {label}
                  </Text>
                ))}
              </Section>
            ) : null}
          </Section>

          <Text style={styles.shareTitle}>
            <span style={styles.shareHighlight}>{summary.shareHighlight}</span>{" "}
            {summary.shareRest}
          </Text>
          <Text style={styles.shareLead}>{summary.shareLead}</Text>
          <Button href={shareUrl} style={styles.shareButton}>
            Condividi
          </Button>

          <Hr style={styles.hr} />
          <Text style={styles.footer}>
            Se non hai chiesto tu questa iscrizione, ignora il messaggio.{" "}
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
    margin: "0 0 16px",
  },
  remember: {
    color: "#404040",
    fontSize: "14px",
    lineHeight: "20px",
    margin: "0 0 20px",
  },
  table: {
    border: "1px solid #e5e5e5",
    borderRadius: "8px",
    margin: "0 0 24px",
    overflow: "hidden" as const,
  },
  tableRowFirst: {
    margin: 0,
    padding: "12px 16px",
  },
  tableRow: {
    borderTop: "1px solid #e5e5e5",
    margin: 0,
    padding: "12px 16px",
  },
  rowLabel: {
    color: "#737373",
    fontSize: "11px",
    fontWeight: 600,
    letterSpacing: "0.08em",
    margin: "0 0 4px",
    textTransform: "uppercase" as const,
  },
  rowValue: {
    color: "#111111",
    fontSize: "14px",
    lineHeight: "20px",
    margin: 0,
  },
  rowValueMono: {
    color: "#111111",
    fontSize: "14px",
    letterSpacing: "0.08em",
    lineHeight: "20px",
    margin: 0,
  },
  prefItem: {
    color: "#111111",
    fontSize: "14px",
    lineHeight: "20px",
    margin: "0 0 2px",
  },
  shareTitle: {
    color: "#111111",
    fontSize: "20px",
    fontWeight: 700,
    letterSpacing: "-0.02em",
    lineHeight: "1.25",
    margin: "0 0 8px",
  },
  shareHighlight: {
    color: "#165B44",
  },
  shareLead: {
    color: "#111111",
    fontSize: "15px",
    lineHeight: "22px",
    margin: "0 0 16px",
  },
  shareButton: {
    backgroundColor: "#165B44",
    borderRadius: "6px",
    color: "#ffffff",
    display: "inline-block",
    fontSize: "14px",
    fontWeight: 500,
    lineHeight: "20px",
    padding: "12px 20px",
    textDecoration: "none",
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
