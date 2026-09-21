import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Link,
  Preview,
  Text,
} from "react-email";
import { shortItDate, type OpsKpiReport } from "@/lib/mail/ops-kpis";

export function OpsKpiEmail({ report }: { report: OpsKpiReport }) {
  const sign = (value: number) => (value > 0 ? `+${value}` : String(value));

  return (
    <Html lang="it">
      <Head />
      <Preview>{report.subject}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Text style={styles.brand}>kilowatt e banane · KPI</Text>
          <Text style={styles.date}>{shortItDate(report.reportDate)}</Text>

          {report.alerts.length > 0 ? (
            <Text style={styles.alert}>{report.alerts.join(" · ")}</Text>
          ) : (
            <Text style={styles.ok}>Tutto ok</Text>
          )}

          <Text style={styles.row}>
            <span style={styles.label}>ISCRITTI</span>
            {report.subscribers.active} attivi ({sign(report.subscribers.newToday)} /{" "}
            {sign(-report.subscribers.unsubscribedToday)} oggi)
          </Text>
          <Text style={styles.row}>
            <span style={styles.label}>DIGEST {shortItDate(report.digest.deliveryDate)}</span>
            {report.digest.status ?? "assente"}
            {report.digest.lastError ? ` · ${report.digest.lastError}` : ""}
            {` · ${report.digest.sent}/${report.digest.sent + report.digest.failed + report.digest.pending} inviate`}
          </Text>
          <Text style={styles.row}>
            <span style={styles.label}>ENTSO oggi</span>
            {completenessLine(report.entsoToday)}
          </Text>
          <Text style={styles.row}>
            <span style={styles.label}>ENTSO {shortItDate(report.entsoTomorrow.date)}</span>
            {completenessLine(report.entsoTomorrow)}
          </Text>
          <Text style={styles.row}>
            <span style={styles.label}>OFFERTE</span>
            {offerteLine(report)}
          </Text>
          <Text style={styles.row}>
            <span style={styles.label}>FORWARD</span>
            {forwardLine(report)}
          </Text>

          <Hr style={styles.hr} />
          <Text style={styles.footer}>
            Solo a te.{" "}
            <Link href="https://kilowattebanane.it" style={styles.link}>
              kilowattebanane.it
            </Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

function completenessLine(row: OpsKpiReport["entsoToday"]) {
  if (row.missing.length === 0) return `${row.complete}/${row.total} complete`;
  if (row.missing.length === row.total) {
    return `${row.complete}/${row.total} complete (mancano tutte)`;
  }
  return `${row.complete}/${row.total} complete (${row.missing.join(", ")})`;
}

function offerteLine(report: OpsKpiReport) {
  if (!report.offerte.lastOkDate) return "nessun sync";
  const inserted = report.offerte.runs.reduce((sum, run) => sum + run.inserted, 0);
  const delisted = report.offerte.runs.reduce((sum, run) => sum + run.delisted, 0);
  const freshness =
    report.offerte.staleDays > 0
      ? `ultimo ok ${shortItDate(report.offerte.lastOkDate)}`
      : "oggi";
  return `${freshness} · ${report.offerte.runs.map((run) => `${run.label} ${run.status}`).join(", ")} · ${inserted} nuove / ${delisted} uscite`;
}

function forwardSourceLine(row: OpsKpiReport["forward"]["gme"]) {
  if (!row.asOf) return `${row.label} assente`;
  return `${row.label} ${shortItDate(row.asOf)} (${row.months} mesi)`;
}

function forwardLine(report: OpsKpiReport) {
  return `${forwardSourceLine(report.forward.gme)} · ${forwardSourceLine(report.forward.cme)}`;
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
    margin: "0 0 4px",
  },
  date: {
    color: "#737373",
    fontSize: "13px",
    margin: "0 0 16px",
  },
  alert: {
    backgroundColor: "#fff1f2",
    borderRadius: "6px",
    color: "#9f1239",
    fontSize: "14px",
    fontWeight: 600,
    lineHeight: "20px",
    margin: "0 0 20px",
    padding: "10px 12px",
  },
  ok: {
    backgroundColor: "#f0fdf4",
    borderRadius: "6px",
    color: "#166534",
    fontSize: "14px",
    fontWeight: 600,
    margin: "0 0 20px",
    padding: "10px 12px",
  },
  row: {
    color: "#111111",
    fontSize: "14px",
    lineHeight: "22px",
    margin: "0 0 8px",
  },
  label: {
    color: "#737373",
    display: "inline-block",
    fontSize: "11px",
    fontWeight: 600,
    letterSpacing: "0.08em",
    marginRight: "10px",
    minWidth: "108px",
    textTransform: "uppercase" as const,
  },
  hr: {
    borderColor: "#e5e5e5",
    margin: "24px 0 12px",
  },
  footer: {
    color: "#737373",
    fontSize: "12px",
    lineHeight: "18px",
    margin: 0,
  },
  link: {
    color: "#111111",
    textDecoration: "underline",
  },
} as const;
