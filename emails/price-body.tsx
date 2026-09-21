import { Button, Column, Img, Link, Row, Section, Text } from "react-email";
import { MailPromoBanners } from "@/emails/promo-banners";
import type { PriceMailModel } from "@/lib/mail/content";
import { MAIL_CHART_DISPLAY_H, MAIL_CHART_DISPLAY_W } from "@/lib/mail/chart";
import {
  MAIL_OUTLOOK_DISPLAY_H,
  MAIL_OUTLOOK_DISPLAY_W,
} from "@/lib/mail/outlook-chart";
import { LOOKBACK_SECTION_ID } from "@/lib/lookback";

const YEAR_TONE = {
  expensive: "#EF4444",
  cheap: "#F5D547",
  mid: "#A3A3A3",
} as const;

const DELTA_BADGE = {
  expensive: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    color: "#B91C1C",
  },
  cheap: {
    backgroundColor: "rgba(245, 213, 71, 0.3)",
    color: "#111111",
  },
  mid: {
    backgroundColor: "#F5F5F5",
    color: "#525252",
  },
} as const;

function lookbackHref(ctaUrl: string) {
  try {
    const url = new URL(ctaUrl);
    url.hash = LOOKBACK_SECTION_ID;
    return url.toString();
  } catch {
    return `${ctaUrl.split("#")[0]}#${LOOKBACK_SECTION_ID}`;
  }
}

