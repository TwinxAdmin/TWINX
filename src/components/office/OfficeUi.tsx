// Irodai felület — közös UI-elemek (a megjelenési terv arculata szerint).
//   • OfficeCard: FIX MAGASSÁGÚ kártya — a fejléc áll, a tartalom a kártyán BELÜL görget,
//     így sok tartalom vagy egy kinyitás sem tolja el a többi blokkot.
//   • EmptyState: szép üres állapot (ikon + cím + rövid magyarázat), hogy a felület
//     munkafolyamat nélkül is teljesnek hasson.
//   • OfficeDialog: felugró ablak (új mappa, mappa tartalma, feltöltés…) — a lap nem ugrik.
//   • SoonBadge: „Hamarosan" címke a még nem működő részekhez (nem kattintható).
"use client";

import { useEffect, type CSSProperties, type ReactNode } from "react";

export const CARD_BG = "#FCFAF7";
export const CARD_BORDER = "#E9E0D5";

export function OfficeCard({ title, badge, action, height, children, className = "", bodyClassName = "", style }: {
  title: string;
  badge?: ReactNode;
  action?: ReactNode;
  height?: number;          // px — ha meg van adva, a kártya ennyi magas, a tartalom belül görget
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  style?: CSSProperties;
}) {
  return (
    <section className={`flex min-w-0 flex-col overflow-hidden rounded-2xl ${className}`}
      style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, height, ...style }}>
      <div className="flex flex-none flex-wrap items-center justify-between gap-3 px-4 pb-2.5 pt-4 sm:px-[18px]">
        <div className="flex items-center gap-2.5">
          <h2 className="font-display text-[17px] font-semibold">{title}</h2>
          {badge}
        </div>
        {action}
      </div>
      <div className={`min-h-0 flex-1 overflow-y-auto px-4 pb-4 sm:px-[18px] ${bodyClassName}`}>{children}</div>
    </section>
  );
}

export function EmptyState({ icon, title, text, action, dark = false }: {
  icon: ReactNode; title: string; text: string; action?: ReactNode; dark?: boolean;
}) {
  return (
    <div className="flex h-full min-h-[140px] flex-col items-center justify-center gap-2 rounded-xl px-6 py-6 text-center"
      style={{ border: `1.5px dashed ${dark ? "#3A322C" : "#E1D6C9"}`, background: dark ? "rgba(255,255,255,0.02)" : "#fff" }}>
      <span className="flex h-11 w-11 items-center justify-center rounded-xl"
        style={{ background: dark ? "rgba(238,123,91,0.14)" : "#FBE1D6", color: dark ? "#F4A48A" : "#C2512F" }}>
        {icon}
      </span>
      <p className="font-display text-sm font-semibold" style={{ color: dark ? "#F6F1EA" : "#1C1A17" }}>{title}</p>
      <p className="max-w-[340px] text-xs leading-relaxed" style={{ color: dark ? "#A89E94" : "#6B6258" }}>{text}</p>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

export function SoonBadge({ dark = false }: { dark?: boolean }) {
  return (
    <span className="rounded-full px-2 py-[3px] text-[10px] font-semibold uppercase tracking-wider"
      style={dark ? { background: "rgba(255,255,255,0.08)", color: "#BFB4A8" } : { background: "#F1EAE1", color: "#6B6258" }}>
      Hamarosan
    </span>
  );
}

export function OfficeDialog({ title, onClose, children, wide = false }: {
  title: string; onClose: () => void; children: ReactNode; wide?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(12,11,10,0.72)" }}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={title}
        className={`flex max-h-[88vh] w-full flex-col overflow-hidden rounded-2xl ${wide ? "max-w-2xl" : "max-w-lg"}`}
        style={{ background: "var(--twx-cream-card)", border: "1px solid var(--twx-line)", color: "var(--twx-ink)", boxShadow: "0 30px 80px rgba(0,0,0,0.5)" }}>
        <div className="flex flex-none items-start justify-between gap-4 px-6 pb-3 pt-5">
          <h2 className="font-display text-xl font-semibold">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Bezárás" className="flex h-8 w-8 flex-none items-center justify-center rounded-full text-lg"
            style={{ background: "var(--twx-line)" }}>×</button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">{children}</div>
      </div>
    </div>
  );
}

/** Egyszerű vonalas ikonok (currentColor). */
export const Icons = {
  inbox: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M22 12h-6l-2 3h-4l-2-3H2" /><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  ),
  send: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" />
    </svg>
  ),
  folder: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
    </svg>
  ),
  coins: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="8" cy="8" r="6" /><path d="M18.09 10.37A6 6 0 1 1 10.34 18" /><path d="M7 6h1v4" /><path d="m16.71 13.88.7.71-2.82 2.82" />
    </svg>
  ),
  users: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
};
