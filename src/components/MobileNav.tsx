// MobileNav — mobil hamburger + jobbról beúszó drawer (profil + modul-nav + kilépés).
// Csak mobilon látszik (a szülő md:hidden-nel adja); a desktop nav változatlan.
"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CATEGORIES } from "@/lib/catalog";
import ModuleIcon from "@/components/ModuleIcon";
import LogoutButton from "@/components/LogoutButton";

const ROLE_LABEL: Record<string, string> = { user: "Felhasználó", sales: "Sales", admin: "Admin" };

type Item = { label: string; href: string; desc?: string; icon?: string };

export default function MobileNav({
  email,
  role,
  balance,
  isAdmin,
}: {
  email: string;
  role: string;
  balance: number;
  isAdmin: boolean;
}) {
  const [open, setOpen] = useState(false);

  const sections: { title: string; items: Item[] }[] = [
    ...CATEGORIES.filter((c) => c.status === "available" && c.modules.length).map((c) => ({
      title: c.label,
      items: c.modules as Item[],
    })),
    {
      title: "Hirdetéskészítő",
      items: [
        { label: "Hirdetés készítése", href: "/dashboard/flyer", icon: "flyer" },
        { label: "Korábbi hirdetések", href: "/dashboard/flyer/history", icon: "history" },
        { label: "Arculatok", href: "/dashboard/branding", icon: "branding" },
      ],
    },
    {
      title: "Egyedi modulok",
      items: [{ label: "Saját moduljaim", href: "/dashboard/custom", icon: "custom" }],
    },
  ];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Menü megnyitása"
        className="flex h-10 w-10 items-center justify-center rounded-full"
        style={{ color: "var(--twx-on-dark)", background: "rgba(255,255,255,0.06)" }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.button
              aria-label="Bezárás"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-[90]"
              style={{ background: "rgba(12,11,10,0.6)" }}
            />
            <motion.aside
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 380, damping: 40 }}
              className="fixed right-0 top-0 z-[91] flex h-full w-[86vw] max-w-[340px] flex-col overflow-y-auto p-5"
              style={{ background: "var(--twx-dark)", color: "var(--twx-on-dark)" }}
            >
              <div className="mb-4 flex items-center justify-between">
                <span className="font-display text-lg font-semibold">Menü</span>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Bezárás"
                  className="flex h-9 w-9 items-center justify-center rounded-full text-lg"
                  style={{ background: "rgba(255,255,255,0.08)" }}
                >
                  ×
                </button>
              </div>

              {/* Profil + egyenleg */}
              <div className="mb-4 rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.05)" }}>
                <p className="truncate text-sm font-medium">{email || "—"}</p>
                <p className="text-xs" style={{ color: "var(--twx-on-dark-muted)" }}>{ROLE_LABEL[role] ?? role}</p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs" style={{ color: "var(--twx-on-dark-muted)" }}>Egyenleg</span>
                  <span className="font-display text-lg font-semibold">{balance.toLocaleString("hu-HU")}</span>
                </div>
              </div>

              {sections.map((sec) => (
                <div key={sec.title} className="mb-4">
                  <p className="mb-1 px-1 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--twx-coral)" }}>
                    {sec.title}
                  </p>
                  {sec.items.map((it) => (
                    <a
                      key={it.href}
                      href={it.href}
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-white/5"
                    >
                      <span
                        className="flex h-8 w-8 flex-none items-center justify-center rounded-lg"
                        style={{ background: "rgba(239,122,90,0.14)", color: "var(--twx-coral)" }}
                      >
                        <ModuleIcon name={it.icon} size={16} />
                      </span>
                      <span className="text-sm">{it.label}</span>
                    </a>
                  ))}
                </div>
              ))}

              <div className="mt-auto space-y-2 border-t pt-4" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
                {isAdmin && (
                  <a href="/admin/analytics" onClick={() => setOpen(false)} className="block rounded-xl px-2 py-2.5 text-sm hover:bg-white/5">
                    Admin
                  </a>
                )}
                <LogoutButton />
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
