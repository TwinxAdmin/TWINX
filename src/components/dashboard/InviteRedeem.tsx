// „Van ajándékkódom" — az ingatlanos kód beváltása BELÉPÉS UTÁN.
//
// A kód szándékosan NEM a regisztrációs űrlapon van: ott a Google-fiókkal
// belépők nem tudnák megadni, és e-mail-megerősítéses regisztrációnál sem
// váltódna be. Egy belépési pont van helyette: a kezdőlapi egyenleg-sáv,
// az „Egyenleg feltöltése” mellett. Beváltás után a gomb eltűnik.
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { showToast } from "@/components/Toast";
import { normalizeInviteCode } from "@/lib/invites";

/** `onDark`: a sötét egyenleg-sávon áll, ott világos szöveg kell. */
export default function InviteRedeem({ onDark = false }: { onDark?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function redeem() {
    const value = normalizeInviteCode(code);
    if (!value) return;
    setBusy(true);
    try {
      const res = await fetch("/api/invite/redeem", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: value }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "A beváltás nem sikerült.");
      showToast(`Ajándékkód beváltva — ${d.total} kredit a fiókodon.`, "success");
      setOpen(false);
      setCode("");
      router.refresh();
    } catch (e) {
      showToast((e as Error).message, "error");
    } finally { setBusy(false); }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)}
        className="rounded-full px-5 py-2.5 text-sm font-medium transition-opacity hover:opacity-90"
        style={onDark
          ? { border: "1px solid rgba(255,255,255,0.35)", color: "var(--twx-on-dark)" }
          : { border: "1px solid var(--twx-line)", color: "var(--twx-ink)" }}>
        Ajándékkód beváltása
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input type="text" value={code} autoFocus
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        onKeyDown={(e) => { if (e.key === "Enter") void redeem(); if (e.key === "Escape") setOpen(false); }}
        placeholder="TWX-XXXX-XXXX"
        aria-label="Ajándékkód"
        className="rounded-full px-4 py-2.5 text-sm outline-none"
        style={onDark
          ? { background: "rgba(255,255,255,0.10)", border: "1px solid rgba(255,255,255,0.35)", color: "var(--twx-on-dark)", width: 180 }
          : { background: "#fff", border: "1px solid var(--twx-line)", color: "var(--twx-ink)", width: 180 }} />
      <button type="button" onClick={() => void redeem()} disabled={busy || !code.trim()}
        className="rounded-full px-4 py-2.5 text-sm font-semibold disabled:opacity-40"
        style={{ background: "var(--twx-coral)", color: "#1c1005" }}>
        {busy ? "Beváltás…" : "Beváltom"}
      </button>
      <button type="button" onClick={() => setOpen(false)}
        className="rounded-full px-3 py-2.5 text-sm"
        style={onDark
          ? { color: "var(--twx-on-dark-muted)" }
          : { color: "var(--twx-ink-muted)" }}>
        Mégse
      </button>
    </div>
  );
}
