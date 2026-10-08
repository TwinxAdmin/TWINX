// OfficeCreditAsk — irodai tag: „Kredit kérése a vezetőtől" (+ a legutóbbi kérés állapota).
"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ALLOCATE_MAX, type OfficeCreditRequest } from "@/lib/office";

const STATUS: Record<OfficeCreditRequest["status"], { label: string; color: string }> = {
  pending: { label: "Elbírálásra vár", color: "var(--twx-coral)" },
  approved: { label: "Jóváhagyva", color: "#15803d" },
  rejected: { label: "Elutasítva", color: "#c0392b" },
};

export default function OfficeCreditAsk() {
  const [mine, setMine] = useState<OfficeCreditRequest | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/office/credit-requests")
      .then((r) => r.json())
      .then((d) => { if (!d.error) setMine(d.mine ?? null); else setError(d.error); })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const n = Number(amount);
    if (!Number.isInteger(n) || n < 1 || n > ALLOCATE_MAX) { setError(`1 és ${ALLOCATE_MAX} közötti egész számot adj meg.`); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/office/credit-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: n, note }),
      });
      const d = await res.json();
      if (!res.ok) { setError(d.errors?.amount ?? d.error ?? "Nem sikerült elküldeni."); return; }
      setMine(d.mine);
      setAmount(""); setNote("");
    } catch {
      setError("Hálózati hiba — próbáld újra.");
    } finally {
      setBusy(false);
    }
  }

  if (!loaded) return null;
  const pending = mine?.status === "pending";

  return (
    <div className="space-y-3 rounded-2xl p-5" style={{ border: "1px solid var(--twx-line)" }}>
      <h3 className="font-display text-lg font-semibold">Kredit kérése a vezetőtől</h3>

      {mine && (
        <p className="text-sm">
          Legutóbbi kérésed: <strong>{mine.amount} kredit</strong>{" "}
          <span style={{ color: STATUS[mine.status].color }}>— {STATUS[mine.status].label}</span>
          {mine.status === "approved" && mine.granted !== null && mine.granted !== mine.amount && ` (${mine.granted} kreditet kaptál)`}
        </p>
      )}

      {pending ? (
        <p className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>
          Amíg ez elbírálásra vár, újat nem küldhetsz. A vezető e-mailben értesítést kapott.
        </p>
      ) : (
        <form onSubmit={submit} className="space-y-2" noValidate>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input className="twx-input sm:w-28" type="number" min={1} max={ALLOCATE_MAX} inputMode="numeric"
              placeholder="db" value={amount} onChange={(e) => { setAmount(e.target.value); setError(null); }} />
            <input className="twx-input flex-1" placeholder="Mire kell? (nem kötelező)" maxLength={300}
              value={note} onChange={(e) => setNote(e.target.value)} />
            <button type="submit" className="twx-btn" disabled={busy}>{busy ? "Küldés…" : "Kérés elküldése"}</button>
          </div>
        </form>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
