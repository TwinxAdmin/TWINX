// OfficeMembers — taglista + keretkiosztás (+ jogosultságok és eltávolítás a létrehozónak).
// Létrehozó: mindent lát és állít. Kiosztó jogú tag: keretet adhat/vehet vissza (magának nem).
"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ALLOCATE_MAX, type OfficeMember } from "@/lib/office";

type Props = { balance?: number; onChanged?: () => void; reloadKey?: number };

export default function OfficeMembers({ balance, onChanged, reloadKey = 0 }: Props) {
  const [members, setMembers] = useState<OfficeMember[] | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [meId, setMeId] = useState<string>("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [rowError, setRowError] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch("/api/office/members")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setLoadError(d.error); return; }
        setMembers(d.members); setCanManage(!!d.canManage); setMeId(d.meId ?? "");
      })
      .catch(() => setLoadError("Nem sikerült betölteni a taglistát."));
  }, [reloadKey]);

  async function act(userId: string, payload: Record<string, unknown>) {
    setBusy(userId);
    setRowError((e) => ({ ...e, [userId]: "" }));
    try {
      const res = await fetch("/api/office/members", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, ...payload }),
      });
      const data = await res.json();
      if (!res.ok) { setRowError((e) => ({ ...e, [userId]: data.error ?? "Hiba történt." })); return false; }
      setMembers(data.members);
      onChanged?.();
      return true;
    } catch {
      setRowError((e) => ({ ...e, [userId]: "Hálózati hiba." }));
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function allocate(userId: string, sign: 1 | -1) {
    const n = Number(amounts[userId]);
    if (!Number.isInteger(n) || n <= 0 || n > ALLOCATE_MAX) {
      setRowError((e) => ({ ...e, [userId]: `Adj meg egy pozitív egész számot (max. ${ALLOCATE_MAX}).` }));
      return;
    }
    if (await act(userId, { action: "allocate", delta: sign * n })) setAmounts((a) => ({ ...a, [userId]: "" }));
  }

  async function remove(m: OfficeMember) {
    if (!window.confirm(`Biztosan eltávolítod ${m.name || m.email} tagot az irodából? A fel nem használt kerete megszűnik, a saját kreditjei és munkái nála maradnak.`)) return;
    await act(m.userId, { action: "remove" });
  }

  if (loadError) return <p className="text-sm text-red-600">{loadError}</p>;
  if (!members) return <p className="text-sm" style={{ color: "var(--twx-ink-muted)" }}>Taglista betöltése…</p>;

  const allocated = members.filter((m) => m.role !== "owner" && !m.unlimited).reduce((s, m) => s + m.allowance, 0);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h3 className="font-display text-lg font-semibold">Tagok ({members.length})</h3>
        <p className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>
          Kiosztott, még fel nem használt keret: <strong style={{ color: "var(--twx-ink)" }}>{allocated} kredit</strong>
          {typeof balance === "number" && allocated > balance && (
            <span className="ml-1 text-red-600">— több, mint az irodai egyenleg ({balance})</span>
          )}
        </p>
      </div>

      <ul className="space-y-2">
        {members.map((m) => {
          const isOwnerRow = m.role === "owner";
          const isMe = m.userId === meId;
          const canAllocateHere = !isOwnerRow && !m.unlimited && (canManage || !isMe);
          return (
            <li key={m.userId} className="rounded-2xl p-4" style={{ border: "1px solid var(--twx-line)" }}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {m.name || m.email || "—"}{isMe && <span style={{ color: "var(--twx-ink-muted)" }}> (te)</span>}
                  </p>
                  {m.name && <p className="truncate text-xs" style={{ color: "var(--twx-ink-muted)" }}>{m.email}</p>}
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {isOwnerRow && <Badge>Létrehozó</Badge>}
                    {m.canAllocate && <Badge>Kioszthat</Badge>}
                    {m.unlimited && <Badge>Korlátlan</Badge>}
                    <span className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                      csatlakozott: {new Date(m.joinedAt).toLocaleDateString("hu-HU")}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>Keret</p>
                  <p className="font-display text-xl font-semibold">
                    {isOwnerRow || m.unlimited ? "Korlátlan" : `${m.allowance} kredit`}
                  </p>
                </div>
              </div>

              {canAllocateHere && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <input className="twx-input w-24" type="number" min={1} max={ALLOCATE_MAX} inputMode="numeric" placeholder="db"
                    value={amounts[m.userId] ?? ""} onChange={(e) => setAmounts((a) => ({ ...a, [m.userId]: e.target.value }))} />
                  <button type="button" className="twx-btn" disabled={busy === m.userId} onClick={() => allocate(m.userId, 1)}>
                    + Keret adása
                  </button>
                  <button type="button" className="twx-btn-outline" disabled={busy === m.userId || m.allowance === 0} onClick={() => allocate(m.userId, -1)}>
                    − Visszavétel
                  </button>
                </div>
              )}

              {canManage && !isOwnerRow && (
                <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 border-t pt-3 text-sm" style={{ borderColor: "var(--twx-line)" }}>
                  <Toggle label="Kioszthat kreditet" hint="más tagoknak adhat keretet"
                    checked={m.canAllocate} disabled={busy === m.userId}
                    onChange={(v) => act(m.userId, { action: "permissions", canAllocate: v })} />
                  <Toggle label="Korlátlan" hint="kérés nélkül költhet az irodai egyenlegből"
                    checked={m.unlimited} disabled={busy === m.userId}
                    onChange={(v) => act(m.userId, { action: "permissions", unlimited: v })} />
                  <button type="button" className="ml-auto text-xs underline" style={{ color: "#c0392b" }}
                    disabled={busy === m.userId} onClick={() => remove(m)}>
                    Eltávolítás
                  </button>
                </div>
              )}

              {rowError[m.userId] && <p className="mt-2 text-xs text-red-600">{rowError[m.userId]}</p>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: "rgba(239,122,90,0.14)", color: "var(--twx-coral)" }}>
      {children}
    </span>
  );
}

function Toggle({ label, hint, checked, disabled, onChange }: {
  label: string; hint: string; checked: boolean; disabled?: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2" title={hint}>
      <input type="checkbox" className="h-4 w-4 accent-[#ef7a5a]" checked={checked} disabled={disabled}
        onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}
