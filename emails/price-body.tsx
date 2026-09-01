import { Button, Column, Row, Section, Text } from "react-email";
import type { PriceMailModel } from "@/lib/mail/content";

export function PriceDigestBody({
  model,
  intro,
}: {
  model: PriceMailModel;
  intro?: string;
}) {
  return (
    <>
      {intro ? <Text style={styles.intro}>{intro}</Text> : null}
      <Text style={styles.kicker}>
        {model.dateLabel} · zona {model.zoneName} · {model.region}
      </Text>
      <Text style={styles.tip}>{model.bestTip}</Text>
      {model.worstTip ? <Text style={styles.worst}>{model.worstTip}</Text> : null}

      <Row style={styles.stats}>
        <Column>
          <Text style={styles.statLabel}>min</Text>
          <Text style={styles.statValue}>{model.minLabel}</Text>
        </Column>
        <Column>
          <Text style={styles.statLabel}>medio</Text>
          <Text style={styles.statValue}>{model.avgLabel}</Text>
        </Column>
        <Column>
          <Text style={styles.statLabel}>max</Text>
          <Text style={styles.statValue}>{model.maxLabel}</Text>
        </Column>
      </Row>
      <Text style={styles.unit}>c€/kWh all&apos;ingrosso</Text>

      <Section style={styles.tableWrap}>
        {model.hourly.map((row) => (
          <Row key={row.hour} style={styles.tableRow}>
            <Column style={styles.hourCol}>
              <Text style={styles.cell}>{row.label}</Text>
            </Column>
            <Column>
              <Text style={styles.priceCell}>{row.priceLabel}</Text>
            </Column>
          </Row>
        ))}
      </Section>

      <Button href={model.ctaUrl} style={styles.button}>
        Vedi il grafico interattivo
      </Button>
    </>
  );
}

const styles = {
  intro: {
    color: "#111111",
    fontSize: "16px",
    lineHeight: "24px",
    margin: "0 0 20px",
  },
  kicker: {
    color: "#737373",
    fontSize: "13px",
    margin: "0 0 12px",
  },
  tip: {
    color: "#111111",
    fontSize: "18px",
    fontWeight: 600,
    lineHeight: "26px",
    margin: "0 0 6px",
  },
  worst: {
    color: "#525252",
    fontSize: "15px",
    lineHeight: "22px",
    margin: "0 0 20px",
  },
  stats: {
    margin: "8px 0 0",
  },
  statLabel: {
    color: "#737373",
    fontSize: "11px",
    letterSpacing: "0.06em",
    margin: "0 0 2px",
    textTransform: "uppercase" as const,
  },
  statValue: {
    color: "#111111",
    fontSize: "20px",
    fontWeight: 600,
    margin: 0,
  },
  unit: {
    color: "#a3a3a3",
    fontSize: "12px",
    margin: "4px 0 18px",
  },
  tableWrap: {
    border: "1px solid #e5e5e5",
    borderRadius: "8px",
    margin: "0 0 22px",
    padding: "4px 12px",
  },
  tableRow: {
    borderBottom: "1px solid #f5f5f5",
  },
  hourCol: {
    width: "80px",
  },
  cell: {
    color: "#525252",
    fontSize: "13px",
    margin: "6px 0",
  },
  priceCell: {
    color: "#111111",
    fontSize: "13px",
    fontVariantNumeric: "tabular-nums",
    margin: "6px 0",
    textAlign: "right" as const,
  },
  button: {
    backgroundColor: "#111111",
    borderRadius: "6px",
    color: "#ffffff",
    display: "inline-block",
    fontSize: "14px",
    fontWeight: 500,
    lineHeight: "20px",
    padding: "12px 16px",
    textDecoration: "none",
  },
} as const;
