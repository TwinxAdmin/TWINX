// Egyedi fejlesztés / árajánlatkérés modális ablakban (dashboardon is elérhető).
// Az `open-b2b` window-eseményre nyílik.
"use client";

import { useCallback, useEffect, useState } from "react";
import B2BForm from "@/components/B2BForm";

export default function B2BModal() {
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(false);

  const close = useCallback(() => {
    setVisible(false);
    window.setTimeout(() => setOpen(false), 180);
  }, []);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener("open-b2b", onOpen);
    return () => window.removeEventListener("open-b2b", onOpen);
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

  if (!open) return null;

  return (
    <div
      onClick={close}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity duration-200"
      style={{ background: "rgba(12,11,10,0.82)", opacity: visible ? 1 : 0 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl p-7 transition-all duration-200"
        style={{
          background: "var(--twx-cream-card)",
          border: "1px solid var(--twx-line)",
          color: "var(--twx-ink)",
          boxShadow: "0 30px 80px rgba(0,0,0,0.5)",
          opacity: visible ? 1 : 0,
          transform: visible ? "scale(1)" : "scale(0.94)",
        }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-semibold">Egyedi fejlesztés</h2>
            <p className="mt-1 text-sm" style={{ color: "var(--twx-ink-muted)" }}>
              Van egy ötleted egy saját modulra? Kérj rá árajánlatot — pár napon belül keresünk.
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Bezárás"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-lg"
            style={{ background: "var(--twx-line)", color: "var(--twx-ink)" }}
          >
            ×
          </button>
        </div>

        <div className="mt-5">
          <B2BForm />
        </div>
      </div>
    </div>
  );
}
