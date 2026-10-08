// OfficeMenu — a fejléc „Irodai fiók" legördülő menüje.
//   • Mi az irodai fiók?        → külön oldal (/dashboard/iroda/bemutato) — részletes ismertető
//   • Irodai fiók igénylése     → külön oldal (/dashboard/iroda/igenyles)
//   • Csatlakozás kóddal        → kis felugró ablak (open-office-join)
//   • Irodai fiókjaim           → kis felugró ablak (open-office-picker) — iroda kiválasztása egy kattintással
"use client";

import { useEffect, useRef, useState } from "react";

type Props = { currentOffice?: string | null; officeCount?: number };

export default function OfficeMenu({ currentOffice = null, officeCount = 0 }: Props) {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);

  // Olvasatlan üzenetek + függő kredit-kérések → kis korall jelzés az „Irodai fiók" gombon.
  useEffect(() => {
    if (!currentOffice) return;
    const load = () => {
      fetch("/api/office/messages/unread").then((r) => r.json()).then((d) => setUnread(d.count ?? 0)).catch(() => {});
    };
    load();
    const t = window.setInterval(load, 60_000);
    window.addEventListener("twx-office-messages", load);
    window.addEventListener("focus", load);
    return () => {
      window.clearInterval(t);
      window.removeEventListener("twx-office-messages", load);
      window.removeEventListener("focus", load);
    };
  }, [currentOffice]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("mousedown", onDown); window.removeEventListener("keydown", onKey); };
  }, [open]);

  function fire(name: string) {
    setOpen(false);
    window.dispatchEvent(new CustomEvent(name));
  }

  const item = "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors hover:bg-white/5";

  return (
    <div className="relative" ref={ref} style={{ zIndex: 60 }}>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
        className="flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors hover:bg-white/5"
        style={{ color: "var(--twx-on-dark)" }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M3 21h18" /><path d="M5 21V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16" />
          <path d="M15 10h3a1 1 0 0 1 1 1v10" /><path d="M8 8h1M11 8h1M8 12h1M11 12h1M8 16h1M11 16h1" />
        </svg>
        Irodai fiók
        {unread > 0 && (
          <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold tabular-nums"
            style={{ background: "#F08A68", color: "#1C1A17" }} aria-label={`${unread} új irodai üzenet`}>
            {unread > 9 ? "9+" : unread}
          </span>
        )}
        <span className="text-xs transition-transform duration-200" style={{ transform: open ? "rotate(180deg)" : "none" }}>▾</span>
      </button>

      <div className="absolute right-0 top-full mt-2 w-[270px] rounded-2xl p-2 transition-all duration-200 ease-out"
        style={{
          background: "var(--twx-dark-2)", border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 24px 48px rgba(0,0,0,0.45)", transformOrigin: "top", color: "var(--twx-on-dark)",
          opacity: open ? 1 : 0, transform: open ? "translateY(0) scaleY(1)" : "translateY(-8px) scaleY(0.96)",
          pointerEvents: open ? "auto" : "none",
        }}>
        {currentOffice && (
          <a href="/dashboard/iroda" onClick={() => setOpen(false)} className="mb-1 block rounded-xl px-3 py-2.5 hover:bg-white/5"
            style={{ background: "rgba(255,255,255,0.05)" }}>
            <span className="block text-[11px]" style={{ color: "var(--twx-on-dark-muted)" }}>Kiválasztott iroda</span>
            <span className="block truncate text-sm font-semibold">{currentOffice}</span>
            {unread > 0 && (
              <span className="mt-1 block text-[11px] font-semibold" style={{ color: "#F4A48A" }}>{unread} új üzenet / kérés →</span>
            )}
          </a>
        )}
        <a href="/dashboard/iroda/bemutato" className={item} onClick={() => setOpen(false)}>
          <Dot>?</Dot> Mi az irodai fiók?
        </a>
        <a href="/dashboard/iroda/igenyles" className={item} onClick={() => setOpen(false)}>
          <Dot>+</Dot> Irodai fiók igénylése
        </a>
        <button type="button" className={item} onClick={() => fire("open-office-join")}>
          <Dot>#</Dot> Csatlakozás kóddal
        </button>
        <button type="button" className={item} onClick={() => fire("open-office-picker")}>
          <Dot>⇄</Dot>
          <span className="flex-1">Irodai fiókjaim</span>
          {officeCount > 0 && (
            <span className="rounded-full px-2 text-[11px] font-semibold" style={{ background: "rgba(239,122,90,0.18)", color: "var(--twx-coral)" }}>
              {officeCount}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}

function Dot({ children }: { children: React.ReactNode }) {
  return (
    <span aria-hidden className="flex h-7 w-7 flex-none items-center justify-center rounded-lg text-xs font-bold"
      style={{ background: "rgba(239,122,90,0.14)", color: "var(--twx-coral)" }}>
      {children}
    </span>
  );
}
