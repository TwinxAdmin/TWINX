import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A headless Chromium csomagokat NE bundle-özze a Next — Vercelen külső csomagként fussanak.
  // A @sparticuz/chromium-min nem tartalmazza a binárist: azt futásidőben, URL-ről tölti le
  // (lásd lib/browser.ts), így elkerüljük a "libnss3.so nem található" becsomagolási hibát.
  serverExternalPackages: ["puppeteer", "puppeteer-core", "@sparticuz/chromium-min"],
  // A build ne bukjon el ESLint stílus-szabályokon (a "funkcionális UI a 7. fázisig" elv miatt).
  // A TypeScript típusellenőrzés így is fut és megfog minden valódi hibát.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
