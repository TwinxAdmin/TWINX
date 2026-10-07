// Admin: irodai fiók igénylések listája — jóváhagyás / elutasítás (indoklással).
"use client";

import { useState } from "react";

export type AdminOfficeRequest = {
  id: string;
  user_email: string | null;
  office_name: string;
  team_size: number | null;
  phone: string | null;
  note: string | null;
  leader_view: boolean;
  status: "pending" | "approved" | "rejected";
  decision_note: string | null;
  created_at: string;
  decided_at: string | null;
};

const STATUS: Record<AdminOfficeRequest["status"], { label: string; color: string }> = {
  pending: { label: "Elbírálásra vár", color: "var(--twx-coral)" },
  approved: { label: "Jóváhagyva", color: "#15803d" },
  rejected: { label: "Elutasítva", color: "#c0392b" },
};

export default function OfficeRequestList({ items: initial }: { items: AdminOfficeRequest[] }) {
  const [items, setItems] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function decide(id: string, action: "approve" | "reject") {
    setBusy(id);
    setErrors((e) => ({ ...e, [id]: "" }));
    try {
      const res = await fetch("/api/admin/office-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action, note: notes[id] ?? "" }),
      });
      const data = await res.json();
      if (!res.ok) { setErrors((e) => ({ ...e, [id]: data.error ?? "Hiba történt." })); return; }
      setItems((list) => list.map((it) => (it.id === id ? { ...it, ...data.item } : it)));
    } catch {
      setErrors((e) => ({ ...e, [id]: "Hálózati hiba." }));
    } finally {
      setBusy(null);
    }
  }

  if (items.length === 0) {
    return <p className="twx-card p-5 text-sm" style={{ color: "var(--twx-ink-muted)" }}>Még nem érkezett irodai igénylés.</p>;
  }

  return (
    <div className="space-y-3">
      {items.map((it) => {
        const st = STATUS[it.status];
        return (
          <div key={it.id} className="twx-card space-y-3 p-5 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-display text-lg font-semibold">{it.office_name}</p>
                <p style={{ color: "var(--twx-ink-muted)" }}>
                  {it.user_email ?? "-"} · {new Date(it.created_at).toLocaleString("hu-HU")}
                </p>
              </div>
              <span className="rounded-full px-3 py-1 text-xs font-semibold" style={{ color: st.color, border: `1px solid ${st.color}` }}>
                {st.label}
              </span>
            </div>
            <div className="grid gap-1 sm:grid-cols-2">
              <p><strong>Létszám:</strong> {it.team_size ?? "-"} fő</p>
              <p><strong>Telefon:</strong> {it.phone ? <a className="underline" href={`tel:${it.phone.replace(/\s/g, "")}`}>{it.phone}</a> : "-"}</p>
              {it.note && <p className="sm:col-span-2"><strong>Megjegyzés:</strong> {it.note}</p>}
              {it.decision_note && it.status !== "pending" && <p className="sm:col-span-2"><strong>Döntés megjegyzése:</strong> {it.decision_note}</p>}
            </div>

            {it.status === "pending" && (
              <div className="space-y-2 border-t pt-3" style={{ borderColor: "var(--twx-line)" }}>
                <input className="twx-input" placeholder="Megjegyzés (elutasításnál kötelező — az igénylő látja)"
                  value={notes[it.id] ?? ""} onChange={(e) => setNotes((n) => ({ ...n, [it.id]: e.target.value }))} />
                <div className="flex gap-2">
                  <button type="button" className="twx-btn" disabled={busy === it.id} onClick={() => decide(it.id, "approve")}>Jóváhagyás</button>
                  <button type="button" className="twx-btn-outline" disabled={busy === it.id} onClick={() => decide(it.id, "reject")}>Elutasítás</button>
                </div>
                {errors[it.id] && <p className="text-xs" style={{ color: "#c0392b" }}>{errors[it.id]}</p>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
