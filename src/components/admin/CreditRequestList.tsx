// Admin — kredit-kérések elbírálása. A függő kérések elöl; jóváhagyáskor a
// kért mennyiség felülírható, elutasításnál indoklás adható.
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { showToast } from "@/components/Toast";

export type CreditRequestRow = {
  id: string;
  user_email: string | null;
  amount: number;
  reason: string | null;
  status: "pending" | "approved" | "rejected";
  decided_by_email: string | null;
  decided_at: string | null;
  decision_note: string | null;
  granted_amount: number | null;
  created_at: string;
};

const STATUS: Record<CreditRequestRow["status"], { label: string; color: string; bg: string }> = {
  pending: { label: "Elbírálásra vár", color: "#7a5a12", bg: "#fff8ec" },
  approved: { label: "Jóváhagyva", color: "#2e7d52", bg: "#f2f9f5" },
  rejected: { label: "Elutasítva", color: "#c0392b", bg: "#fdecea" },
};

export default function CreditRequestList({ items }: { items: CreditRequestRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});

  const pending = items.filter((i) => i.status === "pending");
  const closed = items.filter((i) => i.status !== "pending");

  async function decide(id: string, action: "approve" | "reject") {
    setBusy(id);
    try {
      const amt = parseInt(amounts[id] ?? "", 10);
      const res = await fetch("/api/admin/credit-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id, action,
          amount: Number.isInteger(amt) && amt > 0 ? amt : undefined,
          note: notes[id]?.trim() || undefined,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "A művelet nem sikerült.");
      showToast(
        action === "approve" ? `Jóváírva: ${d.granted} kredit` : "A kérés elutasítva.",
        action === "approve" ? "success" : "info"
      );
      router.refresh();
    } catch (e) {
      showToast((e as Error).message, "error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-5">
      <section>
        <h2 className="mb-2 text-sm font-semibold">
          Elbírálásra vár {pending.length > 0 && (
            <span className="ml-1 rounded-full px-2 py-0.5 text-[11px] font-bold text-white"
              style={{ background: "var(--twx-coral)" }}>{pending.length}</span>
          )}
        </h2>

        {pending.length === 0 ? (
          <p className="twx-card p-5 text-center text-sm" style={{ color: "var(--twx-ink-muted)" }}>
            Nincs elbírálásra váró kérés.
          </p>
        ) : (
          <div className="space-y-3">
            {pending.map((r) => (
              <div key={r.id} className="twx-card p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{r.user_email ?? "—"}</p>
                    <p className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                      {new Date(r.created_at).toLocaleString("hu-HU")}
                    </p>
                  </div>
                  <p className="text-lg font-bold" style={{ color: "var(--twx-coral)" }}>
                    {r.amount} kredit
                  </p>
                </div>

                {r.reason && (
                  <p className="mt-2 rounded-lg p-2 text-sm"
                    style={{ background: "var(--twx-cream-card)" }}>{r.reason}</p>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-1.5 text-xs">
                    <span style={{ color: "var(--twx-ink-muted)" }}>Jóváírás:</span>
                    <input type="number" min={1} placeholder={String(r.amount)}
                      value={amounts[r.id] ?? ""}
                      onChange={(e) => setAmounts((a) => ({ ...a, [r.id]: e.target.value }))}
                      className="twx-input w-20 py-1 text-right text-xs" />
                  </label>
                  <input type="text" placeholder="Megjegyzés (nem kötelező)"
                    value={notes[r.id] ?? ""}
                    onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
                    className="twx-input flex-1 py-1 text-xs" style={{ minWidth: 160 }} />
                  <button type="button" disabled={busy === r.id}
                    onClick={() => void decide(r.id, "approve")}
                    className="rounded-lg px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
                    style={{ background: "var(--twx-coral)" }}>
                    Jóváhagyás
                  </button>
                  <button type="button" disabled={busy === r.id}
                    onClick={() => void decide(r.id, "reject")}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-40"
                    style={{ border: "1px solid #f0b3b3", color: "#c0392b", background: "#fff" }}>
                    Elutasítás
                  </button>
                </div>
                <p className="mt-1.5 text-[11px]" style={{ color: "var(--twx-ink-muted)" }}>
                  Ha üresen hagyod a mennyiséget, a kért {r.amount} kredit kerül jóváírásra.
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      {closed.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold">Elbírált kérések</h2>
          <div className="twx-card overflow-x-auto p-4">
            <table className="w-full min-w-[620px] text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--twx-line)" }}>
                  {["Mikor", "Kérelmező", "Kért", "Jóváírt", "Elbírálta", "Állapot"].map((h) => (
                    <th key={h} className="pb-2 text-left text-[11px] font-bold uppercase tracking-wide"
                      style={{ color: "var(--twx-ink-muted)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {closed.map((r) => {
                  const s = STATUS[r.status];
                  return (
                    <tr key={r.id} style={{ borderBottom: "1px solid var(--twx-line)" }}>
                      <td className="py-2 pr-3 text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                        {new Date(r.decided_at ?? r.created_at).toLocaleDateString("hu-HU")}
                      </td>
                      <td className="py-2 pr-3 text-xs font-medium">{r.user_email ?? "—"}</td>
                      <td className="py-2 pr-3 text-xs">{r.amount}</td>
                      <td className="py-2 pr-3 text-xs font-semibold">{r.granted_amount ?? "—"}</td>
                      <td className="py-2 pr-3 text-xs">{r.decided_by_email ?? "—"}</td>
                      <td className="py-2">
                        <span className="rounded-full px-2 py-0.5 text-[11px] font-medium"
                          style={{ background: s.bg, color: s.color }}>{s.label}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
