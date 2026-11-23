// Admin kezdőlap: „Új felület (kredit nélkül)" kapcsoló (3d; D51: előbb csak admin látja, a kapcsolóval mindenki).
// Bekapcsolás előtt megerősítés, mert az élő felhasználókat érinti.
"use client";

import { useEffect, useState } from "react";
import { showToast } from "@/components/Toast";

// Amíg a 3d lépés felületi része (a „kredit” eltüntetése, „nem elérhető” üzenet) nincs kész, bekapcsolni nem lehet.
const READY = false;

export default function NewUiSwitch() {
  const [s, setS] = useState<{ enabled: boolean; accessCount: number } | null>(null);
  const [confirm, setConfirm] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { fetch("/api/admin/new-ui").then((r) => r.json()).then(setS).catch(() => {}); }, []);

  async function apply(enabled: boolean) {
    setBusy(true);
    try {
      const r = await fetch("/api/admin/new-ui", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ enabled }) });
      const d = await r.json();
      if (!r.ok) { showToast(d.error ?? "Nem sikerült.", "error"); return; }
      setS(d); setConfirm(null);
      showToast(enabled ? "Az új felület mindenkinél bekapcsolva." : "Az új felület kikapcsolva (csak az admin látja).", "success");
    } finally { setBusy(false); }
  }

  return (
    <section className="twx-card flex min-h-[96px] flex-wrap items-center justify-between gap-4 p-5">
      <div className="max-w-xl">
        <p className="text-sm font-semibold">Új felület (kredit nélkül)</p>
        <p className="mt-1 text-xs" style={{ color: "var(--twx-ink-muted)" }}>
          {s === null ? "Betöltés…" : s.enabled
            ? `Bekapcsolva: mindenki az új felületet látja. Ingatlan-hozzáféréssel nincs levonás (${s.accessCount} felhasználó).`
            : `Kikapcsolva: csak az admin látja az új felületet, mindenki más a mostani kredites működést. Ingatlan-hozzáférés: ${s.accessCount} felhasználó (Felhasználók lap).`}
        </p>
      </div>
      <button type="button" role="switch" aria-checked={!!s?.enabled} disabled={!s || busy || (!s.enabled && !READY)}
        title={!READY && !s?.enabled ? "Hamarosan — a kredit-kivezetés felületi része még készül." : undefined}
        onClick={() => s && setConfirm(!s.enabled)}
        className="relative h-7 w-12 flex-none rounded-full transition-colors disabled:opacity-50"
        style={{ background: s?.enabled ? "var(--twx-coral)" : "#d9d1c6" }}>
        <span className="absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all" style={{ left: s?.enabled ? 26 : 4 }} />
      </button>

      {confirm !== null && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" style={{ background: "rgba(18,16,14,0.55)" }} onMouseDown={() => setConfirm(null)}>
          <div className="twx-card w-full max-w-md p-6" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal>
            <h3 className="font-display text-lg font-semibold">{confirm ? "Új felület bekapcsolása mindenkinek" : "Új felület kikapcsolása"}</h3>
            <p className="mt-3 text-sm">
              {confirm
                ? `Minden felhasználónál eltűnik a „kredit”. Akinek van Ingatlan-hozzáférése (${s?.accessCount ?? 0} fő), annál nincs levonás; akinek nincs, az a modulok helyén „nem elérhető” üzenetet lát. Bekapcsolás előtt nézd át a hozzáféréseket a Felhasználók lapon.`
                : "Mindenki (az adminon kívül) visszakapja a mostani, kredites felületet és levonást."}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className="twx-btn-outline" onClick={() => setConfirm(null)}>Mégse</button>
              <button type="button" className="twx-btn" disabled={busy} onClick={() => apply(confirm)}>{confirm ? "Bekapcsolás" : "Kikapcsolás"}</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
