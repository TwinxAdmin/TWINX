// Admin — felhasználók blokk (inline). Alapból a legutóbbi 3, gombra a legutóbbi 10;
// keresés e-mail alapján (keresésnél az összes találat látszik).
"use client";

import { useMemo, useState } from "react";
import type { UserMetric } from "@/lib/metrics";

const huf = (n: number) => `${Math.round(n).toLocaleString("hu-HU")} Ft`;

export default function UserMetricsBlock({
  users,
  hufPerUsd,
}: {
  users: UserMetric[];
  hufPerUsd: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState("");
  const [roleMap, setRoleMap] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function changeRole(userId: string, role: string) {
    setBusyId(userId);
    setNote(null);
    try {
      const res = await fetch("/api/admin/role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role }),
      });
      const data = await res.json();
      if (!res.ok) {
        setNote(data.error ?? "Hiba a szerepkör módosításakor.");
        return;
      }
      setRoleMap((m) => ({ ...m, [userId]: role }));
      setNote("Szerepkör frissítve.");
    } catch {
      setNote("Hálózati hiba.");
    } finally {
      setBusyId(null);
    }
  }

  // Legutóbbi (regisztráció szerint csökkenő).
  const recent = useMemo(
    () => [...users].sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? "")),
    [users]
  );

  const q = query.trim().toLowerCase();
  const list = q
    ? recent.filter((u) => u.email.toLowerCase().includes(q)).slice(0, 20)
    : recent.slice(0, expanded ? 10 : 3);

  return (
    <section>
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display font-medium">Felhasználók</h2>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Keresés e-mail alapján…"
          className="twx-input max-w-[240px]"
        />
      </div>

      {note && <p className="mt-2 text-xs" style={{ color: "var(--twx-coral)" }}>{note}</p>}

      <div className="mt-3 space-y-2">
        {list.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--twx-ink-muted)" }}>
            {q ? "Nincs találat." : "Még nincs felhasználó."}
          </p>
        ) : (
          list.map((u) => (
            <div
              key={u.userId}
              className="twx-card flex items-start justify-between gap-3 p-3"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{u.email}</p>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>Szerepkör:</span>
                  <select
                    value={roleMap[u.userId] ?? u.role}
                    disabled={busyId === u.userId}
                    onChange={(e) => changeRole(u.userId, e.target.value)}
                    className="twx-input h-7 py-0 text-xs"
                    style={{ width: "auto", minWidth: "90px" }}
                  >
                    <option value="user">user</option>
                    <option value="sales">sales</option>
                    <option value="admin">admin</option>
                  </select>
                </div>
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
          ))
        )}
      </div>

      {!q && recent.length > 3 && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-3 rounded-full px-4 py-2 text-sm font-medium transition-colors"
          style={{ border: "1px solid var(--twx-line)", background: "var(--twx-cream-card)", color: "var(--twx-ink)" }}
        >
          {expanded ? "Kevesebb" : "Legutóbbi 10 megjelenítése"}
        </button>
      )}
    </section>
  );
}
