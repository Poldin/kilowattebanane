import { ImageResponse } from "next/og";
import {
  MAIL_OUTLOOK_H,
  MAIL_OUTLOOK_W,
  buildMailOutlookChartLayout,
  type MailOutlookChartLayout,
} from "@/lib/mail/outlook-chart";
import type { TariffPlanId } from "@/lib/fasce";
import type { PunMonthPoint } from "@/lib/offerte/forward";
import type { ZoneHourlyPayload } from "@/lib/zone-home-types";

const BANANA = "#F5D547";
const CHART_BG = "#111111";
const AXIS = "#A3A3A3";

export function mailOutlookChartImageResponse({
  anchorDate,
  hourly,
  tariff,
  forwardMonths,
  forwardAsOf,
  forwardSource,
}: {
  anchorDate: string;
  hourly: ZoneHourlyPayload[];
  tariff: TariffPlanId;
  forwardMonths: PunMonthPoint[];
  forwardAsOf: string | null;
  forwardSource?: string | null;
}) {
  const layout = buildMailOutlookChartLayout({
    anchorDate,
    hourly,
    tariff,
    forwardMonths,
    forwardAsOf,
    forwardSource,
  });
  if (!layout) {
    return new Response("Grafico non disponibile", { status: 404 });
  }

  const image = new ImageResponse(<MailOutlookChartImage layout={layout} />, {
    width: MAIL_OUTLOOK_W,
    height: MAIL_OUTLOOK_H,
  });
  image.headers.set(
    "Cache-Control",
    "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800",
  );
  return image;
}

function MailOutlookChartImage({ layout }: { layout: MailOutlookChartLayout }) {
  return (
    <div
      style={{
        display: "flex",
        width: layout.width,
        height: layout.height,
        backgroundColor: CHART_BG,
        position: "relative",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          padding: "18px 24px 0",
          color: "#f5f5f5",
          fontSize: 24,
          fontWeight: 600,
        }}
      >
        <span>Prezzo medio mensile</span>
      </div>

      <svg
        width={layout.width}
        height={layout.height}
        style={{ position: "absolute", inset: 0 }}
      >
        <defs>
          <pattern
            id="mail-outlook-forward"
            width="8"
            height="8"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <rect width="8" height="8" fill="#E5E5E5" fillOpacity="0.14" />
            <line
              x1="0"
              y1="0"
              x2="0"
              y2="8"
              stroke="#E5E5E5"
              strokeWidth="2"
              strokeOpacity="0.72"
            />
          </pattern>
        </defs>
        {layout.bars.map((bar) => (
          <rect
            key={`${bar.monthLabel}-${bar.x}`}
            x={bar.x}
            y={bar.y}
            width={bar.width}
            height={bar.height}
            rx="4"
            fill={bar.isForward ? "url(#mail-outlook-forward)" : bar.fill}
            fillOpacity={bar.fillOpacity}
          />
        ))}
      </svg>

      {layout.bars.map((bar) =>
        bar.valueLabel ? (
          <div
            key={`value-${bar.monthLabel}-${bar.x}`}
            style={{
              position: "absolute",
              left: bar.x + bar.width / 2 - 28,
              top: bar.y - 22,
              width: 56,
              display: "flex",
              justifyContent: "center",
              color: bar.isAnchor ? BANANA : bar.isForward ? "#E5E5E5" : "#F5F5F5",
              fontSize: 18,
              fontWeight: 500,
              opacity: bar.isForward ? 0.82 : 0.92,
            }}
          >
            {bar.valueLabel}
          </div>
        ) : null,
      )}

      {layout.monthLabels.map((label) => (
        <div
          key={`month-${label.label}-${label.x}`}
          style={{
            position: "absolute",
            left: label.x - 36,
            top: label.y - 8,
            width: 72,
            display: "flex",
            justifyContent: "center",
            transform: "rotate(-40deg)",
            color: label.isAnchor ? BANANA : AXIS,
            fontSize: 18,
            fontWeight: label.isAnchor ? 600 : 500,
          }}
        >
          {label.label}
        </div>
      ))}

      <div
        style={{
          position: "absolute",
          left: 24,
          bottom: 18,
          display: "flex",
          gap: 24,
          color: "#A3A3A3",
          fontSize: 18,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 14,
              height: 14,
              backgroundColor: "#F5F5F5",
              borderRadius: 2,
            }}
          />
          Passato · zona
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 14,
              height: 14,
              backgroundColor: "rgba(229,229,229,0.15)",
              borderRadius: 2,
              backgroundImage:
                "repeating-linear-gradient(45deg, #e5e5e5 0 2px, transparent 2px 8px)",
            }}
          />
          Futuro · forward PUN
          {layout.forwardAsOfLabel
            ? ` (${layout.forwardSourceLabel ?? "forward"} al ${layout.forwardAsOfLabel})`
            : ""}
        </div>
      </div>
    </div>
  );
}
