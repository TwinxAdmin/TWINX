// Lengő nézet-váltó sáv a képernyő alján — CSAK adminnak.
//
// Kilépés nélkül átkapcsolható, hogy a felület úgy nézzen ki, ahogy egy sima
// felhasználó vagy egy sales kolléga látja. Előnézet közben a sáv feltűnő,
// hogy ne lehessen elfelejteni, miért „hiányzik" az Admin menü.
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { showToast } from "@/components/Toast";

type View = "admin" | "user" | "sales";

const OPTIONS: { id: View; label: string }[] = [
  { id: "admin", label: "Admin" },
  { id: "sales", label: "Sales" },
  { id: "user", label: "Felhasználó" },
];

export default function ViewAsBar({ current }: { current: View }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function pick(v: View) {
    if (v === current || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/view-as", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ view: v === "admin" ? null : v }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "A nézetváltás nem sikerült.");
      }
      // A szerver-komponensek újrarenderelése hozza az új nézetet.
      router.refresh();
    } catch (e) {
      showToast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  const previewing = current !== "admin";

  return (
    <motion.div
      initial={{ y: 40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.2 }}
      className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-4"
      style={{ pointerEvents: "none" }}
    >
      <div
        className="flex flex-wrap items-center gap-2 rounded-2xl px-3 py-2 shadow-lg"
        style={{
          pointerEvents: "auto",
          background: previewing ? "#7a2e17" : "var(--twx-dark)",
          color: "#fff",
          border: previewing ? "2px solid var(--twx-coral)" : "1px solid rgba(255,255,255,0.12)",
        }}
      >
        <span className="pl-1 text-xs font-medium" style={{ opacity: 0.85 }}>
          {previewing ? "Előnézet — így látja a partner:" : "Nézet:"}
        </span>

        <div className="flex gap-1">
          {OPTIONS.map((o) => {
            const on = o.id === current;
            return (
              <button
                key={o.id}
                type="button"
                disabled={busy}
                onClick={() => void pick(o.id)}
                className="rounded-xl px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50"
                style={on
                  ? { background: "#fff", color: previewing ? "#7a2e17" : "var(--twx-dark)" }
                  : { background: "rgba(255,255,255,0.12)", color: "#fff" }}
              >
                {o.label}
              </button>
            );
          })}
        </div>

        {previewing && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void pick("admin")}
            className="rounded-xl px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
            style={{ background: "var(--twx-coral)", color: "#fff" }}
          >
            Vissza admin nézetbe
          </button>
        )}
      </div>
    </motion.div>
  );
}
