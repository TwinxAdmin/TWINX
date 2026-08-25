// Kis kliens-gomb az /ingatlan landing CTA-ihoz: az űrlaphoz görget és beállítja
// az érdeklődés típusát (10 kredit vagy bemutató). A page maga server-komponens.
"use client";

import type { IngatlanLeadIntent } from "@/lib/ingatlan-lead";

export default function IngatlanCta({
  intent,
  children,
  className,
  style,
}: {
  intent: IngatlanLeadIntent;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <button
      type="button"
      onClick={() =>
        window.dispatchEvent(new CustomEvent("open-ingatlan-lead", { detail: { intent } }))
      }
      className={className}
      style={style}
    >
      {children}
    </button>
  );
}
