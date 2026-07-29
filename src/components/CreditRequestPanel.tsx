// Kredit-kérés a Beállításokban. A sales kolléga (és bárki, aki nem admin) itt
// tud új keretet kérni: megadja a mennyiséget és hogy mire kell, az adminok
// e-mailt kapnak, és jóváhagyáskor megérkezik a kredit.
"use client";

import { useCallback, useEffect, useState } from "react";
import { showToast } from "@/components/Toast";

type RequestRow = {
  id: string;
  amount: number;
  reason: string | null;
  status: "pending" | "approved" | "rejected";
  decision_note: string | null;
  granted_amount: number | null;
  decided_at: string | null;
  created_at: string;
};

const QUICK = [10, 25, 50, 100];

const STATUS: Record<RequestRow["status"], { label: string; color: string; bg: string }> = {
  pending: { label: "Elbírálásra vár", color: "#7a5a12", bg: "#fff8ec" },
  approved: { label: "Jóváhagyva", color: "#2e7d52", bg: "#f2f9f5" },
  rejected: { label: "Elutasítva", color: "#c0392b", bg: "#fdecea" },
};

export default function CreditRequestPanel({ balance }: { balance: number }) {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState<RequestRow[]>([]);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/credit-requests");
      if (!res.ok) return;
      const d = await res.json();
      setItems((d.items ?? []) as RequestRow[]);
    } catch { /* lista nélkül is használható */ }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const pending = items.find((i) => i.status === "pending");

  async function submit() {
    const amt = parseInt(amount, 10);
    if (!Number.isInteger(amt) || amt <= 0) {
      showToast("Add meg, hány kreditre van szükséged.", "error");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/credit-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amt, reason: reason.trim() || undefined }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "A kérés beadása nem sikerült.");
      showToast(
        d.emailed
          ? "Kérés elküldve — az adminok értesítést kaptak."
          : "Kérés rögzítve. (Az értesítő e-mail nem ment ki, szólj az adminnak.)",
        d.emailed ? "success" : "error"
      );
      setAmount("");
      setReason("");
      void load();
    } catch (e) {
      showToast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="twx-card space-y-4 p-5">
      <div>
        <h2 className="text-sm font-semibold">Kredit kérés</h2>
        <p className="mt-0.5 text-xs" style={{ color: "var(--twx-ink-muted)" }}>
          Jelenlegi egyenleged: <strong>{balance}</strong> kredit. Ha elfogyott, itt kérhetsz
          újat — az adminok értesítést kapnak, és jóváhagyás után azonnal megérkezik.
        </p>
      </div>

      {pending ? (
        <div className="rounded-xl p-3 text-sm"
          style={{ background: STATUS.pending.bg, border: `1px solid ${STATUS.pending.color}33` }}>
          <p className="font-medium" style={{ color: STATUS.pending.color }}>
            Van egy elbírálásra váró kérésed: {pending.amount} kredit
          </p>
          <p className="mt-0.5 text-xs" style={{ color: "var(--twx-ink-muted)" }}>
            Beadva: {new Date(pending.created_at).toLocaleString("hu-HU")}
            {pending.reason ? ` · ${pending.reason}` : ""}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <span className="mb-1.5 block text-xs font-medium">Mennyi kreditre van szükséged?</span>
            <div className="flex flex-wrap gap-1.5">
              {QUICK.map((q) => (
                <button key={q} type="button" onClick={() => setAmount(String(q))}
                  className="rounded-lg px-3 py-1.5 text-sm font-semibold transition"
                  style={amount === String(q)
                    ? { background: "var(--twx-coral)", color: "#fff" }
                    : { border: "1px solid var(--twx-line)", background: "#fff" }}>
                  {q}
                </button>
              ))}
              <input type="number" min={1} value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="egyéb" className="twx-input w-24 text-right text-sm" />
            </div>
          </div>

          <label className="block">
            <span className="mb-1 block text-xs font-medium">Mire kell? (nem kötelező)</span>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2}
              placeholder="pl. 3 ügyfélbemutató a jövő héten"
              className="twx-input w-full text-sm" />
          </label>

          <button type="button" onClick={submit} disabled={busy || !amount.trim()}
            className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
            style={{ background: "var(--twx-coral)" }}>
            {busy ? "Küldés…" : "Kérés elküldése"}
          </button>
        </div>
      )}

      {items.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-semibold">Korábbi kéréseim</p>
          <div className="space-y-1.5">
            {items.map((it) => {
              const s = STATUS[it.status];
              return (
                <div key={it.id} className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg px-3 py-2 text-xs"
                  style={{ border: "1px solid var(--twx-line)" }}>
                  <span>
                    <strong>{it.amount} kredit</strong>
                    {it.granted_amount != null && it.granted_amount !== it.amount && (
                      <> → jóváírva: <strong>{it.granted_amount}</strong></>
                    )}
                    <span style={{ color: "var(--twx-ink-muted)" }}>
                      {" · "}{new Date(it.created_at).toLocaleDateString("hu-HU")}
                    </span>
                  </span>
                  <span className="rounded-full px-2 py-0.5 font-medium"
                    style={{ background: s.bg, color: s.color }}>
                    {s.label}
                  </span>
                  {it.decision_note && (
                    <span className="w-full" style={{ color: "var(--twx-ink-muted)" }}>{it.decision_note}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
