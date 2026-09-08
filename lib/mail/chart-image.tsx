import { ImageResponse } from "next/og";
import {
  MAIL_CHART_H,
  MAIL_CHART_W,
  buildMailChartLayout,
  type MailChartLayout,
} from "@/lib/mail/chart";
import { MAIL_DEFAULT_TARIFF_PLAN, type TariffPlanId } from "@/lib/fasce";

const BANANA = "#F5D547";

export function mailChartImageResponse(
  prices: number[],
  deliveryDate: string,
  tariff: TariffPlanId = MAIL_DEFAULT_TARIFF_PLAN,
) {
  const layout = buildMailChartLayout(prices, deliveryDate, tariff);
  const image = new ImageResponse(<MailChartImage layout={layout} />, {
    width: MAIL_CHART_W,
    height: MAIL_CHART_H,
  });
  image.headers.set(
    "Cache-Control",
    "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800",
  );
  return image;
}

function MailChartImage({ layout }: { layout: MailChartLayout }) {
  return (
    <div
      style={{
        display: "flex",
        width: layout.width,
        height: layout.height,
        backgroundColor: "#111111",
        position: "relative",
      }}
    >
      <svg width={layout.width} height={layout.height}>
        {layout.hLines.map((line) => (
          <line
            key={`h-${line.y}`}
            x1={line.x1}
            x2={line.x2}
            y1={line.y}
            y2={line.y}
            stroke="#262626"
            strokeWidth="2"
          />
        ))}
        {layout.vLines.map((line) => (
          <line
            key={`v-${line.x}`}
            x1={line.x}
            x2={line.x}
            y1={line.y1}
            y2={line.y2}
            stroke="#1f1f1f"
            strokeWidth="2"
          />
        ))}
        {layout.cheapRects.map((rect) => (
          <rect
            key={`cheap-${rect.x}`}
            x={rect.x}
            y={rect.y}
            width={rect.width}
            height={rect.height}
            fill="#F5D54714"
          />
        ))}
        {layout.peakRects.map((rect) => (
          <rect
            key={`peak-${rect.x}`}
            x={rect.x}
            y={rect.y}
            width={rect.width}
            height={rect.height}
            fill="#EF444429"
          />
        ))}
        {layout.fasciaRects.map((rect, index) => (
          <rect
            key={`fascia-${rect.label}-${index}`}
            x={rect.x}
            y={rect.y}
            width={rect.width}
            height={rect.height}
            fill={rect.color}
            fillOpacity={rect.fillOpacity}
            stroke={rect.color}
            strokeWidth="3"
          />
        ))}
        {layout.mono ? (
          <g>
            <rect
              x={layout.mono.x}
              y={layout.mono.y}
              width={layout.mono.width}
              height={layout.mono.height}
              fill={layout.mono.color}
              fillOpacity={0.28}
            />
            <line
              x1={layout.mono.x}
              x2={layout.mono.x + layout.mono.width}
              y1={layout.mono.y}
              y2={layout.mono.y}
              stroke={layout.mono.color}
              strokeWidth="4"
              strokeLinecap="round"
            />
          </g>
        ) : null}
        {layout.showLine ? (
          <path
            d={layout.path}
            fill="none"
            stroke={BANANA}
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}
      </svg>

      <div
        style={{
          position: "absolute",
          left: layout.unit.x,
          top: layout.unit.y,
          color: "#e5e5e5",
          fontSize: 22,
          fontWeight: 500,
          display: "flex",
        }}
      >
        {layout.unit.label}
      </div>

      {layout.yTicks.map((tick) => (
        <div
          key={`yt-${tick.label}-${tick.y}`}
          style={{
            position: "absolute",
            left: 0,
            top: tick.y - 14,
            width: 86,
            color: "#f5f5f5",
            fontSize: 24,
            fontWeight: 600,
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          {tick.label}
        </div>
      ))}

      {layout.xTicks.map((tick) => (
        <div
          key={`xt-${tick.label}`}
          style={{
            position: "absolute",
            left: tick.x - 24,
            top: tick.y,
            width: 48,
            color: "#f5f5f5",
            fontSize: 24,
            fontWeight: 600,
            display: "flex",
            justifyContent: "center",
          }}
        >
          {tick.label}
        </div>
      ))}

      {layout.fasciaRects.map((rect, index) =>
        rect.mark || rect.label ? (
          <div
            key={`fannot-${rect.label}-${index}`}
            style={{
              position: "absolute",
              left: rect.annotX - 40,
              top: rect.annotY,
              width: 80,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            {rect.mark ? (
              <div
                style={{
                  fontSize: 32,
                  lineHeight: 1,
                  height: 36,
                  display: "flex",
                }}
              >
                {rect.mark}
              </div>
            ) : null}
            {rect.label ? (
              <div
                style={{
                  color: rect.color,
                  fontSize: 18,
                  fontWeight: 700,
                  lineHeight: 1.2,
                  display: "flex",
                }}
              >
                {rect.label}
              </div>
            ) : null}
          </div>
        ) : null,
      )}

      {layout.mono ? (
        <div
          style={{
            position: "absolute",
            left: layout.mono.labelX,
            top: layout.mono.labelY - 16,
            color: layout.mono.color,
            fontSize: 20,
            fontWeight: 700,
            display: "flex",
          }}
        >
          Fmono
        </div>
      ) : null}

      {layout.bananas.map((mark) => (
        <div
          key={`banana-${mark.x}`}
          style={{
            position: "absolute",
            left: mark.x - 22,
            top: mark.y - 48,
            fontSize: 40,
            display: "flex",
            lineHeight: 1,
          }}
        >
          🍌
        </div>
      ))}

      {layout.monkeys.map((mark) => (
        <div
          key={`monkey-${mark.x}`}
          style={{
            position: "absolute",
            left: mark.x - 22,
            top: mark.y - 48,
            fontSize: 40,
            display: "flex",
            lineHeight: 1,
          }}
        >
          🐵
        </div>
      ))}
    </div>
  );
}
