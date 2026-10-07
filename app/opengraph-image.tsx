import { ImageResponse } from "next/og";

export const alt = "kilowatt e banane";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          background: "#0a0a0a",
          color: "#fafafa",
          padding: "80px",
        }}
      >
        <div style={{ display: "flex", fontSize: 112, lineHeight: 1 }}>🍌🍌🍌</div>
        <div
          style={{
            display: "flex",
            marginTop: 32,
            fontSize: 68,
            fontWeight: 600,
            letterSpacing: "-0.03em",
          }}
        >
          kilowatt e banane
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 18,
            fontSize: 32,
            color: "#a3a3a3",
          }}
        >
          Informazioni e strumenti per risparmiare sulla bolletta.
        </div>
      </div>
    ),
    { ...size },
  );
}
