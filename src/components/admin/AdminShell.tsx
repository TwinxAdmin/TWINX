// Admin keret: fejléc + KEVÉS főmenü, alattuk lenyíló almenükkel.
//
// Miért így: a korábbi vízszintes sáv minden oldalt egyenrangúan sorolt fel, és
// ahogy nőtt a rendszer, a végük kilógott a képernyőről. Most 5 főmenü van; ami
// több oldalt fog össze, az kattintásra nyílik le. Új admin oldal hozzáadása =
// egy sor a megfelelő csoport `items` tömbjében, a sáv nem nő tovább.
"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";

/** `countKey`: melyik számláló tartozik a menüponthoz (lásd /api/admin/inbox-counts). */
type CountKey = "inboxPage" | "pendingCredits" | "newIdeas";
type Item = { href: string; label: string; hint?: string; countKey?: CountKey };
type Section = { id: string; label: string; href?: string; items?: Item[] };

const SECTIONS: Section[] = [
  { id: "home", label: "Kezdőlap", href: "/admin" },
  {
    id: "inbox",
    label: "Megkeresések",
    items: [
      { href: "/admin/megkeresesek", label: "Kérések és üzenetek", hint: "tájékoztatás-kérés, B2B, ajándékkód-jelentkezők", countKey: "inboxPage" },
      { href: "/admin/credit-requests", label: "Kredit-kérések", hint: "csomagigénylés és számlázás", countKey: "pendingCredits" },
      { href: "/admin/ideas", label: "Ötletláda", hint: "felhasználói javaslatok", countKey: "newIdeas" },
    ],
  },
  { id: "users", label: "Felhasználók", href: "/admin/users" },
  {
    id: "money",
    label: "Pénzügy",
    items: [
      { href: "/admin/credit-log", label: "Kredit-napló", hint: "ki, kinek, mikor, mennyit" },
      { href: "/admin/analytics", label: "Költségfigyelő", hint: "API-önköltség és bevétel" },
    ],
  },
  {
    id: "content",
    label: "Tartalom",
    items: [
      { href: "/admin/prompts", label: "AI promptok" },
      { href: "/admin/valuation-engine", label: "Értékbecslő motor" },
      { href: "/admin/rejections", label: "Nem elfogadott képek" },
    ],
  },
];

/** Egy szekció akkor aktív, ha a saját vagy valamelyik aloldala van megnyitva. */
function isActive(s: Section, pathname: string): boolean {
  if (s.href) return pathname === s.href;
  return (s.items ?? []).some((i) => pathname === i.href || pathname.startsWith(i.href + "/"));
}

/** A sales munkafelület menüje: CSAK a megkeresések. */
const SALES_SECTIONS: Section[] = [
  { id: "inbox", label: "Megkeresések", href: "/sales/megkeresesek" },
];

export default function AdminShell({
  title,
  subtitle,
  children,
  variant = "admin",
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  /** "sales" esetén szűkített menü és fejléc — ugyanaz a szerkezet, kevesebb jog. */
  variant?: "admin" | "sales";
}) {
  const sections = variant === "sales" ? SALES_SECTIONS : SECTIONS;
  const pathname = usePathname();
  const [open, setOpen] = useState<string | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const newCount = counts.total ?? 0;
  const navRef = useRef<HTMLElement>(null);

  // Kívülre kattintva / Esc-re zárjuk a lenyílót.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setOpen(null);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(null); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, []);

  // Oldalváltáskor csukódjon be.
  useEffect(() => { setOpen(null); }, [pathname]);

  // Elintézetlen megkeresések száma a Megkeresések menü mellé.
  useEffect(() => {
    let alive = true;
    fetch("/api/admin/inbox-counts")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (alive && d && typeof d.total === "number") setCounts(d as Record<string, number>); })
      .catch(() => {});
    return () => { alive = false; };
  }, [pathname]);

  return (
    <main className="twx-page font-sans">
      <div className="mx-auto max-w-6xl space-y-5 px-4 py-8 sm:px-6">
        {/* Fejléc */}
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-display text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--twx-coral)" }}>
              {variant === "sales" ? "TWINX Értékesítés" : "TWINX Admin"}
            </p>
            <h1 className="mt-0.5 font-display text-2xl font-semibold sm:text-3xl">{title}</h1>
            {subtitle && (
              <p className="mt-1 text-sm" style={{ color: "var(--twx-ink-muted)" }}>{subtitle}</p>
            )}
          </div>
          <Link href="/dashboard" className="text-sm" style={{ color: "var(--twx-ink-muted)" }}>
            ← Vissza a Dashboardra
          </Link>
        </header>

        {/* Főmenü — 5 elem, a többszintűek kattintásra nyílnak */}
        <nav ref={navRef} className="relative z-30 rounded-2xl px-3 py-2.5"
          style={{ background: "#171412", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="flex flex-wrap items-center gap-1.5">
            {sections.map((s) => {
              const active = isActive(s, pathname);
              const style = active
                ? { background: "var(--twx-coral)", color: "#1c1005", fontWeight: 600 }
                : { color: "rgba(255,255,255,0.86)" };

              if (s.href) {
                return (
                  <Link key={s.id} href={s.href} className="rounded-lg px-3.5 py-2 text-sm transition-colors" style={style}>
                    {s.label}
                  </Link>
                );
              }

              const isOpen = open === s.id;
              return (
                <div key={s.id} className="relative">
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? null : s.id)}
                    aria-expanded={isOpen}
                    className="flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm transition-colors"
                    style={style}
                  >
                    {s.label}
                    {s.id === "inbox" && newCount > 0 && (
                      <span className="rounded-full px-1.5 text-[11px] font-bold"
                        style={active
                          ? { background: "rgba(0,0,0,0.16)", color: "#1c1005" }
                          : { background: "var(--twx-coral)", color: "#1c1005" }}>
                        {newCount}
                      </span>
                    )}
                    <span aria-hidden className="text-[10px] opacity-70">{isOpen ? "▲" : "▼"}</span>
                  </button>

                  {isOpen && (
                    <div className="absolute left-0 top-full z-40 mt-1.5 w-72 overflow-hidden rounded-xl p-1.5 shadow-2xl"
                      style={{ background: "#1f1b18", border: "1px solid rgba(255,255,255,0.12)" }}>
                      {(s.items ?? []).map((it) => {
                        const on = pathname === it.href || pathname.startsWith(it.href + "/");
                        // Menüpontonkénti szám: így látszik, MELYIK részre érkezett a megkeresés.
                        const n = it.countKey ? (counts[it.countKey] ?? 0) : 0;
                        return (
                          <Link key={it.href} href={it.href}
                            className="block rounded-lg px-3 py-2 transition-colors"
                            style={on
                              ? { background: "rgba(239,122,90,0.18)", color: "var(--twx-coral)" }
                              : { color: "rgba(255,255,255,0.9)" }}>
                            <span className="flex items-center justify-between gap-2">
                              <span className="text-sm font-medium">{it.label}</span>
                              {n > 0 && (
                                <span className="shrink-0 rounded-full px-1.5 text-[11px] font-bold"
                                  style={{ background: "var(--twx-coral)", color: "#1c1005" }}>
                                  {n}
                                </span>
                              )}
                            </span>
                            {it.hint && (
                              <span className="block text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>{it.hint}</span>
                            )}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </nav>

        {/* Tartalom */}
        <div className="space-y-5">{children}</div>
      </div>
    </main>
  );
}
