// Kredit-napló: melyik admin kinek, mikor, mennyi kreditet adott (és miért).
// Saját admin oldalon fut (/admin/credit-log). A kredit ADÁSA a Felhasználók
// táblában történik, a sorvégi „+" gombbal.
"use client";

import { useMemo, useState } from "react";

export type CreditGrant = {
  id: string;
  admin_email: string | null;
  user_email: string | null;
  amount: number;
  note: string | null;
  created_at: string;
};

function when(iso: string): string {
  return new Date(iso).toLocaleString("hu-HU", {
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}

export default function CreditGrantLog({ grants }: { grants: CreditGrant[] }) {
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return grants;
    return grants.filter((g) =>
      [g.user_email, g.admin_email, g.note].some((v) => (v ?? "").toLowerCase().includes(q))
    );
  }, [grants, query]);

  const total = rows.reduce((s, g) => s + g.amount, 0);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)}
          placeholder="Keresés partner, admin vagy indoklás alapján…"
          className="twx-input w-full text-sm sm:max-w-sm" />
        <p className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>
          {rows.length} jóváírás · összesen <strong>{total}</strong> kredit
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="twx-card p-6 text-center text-sm" style={{ color: "var(--twx-ink-muted)" }}>
          {grants.length
            ? "Nincs találat."
            : "Még nem adtál kézzel kreditet. A Felhasználók oldalon, a Kredit oszlop „+” gombjával tudsz."}
        </p>
      ) : (
        <>
          {/* Asztali nézet */}
          <div className="twx-card hidden overflow-x-auto p-4 sm:block">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--twx-line)" }}>
                  {["Mikor", "Ki adta", "Kinek", "Mennyi", "Indoklás"].map((h, i) => (
                    <th key={h}
                      className={`pb-2 text-[11px] font-bold uppercase tracking-wide ${i === 3 ? "text-center" : "text-left"}`}
                      style={{ color: "var(--twx-ink-muted)" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((g) => (
                  <tr key={g.id} style={{ borderBottom: "1px solid var(--twx-line)" }}>
                    <td className="py-2.5 pr-3 text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                      {when(g.created_at)}
                    </td>
                    <td className="py-2.5 pr-3 text-xs">{g.admin_email ?? "—"}</td>
                    <td className="py-2.5 pr-3 text-xs font-medium">{g.user_email ?? "—"}</td>
                    <td className="py-2.5 text-center font-semibold" style={{ color: "var(--twx-coral)" }}>
                      +{g.amount}
                    </td>
                    <td className="py-2.5 pl-3 text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                      {g.note ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobil nézet */}
          <div className="space-y-2 sm:hidden">
            {rows.map((g) => (
              <div key={g.id} className="twx-card p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate text-sm font-medium">{g.user_email ?? "—"}</p>
                  <span className="flex-none font-semibold" style={{ color: "var(--twx-coral)" }}>
                    +{g.amount}
                  </span>
                </div>
                <p className="mt-0.5 text-[11px]" style={{ color: "var(--twx-ink-muted)" }}>
                  {when(g.created_at)} · {g.admin_email ?? "—"}
                </p>
                {g.note && <p className="mt-1 text-xs">{g.note}</p>}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
