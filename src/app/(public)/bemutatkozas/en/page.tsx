// twinx.hu/bemutatkozas/en — a LinkedIn-bemutatkozó oldal angolul (külföldi partnereknek; a keresők elől tiltva, mint a magyar).
import type { Metadata } from "next";
import IntroductionPage from "@/components/landing/IntroductionPage";

export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "Márk Kovács — AI Integration Developer | TWINX",
  description: "Custom AI tools, automation and generative content for businesses. Co-founder of Twinx.hu and creative media producer.",
  robots: { index: false, follow: false },
  // A LinkedIn-üzenet linkkártyája (a kép: public/og-bemutatkozas-en.png, 1200×630).
  openGraph: {
    type: "profile",
    url: "https://twinx.hu/bemutatkozas/en",
    siteName: "TWINX",
    locale: "en_GB",
    title: "Márk Kovács — AI Integration Developer",
    description: "Custom AI tools, automation and generative content for businesses. Co-founder of Twinx.hu and creative media producer.",
    images: [{ url: "https://twinx.hu/og-bemutatkozas-en.png", width: 1200, height: 630, alt: "Márk Kovács — AI Integration Developer" }],
  },
};

export default function BemutatkozasEnPage() {
  return <IntroductionPage lang="en" />;
}
