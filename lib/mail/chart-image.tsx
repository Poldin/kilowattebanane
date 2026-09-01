import { ImageResponse } from "next/og";
import {
  MAIL_CHART_H,
  MAIL_CHART_W,
  buildMailChartLayout,
  type MailChartLayout,
} from "@/lib/mail/chart";
import type { DayRecommendations } from "@/lib/insights";

const BANANA = "#F5D547";

export function mailChartImageResponse(
  prices: number[],
  recommendations?: DayRecommendations,
) {
  const layout = buildMailChartLayout(prices, recommendations);
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
        <path
          d={layout.path}
          fill="none"
          stroke={BANANA}
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
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
