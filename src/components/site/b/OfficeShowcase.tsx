// Irodai fiók bemutató a főoldalon (B arculat, Márk kérése 2026-11-24) — a korábbi „példa-modulok" ablak helyén,
// hasonlóan vékony böngészőablakban. Amit mutat (csak a már MŰKÖDŐ részek, D35):
//   • a cégnek fejlesztett modulokat a csapat minden tagja eléri (közös modulpolc),
//   • a modullal készült munka megosztható a közös mappában, a kolléga onnan folytatja.
// A „munka küldése egymásnak" még nincs kész (kezdőlapon „Hamarosan"), ezért itt nem szerepel.
// Szerepek, nem kitalált nevek; nincs szám, nincs ügyfélnév. Fix méretek → nincs ugrálás.
// Mozgás: 4 ütem ismétlődik; „mozgás csökkentése" beállításnál egy álló ütem (megosztva) látszik.
"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

const PEOPLE = [
  { role: "Kolléga", initial: "K" },
  { role: "Vezető", initial: "V" },
  { role: "Kolléga", initial: "K" },
];

const MODULES = ["Ajánlatkészítő", "Ügyfélkérdés-válaszoló"];

// pos: a munka-kártya helye a sávon (0 = bal kolléga, 1 = közös mappa, 2 = jobb kolléga).
const STAGES = [
  { pos: 0, active: [0], chip: "Elkészül a modullal", note: "Ajánlat · PDF kész" },
  { pos: 1, active: [0, 1, 2], chip: "Megosztva a közös mappában", note: "Az egész csapat látja" },
  { pos: 2, active: [2], chip: "A kolléga folytatja", note: "Nem kell elölről kezdeni" },
  { pos: 1, active: [0, 1, 2], chip: "Minden modul, mindenkinek", note: "Egy fiókban, egy helyen" },
] as const;

const LEFT = ["12%", "50%", "88%"];
// A kártya kicsit beljebb áll, mint a kollégák, hogy keskeny (mobil) nézetben se lógjon ki.
const CARD_LEFT = ["22%", "50%", "78%"];

