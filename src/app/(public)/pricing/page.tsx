// twinx.hu/pricing — Csomagvásárlás (wireframe).
// Gomb -> /api/checkout -> átirányítás a Stripe Checkout oldalra.
"use client";

import { useState } from "react";
import { CREDIT_PACKAGES } from "@/lib/packages";

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
    <main className="min-h-screen p-8 font-sans">
      <div className="mx-auto max-w-3xl space-y-4">
        <h1 className="text-2xl font-semibold">Csomagok</h1>
        <p className="text-sm text-gray-500">
          Fix áras csomagok. A megvásárolt kreditek nem járnak le.
        </p>

        <ul className="space-y-3">
          {CREDIT_PACKAGES.map((pkg) => (
            <li
              key={pkg.id}
              className="flex items-center justify-between border border-gray-200 p-4"
            >
              <div>
                <p className="font-medium">{pkg.name}</p>
                <p className="text-sm text-gray-500">
                  {pkg.credits} kredit · {pkg.priceHuf.toLocaleString("hu-HU")} Ft
                </p>
              </div>
              <button
                onClick={() => buy(pkg.id)}
                disabled={loadingId !== null}
                className="border border-gray-800 bg-gray-800 px-4 py-2 text-sm text-white disabled:opacity-50"
              >
                {loadingId === pkg.id ? "Átirányítás…" : "Vásárlás"}
              </button>
            </li>
          ))}
        </ul>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <p className="text-xs text-gray-400">
          Bejelentkezés szükséges a vásárláshoz.
        </p>
      </div>
    </main>
  );
}