export function PriceDigestBody({
  model,
  intro,
}: {
  model: PriceMailModel;
  intro?: string;
}) {
  const hasHints = model.kpiColumns.some((column) => column.hint);

  return (
    <>
      {intro ? <Text style={styles.intro}>{intro}</Text> : null}
      <Text style={styles.kicker}>
        {model.dateLabel} · zona {model.zoneName} · {model.region} · {model.tariffLabel}
      </Text>
      <Link href={model.ctaUrl} style={styles.chartLink}>
        <Img
          src={model.chartUrl}
          alt={`Grafico dei prezzi ${model.dateLabel}, zona ${model.zoneName}, ${model.tariffLabel}`}
          width={MAIL_CHART_DISPLAY_W}
          height={MAIL_CHART_DISPLAY_H}
          style={styles.chart}
        />
      </Link>
      <Text style={styles.tip}>{model.bestTip}</Text>
      {model.worstTip ? <Text style={styles.worst}>{model.worstTip}</Text> : null}

      {model.kpiColumns.length > 0 ? (
        <Section style={styles.kpiWrap}>
          <table style={styles.kpiTable} cellPadding={0} cellSpacing={0}>
            <thead>
              <tr>
                {model.kpiColumns.map((column, index) => (
                  <th
                    key={column.key}
                    style={{
                      ...styles.kpiHead,
                      ...(index > 0 ? styles.kpiDivider : {}),
                      ...(column.color ? { color: column.color } : {}),
                    }}
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                {model.kpiColumns.map((column, index) => (
                  <td
                    key={column.key}
                    style={{
                      ...styles.kpiValue,
                      ...(index > 0 ? styles.kpiDivider : {}),
                      ...(column.color ? { color: column.color } : {}),
                    }}
                  >
                    {column.value}
                  </td>
                ))}
              </tr>
              {hasHints ? (
                <tr>
                  {model.kpiColumns.map((column, index) => (
                    <td
                      key={column.key}
                      style={{
                        ...styles.kpiHint,
                        ...(index > 0 ? styles.kpiDivider : {}),
                      }}
                    >
                      {column.hint ?? ""}
                    </td>
                  ))}
                </tr>
              ) : null}
            </tbody>
          </table>
        </Section>
      ) : null}

      {model.yearPercentile ? (
        <Text style={styles.yearLine}>
          {model.yearPercentile.before}
          <span style={styles.yearBadge}>{model.yearPercentile.badge}</span>
          {" dell'ultimo anno: "}
          <span
            style={{
              ...styles.yearMark,
              textDecorationColor: YEAR_TONE[model.yearPercentile.tone],
            }}
          >
            {model.yearPercentile.mark}
          </span>
          {model.yearPercentile.after}{" "}
          <Link href={lookbackHref(model.ctaUrl)} style={styles.yearLink}>
            Approfondisci
          </Link>
        </Text>
      ) : null}

      {model.priceDeltas.length > 0 ? (
        <Section style={styles.deltaWrap}>
          <table style={styles.deltaTable} cellPadding={0} cellSpacing={0}>
            <tbody>
              <tr>
                <td
                  colSpan={model.priceDeltas.length}
                  style={styles.deltaCaption}
                >
                  Variazione % del prezzo medio del giorno rispetto al passato
                </td>
              </tr>
              <tr>
                {model.priceDeltas.map((column, index) => (
                  <th
                    key={column.key}
                    style={{
                      ...styles.deltaHead,
                      ...(index > 0 ? styles.kpiDivider : {}),
                    }}
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
              <tr>
                {model.priceDeltas.map((column, index) => (
                  <td
                    key={column.key}
                    style={{
                      ...styles.deltaValue,
                      ...(index > 0 ? styles.kpiDivider : {}),
                    }}
                  >
                    <span
                      style={{
                        ...styles.deltaBadge,
                        ...DELTA_BADGE[column.tone],
                      }}
                    >
                      {column.value}
                    </span>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </Section>
      ) : null}

      <Link href={model.ctaUrl} style={styles.chartLink}>
        <Img
          src={model.outlookChartUrl}
          alt={`Prezzo medio mensile sull'ultimo anno, zona ${model.zoneName}, ${model.tariffLabel}`}
          width={MAIL_OUTLOOK_DISPLAY_W}
          height={MAIL_OUTLOOK_DISPLAY_H}
          style={styles.chart}
        />
      </Link>

      <Button href={model.ctaUrl} style={styles.button}>
        Vedi il grafico interattivo
      </Button>

      <MailPromoBanners
        learnUrl={model.learnUrl}
        offerCompareUrl={model.offerCompareUrl}
        offerStatsUrl={model.offerStatsUrl}
        shareUrl={model.shareUrl}
      />

      {model.tariff === "dinamica" ? (
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
      ) : null}
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
  chartLink: {
    display: "block",
    margin: "0 0 16px",
    textDecoration: "none",
  },
  chart: {
    borderRadius: "8px",
    display: "block",
    height: "auto",
    width: "100%",
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
    margin: "0 0 12px",
  },
  kpiWrap: {
    margin: "0 0 16px",
  },
  kpiTable: {
    border: "1px solid #e5e5e5",
    borderCollapse: "collapse" as const,
    borderRadius: "6px",
  },
  kpiHead: {
    backgroundColor: "#fafafa",
    borderBottom: "1px solid #e5e5e5",
    color: "#737373",
    fontSize: "10px",
    fontWeight: 600,
    letterSpacing: "0.06em",
    padding: "6px 10px",
    textAlign: "left" as const,
    textTransform: "uppercase" as const,
  },
  kpiValue: {
    color: "#111111",
    fontSize: "16px",
    fontWeight: 600,
    padding: "4px 10px",
    textAlign: "left" as const,
  },
  kpiHint: {
    borderTop: "1px solid #f5f5f5",
    color: "#a3a3a3",
    fontSize: "10px",
    padding: "2px 10px 6px",
    textAlign: "left" as const,
  },
  kpiDivider: {
    borderLeft: "1px solid #e5e5e5",
  },
  yearLine: {
    color: "#111111",
    fontSize: "15px",
    fontWeight: 600,
    lineHeight: "24px",
    margin: "0 0 16px",
  },
  yearBadge: {
    backgroundColor: "#F5D547",
    borderRadius: "999px",
    color: "#111111",
    display: "inline-block",
    fontWeight: 600,
    padding: "1px 8px",
  },
  yearMark: {
    textDecoration: "underline",
    textDecorationThickness: "2px",
    textUnderlineOffset: "2px",
  },
  yearLink: {
    color: "#737373",
    fontWeight: 500,
    textDecoration: "underline",
    textUnderlineOffset: "2px",
  },
  deltaWrap: {
    margin: "0 0 16px",
  },
  deltaTable: {
    border: "1px solid #e5e5e5",
    borderCollapse: "collapse" as const,
    borderRadius: "6px",
  },
  deltaCaption: {
    backgroundColor: "#fafafa",
    borderBottom: "1px solid #e5e5e5",
    color: "#737373",
    fontSize: "12px",
    fontWeight: 500,
    padding: "6px 10px",
    textAlign: "left" as const,
  },
  deltaHead: {
    backgroundColor: "#fafafa",
    borderBottom: "1px solid #e5e5e5",
    color: "#525252",
    fontSize: "13px",
    fontWeight: 500,
    padding: "6px 10px",
    textAlign: "left" as const,
  },
  deltaValue: {
    padding: "6px 10px",
    textAlign: "left" as const,
  },
  deltaBadge: {
    borderRadius: "999px",
    display: "inline-block",
    fontSize: "14px",
    fontVariantNumeric: "tabular-nums",
    fontWeight: 600,
    lineHeight: "20px",
    padding: "2px 8px",
  },
  button: {
    backgroundColor: "#111111",
    borderRadius: "6px",
    color: "#ffffff",
    display: "inline-block",
    fontSize: "14px",
    fontWeight: 500,
    lineHeight: "20px",
    margin: "0 0 22px",
    padding: "12px 16px",
    textDecoration: "none",
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
} as const;
