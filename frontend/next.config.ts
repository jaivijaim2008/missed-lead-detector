import type { NextConfig } from "next";

const API_BACKEND = process.env.API_URL || "https://sega-wants-backing-vault.trycloudflare.com";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${API_BACKEND}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
