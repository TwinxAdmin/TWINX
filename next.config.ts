import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A headless Chromium csomagokat NE bundle-özze a Next — Vercelen külső csomagként fussanak.
  serverExternalPackages: ["puppeteer", "puppeteer-core", "@sparticuz/chromium"],
};

export default nextConfig;
