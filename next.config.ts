import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
    ];
  },
};

export default nextConfig;
