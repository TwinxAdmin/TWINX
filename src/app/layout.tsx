import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const sans = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TWINX — AI-alapú üzleti automatizáció",
  description:
    "Saját fejlesztésű, kategorizált AI alkalmazás-platform a mindennapi üzletmenethez. Használat alapon, havidíjak nélkül.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="hu">
      <body className={`${sans.variable} antialiased`}>{children}</body>
    </html>
  );
}
