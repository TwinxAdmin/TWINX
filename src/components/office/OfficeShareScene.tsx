// OfficeShareScene — „Így működik a közös tér" animáció az Irodai fiók oldalon (új felület; Márk kérése 2026-11-24).
// A korábbi „Mi az irodai fiók?" hero-animáció (OfficeHandoffScene) utódja, B arculatban és ÁLTALÁNOS, iparág-független
// szövegekkel (nincs ingatlanos példa, nincs kredit, nincs név). Csak a már működő részeket mutatja (D35):
// munka elkészül → megosztás a közös mappában → a kolléga megnyitja → mindenki egy helyen látja.
// Négy ütem ismétlődik (2,8 mp); fix méretek → nincs ugrálás. „Mozgás csökkentése": álló kép (megosztva).
"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import SilkRibbons from "@/components/site/b/SilkRibbons";

const STAGES = [
  { pos: 0, active: [0], chip: "Elkészül a munka", note: "Ajánlat · kész PDF" },
  { pos: 1, active: [0, 1, 2], chip: "Megosztva a közös mappában", note: "A mappa tagjai látják" },
  { pos: 2, active: [2], chip: "A kolléga megnyitja", note: "Nem kell e-mailben küldözgetni" },
  { pos: 1, active: [0, 1, 2], chip: "Mindenki ugyanazt látja", note: "A csapat munkái egy helyen" },
] as const;

const NODES = [
  { label: "Te", sub: "elkészíted", initial: "Te" },
  { label: "Közös mappa", sub: "a csapatnak", initial: "" },
  { label: "Kolléga", sub: "megnyitja", initial: "K" },
];
const LEFT = ["16%", "50%", "84%"];

export default function OfficeShareScene() {
  const reduce = useReducedMotion();
  const [i, setI] = useState(1);
  useEffect(() => {
    if (reduce) return;
    const t = window.setInterval(() => setI((v) => (v + 1) % STAGES.length), 2800);
    return () => window.clearInterval(t);
  }, [reduce]);
  const s = STAGES[reduce ? 1 : i];

  return (
    <section className="b-office-silk rounded-[22px] p-5 text-b-on-dark shadow-b sm:p-7" aria-label="Így működik a közös tér">
      {/* Selymes, petróleum–türkiz háttér (globals.css: .b-office-silk), mint a foglalási sávnál, más színnel. */}
      <SilkRibbons tone="accent" heightClass="h-[160px] sm:h-[200px]" className="opacity-60" />
      <div className="relative mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="mb-1 text-[13px] uppercase tracking-[1.6px] text-[#ffc4b0]">Így működik</p>
          <h2 className="font-display text-[20px] font-bold leading-tight sm:text-[24px]">Megosztod, és a csapat már látja.</h2>
        </div>
        <p className="max-w-[360px] text-sm text-b-on-dark">A napi munkák egy közös helyre kerülnek: nem kell keresgélni, sem e-mailben továbbküldeni.</p>
      </div>

      <div className="relative h-[220px] overflow-hidden rounded-2xl border border-white/10 bg-white/[0.06] backdrop-blur-[2px]" aria-hidden>
        {/* állapot-címke (fix hely) */}
        <div className="absolute left-4 top-3 h-[42px] w-[calc(100%-2rem)]">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={s.chip} initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.3 }}>
              <p className="text-[15px] font-semibold text-b-on-dark">{s.chip}</p>
              <p className="text-xs text-b-on-dark">{s.note}</p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* összekötő vonal */}
        <div className="absolute inset-x-[16%] bottom-[58px] border-t-2 border-dashed border-white/25" />

        {/* szereplők és a mappa */}
        {NODES.map((n, k) => {
          const on = (s.active as readonly number[]).includes(k);
          return (
            <div key={k} className="absolute bottom-[14px] flex -translate-x-1/2 flex-col items-center" style={{ left: LEFT[k] }}>
              <span className={`flex h-11 w-11 items-center justify-center rounded-2xl font-display text-sm font-bold transition-colors duration-500 ${on ? "bg-b-accent text-white" : "bg-white/10 text-b-on-dark ring-1 ring-white/20"}`}>
                {n.initial || (
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M3 7.5A1.5 1.5 0 0 1 4.5 6h4l2 2h9A1.5 1.5 0 0 1 21 9.5v8a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5z" />
                  </svg>
                )}
              </span>
              <span className="mt-1 text-[11px] font-semibold text-b-on-dark">{n.label}</span>
            </div>
          );
        })}

        {/* a vándorló munka-kártya */}
        <motion.div
          className="absolute bottom-[88px] w-[124px] -translate-x-1/2 rounded-xl border border-b-line bg-b-card p-2.5 shadow-b sm:w-[150px]"
          initial={false}
          animate={{ left: ["24%", "50%", "76%"][s.pos] }}
          transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 70, damping: 16 }}
        >
          <p className="text-[12px] font-semibold text-b-ink">Ajánlat</p>
          <div className="mt-1.5 h-[6px] rounded bg-b-surface" />
          <div className="mt-1 h-[6px] w-3/4 rounded bg-b-surface" />
          <span className="mt-2 inline-block rounded-full bg-b-accent px-2 py-[3px] text-[10px] font-semibold text-white">PDF kész</span>
        </motion.div>
      </div>
    </section>
  );
}
