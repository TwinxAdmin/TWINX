// Felső sáv navigáció — publikus kategóriák animált legördülővel.
// Kattintásra a kategória alatt lenyílnak az elérhető modulok.
"use client";

import { useState } from "react";
import { CATEGORIES } from "@/lib/catalog";

export default function DashboardNav() {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <nav className="relative flex items-center gap-1 text-sm">
      {/* Kattintáson kívülre zárás */}
      {open && (
        <button
          aria-hidden
          tabIndex={-1}
          onClick={() => setOpen(null)}
          className="fixed inset-0 z-20 cursor-default"
          style={{ background: "transparent" }}
        />
      )}

      {CATEGORIES.map((cat) => {
        const isOpen = open === cat.slug;
        const soon = cat.status === "soon";
        return (
          <div key={cat.slug} className="relative z-30">
            <button
              type="button"
              disabled={soon}
              onClick={() => setOpen(isOpen ? null : cat.slug)}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors"
              style={{
                color: soon ? "var(--twx-on-dark-muted)" : "var(--twx-on-dark)",
                background: isOpen ? "rgba(239,122,90,0.16)" : "transparent",
                cursor: soon ? "not-allowed" : "pointer",
              }}
            >
              <span>{cat.label}</span>
              {soon ? (
                <span
                  className="rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                  style={{ background: "rgba(255,255,255,0.08)", color: "var(--twx-on-dark-muted)" }}
                >
                  Hamarosan
                </span>
              ) : (
                <span
                  className="text-xs transition-transform duration-200"
                  style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}
                >
                  ▾
                </span>
              )}
            </button>

            {!soon && (
              <div
                className="absolute left-0 top-full mt-2 min-w-[230px] rounded-2xl p-2 transition-all duration-200 ease-out"
                style={{
                  background: "var(--twx-dark-2)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  boxShadow: "0 24px 48px rgba(0,0,0,0.45)",
                  transformOrigin: "top",
                  opacity: isOpen ? 1 : 0,
                  transform: isOpen ? "translateY(0) scaleY(1)" : "translateY(-8px) scaleY(0.96)",
                  pointerEvents: isOpen ? "auto" : "none",
                }}
              >
                {cat.modules.map((m) => (
                  <a
                    key={m.href}
                    href={m.href}
                    onClick={() => setOpen(null)}
                    className="block rounded-xl px-3 py-2.5 text-sm transition-colors hover:bg-white/5"
                    style={{ color: "var(--twx-on-dark)" }}
                  >
                    {m.label}
                  </a>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Hirdetéskészítő — legördülő: hirdetés + arculatok */}
      <div className="relative z-30">
        <button
          type="button"
          onClick={() => setOpen(open === "hirdetes" ? null : "hirdetes")}
          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors"
          style={{
            color: "var(--twx-on-dark)",
            background: open === "hirdetes" ? "rgba(239,122,90,0.16)" : "transparent",
          }}
        >
          <span>Hirdetéskészítő</span>
          <span
            className="text-xs transition-transform duration-200"
            style={{ transform: open === "hirdetes" ? "rotate(180deg)" : "rotate(0deg)" }}
          >
            ▾
          </span>
        </button>

        <div
          className="absolute left-0 top-full mt-2 min-w-[220px] rounded-2xl p-2 transition-all duration-200 ease-out"
          style={{
            background: "var(--twx-dark-2)",
            border: "1px solid rgba(255,255,255,0.08)",
            boxShadow: "0 24px 48px rgba(0,0,0,0.45)",
            transformOrigin: "top",
            opacity: open === "hirdetes" ? 1 : 0,
            transform: open === "hirdetes" ? "translateY(0) scaleY(1)" : "translateY(-8px) scaleY(0.96)",
            pointerEvents: open === "hirdetes" ? "auto" : "none",
          }}
        >
          <a
            href="/dashboard/flyer"
            onClick={() => setOpen(null)}
            className="block rounded-xl px-3 py-2.5 text-sm transition-colors hover:bg-white/5"
            style={{ color: "var(--twx-on-dark)" }}
          >
            Hirdetés készítése
          </a>
          <a
            href="/dashboard/flyer/history"
            onClick={() => setOpen(null)}
            className="block rounded-xl px-3 py-2.5 text-sm transition-colors hover:bg-white/5"
            style={{ color: "var(--twx-on-dark)" }}
          >
            Korábbi hirdetések
          </a>
          <a
            href="/dashboard/branding"
            onClick={() => setOpen(null)}
            className="block rounded-xl px-3 py-2.5 text-sm transition-colors hover:bg-white/5"
            style={{ color: "var(--twx-on-dark)" }}
          >
            Arculatok
          </a>
        </div>
      </div>

      {/* Egyedi modulok — legördülő: saját moduljaim + igénylés */}
      <div className="relative z-30">
        <button
          type="button"
          onClick={() => setOpen(open === "egyedi" ? null : "egyedi")}
          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors"
          style={{
            color: "var(--twx-on-dark)",
            background: open === "egyedi" ? "rgba(239,122,90,0.16)" : "transparent",
          }}
        >
          <span>Egyedi modulok</span>
          <span
            className="text-xs transition-transform duration-200"
            style={{ transform: open === "egyedi" ? "rotate(180deg)" : "rotate(0deg)" }}
          >
            ▾
          </span>
        </button>

        <div
          className="absolute right-0 top-full mt-2 min-w-[240px] rounded-2xl p-2 transition-all duration-200 ease-out"
          style={{
            background: "var(--twx-dark-2)",
            border: "1px solid rgba(255,255,255,0.08)",
            boxShadow: "0 24px 48px rgba(0,0,0,0.45)",
            transformOrigin: "top",
            opacity: open === "egyedi" ? 1 : 0,
            transform: open === "egyedi" ? "translateY(0) scaleY(1)" : "translateY(-8px) scaleY(0.96)",
            pointerEvents: open === "egyedi" ? "auto" : "none",
          }}
        >
          <a
            href="/dashboard/custom"
            onClick={() => setOpen(null)}
            className="block rounded-xl px-3 py-2.5 text-sm transition-colors hover:bg-white/5"
            style={{ color: "var(--twx-on-dark)" }}
          >
            Saját moduljaim
          </a>
          <button
            type="button"
            onClick={() => {
              setOpen(null);
              window.dispatchEvent(new CustomEvent("open-b2b"));
            }}
            className="block w-full rounded-xl px-3 py-2.5 text-left text-sm transition-colors hover:bg-white/5"
            style={{ color: "var(--twx-on-dark)" }}
          >
            Egyedi modul igénylése
          </button>
        </div>
      </div>
    </nav>
  );
}
