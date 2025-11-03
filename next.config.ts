import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["puppeteer", "puppeteer-core"],
  },
};

export default nextConfig;
