// Kredit jóváírása egy partnernek — felugró ablak a Felhasználók táblából.
// Gyorsválasztó gombok (10 / 25 / 50 / 100), szabad mennyiség és opcionális
// indoklás, ami bekerül a kredit-naplóba.
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { showToast } from "@/components/Toast";

const QUICK = [10, 25, 50, 100];

export default function CreditGrantDialog({
  name, company, email, onClose,
}: {
  name: string;
  company?: string;
  email: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function submit() {
    const amt = parseInt(amount, 10);
    if (!Number.isInteger(amt) || amt <= 0) {
      showToast("Adj meg egy pozitív kredit számot.", "error");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, amount: amt, note: note.trim() || undefined }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Hiba a jóváírás során.");
      showToast(`${amt} kredit jóváírva: ${name || email}`, "success");
      onClose();
      router.refresh(); // frissüljön a táblázat és a napló
    } catch (e) {
      showToast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      style={{ background: "rgba(20,16,14,0.5)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="px-5 py-4" style={{ background: "var(--twx-coral-soft)" }}>
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#7a2e17" }}>
            Kredit jóváírása
          </p>
          <p className="mt-1 truncate text-base font-semibold">{name || email}</p>
          {company && (
            <p className="truncate text-xs font-medium" style={{ color: "var(--twx-coral)" }}>{company}</p>
          )}
          <p className="truncate text-xs" style={{ color: "var(--twx-ink-muted)" }}>{email}</p>
        </div>

        <div className="space-y-3 p-5">
          <div>
            <span className="mb-1.5 block text-xs font-medium">Mennyiség</span>
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
              <input type="number" min={1} value={amount} autoFocus
                onChange={(e) => setAmount(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void submit(); }}
                placeholder="egyéb" className="twx-input w-24 text-right text-sm" />
            </div>
          </div>

          <label className="block">
            <span className="mb-1 block text-xs font-medium">Indoklás (nem kötelező)</span>
            <input type="text" value={note} onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void submit(); }}
              placeholder="pl. bemutató, kárpótlás, átutalás ellenében"
              className="twx-input w-full text-sm" />
            <span className="mt-1 block text-[11px]" style={{ color: "var(--twx-ink-muted)" }}>
              Bekerül a kredit-naplóba, hogy később is tudd, miért adtad.
            </span>
          </label>
        </div>

        <div className="flex items-center justify-end gap-2 border-t px-5 py-3"
          style={{ borderColor: "var(--twx-line)" }}>
          <button type="button" onClick={onClose}
            className="rounded-xl px-4 py-2 text-sm font-medium"
            style={{ border: "1px solid var(--twx-line)" }}>
            Mégse
          </button>
          <button type="button" onClick={submit} disabled={busy || !amount.trim()}
            className="rounded-xl px-5 py-2 text-sm font-semibold text-white disabled:opacity-40"
            style={{ background: "var(--twx-coral)" }}>
            {busy ? "Jóváírás…" : "Jóváírás"}
          </button>
        </div>
      </div>
    </div>
  );
}
