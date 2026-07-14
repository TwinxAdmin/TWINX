import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A headless Chromium csomagokat NE bundle-özze a Next — Vercelen külső csomagként fussanak.
  serverExternalPackages: ["puppeteer", "puppeteer-core", "@sparticuz/chromium"],
  // A build ne bukjon el ESLint stílus-szabályokon (a "funkcionális UI a 7. fázisig" elv miatt).
  // A TypeScript típusellenőrzés így is fut és megfog minden valódi hibát.
  eslint: { ignoreDuringBuilds: true },
  // FONTOS: a @sparticuz/chromium bináris + shared library fájljait (pl. libnss3.so)
  // kézzel bevonjuk a PDF/kép-rendert használó szerverless függvényekbe, különben a
  // Chromium nem indul el a Vercelen ("libnss3.so: cannot open shared object file").
  outputFileTracingIncludes: {
    "/api/real-estate/valuation": ["./node_modules/@sparticuz/chromium/**"],
    "/api/real-estate/land": ["./node_modules/@sparticuz/chromium/**"],
    "/api/real-estate/land/status": ["./node_modules/@sparticuz/chromium/**"],
    "/api/flyer/generate": ["./node_modules/@sparticuz/chromium/**"],
    "/api/flyer/accept": ["./node_modules/@sparticuz/chromium/**"],
  },
};

export default nextConfig;
