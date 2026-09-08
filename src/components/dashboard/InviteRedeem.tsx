// „Van ajándékkódom" — az ingatlanos kód beváltása belépés után.
//
// Miért kell a regisztrációs mezőn KÍVÜL is: a Google-fiókkal belépők nem
// töltenek ki regisztrációs űrlapot, tehát ott nem tudnak kódot megadni.
// Ugyanaz a végpont, ugyanaz az ellenőrzés — csak másik belépési pont.
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { showToast } from "@/components/Toast";
import { normalizeInviteCode } from "@/lib/invites";

export default function InviteRedeem() {
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
        className="text-sm font-semibold underline underline-offset-2"
        style={{ color: "var(--twx-coral)" }}>
        Van ajándékkódom
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input type="text" value={code} autoFocus
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        onKeyDown={(e) => { if (e.key === "Enter") void redeem(); if (e.key === "Escape") setOpen(false); }}
        placeholder="TWX-XXXX-XXXX"
        className="twx-input max-w-[200px] text-sm" />
      <button type="button" onClick={() => void redeem()} disabled={busy || !code.trim()}
        className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
        style={{ background: "var(--twx-coral)" }}>
        {busy ? "Beváltás…" : "Beváltom"}
      </button>
      <button type="button" onClick={() => setOpen(false)}
        className="rounded-lg px-2.5 py-1.5 text-xs" style={{ border: "1px solid var(--twx-line)" }}>
        Mégse
      </button>
    </div>
  );
}