export default function OfficeShowcase() {
  const reduce = useReducedMotion();
  const [i, setI] = useState(1);
  useEffect(() => {
    if (reduce) return;
    const t = window.setInterval(() => setI((v) => (v + 1) % STAGES.length), 2800);
    return () => window.clearInterval(t);
  }, [reduce]);
  const s = STAGES[reduce ? 1 : i];
  const allModules = s.chip.startsWith("Minden modul");

  return (
    // Teljes szélességű, kicsit sötétebb sáv (Márk kérése), benne a cím egy sötét kiemelő dobozban.
    <section className="bg-b-surface" aria-label="Irodai fiók">
    <div className="mx-auto max-w-[1100px] px-4 pb-16 pt-14 sm:px-8 sm:pb-20 sm:pt-16">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-x-10 gap-y-3 rounded-3xl bg-b-dark px-6 py-6 text-b-on-dark shadow-b sm:px-9 sm:py-7">
        <div>
          <p className="mb-2 text-[13px] uppercase tracking-[1.6px] text-b-accent-on-dark">Irodai fiók</p>
          <h2 className="font-display text-[26px] font-bold leading-tight tracking-[-0.5px] sm:text-[32px]">
            Egy cég, egy közös tér.
          </h2>
        </div>
        <p className="max-w-[480px] text-[16px] leading-[1.55] text-b-on-dark-2">
          A cégednek épített modulokat minden kollégád eléri, a velük készült munkát pedig megosztjátok egymással.
          Gyorsabb lesz a napi munka.
        </p>
      </div>

      <div className="overflow-hidden rounded-3xl border border-b-line bg-b-card shadow-b-lg">
        <div className="flex h-[42px] items-center gap-[7px] bg-b-surface px-[18px]" aria-hidden>
          <span className="h-[11px] w-[11px] rounded-full bg-[#d9c9b8]" />
          <span className="h-[11px] w-[11px] rounded-full bg-[#d9c9b8]" />
          <span className="h-[11px] w-[11px] rounded-full bg-[#d9c9b8]" />
          <span className="ml-4 text-xs text-b-ink-2">app.twinx.hu · irodai fiók</span>
        </div>

        <div className="grid grid-cols-1 gap-[18px] bg-b-surface-2 p-5 sm:p-7 md:grid-cols-[minmax(0,310px)_minmax(0,1fr)]" aria-hidden>
          {/* Közös modulpolc — mindenki eléri */}
          <div className="h-[230px] rounded-2xl border border-b-line bg-b-card p-4">
            <p className="mb-1 font-semibold">Közös modulok</p>
            <p className="mb-3.5 text-xs text-b-ink-3">a cégnek fejlesztve</p>
            <ul className="space-y-2.5">
              {MODULES.map((m) => (
                <li key={m} className={`flex h-[52px] items-center justify-between gap-2 rounded-xl border px-3 transition-colors duration-500 ${allModules ? "border-b-accent bg-b-accent-tint" : "border-b-line bg-b-surface-2"}`}>
                  <span className="min-w-0 truncate text-[13px] font-semibold">{m}</span>
                  <span className="flex flex-none -space-x-1.5">
                    {PEOPLE.map((p, k) => (
                      <span key={k} className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-b-card bg-b-surface text-[9px] font-bold text-b-ink-2">{p.initial}</span>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[11px] font-semibold uppercase tracking-[1px] text-b-accent-ink">Mindenki eléri</p>
          </div>

          {/* A munka útja a kollégák között */}
          <div className="relative h-[230px] overflow-hidden rounded-2xl border border-b-line bg-b-card">
            {/* állapot-címke (fix hely) */}
            <div className="absolute left-4 top-4 h-[44px] w-[calc(100%-2rem)]">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div key={s.chip} initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.3 }}>
                  <p className="text-[15px] font-semibold">{s.chip}</p>
                  <p className="text-xs text-b-ink-2">{s.note}</p>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* vezetősáv */}
            <div className="absolute inset-x-[12%] bottom-[46px] border-t-2 border-dashed border-b-line" />

            {/* közös mappa középen */}
            <div className="absolute bottom-[26px] left-1/2 flex h-10 w-10 -translate-x-1/2 items-center justify-center rounded-xl bg-b-surface">
              <svg viewBox="0 0 24 24" className="h-5 w-5 text-b-ink-2" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M3 7.5A1.5 1.5 0 0 1 4.5 6h4l2 2h9A1.5 1.5 0 0 1 21 9.5v8a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5z" />
              </svg>
            </div>
            <p className="absolute bottom-[8px] left-1/2 -translate-x-1/2 text-[10px] font-semibold uppercase tracking-[0.8px] text-b-ink-3">Közös mappa</p>

            {/* kollégák a két szélen */}
            {[0, 2].map((k) => (
              <div key={k} className="absolute bottom-[14px] flex -translate-x-1/2 flex-col items-center" style={{ left: LEFT[k] }}>
                <span className={`flex h-10 w-10 items-center justify-center rounded-full font-display text-sm font-bold transition-colors duration-500 ${(s.active as readonly number[]).includes(k) ? "bg-b-accent text-white" : "bg-b-surface text-b-ink-2"}`}>
                  {PEOPLE[k].initial}
                </span>
                <span className="mt-1 text-[11px] text-b-ink-2">{PEOPLE[k].role}</span>
              </div>
            ))}

            {/* a munka-kártya: a sáv fölött vándorol */}
            <motion.div
              className="absolute bottom-[78px] w-[120px] -translate-x-1/2 sm:w-[138px] rounded-xl border border-b-line bg-b-card p-2.5 shadow-b"
              initial={false}
              animate={{ left: CARD_LEFT[s.pos] }}
              transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 70, damping: 16 }}
            >
              <p className="text-[12px] font-semibold">Ajánlat</p>
              <div className="mt-1.5 h-[6px] rounded bg-b-surface" />
              <div className="mt-1 h-[6px] w-3/4 rounded bg-b-surface" />
              <span className="mt-2 inline-block rounded-full bg-b-accent px-2 py-[3px] text-[10px] font-semibold text-white">PDF kész</span>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
    </section>
  );
}
