// OfficeRequestsInbox — létrehozó / kiosztó: a tagok függő kredit-kérései (jóváhagyás / elutasítás).
"use client";

import { useEffect, useState } from "react";
import type { OfficeCreditRequest } from "@/lib/office";

export default function OfficeRequestsInbox({ onDecided }: { onDecided?: () => void }) {
  const [items, setItems] = useState<OfficeCreditRequest[] | null>(null);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch("/api/office/credit-requests")
      .then((r) => r.json())
      .then((d) => setItems(d.error ? [] : d.pending ?? []))
      .catch(() => setItems([]));
  }, []);

  async function decide(it: OfficeCreditRequest, action: "approve" | "reject") {
    setBusy(it.id);
    setErrors((e) => ({ ...e, [it.id]: "" }));
    try {
      const res = await fetch("/api/office/credit-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: it.id, action, amount: amounts[it.id] ?? "" }),
      });
      const d = await res.json();
      if (!res.ok) { setErrors((e) => ({ ...e, [it.id]: d.error ?? "Hiba történt." })); return; }
      setItems((list) => (list ?? []).filter((x) => x.id !== it.id));
      onDecided?.();
    } catch {
      setErrors((e) => ({ ...e, [it.id]: "Hálózati hiba." }));
    } finally {
      setBusy(null);
    }
  }

  if (!items || items.length === 0) return null;

  return (
    <div className="space-y-3 rounded-2xl p-5" style={{ border: "1.5px solid var(--twx-coral)", background: "rgba(239,122,90,0.05)" }}>
      <h3 className="font-display text-lg font-semibold">Kredit-kérések ({items.length})</h3>
      <ul className="space-y-2">
        {items.map((it) => (
          <li key={it.id} className="rounded-xl p-3" style={{ background: "#fff", border: "1px solid var(--twx-line)" }}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold">{it.name || it.email} — {it.amount} kredit</p>
                {it.note && <p className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>„{it.note}”</p>}
                <p className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>{new Date(it.createdAt).toLocaleString("hu-HU")}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input className="twx-input w-20" type="number" min={1} placeholder={String(it.amount)} title="Más mennyiség adása (üresen: a kért mennyiség)"
                  value={amounts[it.id] ?? ""} onChange={(e) => setAmounts((a) => ({ ...a, [it.id]: e.target.value }))} />
                <button type="button" className="twx-btn" disabled={busy === it.id} onClick={() => decide(it, "approve")}>Jóváhagyás</button>
                <button type="button" className="twx-btn-outline" disabled={busy === it.id} onClick={() => decide(it, "reject")}>Elutasítás</button>
              </div>
            </div>
            {errors[it.id] && <p className="mt-1 text-xs text-red-600">{errors[it.id]}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}
