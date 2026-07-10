// Admin — felhasználónkénti bontás böngésző. Gombra felugró ablak, keresés e-mail alapján,
// görgethető lista (kb. 8 sor látszik egyszerre).
"use client";

import { useMemo, useState } from "react";
import type { UserMetric } from "@/lib/metrics";

const huf = (n: number) => `${Math.round(n).toLocaleString("hu-HU")} Ft`;
const usd = (n: number) => `$${n.toFixed(2)}`;

export default function UserMetricsBrowser({
  users,
  hufPerUsd,
}: {
  users: UserMetric[];
  hufPerUsd: number;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => u.email.toLowerCase().includes(q));
  }, [users, query]);

  return (
    <>
      <button onClick={() => setOpen(true)} className="twx-btn">
        Felhasználók böngészése ({users.length})
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(12,11,10,0.82)" }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl p-5"
            style={{ background: "var(--twx-cream-card)", border: "1px solid var(--twx-line)", color: "var(--twx-ink)", boxShadow: "0 30px 80px rgba(0,0,0,0.5)" }}
          >
            <div className="flex items-center justify-between gap-4">
              <h3 className="font-display text-xl font-semibold">Felhasználók</h3>
              <button
                onClick={() => setOpen(false)}
                aria-label="Bezárás"
                className="flex h-8 w-8 items-center justify-center rounded-full text-lg"
                style={{ background: "var(--twx-line)", color: "var(--twx-ink)" }}
              >
                ×
              </button>
            </div>

            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Keresés e-mail alapján…"
              className="twx-input mt-4"
              autoFocus
            />

            <div className="mt-3 max-h-[28rem] space-y-2 overflow-y-auto pr-1">
              {filtered.length === 0 ? (
                <p className="p-3 text-sm" style={{ color: "var(--twx-ink-muted)" }}>
                  Nincs találat.
                </p>
              ) : (
                filtered.map((u) => (
                  <div
                    key={u.userId}
                    className="rounded-xl p-3"
                    style={{ background: "var(--twx-cream)", border: "1px solid var(--twx-line)" }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{u.email}</p>
                        {u.role !== "user" && (
                          <span className="text-xs" style={{ color: "var(--twx-coral)" }}>{u.role}</span>
                        )}
                        <p className="mt-1 truncate text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                          {u.features.length
                            ? u.features.map((f) => `${f.label} ${f.count}`).join(" · ")
                            : "nincs használat"}
                        </p>
                      </div>
                      <div className="shrink-0 text-right text-sm">
                        <p className="font-semibold">{u.uses} db</p>
                        <p className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                          {huf(u.costUsd * hufPerUsd)} költség
                        </p>
                        <p className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                          {huf(u.revenueHuf)} bevétel · {u.creditsBought} kredit
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <p className="mt-3 text-xs" style={{ color: "var(--twx-ink-muted)" }}>
              {filtered.length} / {users.length} felhasználó · 1 USD = {hufPerUsd} Ft · a költség becsült API-önköltség.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
