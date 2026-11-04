// twinx.hu/bemutatkozas — a LinkedIn-üzenetekben kiküldhető landing, magyarul (üzenetben küldött oldal, ezért a keresők elől tiltva).
// A tartalom közös: IntroductionPage; az angol változat: /bemutatkozas/en.
import type { Metadata } from "next";
import IntroductionPage from "@/components/landing/IntroductionPage";

export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "Kovács Márk — AI-integrációs fejlesztő | TWINX",
  description: "Egyedi AI-eszközök, automatizálás és generatív tartalom cégeknek. Twinx.hu társalapító és kreatív média tartalomgyártó.",
  robots: { index: false, follow: false },
  // A LinkedIn-üzenet linkkártyája (a kép: public/og-bemutatkozas.png, 1200×630).
  openGraph: {
    type: "profile",
    url: "https://twinx.hu/bemutatkozas",
    siteName: "TWINX",
    title: "Kovács Márk — AI-integrációs fejlesztő",
    description: "Egyedi AI-eszközök, automatizálás és generatív tartalom cégeknek. Twinx.hu társalapító és kreatív média tartalomgyártó.",
    images: [{ url: "https://twinx.hu/og-bemutatkozas.png", width: 1200, height: 630, alt: "Kovács Márk — AI-integrációs fejlesztő" }],
  },
};

export default function BemutatkozasPage() {
  return <IntroductionPage lang="hu" />;
}
