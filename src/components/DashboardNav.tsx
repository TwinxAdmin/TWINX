// Felső sáv navigáció — publikus kategóriák animált legördülővel.
// Kattintásra a kategória alatt lenyílnak az elérhető modulok.
"use client";

import { useState } from "react";
import { CATEGORIES } from "@/lib/catalog";

export default function DashboardNav({ hasCustom = false }: { hasCustom?: boolean }) {
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

      {hasCustom ? (
        <a
          href="/dashboard/custom"
          className="rounded-full px-3 py-1.5 transition-colors hover:bg-white/5"
          style={{ color: "var(--twx-on-dark)" }}
        >
          Egyedi modulok
        </a>
      ) : (
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent("open-b2b"))}
          className="rounded-full px-3 py-1.5 transition-colors hover:bg-white/5"
          style={{ color: "var(--twx-on-dark)" }}
        >
          Egyedi modulok
        </button>
      )}
    </nav>
  );
}
