// twinx.hu/pricing — Csomagvásárlás (wireframe).
// Gomb -> /api/checkout -> átirányítás a Stripe Checkout oldalra.
"use client";

import { useState } from "react";
import { CREDIT_PACKAGES, CHECKOUT_ENABLED } from "@/lib/packages";
import Wordmark from "@/components/Wordmark";

export default function PricingPage() {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function buy(packageId: string) {
    setError(null);
    setLoadingId(packageId);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageId }),
      });
      const data = await res.json();

      if (!res.ok || !data.url) {
        setError(data.error ?? "Hiba a fizetés indításakor.");
        return;
      }
      window.location.href = data.url as string;
    } catch {
      setError("Hálózati hiba. Próbáld újra.");
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <main className="twx-page p-8 font-sans">
      <div className="mx-auto max-w-3xl space-y-5 py-8">
        <a href="/" className="font-display text-2xl font-semibold tracking-wide"><Wordmark /></a>
        <h1 className="font-display text-4xl font-semibold">Csomagok</h1>
        <p className="text-sm" style={{ color: "var(--twx-ink-muted)" }}>
          Fix áras csomagok. A megvásárolt egyenleg nem jár le.
        </p>

        <ul className="space-y-3">
          {CREDIT_PACKAGES.map((pkg) => (
            <li
              key={pkg.id}
              className="twx-card flex items-center justify-between p-5"
            >
              <div>
                <p className="font-display text-xl font-medium">{pkg.name}</p>
                <p className="text-sm" style={{ color: "var(--twx-ink-muted)" }}>
                  {pkg.priceHuf.toLocaleString("hu-HU")} Ft
                </p>
              </div>
              {CHECKOUT_ENABLED ? (
                <button
                  onClick={() => buy(pkg.id)}
                  disabled={loadingId !== null}
                  className="twx-btn"
                >
                  {loadingId === pkg.id ? "Átirányítás…" : "Vásárlás"}
                </button>
              ) : (
                <span
                  className="cursor-not-allowed rounded-xl px-4 py-2 text-sm font-semibold"
                  style={{ background: "var(--twx-line)", color: "var(--twx-ink-muted)", opacity: 0.75 }}
                >
                  Hamarosan
                </span>
              )}
            </li>
          ))}
        </ul>

        {/* Amíg a bankkártyás fizetés nem él, mutassuk a MŰKÖDŐ utat. */}
        {!CHECKOUT_ENABLED && (
          <div className="twx-card p-5" style={{ borderColor: "var(--twx-coral)" }}>
            <p className="text-sm font-semibold" style={{ color: "#7a2e17" }}>
              Most így tudsz kreditet szerezni
            </p>
            <p className="mt-1 text-xs" style={{ color: "var(--twx-ink-muted)" }}>
              A bankkártyás fizetés hamarosan indul. Addig regisztrálsz, leadod az igényed,
              mi kiállítjuk a számlát, és a befizetés beérkezése után jóváírjuk a kreditet.
            </p>
            <a href="/dashboard/settings"
              className="mt-3 inline-block rounded-xl px-5 py-2.5 text-sm font-semibold text-white"
              style={{ background: "var(--twx-coral)" }}>
              Kredit igénylés
            </a>
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
        <p className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>
          Bejelentkezés szükséges.
        </p>
      </div>
    </main>
  );
}
