// OfficeJoinForm — csatlakozás egy irodához csatlakozási kóddal (a felugró ablakban használjuk).
"use client";

import { useState, type FormEvent } from "react";
import type { MyOffice } from "@/lib/office";

export default function OfficeJoinForm({ onJoined }: { onJoined: (o: MyOffice) => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function join(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (code.replace(/[^a-z0-9]/gi, "").length < 6) { setError("Írd be a teljes kódot (pl. TWX-8K4P9R)."); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/office/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.errors?.code ?? data.error ?? "Nem sikerült csatlakozni."); return; }
      onJoined(data.office);
    } catch {
      setError("Hálózati hiba — próbáld újra.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={join} className="space-y-2" noValidate>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input className="twx-input font-mono uppercase tracking-widest sm:max-w-xs" placeholder="TWX-8K4P9R"
          value={code} maxLength={14} autoComplete="off" spellCheck={false}
          onChange={(e) => { setCode(e.target.value.toUpperCase()); setError(null); }} aria-label="Csatlakozási kód" />
        <button type="submit" className="twx-btn" disabled={busy}>{busy ? "Csatlakozás…" : "Csatlakozás"}</button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </form>
  );
}

