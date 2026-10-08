// Munkatípus-jelölés: modulcsoport (szín + ikon + név) és fájltípus (PDF / MP4 / JPG…).
// Mappákban, listákban egységesen ezzel jelöljük, hogy egy munka videó, értékbecslés, kép stb.
"use client";

import type { ReactNode } from "react";

export type WorkCategory = "video" | "valuation" | "visual" | "enhance" | "ad" | "text" | "other";

type Meta = { label: string; bg: string; fg: string; icon: ReactNode };

const I = (d: ReactNode) => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{d}</svg>
);

export const CATEGORY_META: Record<WorkCategory, Meta> = {
  video:     { label: "Videó",        bg: "#1C1A17", fg: "#F4A48A", icon: I(<><rect x="2" y="5" width="15" height="14" rx="2" /><path d="m17 10 5-3v10l-5-3" /></>) },
  valuation: { label: "Értékbecslés", bg: "#DCE8F5", fg: "#24476B", icon: I(<><path d="M3 21h18" /><path d="M5 21V10l7-6 7 6v11" /><path d="M10 21v-6h4v6" /></>) },
  visual:    { label: "Látványterv",  bg: "#EDE3F7", fg: "#5B3A86", icon: I(<><path d="M12 3 2 8l10 5 10-5-10-5Z" /><path d="m2 16 10 5 10-5" /></>) },
  enhance:   { label: "Képjavítás",   bg: "#DDF0E4", fg: "#1F5C38", icon: I(<><path d="m12 3 1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8Z" /><path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9Z" /></>) },
  ad:        { label: "Hirdetés",     bg: "#FDE6C8", fg: "#7A4A06", icon: I(<><path d="M3 11v2a1 1 0 0 0 1 1h3l5 4V6L7 10H4a1 1 0 0 0-1 1Z" /><path d="M16 9a3 3 0 0 1 0 6" /></>) },
  text:      { label: "Elemzés",      bg: "#F1EAE1", fg: "#4A433C", icon: I(<><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z" /><path d="M14 3v6h6" /><path d="M8 13h8M8 17h5" /></>) },
  other:     { label: "Egyéb",        bg: "#F1EAE1", fg: "#6B6258", icon: I(<><circle cx="12" cy="12" r="9" /></>) },
};

const FEATURE_CATEGORY: Record<string, WorkCategory> = {
  video: "video",
  valuation: "valuation",
  "land-valuation": "valuation",
  visualization: "visual",
  image_enhance: "enhance",
  image_enhance_regenerate: "enhance",
  flyer: "ad",
  "fb-ads": "ad",
  "google-ads": "ad",
  "ad-check": "text",
  menu_generator: "text",
  cost_analysis: "text",
  profit_plan: "text",
  supplier_search: "text",
  professional_search: "text",
};

export function workCategory(feature: string): WorkCategory {
  return FEATURE_CATEGORY[feature] ?? "other";
}

/** Fájltípus a kimeneti URL-ből: „PDF", „MP4", „JPG"… (null, ha nincs fájl). */
export function fileTag(url: string | null): string | null {
  if (!url) return null;
  const m = url.split("?")[0].toLowerCase().match(/\.([a-z0-9]{2,4})$/);
  if (!m) return null;
  const ext = m[1] === "jpeg" ? "jpg" : m[1];
  return ext.toUpperCase();
}

export default function WorkTypeBadge({ feature, label }: { feature: string; label?: string }) {
  const meta = CATEGORY_META[workCategory(feature)];
  return (
    <span className="inline-flex h-[22px] flex-none items-center gap-1 whitespace-nowrap rounded-full px-2 text-[11px] font-semibold"
      style={{ background: meta.bg, color: meta.fg }}>
      {meta.icon}{label ?? meta.label}
    </span>
  );
}

export function FileTag({ url }: { url: string | null }) {
  const t = fileTag(url);
  if (!t) return null;
  return (
    <span className="inline-flex h-[22px] flex-none items-center rounded-md px-1.5 text-[10px] font-bold tracking-wide"
      style={{ background: "#fff", color: "#6B6258", border: "1px solid #E1D6C9" }}>
      {t}
    </span>
  );
}
