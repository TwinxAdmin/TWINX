import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import ToastProvider from "@/components/Toast";
import GoogleAnalytics from "@/components/analytics/GoogleAnalytics";
import CookieBanner from "@/components/analytics/CookieBanner";
import MetaPixel from "@/components/analytics/MetaPixel";
import SmartsuppChat from "@/components/SmartsuppChat";
import ContactFab from "@/components/contact/ContactFab";

const sans = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

// Karakteres display betű a címekhez (letisztult, teches).
const display = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "TWINX — a te cégedre szabott modul",
  description:
    "Profi felmérés után a TWINX a napi munkádhoz igazított eszközt épít. Foglalj ingyenes felmérést.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="hu">
      <body className={`${sans.variable} ${display.variable} antialiased`}>
        {children}
        <ToastProvider />
        <GoogleAnalytics />
        <MetaPixel />
        <CookieBanner />
        <SmartsuppChat />
        <ContactFab />
      </body>
    </html>
  );
}
