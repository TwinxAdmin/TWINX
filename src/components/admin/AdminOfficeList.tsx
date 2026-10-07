// Admin: megnyitott irodák listája + irodai egyenleg közvetlen jóváírása.
"use client";

import { useState } from "react";

export type AdminOffice = {
  id: string;
  name: string;
  balance: number;
  ownerEmail: string;
  memberCount: number;
  createdAt: string;
};

export default function AdminOfficeList({ items: initial }: { items: AdminOffice[] }) {
  const [items, setItems] = useState(initial);
  const [amount, setAmount] = useState<Record<string, string>>({});
  const [note, setNote] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<Record<string, { ok: boolean; text: string }>>({});

  async function topup(id: string) {
    const n = Number(amount[id]);
    if (!Number.isInteger(n) || n <= 0) { setMsg((m) => ({ ...m, [id]: { ok: false, text: "Pozitív egész számot adj meg." } })); return; }
    if (!window.confirm(`${n} kredit jóváírása az iroda egyenlegére?`)) return;
    setBusy(id);
    try {
      const res = await fetch("/api/admin/offices", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ officeId: id, amount: n, note: note[id] ?? "" }),
      });
      const data = await res.json();
      if (!res.ok) { setMsg((m) => ({ ...m, [id]: { ok: false, text: data.error ?? "Hiba." } })); return; }
      setItems((list) => list.map((o) => (o.id === id ? { ...o, balance: data.balance ?? o.balance + n } : o)));
      setAmount((a) => ({ ...a, [id]: "" }));
      setNote((a) => ({ ...a, [id]: "" }));
      setMsg((m) => ({ ...m, [id]: { ok: true, text: `+${n} kredit jóváírva.` } }));
    } catch {
      setMsg((m) => ({ ...m, [id]: { ok: false, text: "Hálózati hiba." } }));
    } finally {
      setBusy(null);
    }
  }

  if (items.length === 0) {
    return <p className="twx-card p-5 text-sm" style={{ color: "var(--twx-ink-muted)" }}>Még nincs megnyitott iroda.</p>;
  }

  return (
    <div className="space-y-3">
      {items.map((o) => (
        <div key={o.id} className="twx-card space-y-3 p-5 text-sm">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-display text-lg font-semibold">{o.name}</p>
              <p style={{ color: "var(--twx-ink-muted)" }}>
                Létrehozó: {o.ownerEmail} · {o.memberCount} tag · nyitva: {new Date(o.createdAt).toLocaleDateString("hu-HU")}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>Irodai egyenleg</p>
              <p className="font-display text-xl font-semibold">{o.balance} kredit</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t pt-3" style={{ borderColor: "var(--twx-line)" }}>
            <input className="twx-input w-24" type="number" min={1} placeholder="db" value={amount[o.id] ?? ""}
              onChange={(e) => setAmount((a) => ({ ...a, [o.id]: e.target.value }))} />
            <input className="twx-input min-w-[180px] flex-1" placeholder="Megjegyzés (nem kötelező)" value={note[o.id] ?? ""}
              onChange={(e) => setNote((a) => ({ ...a, [o.id]: e.target.value }))} />
            <button type="button" className="twx-btn" disabled={busy === o.id} onClick={() => topup(o.id)}>Jóváírás az irodának</button>
          </div>
          {msg[o.id] && <p className="text-xs" style={{ color: msg[o.id].ok ? "#15803d" : "#c0392b" }}>{msg[o.id].text}</p>}
        </div>
      ))}
    </div>
  );
}
