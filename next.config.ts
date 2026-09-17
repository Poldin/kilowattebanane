import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(__dirname),
  },
  async redirects() {
    return [
      {
        source: "/",
        has: [{ type: "host", value: "kilowattebanane.vercel.app" }],
        destination: "https://kilowattebanane.it/",
        permanent: true,
      },
      {
        source: "/:path*",
        has: [{ type: "host", value: "kilowattebanane.vercel.app" }],
        destination: "https://kilowattebanane.it/:path*",
        permanent: true,
      },
      {
        source: "/prezzi",
        destination: "/",
        permanent: true,
      },
      {
        source: "/prezzi/:path*",
        destination: "/",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
