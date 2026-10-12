// TermsGate — belépés utáni, kötelező ÁSZF-elfogadó ablak. Akkor jelenik meg, ha a partner még NEM fogadta el
// az aktuális változatot (régi fiók, Google-belépés jelölés nélkül, vagy új ÁSZF-változat). Elfogadás nélkül
// a felület nem használható — helyette kiléphet.
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import TermsCheckbox from "@/components/TermsCheckbox";

export default function TermsGate({ updated }: { updated: boolean }) {
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function accept() {
    if (!checked) { setError("Az ÁSZF elfogadása szükséges a folytatáshoz."); return; }
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/legal/accept", { method: "POST" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setError(d.error ?? "Nem sikerült menteni. Próbáld újra."); return; }
      setDone(true);
      router.refresh();
    } catch {
      setError("Hálózati hiba. Próbáld újra.");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    setBusy(true);
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
    window.location.href = "/";
  }

  if (done) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: "rgba(18,16,14,0.72)" }}
      role="dialog" aria-modal="true" aria-label="ÁSZF elfogadása">
      <div className="w-full max-w-[440px] rounded-2xl p-6 shadow-2xl"
        style={{ background: "var(--twx-cream-card)", border: "1px solid var(--twx-line)" }}>
        <h2 className="font-display text-xl font-semibold">
          {updated ? "Frissült az ÁSZF" : "Még egy lépés"}
        </h2>
        <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--twx-ink-muted)" }}>
          {updated
            ? "Módosultak az Általános Szerződési Feltételek. A TWINX további használatához kérjük, olvasd el és fogadd el az új változatot."
            : "A TWINX használatához kérjük, olvasd el és fogadd el az Általános Szerződési Feltételeket."}
        </p>
        <div className="mt-4">
          <TermsCheckbox checked={checked} onChange={(v) => { setChecked(v); setError(null); }} error={error ?? undefined} />
        </div>
        <div className="mt-5 flex items-center justify-between gap-3">
          <button type="button" onClick={() => void logout()} disabled={busy}
            className="h-9 rounded-full px-3 text-sm font-semibold" style={{ color: "var(--twx-ink-muted)" }}>
            Kilépés
          </button>
          <button type="button" onClick={() => void accept()} disabled={busy || !checked}
            title={checked ? undefined : "Előbb jelöld be az elfogadást"}
            className="twx-btn h-10 px-5 disabled:cursor-not-allowed disabled:opacity-50">
            {busy ? "Egy pillanat…" : "Elfogadom és tovább"}
          </button>
        </div>
      </div>
    </div>
  );
}
