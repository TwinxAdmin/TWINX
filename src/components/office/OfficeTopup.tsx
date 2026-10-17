// OfficeTopup — irodai egyenleg feltöltése (CSAK a létrehozó).
// Két út: (1) BANKKÁRTYA (ha élesítve): a közös fizetési lépés (PricingModal) irodai célponttal → Stripe → a kredit
// azonnal az IRODA egyenlegére kerül, a számla e-mailben jön; (2) számlás megrendelés: számla → befizetés → az admin
// jóváhagyásakor a kredit az iroda egyenlegére kerül.
"use client";

import { useState } from "react";
import { CREDIT_PACKAGES, CHECKOUT_ENABLED } from "@/lib/packages";

export default function OfficeTopup() {
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string; needsBilling?: boolean } | null>(null);

  async function order() {
    if (!selected) { setResult({ ok: false, text: "Válassz egy csomagot." }); return; }
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/credit-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageId: selected, target: "office" }),
      });
      const d = await res.json();
      if (res.status === 428 || d.needsBilling) {
        setResult({ ok: false, text: "A számlához előbb add meg a számlázási adataidat.", needsBilling: true });
        return;
      }
      if (!res.ok) { setResult({ ok: false, text: d.error ?? "Nem sikerült elküldeni." }); return; }
      setResult({ ok: true, text: "Megrendelés elküldve. Kiállítjuk a számlát; a befizetés után a kredit az iroda egyenlegére kerül." });
      setSelected(null);
    } catch {
      setResult({ ok: false, text: "Hálózati hiba — próbáld újra." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-2xl p-5" style={{ border: "1px solid var(--twx-line)" }}>
      <div>
        <h3 className="font-display text-lg font-semibold">Irodai egyenleg feltöltése</h3>
        <p className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>
          A kredit az iroda közös egyenlegére kerül — innen osztod ki a kollégáknak. A kreditek nem járnak le.
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {CREDIT_PACKAGES.map((p) => {
          const on = selected === p.id;
          return (
            <button key={p.id} type="button" onClick={() => { setSelected(p.id); setResult(null); }} aria-pressed={on}
              className="rounded-xl p-3 text-left transition-colors"
              style={{ border: `1.5px solid ${on ? "var(--twx-coral)" : "var(--twx-line)"}`, background: on ? "rgba(239,122,90,0.08)" : "transparent" }}>
              <span className="block font-display text-lg font-semibold">{p.credits} kredit</span>
              <span className="block text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                {p.priceHuf.toLocaleString("hu-HU")} Ft
              </span>
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {CHECKOUT_ENABLED && (
          <button type="button" className="twx-btn" disabled={!selected}
            title={!selected ? "Előbb válassz csomagot" : undefined}
            onClick={() => selected && window.dispatchEvent(new CustomEvent("open-pricing", { detail: { packageId: selected, target: "office" } }))}>
            Fizetés bankkártyával
          </button>
        )}
        <button type="button" disabled={busy || !selected} onClick={order}
          className={CHECKOUT_ENABLED ? "rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-40" : "twx-btn"}
          style={CHECKOUT_ENABLED ? { border: "1px solid var(--twx-line)", background: "#fff" } : undefined}>
          {busy ? "Küldés…" : "Megrendelés (számlával)"}
        </button>
      </div>
      {CHECKOUT_ENABLED && (
        <p className="text-[11px]" style={{ color: "var(--twx-ink-muted)" }}>
          Kártyával a kredit azonnal az iroda egyenlegére kerül; számlával a befizetés beérkezése után.
        </p>
      )}
      {result && (
        <p className="text-xs" style={{ color: result.ok ? "#15803d" : "#c0392b" }}>
          {result.text}{" "}
          {result.needsBilling && <a href="/dashboard/settings" className="underline">Számlázási adatok megadása →</a>}
        </p>
      )}
    </div>
  );
}
