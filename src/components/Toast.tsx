// Toast — globális, esemény-alapú visszajelzések (siker/hiba/info) animációval.
// Bárhonnan hívható: showToast("Mentve!", "success"). A ToastProvider a layoutban ül.
"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

type ToastType = "success" | "error" | "info";
type ToastItem = { id: number; message: string; type: ToastType };

const STYLES: Record<ToastType, { bg: string; icon: string }> = {
  success: { bg: "#1f7a4d", icon: "✓" },
  error: { bg: "#b5372f", icon: "!" },
  info: { bg: "var(--twx-dark-2)", icon: "i" },
};

export function showToast(message: string, type: ToastType = "info") {
  window.dispatchEvent(new CustomEvent("twx-toast", { detail: { message, type } }));
}

export default function ToastProvider() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    let counter = 0;
    const onToast = (e: Event) => {
      const d = (e as CustomEvent).detail as { message: string; type?: ToastType };
      const item: ToastItem = { id: ++counter, message: d.message, type: d.type ?? "info" };
      setToasts((prev) => [...prev, item]);
      setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== item.id)), 4200);
    };
    window.addEventListener("twx-toast", onToast);
    return () => window.removeEventListener("twx-toast", onToast);
  }, []);

  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-[100] flex w-[min(92vw,360px)] flex-col gap-2">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: 18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 24 }}
            transition={{ type: "spring", stiffness: 400, damping: 32 }}
            className="pointer-events-auto flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium shadow-lg"
            style={{ background: STYLES[t.type].bg, color: "#fff" }}
          >
            <span
              className="flex h-6 w-6 flex-none items-center justify-center rounded-full text-xs font-bold"
              style={{ background: "rgba(255,255,255,0.2)" }}
            >
              {STYLES[t.type].icon}
            </span>
            <span>{t.message}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
