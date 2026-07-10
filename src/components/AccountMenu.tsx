// Fiók-legördülő a fejlécben — egyenleg + feltöltés, profiladatok, gyorslinkek.
"use client";

import { useEffect, useRef, useState } from "react";

const ROLE_LABEL: Record<string, string> = {
  user: "Felhasználó",
  sales: "Sales",
  admin: "Admin",
};

export default function AccountMenu({
  email,
  role,
  balance,
}: {
  email: string;
  role: string;
  balance: number;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors hover:bg-white/5"
        style={{ color: "var(--twx-on-dark)" }}
      >
        Fiók
        <span className="text-xs transition-transform duration-200" style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}>▾</span>
      </button>

      <div
        className="absolute right-0 top-full mt-2 w-[290px] rounded-2xl p-3 transition-all duration-200 ease-out"
        style={{
          background: "var(--twx-dark-2)",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 24px 48px rgba(0,0,0,0.45)",
          transformOrigin: "top",
          opacity: open ? 1 : 0,
          transform: open ? "translateY(0) scaleY(1)" : "translateY(-8px) scaleY(0.96)",
          pointerEvents: open ? "auto" : "none",
        }}
      >
        {/* Profiladatok */}
        <div className="px-2 pb-2">
          <p className="truncate text-sm font-medium" style={{ color: "var(--twx-on-dark)" }}>{email || "—"}</p>
          <p className="text-xs" style={{ color: "var(--twx-on-dark-muted)" }}>
            {ROLE_LABEL[role] ?? role}
          </p>
        </div>

        {/* Egyenleg */}
        <div
          className="mt-1 flex items-center justify-between rounded-xl px-3 py-2.5"
          style={{ background: "rgba(255,255,255,0.05)" }}
        >
          <div>
            <p className="text-xs" style={{ color: "var(--twx-on-dark-muted)" }}>Egyenleg</p>
            <p className="font-display text-lg font-semibold" style={{ color: "var(--twx-on-dark)" }}>{balance}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              window.dispatchEvent(new CustomEvent("open-pricing"));
            }}
            className="rounded-full px-3 py-1.5 text-xs font-medium"
            style={{ background: "var(--twx-coral)", color: "#1c1005" }}
          >
            Feltöltés
          </button>
        </div>

        {/* Linkek */}
        <div className="mt-2 space-y-0.5">
          <a
            href="/dashboard/settings"
            onClick={() => setOpen(false)}
            className="block rounded-xl px-3 py-2.5 text-sm transition-colors hover:bg-white/5"
            style={{ color: "var(--twx-on-dark)" }}
          >
            Beállítások / profil
          </a>
          <a
            href="/dashboard/purchases"
            onClick={() => setOpen(false)}
            className="block rounded-xl px-3 py-2.5 text-sm transition-colors hover:bg-white/5"
            style={{ color: "var(--twx-on-dark)" }}
          >
            Korábbi vásárlások
          </a>
        </div>
      </div>
    </div>
  );
}
