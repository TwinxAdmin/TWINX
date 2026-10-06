import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A headless Chromium csomagokat NE bundle-özze a Next — Vercelen külső csomagként fussanak.
  // A @sparticuz/chromium-min nem tartalmazza a binárist: azt futásidőben, URL-ről tölti le
  // (lásd lib/browser.ts), így elkerüljük a "libnss3.so nem található" becsomagolási hibát.
  serverExternalPackages: ["puppeteer", "puppeteer-core", "@sparticuz/chromium-min", "ffmpeg-static"],
  // A PDF-ekhez futásidőben olvasott betűfájlok biztosan kerüljenek fel a Vercelre.
  outputFileTracingIncludes: {
    "/api/**": ["./assets/fonts/**/*"],
    // SAJÁT VIDEÓMOTOR: az ffmpeg futtatható fájl (a csomag csak az útvonalát adja
    // vissza, ezért a Next nem találná meg magától). Csak a videót gyártó útvonalakhoz.
    // + a filmes effekt-klipek (filmburn stb.), amiket a sablonok áttűnésként használnak.
    "/api/real-estate/video": ["./node_modules/ffmpeg-static/ffmpeg", "./assets/video-fx/*.mp4", "./assets/video-transitions/*.apng"],
    "/api/admin/video-lab": ["./node_modules/ffmpeg-static/ffmpeg", "./assets/video-fx/*.mp4", "./assets/video-transitions/*.apng"],
  },
  // A build ne bukjon el ESLint stílus-szabályokon (a "funkcionális UI a 7. fázisig" elv miatt).
  // A TypeScript típusellenőrzés így is fut és megfog minden valódi hibát.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
