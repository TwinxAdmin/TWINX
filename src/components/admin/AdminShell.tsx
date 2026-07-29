// Admin keret: fejléc + VÍZSZINTES, csoportosított menüsáv, alatta a tartalom.
// Minden admin oldal ezt használja — egységes navigáció és megjelenés.
"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";

type Item = { href: string; label: string };
type Group = { title: string; items: Item[] };

const GROUPS: Group[] = [
  { title: "Áttekintés", items: [{ href: "/admin", label: "Kezdőlap" }] },
  {
    title: "Üzlet",
    items: [
      { href: "/admin/users", label: "Felhasználók" },
      { href: "/admin/credits", label: "Kredit kezelés" },
      { href: "/admin/analytics", label: "Költségfigyelő" },
    ],
  },
  {
    title: "Tartalom",
    items: [
      { href: "/admin/prompts", label: "AI promptok" },
      { href: "/admin/rejections", label: "Nem elfogadott képek" },
    ],
  },
  { title: "Visszajelzés", items: [{ href: "/admin/ideas", label: "Ötletláda" }] },
];

export default function AdminShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <main className="twx-page font-sans">
      <div className="mx-auto max-w-6xl space-y-5 px-4 py-8 sm:px-6">
        {/* Fejléc */}
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-display text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--twx-coral)" }}>
              TWINX Admin
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

        {/* VÍZSZINTES menüsáv — csoportosítva */}
        <nav
          className="overflow-x-auto rounded-2xl px-4 py-3"
          style={{ background: "#171412", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <div className="flex min-w-max items-center gap-5">
            {GROUPS.map((g, gi) => (
              <div key={g.title} className="flex items-center gap-5">
                <div>
                  <p className="pb-1.5 text-[10px] font-bold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>
                    {g.title}
                  </p>
                  <div className="flex items-center gap-1.5">
                    {g.items.map((it) => {
                      const active = pathname === it.href;
                      return (
                        <Link
                          key={it.href}
                          href={it.href}
                          className="whitespace-nowrap rounded-lg px-3 py-1.5 text-sm transition"
                          style={
                            active
                              ? { background: "var(--twx-coral)", color: "#1c1005", fontWeight: 600 }
                              : { color: "rgba(255,255,255,0.86)" }
                          }
                        >
                          {it.label}
                        </Link>
                      );
                    })}
                  </div>
                </div>
                {gi < GROUPS.length - 1 && (
                  <span className="h-9 w-px shrink-0" style={{ background: "rgba(255,255,255,0.12)" }} />
                )}
              </div>
            ))}
          </div>
        </nav>

        {/* Tartalom */}
        <div className="space-y-5">{children}</div>
      </div>
    </main>
  );
}
