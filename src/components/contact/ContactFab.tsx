// ContactFab — kis „Kapcsolat" gomb a bal alsó sarokban, az élő chat buboréka fölött → twinx.hu/kapcsolat.
// Nincs az admin- / sales-felületen és magán a Kapcsolat oldalon. A helye a globals.css-ben (.twx-contact-fab).
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function ContactFab() {
  const path = usePathname() ?? "/";
  if (path.startsWith("/admin") || path.startsWith("/sales") || path.startsWith("/kapcsolat")) return null;
  return (
    <Link href="/kapcsolat" aria-label="Kapcsolat" title="Kapcsolat — telefon, e-mail, üzenet"
      className="twx-contact-fab fixed z-30 flex h-11 items-center gap-2 rounded-full pl-3 pr-3 text-sm font-semibold shadow-lg transition-transform hover:-translate-y-0.5 sm:pr-4"
      style={{ background: "#fff", color: "var(--twx-ink)", boxShadow: "0 0 0 1px var(--twx-line), 0 10px 26px rgba(28,24,21,.16)" }}>
      <span aria-hidden className="flex h-7 w-7 items-center justify-center rounded-full" style={{ background: "#c4553a", color: "#fff" }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2Z" /></svg>
      </span>
      <span className="hidden sm:inline">Kapcsolat</span>
    </Link>
  );
}
