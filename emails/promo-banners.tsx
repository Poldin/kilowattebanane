import type { CSSProperties, ReactNode } from "react";
import { Button, Column, Link, Row, Section, Text } from "react-email";

const BANANA = "#F5D547";

function solidFill(color: string): CSSProperties {
  return {
    backgroundColor: color,
    backgroundImage: `linear-gradient(${color}, ${color})`,
  };
}

function PromoBanner({
  style,
  className,
  children,
}: {
  style: CSSProperties;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Section className={className} style={{ margin: style.margin }}>
      <Row>
        <Column className={className} style={{ ...style, margin: 0 }}>
          {children}
        </Column>
      </Row>
    </Section>
  );
}

export function MailPromoBanners({
  learnUrl,
  offerCompareUrl,
  offerStatsUrl,
  shareUrl,
}: {
  learnUrl: string;
  offerCompareUrl: string;
  offerStatsUrl: string;
  shareUrl: string;
}) {
  return (
    <Section style={styles.wrap}>
      <PromoBanner className="banana-bg" style={styles.learnBanner}>
        <Text className="banana-title" style={styles.learnTitle}>
          Non ci capisci una mazza?!🏏
        </Text>
        <Text className="banana-sub" style={styles.learnSub}>
          Sei in buona compagnia.
        </Text>
        <Button href={learnUrl} style={styles.learnButton}>
          studia il mercato elettrico →
        </Button>
      </PromoBanner>

      <PromoBanner style={styles.offerBanner}>
        <Text style={styles.offerTitle}>Confronta le offerte luce</Text>
        <Text style={styles.offerSub}>
          Inserisci il CAP della fornitura e scopri quanto paghi in bolletta
        </Text>
        <Button href={offerCompareUrl} style={styles.offerButton}>
          Confronta →
        </Button>
        <Text style={styles.offerLinkWrap}>
          <Link href={offerStatsUrl} style={styles.offerLink}>
            Vedi le statistiche sulle offerte luce
          </Link>
        </Text>
      </PromoBanner>

      <PromoBanner style={styles.shareBanner}>
        <Text style={styles.shareTitle}>Condividi kilowatt e banane</Text>
        <Text style={styles.shareSub}>
          parlane a chi può trarne beneficio 😮🙂😍
        </Text>
        <Button href={shareUrl} style={styles.shareButton}>
          Condividi →
        </Button>
      </PromoBanner>
    </Section>
  );
}

const styles = {
  wrap: {
    margin: "8px 0 0",
  },
  learnBanner: {
    backgroundColor: BANANA,
    border: `1px solid ${BANANA}`,
    borderRadius: "8px",
    margin: "0 0 12px",
    padding: "20px 20px 18px",
  },
  learnTitle: {
    color: "#111111",
    fontSize: "24px",
    fontWeight: 700,
    letterSpacing: "-0.02em",
    lineHeight: "1.15",
    margin: "0 0 8px",
  },
  learnSub: {
    color: "#262626",
    fontSize: "14px",
    lineHeight: "20px",
    margin: "0 0 16px",
  },
  learnButton: {
    backgroundColor: "#111111",
    borderRadius: "6px",
    color: "#FEFCE8",
    display: "inline-block",
    fontSize: "14px",
    fontWeight: 500,
    lineHeight: "20px",
    padding: "10px 16px",
    textDecoration: "none",
  },
  offerBanner: {
    backgroundColor: "#165B44",
    borderRadius: "8px",
    margin: "0 0 12px",
    padding: "20px 20px 18px",
  },
  offerTitle: {
    color: "#f5f5f5",
    fontSize: "24px",
    fontWeight: 700,
    letterSpacing: "-0.02em",
    lineHeight: "1.15",
    margin: "0 0 8px",
  },
  offerSub: {
    color: "#D1FAE5",
    fontSize: "14px",
    lineHeight: "20px",
    margin: "0 0 16px",
  },
  offerButton: {
    backgroundColor: "#f5f5f5",
    borderRadius: "6px",
    color: "#111111",
    display: "inline-block",
    fontSize: "14px",
    fontWeight: 500,
    lineHeight: "20px",
    padding: "10px 16px",
    textDecoration: "none",
  },
  offerLinkWrap: {
    margin: "12px 0 0",
  },
  offerLink: {
    color: "#D1FAE5",
    fontSize: "14px",
    textDecoration: "underline",
    textUnderlineOffset: "2px",
  },
  shareBanner: {
    backgroundColor: "#111111",
    borderRadius: "8px",
    margin: 0,
    padding: "20px 20px 18px",
  },
  shareTitle: {
    color: "#f5f5f5",
    fontSize: "24px",
    fontWeight: 700,
    letterSpacing: "-0.02em",
    lineHeight: "1.15",
    margin: "0 0 8px",
  },
  shareSub: {
    color: "#D4D4D4",
    fontSize: "14px",
    lineHeight: "20px",
    margin: "0 0 16px",
  },
  shareButton: {
    backgroundColor: "#f5f5f5",
    borderRadius: "6px",
    color: "#111111",
    display: "inline-block",
    fontSize: "14px",
    fontWeight: 500,
    lineHeight: "20px",
    padding: "10px 16px",
    textDecoration: "none",
  },
} as const;
