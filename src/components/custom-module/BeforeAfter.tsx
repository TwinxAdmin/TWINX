// ELŐTTE / UTÁNA — egy tipikus feladat (példa: árajánlat-készítés) idősávjai, görgetésre kifutó animációval.
"use client";

import { motion } from "framer-motion";

const BEFORE = [
  { label: "Adatok kikeresése táblázatból", w: 28 },
  { label: "Árak számolása", w: 22 },
  { label: "Dokumentum szerkesztése", w: 30 },
  { label: "Formázás, ellenőrzés", w: 20 },
];

export default function BeforeAfter() {
  return (
    <div className="space-y-6">
      <div>
        <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--twx-ink-muted)" }}>
          <span>Előtte — kézzel</span>
          <span>4 lépés, több program</span>
        </div>
        <div className="flex h-12 w-full overflow-hidden rounded-xl" style={{ background: "var(--twx-line)" }}>
          {BEFORE.map((b, i) => (
            <motion.div key={b.label}
              initial={{ width: 0 }} whileInView={{ width: `${b.w}%` }} viewport={{ once: true }}
              transition={{ duration: 0.7, delay: 0.15 * i, ease: [0.22, 1, 0.36, 1] }}
              className="flex items-center justify-center overflow-hidden whitespace-nowrap px-2 text-[12px] font-bold"
              style={{ background: i % 2 ? "#cdbfae" : "#d9ccbb", color: "#4a4036", borderRight: "2px solid var(--twx-cream)" }}>
              {i + 1}
            </motion.div>
          ))}
        </div>
        {/* Jelmagyarázat — a sávokban csak a sorszám fér el, így kis képernyőn sem vágódik le a szöveg */}
        <ol className="mt-2 grid grid-cols-1 gap-x-4 gap-y-0.5 text-[11px] sm:grid-cols-2" style={{ color: "var(--twx-ink-muted)" }}>
          {BEFORE.map((b, i) => <li key={b.label}><strong style={{ color: "#4a4036" }}>{i + 1}.</strong> {b.label}</li>)}
        </ol>
      </div>
      <div>
        <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--twx-coral)" }}>
          <span>Utána — egyedi modullal</span>
          <span>1 kattintás</span>
        </div>
        <div className="flex h-12 w-full items-center overflow-hidden rounded-xl" style={{ background: "var(--twx-line)" }}>
          <motion.div
            initial={{ width: 0 }} whileInView={{ width: "16%" }} viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="flex h-full items-center justify-center whitespace-nowrap px-3 text-[12px] font-bold"
            style={{ background: "var(--twx-coral)", color: "#1c1005" }}>
            Kész ✓
          </motion.div>
          <motion.span initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 1.5 }}
            className="ml-4 text-sm font-medium" style={{ color: "var(--twx-ink)" }}>
            … a felszabaduló idő a tiéd: ügyfelek, tárgyalás, értékesítés.
          </motion.span>
        </div>
      </div>
      <p className="text-[11px]" style={{ color: "var(--twx-ink-muted)" }}>
        Szemléltető példa. A tényleges megtakarítást az egyeztetéskor, a te folyamatodon mérjük fel.
      </p>
    </div>
  );
}
