import { ImageResponse } from "next/og";
import { loadArchiveDay } from "@/lib/day-archive";
import { formatEurocent } from "@/lib/insights";

export const alt = "Prezzi all'ingrosso dell'energia in Italia";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ giorno: string }>;
}) {
  const { giorno } = await params;
  const day = await loadArchiveDay(giorno).catch(() => null);

  const dateLabel = day?.dateTitle ?? giorno;
  const min = day ? formatEurocent(day.italy.min) : "—";
  const avg = day ? formatEurocent(day.italy.avg) : "—";
  const max = day ? formatEurocent(day.italy.max) : "—";
  const cheap = day
    ? `${day.italy.cheapestZoneName}${day.italy.cheapestHours ? ` · ${day.italy.cheapestHours}` : ""}`
    : "";
  const peak = day
    ? `${day.italy.priciestZoneName}${day.italy.priciestHours ? ` · ${day.italy.priciestHours}` : ""}`
    : "";

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          backgroundColor: "#111111",
          color: "#ededed",
          padding: "64px 72px",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 22,
            color: "#a3a3a3",
            letterSpacing: -0.3,
          }}
        >
          kilowatt e banane 🍌
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 28,
            fontSize: 48,
            fontWeight: 600,
            letterSpacing: -1.4,
            lineHeight: 1.15,
            maxWidth: 980,
          }}
        >
          Quando conviene consumare il {dateLabel}
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 56,
            gap: 56,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 18, color: "#a3a3a3" }}>
              MINIMO
            </div>
            <div
              style={{
                display: "flex",
                marginTop: 8,
                fontSize: 72,
                fontWeight: 650,
                letterSpacing: -2,
              }}
            >
              {min}
            </div>
            <div style={{ display: "flex", marginTop: 8, fontSize: 20, color: "#F5D547" }}>
              {cheap}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 18, color: "#a3a3a3" }}>
              MEDIO
            </div>
            <div
              style={{
                display: "flex",
                marginTop: 8,
                fontSize: 72,
                fontWeight: 650,
                letterSpacing: -2,
              }}
            >
              {avg}
            </div>
            <div style={{ display: "flex", marginTop: 8, fontSize: 20, color: "#a3a3a3" }}>
              c€/kWh all'ingrosso
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 18, color: "#a3a3a3" }}>
              PICCO
            </div>
            <div
              style={{
                display: "flex",
                marginTop: 8,
                fontSize: 72,
                fontWeight: 650,
                letterSpacing: -2,
              }}
            >
              {max}
            </div>
            <div style={{ display: "flex", marginTop: 8, fontSize: 20, color: "#fca5a5" }}>
              {peak}
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
