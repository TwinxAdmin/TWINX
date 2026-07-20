// DateField — saját, elegáns dátumválasztó a TWINX arculatához.
// A natív <input type="date"> helyett: egységes megjelenés minden böngészőben,
// magyar hónap-/napnevekkel, hétfővel kezdődő héttel, min/max korláttal.
// Nincs új függőség — csak React + Framer Motion (ami már használatban van).
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const MONTHS = [
  "január", "február", "március", "április", "május", "június",
  "július", "augusztus", "szeptember", "október", "november", "december",
];
const MONTHS_SHORT = ["jan.", "febr.", "márc.", "ápr.", "máj.", "jún.", "júl.", "aug.", "szept.", "okt.", "nov.", "dec."];
const WEEKDAYS = ["H", "K", "Sze", "Cs", "P", "Szo", "V"]; // hétfővel kezdve

// "YYYY-MM-DD" -> {y,m,d} (UTC-biztos: stringből bontva, nem Date-parse-szal)
function parseISO(s: string): { y: number; m: number; d: number } | null {
  const mm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s ?? "");
  if (!mm) return null;
  return { y: Number(mm[1]), m: Number(mm[2]) - 1, d: Number(mm[3]) };
}
function toISO(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
function todayISO(): string {
  const t = new Date();
  return toISO(t.getFullYear(), t.getMonth(), t.getDate());
}
function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
}
// A hónap első napjának hétindexe (hétfő = 0).
function firstWeekday(y: number, m: number): number {
  return (new Date(Date.UTC(y, m, 1)).getUTCDay() + 6) % 7;
}

export default function DateField({
  value, onChange, min, max, placeholder = "Válassz dátumot", className,
}: {
  value: string;
  onChange: (v: string) => void;
  min?: string;
  max?: string;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const parsed = parseISO(value);
  const [view, setView] = useState(() => {
    const p = parsed ?? parseISO(todayISO())!;
    return { y: p.y, m: p.m };
  });
  const wrapRef = useRef<HTMLDivElement>(null);

  // A nézet kövesse a kívülről érkező értéket (pl. előzményből betöltött időszak).
  useEffect(() => {
    const p = parseISO(value);
    if (p) setView({ y: p.y, m: p.m });
  }, [value]);

  // Kattintás kívülre / Esc → bezárás
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const label = parsed
    ? `${parsed.y}. ${MONTHS_SHORT[parsed.m]} ${parsed.d}.`
    : placeholder;

  const disabled = (iso: string) => (min && iso < min) || (max && iso > max);

  const cells = useMemo(() => {
    const lead = firstWeekday(view.y, view.m);
    const total = daysInMonth(view.y, view.m);
    const out: (number | null)[] = Array(lead).fill(null);
    for (let d = 1; d <= total; d++) out.push(d);
    while (out.length % 7 !== 0) out.push(null);
    return out;
  }, [view]);

  const shift = (delta: number) => {
    setView((v) => {
      const m = v.m + delta;
      return { y: v.y + Math.floor(m / 12), m: ((m % 12) + 12) % 12 };
    });
  };

  const today = todayISO();

  return (
    // Alapértelmezett szélesség, hogy flex-sorban is elférjen a formázott dátum.
    <div ref={wrapRef} className={`relative ${className ?? "w-[156px]"}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="box-border flex h-[38px] w-full items-center justify-between gap-2 rounded-lg border px-3 text-sm transition"
        style={{
          borderColor: open ? "var(--twx-coral)" : "var(--twx-line)",
          background: "var(--twx-cream-card)",
          color: parsed ? "var(--twx-ink)" : "var(--twx-ink-muted)",
        }}
      >
        <span className="truncate">{label}</span>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
          strokeLinecap="round" style={{ color: "var(--twx-coral)", flex: "none" }} aria-hidden>
          <rect x="3" y="5" width="18" height="16" rx="2.5" />
          <path d="M3 10h18M8 3v4M16 3v4" />
        </svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            className="absolute left-0 z-[70] mt-2 w-[268px] rounded-2xl p-3"
            style={{
              background: "var(--twx-cream-card)",
              border: "1px solid var(--twx-line)",
              boxShadow: "0 18px 44px rgba(20,12,8,0.18)",
            }}
          >
            {/* Fejléc: hónapléptetés */}
            <div className="mb-2 flex items-center justify-between">
              <button type="button" onClick={() => shift(-1)}
                className="rounded-lg px-2 py-1 text-lg leading-none transition hover:opacity-70"
                style={{ color: "var(--twx-coral)" }} aria-label="Előző hónap">‹</button>
              <span className="font-display text-sm font-semibold">
                {view.y}. {MONTHS[view.m]}
              </span>
              <button type="button" onClick={() => shift(1)}
                className="rounded-lg px-2 py-1 text-lg leading-none transition hover:opacity-70"
                style={{ color: "var(--twx-coral)" }} aria-label="Következő hónap">›</button>
            </div>

            {/* Napnevek */}
            <div className="mb-1 grid grid-cols-7 gap-0.5">
              {WEEKDAYS.map((w, i) => (
                <div key={w} className="text-center text-[10px] font-medium uppercase tracking-wide"
                  style={{ color: i >= 5 ? "var(--twx-coral)" : "var(--twx-ink-muted)" }}>
                  {w}
                </div>
              ))}
            </div>

            {/* Napok */}
            <div className="grid grid-cols-7 gap-0.5">
              {cells.map((d, i) => {
                if (d === null) return <div key={`e-${i}`} className="h-8" />;
                const iso = toISO(view.y, view.m, d);
                const isSel = iso === value;
                const isToday = iso === today;
                const off = disabled(iso);
                return (
                  <button
                    key={iso}
                    type="button"
                    disabled={!!off}
                    onClick={() => { onChange(iso); setOpen(false); }}
                    className="h-8 rounded-lg text-sm transition disabled:cursor-not-allowed"
                    style={{
                      background: isSel ? "var(--twx-coral)" : "transparent",
                      color: off
                        ? "var(--twx-line)"
                        : isSel
                          ? "#fff"
                          : isToday
                            ? "var(--twx-coral)"
                            : "var(--twx-ink)",
                      fontWeight: isSel || isToday ? 600 : 400,
                      border: isToday && !isSel ? "1px solid var(--twx-coral)" : "1px solid transparent",
                      opacity: off ? 0.5 : 1,
                    }}
                  >
                    {d}
                  </button>
                );
              })}
            </div>

            {/* Lábléc: gyors ugrás a mai napra */}
            <div className="mt-2 flex items-center justify-between border-t pt-2" style={{ borderColor: "var(--twx-line)" }}>
              <button
                type="button"
                onClick={() => {
                  if (disabled(today)) return;
                  onChange(today);
                  setOpen(false);
                }}
                disabled={!!disabled(today)}
                className="text-xs font-medium disabled:opacity-40"
                style={{ color: "var(--twx-coral)" }}
              >
                Ma
              </button>
              <button type="button" onClick={() => setOpen(false)} className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                Bezár
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
