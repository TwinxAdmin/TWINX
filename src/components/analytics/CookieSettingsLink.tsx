// Lábléc-link: újranyitja a süti-sávot, hogy a látogató bármikor módosíthassa a döntését.
"use client";

import { openConsentSettings } from "@/lib/consent";

export default function CookieSettingsLink({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <button type="button" onClick={openConsentSettings} className={className} style={style}>
      Süti-beállítások
    </button>
  );
}
