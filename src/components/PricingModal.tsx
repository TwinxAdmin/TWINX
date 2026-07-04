// Csomagok modális ablakban (a landing page-en nyílik, nem külön oldalon).
// Egy példány kell belőle a landingen; az `open-pricing` window-eseményre nyílik.
"use client";

import { useCallback, useEffect, useState } from "react";
import { CREDIT_PACKAGES } from "@/lib/packages";

export default function PricingModal() {
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const close = useCallback(() => {
    setVisible(false);
    window.setTimeout(() => setOpen(false), 180);
  }, []);

  useEffect(() => {
    const onOpen = () => {
      setError(null);
      setOpen(true);
    };
    window.addEventListener("open-pricing", onOpen);
    return () => window.removeEventListener("open-pricing", onOpen);
  }, []);

  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => setVisible(true));
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, close]);

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

      // Nincs belépve -> auth-modál nyitása (belépés után visszatérhet vásárolni).
      if (res.status === 401) {
        close();
        window.setTimeout(
          () => window.dispatchEvent(new CustomEvent("open-auth", { detail: { mode: "login" } })),
          180
        );
        return;
      }
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

  if (!open) return null;

  return (
    <div
      onClick={close}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity duration-200"
      style={{ background: "rgba(12,11,10,0.82)", opacity: visible ? 1 : 0 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl p-7 transition-all duration-200"
        style={{
          background: "var(--twx-cream-card)",
          border: "1px solid var(--twx-line)",
          color: "var(--twx-ink)",
          boxShadow: "0 30px 80px rgba(0,0,0,0.5)",
          opacity: visible ? 1 : 0,
          transform: visible ? "scale(1)" : "scale(0.94)",
        }}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl font-semibold">Csomagok</h2>
          <button
            type="button"
            onClick={close}
            aria-label="Bezárás"
            className="flex h-8 w-8 items-center justify-center rounded-full text-lg"
            style={{ background: "var(--twx-line)", color: "var(--twx-ink)" }}
          >
            ×
          </button>
        </div>

        <p className="mt-2 text-sm" style={{ color: "var(--twx-ink-muted)" }}>
          Fix áras csomagok. A megvásárolt egyenleg nem jár le.
        </p>

        <ul className="mt-5 space-y-3">
          {CREDIT_PACKAGES.map((pkg) => (
            <li
              key={pkg.id}
              className="flex items-center justify-between gap-3 rounded-xl p-4"
              style={{ background: "var(--twx-cream)", border: "1px solid var(--twx-line)" }}
            >
              <div>
                <p className="font-display text-lg font-medium">{pkg.name}</p>
                <p className="text-sm" style={{ color: "var(--twx-ink-muted)" }}>
                  {pkg.priceHuf.toLocaleString("hu-HU")} Ft
                </p>
              </div>
              <button
                onClick={() => buy(pkg.id)}
                disabled={loadingId !== null}
                className="twx-btn shrink-0"
              >
                {loadingId === pkg.id ? "Átirányítás…" : "Vásárlás"}
              </button>
            </li>
          ))}
        </ul>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <p className="mt-3 text-xs" style={{ color: "var(--twx-ink-muted)" }}>
          Bejelentkezés szükséges a vásárláshoz.
        </p>
      </div>
    </div>
  );
}
