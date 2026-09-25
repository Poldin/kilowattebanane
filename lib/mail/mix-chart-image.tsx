import { ImageResponse } from "next/og";
import { MIX_SOURCE_META } from "@/lib/generation/sources";
import { romeToday } from "@/lib/generation/time";
import type { ItalyMixPayload } from "@/lib/generation/types";
import {
  MAIL_MIX_H,
  MAIL_MIX_W,
  buildMailMixChartLayout,
  type MailMixChartLayout,
} from "@/lib/mail/mix-chart";

const CHART_BG = "#111111";
const AXIS = "#A3A3A3";

export function mailMixChartImageResponse(mix: ItalyMixPayload) {
  const layout = buildMailMixChartLayout(mix);
  if (!layout) {
    return new Response("Grafico non disponibile", { status: 404 });
  }

  const image = new ImageResponse(<MailMixChartImage layout={layout} />, {
    width: MAIL_MIX_W,
    height: MAIL_MIX_H,
  });
  const fresh = mix.date === romeToday();
  image.headers.set(
    "Cache-Control",
    fresh
      ? "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400"
      : "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800",
  );
  return image;
}

function MailMixChartImage({ layout }: { layout: MailMixChartLayout }) {
  return (
    <div
      style={{
        display: "flex",
        width: layout.width,
        height: layout.height,
        backgroundColor: CHART_BG,
        position: "relative",
      }}
    >
      <svg width={layout.width} height={layout.height}>
        <rect width={layout.width} height={layout.height} fill={CHART_BG} />
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
        {layout.stack.layers.map((layer) => (
          <path key={layer.id} d={layer.d} fill={MIX_SOURCE_META[layer.id].color} />
        ))}
      </svg>

      {layout.yTicks.map((tick) => (
        <div
          key={`yt-${tick.label}-${tick.y}`}
          style={{
            position: "absolute",
            left: 0,
            top: tick.y - 14,
            width: 80,
            color: AXIS,
            fontSize: 22,
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
            left: tick.x - 28,
            top: layout.height - 52,
            width: 56,
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
    </div>
  );
}
