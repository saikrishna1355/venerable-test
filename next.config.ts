import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ensure server bundles include these native modules for the API routes
  serverExternalPackages: ["puppeteer-core", "@sparticuz/chromium", "chrome-aws-lambda"],
};

export default nextConfig;
