// OfficeHandoffScene — a „Mi az irodai fiók?" hero animációja: egy munka útja két kolléga között.
// Négy ütem ismétlődik: Anna elkészíti → megosztja az irodai mappába → Péter folytatja → átnézve, kész.
"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const STAGES = [
  { who: 0, chip: "Anna elkészíti", note: "Értékbecslés · Budapest XIII." },
  { who: 1, chip: "Megosztva: „Közös ügyfelek” mappa", note: "A mappa tagjai látják" },
  { who: 2, chip: "Péter folytatja", note: "Szerkesztés · zárolva Péternek" },
  { who: 2, chip: "Átnézve ✓ — 2. verzió", note: "Minden módosítás naplózva" },
] as const;

const PEOPLE = [
  { name: "Anna", role: "Értékesítő", initials: "A" },
  { name: "Péter", role: "Kolléga", initials: "P" },
];

export default function OfficeHandoffScene() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setI((v) => (v + 1) % STAGES.length), 2600);
    return () => window.clearInterval(t);
  }, []);
  const s = STAGES[i];
  // A munka-kártya vízszintes helye: 0 = Annánál, 1 = mappában (középen), 2 = Péternél.
  const x = s.who === 0 ? "0%" : s.who === 1 ? "50%" : "100%";

  return (
    <div className="relative mx-auto w-full max-w-[560px] rounded-3xl p-6 sm:p-8"
      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(244,239,231,0.10)" }}>
      {/* Közös irodai egyenleg sáv */}
      <div className="flex items-center justify-between rounded-2xl px-4 py-3" style={{ background: "rgba(239,122,90,0.10)", border: "1px solid rgba(239,122,90,0.25)" }}>
        <span className="text-xs font-semibold uppercase" style={{ color: "var(--twx-coral)", letterSpacing: "0.14em" }}>Irodai egyenleg</span>
        <span className="font-display text-lg font-semibold" style={{ color: "var(--twx-on-dark)" }}>
          {i < 2 ? "120" : "116"} kredit
        </span>
      </div>

      {/* Szereplők + mappa */}
      <div className="relative mt-8 grid grid-cols-3 items-start gap-2">
        {[PEOPLE[0], null, PEOPLE[1]].map((p, k) => {
          const active = (k === 0 && s.who === 0) || (k === 1 && s.who === 1) || (k === 2 && s.who === 2);
          return (
            <div key={k} className="flex flex-col items-center text-center">
              <motion.span animate={{ scale: active ? 1.08 : 1 }} transition={{ duration: 0.4 }}
                className="flex h-14 w-14 items-center justify-center rounded-2xl font-display text-lg font-semibold"
                style={{
                  background: active ? "var(--twx-coral)" : "rgba(255,255,255,0.07)",
                  color: active ? "#1c1005" : "var(--twx-on-dark)",
                  boxShadow: active ? "0 0 0 6px rgba(239,122,90,0.18)" : "none",
                }}>
                {p ? p.initials : (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
                  </svg>
                )}
              </motion.span>
              <span className="mt-2 text-sm font-semibold" style={{ color: "var(--twx-on-dark)" }}>{p ? p.name : "Irodai mappa"}</span>
              <span className="text-[11px]" style={{ color: "var(--twx-on-dark-muted)" }}>{p ? p.role : "Közös ügyfelek"}</span>
            </div>
          );
        })}
        {/* összekötő vonal */}
        <span aria-hidden className="absolute left-[16%] right-[16%] top-7 -z-0 h-px"
          style={{ background: "linear-gradient(90deg, rgba(239,122,90,0.5), rgba(239,122,90,0.15), rgba(239,122,90,0.5))" }} />
      </div>

      {/* A vándorló munka-kártya */}
      <div className="relative mt-8 h-[92px]">
        <motion.div animate={{ left: x, x: s.who === 0 ? "0%" : s.who === 1 ? "-50%" : "-100%" }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="absolute top-0 w-[200px] rounded-2xl p-3"
          style={{ background: "var(--twx-cream-card)", color: "var(--twx-ink)", boxShadow: "0 14px 34px rgba(0,0,0,0.35)" }}>
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold" style={{ background: "rgba(239,122,90,0.15)", color: "var(--twx-coral)" }}>€</span>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold">Értékbecslés</p>
              <p className="truncate text-[10px]" style={{ color: "var(--twx-ink-muted)" }}>{s.note}</p>
            </div>
          </div>
          <div className="mt-2 space-y-1">
            <span className="block h-1.5 w-full rounded-full" style={{ background: "var(--twx-line)" }} />
            <motion.span className="block h-1.5 rounded-full" animate={{ width: `${40 + i * 18}%` }} transition={{ duration: 0.6 }}
              style={{ background: "var(--twx-coral)" }} />
          </div>
        </motion.div>
      </div>

      {/* Állapot-felirat */}
      <div className="mt-2 flex h-8 items-center justify-center">
        <AnimatePresence mode="wait">
          <motion.span key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.3 }}
            className="rounded-full px-3 py-1 text-xs font-semibold"
            style={{ background: "rgba(255,255,255,0.08)", color: "var(--twx-on-dark)" }}>
            {s.chip}
          </motion.span>
        </AnimatePresence>
      </div>
    </div>
  );
}
