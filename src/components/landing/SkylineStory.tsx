// „Ház → jóváhagyás → naptár" történet a „Nézd meg működés közben" blokk két
// szélén (csak xl+ képernyőn, ahol a kártya mellett van hely).
//
// Forgatókönyv (~9 s-os ciklus, mindig elölről):
//   1) ÉPÜL — a bal szélen vonalról vonalra, alulról fölfelé kirajzolódik egy
//      magas ház drótváza (~2,8 s).
//   2) ELFOGAD — a vonalak egyszerre korallra váltanak, felvillanás, pipa-jelvény.
//   3) VONAL — a torony csúcsáról egyetlen gyors fénycsík indul: fölmegy a cím
//      magasságába, a „Nézd meg működés közben" felirat MÖGÖTT átsuhan a jobb
//      oldalra, és leérkezik a naptárhoz.
//   4) NAPTÁR — a jobb szélen megjelenik egy havi naptár, a napok gyorsan,
//      egymás után kipipálódnak, mint az elvégzett feladatok. Közben a ház
//      felhőbe olvad (fölúszik, elmosódik, felhőpamacsok).
//   5) a naptár még áll egy kicsit, majd elhalványul; szünet; újra.
//
// Egy rAF-óra (t ms) hajtja az egészet. A vonal útját pixelben számoljuk a
// szekció mért méretéből, hogy a ház csúcsától pontosan a naptárig érjen.
// Csak akkor fut, amíg a látómezőben van.

"use client";

import { useEffect, useRef, useState } from "react";

// ---- Ház-geometria (viewBox 160 × 380) --------------------------------------
type Line = { d: string; y: number };
const L: Line[] = [];
const add = (d: string, y: number) => L.push({ d, y });
add("M8 352 H152", 352);
for (const x of [40, 60, 80, 100, 120]) add(`M${x} 352 V200`, 352 - 0.1 * (x - 40));
for (let y = 338; y >= 214; y -= 14) add(`M40 ${y} H120`, y);
add("M40 200 H120", 200);
for (const x of [52, 70, 90, 108]) add(`M${x} 200 V90`, 200 - 0.1 * (x - 52));
for (let y = 186; y >= 104; y -= 14) add(`M52 ${y} H108`, y);
add("M52 90 H108", 90);
for (const x of [64, 80, 96]) add(`M${x} 90 V40`, 90 - 0.1 * (x - 64));
for (let y = 76; y >= 48; y -= 14) add(`M64 ${y} H96`, y);
add("M64 40 H96", 40);
add("M80 40 V12", 39);
add("M76 20 H84", 20);
add("M14 352 V290", 351); add("M34 352 V290", 350);
for (let y = 338; y >= 304; y -= 14) add(`M14 ${y} H34`, y);
add("M14 290 H34", 290);
add("M126 352 V270", 351); add("M150 352 V270", 350);
for (let y = 338; y >= 284; y -= 14) add(`M126 ${y} H150`, y);
add("M126 270 H150", 270);
const LINES = [...L].sort((a, b) => b.y - a.y);

/** A ház és a naptár megjelenített szélessége (px) és a széltől mért távolság. */
const ART_W = 150;
const EDGE = "2.5%";
const HOUSE_H = (ART_W / 160) * 380; // ≈356 px
/** A cím függőleges közepe a szekció tetejétől (pt-16 + fél sor). */
const HEADING_Y = 86;

// ---- Időzítés (ms) -----------------------------------------------------------
const BUILD_MS = 2800;
const DRAW_MS = 320;
const STEP = (BUILD_MS - DRAW_MS) / (LINES.length - 1);
const ACCEPT_AT = BUILD_MS + 600;
const LINE_AT = ACCEPT_AT + 500;
const LINE_MS = 1100;
const CAL_AT = LINE_AT + LINE_MS - 150;
const TICK_AT = CAL_AT + 350;
const TICK_STEP = 70;
const DISSOLVE_AT = LINE_AT + 700;
const DISSOLVE_MS = 1700;
const DAYS = 30;
const TICK_END = TICK_AT + DAYS * TICK_STEP;
const CAL_OUT_AT = TICK_END + 1100;
const CAL_OUT_MS = 600;
const CYCLE_MS = CAL_OUT_AT + CAL_OUT_MS + 700;

const BASE = "rgba(244,239,231,0.55)";
const ACCENT = "var(--twx-coral)";
/** Szeptember 2026: hétfővel kezdődő rácsban a 1-je keddre esik → 1 üres cella. */
const FIRST_OFFSET = 1;

const clamp01 = (v: number) => Math.min(Math.max(v, 0), 1);

export default function SkylineStory({ className = "" }: { className?: string }) {
  const [t, setT] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [pathLen, setPathLen] = useState(0);

  // Óra — csak amíg látszik
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    let raf = 0;
    let start = 0;
    const tick = (now: number) => {
      if (!start) start = now;
      setT((now - start) % CYCLE_MS);
      raf = requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { start = 0; raf = requestAnimationFrame(tick); }
      else cancelAnimationFrame(raf);
    });
    io.observe(el);
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => { io.disconnect(); ro.disconnect(); cancelAnimationFrame(raf); };
  }, []);

  // A vonal útja pixelben: ház csúcsa → cím magassága → jobb oldal → naptár teteje
  const edgePx = size.w * 0.025;
  const houseX = edgePx + ART_W / 2;                 // torony közepe
  const houseTop = size.h / 2 - HOUSE_H / 2 + (12 / 380) * HOUSE_H; // antenna csúcsa
  const calX = size.w - edgePx - ART_W / 2;
  const calTop = size.h / 2 - 78;                    // a naptár-kártya teteje
  const d = size.w
    ? `M${houseX} ${houseTop} C${houseX} ${HEADING_Y + 40}, ${houseX + 30} ${HEADING_Y}, ${houseX + 120} ${HEADING_Y} ` +
      `L${calX - 120} ${HEADING_Y} C${calX - 30} ${HEADING_Y}, ${calX} ${HEADING_Y + 40}, ${calX} ${calTop}`
    : "";
  useEffect(() => {
    if (pathRef.current && d) setPathLen(pathRef.current.getTotalLength());
  }, [d]);

  // ---- Állapotok ----
  const accepted = t >= ACCEPT_AT;
  const flash = t >= ACCEPT_AT && t < ACCEPT_AT + 350;
  const lineP = clamp01((t - LINE_AT) / LINE_MS);
  const lineOn = t >= LINE_AT && t < LINE_AT + LINE_MS + 100;
  const dis = clamp01((t - DISSOLVE_AT) / DISSOLVE_MS);
  const ease = 1 - Math.pow(1 - dis, 2);
  const cloud = dis <= 0 ? 0 : Math.sin(dis * Math.PI);
  const gone = t >= DISSOLVE_AT + DISSOLVE_MS;
  const calIn = clamp01((t - CAL_AT) / 350);
  const calOut = clamp01((t - CAL_OUT_AT) / CAL_OUT_MS);
  const calOpacity = t < CAL_AT ? 0 : calIn * (1 - calOut);
  const ticked = t < TICK_AT ? 0 : Math.min(DAYS, Math.floor((t - TICK_AT) / TICK_STEP) + 1);
  const allDone = ticked >= DAYS;

  // A fénycsík: rövid dash + hosszabb, halvány csóva, ugyanazzal a fejjel
  const HEAD = 70, TAIL = 220;
  const headPos = lineP * (pathLen + HEAD);

  return (
    <div ref={rootRef} className={`pointer-events-none absolute inset-0 ${className}`} aria-hidden>
      {/* ===== Fénycsík (a cím mögött — a cím konténere z-ben fölötte van) ===== */}
      {size.w > 0 && (
        <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 ${size.w} ${size.h}`} fill="none">
          <path ref={pathRef} d={d} stroke="none" />
          {lineOn && pathLen > 0 && (
            <>
              <path d={d} stroke="rgba(239,122,90,0.35)" strokeWidth="5" strokeLinecap="round"
                strokeDasharray={`${TAIL} ${pathLen + TAIL}`} strokeDashoffset={TAIL - headPos} style={{ filter: "blur(2px)" }} />
              <path d={d} stroke="rgba(249,201,182,1)" strokeWidth="2" strokeLinecap="round"
                strokeDasharray={`${HEAD} ${pathLen + HEAD}`} strokeDashoffset={HEAD - headPos}
                style={{ filter: "drop-shadow(0 0 6px rgba(239,122,90,0.9))" }} />
            </>
          )}
        </svg>
      )}

      {/* ===== Ház — bal szél ===== */}
      <svg viewBox="0 0 160 380" fill="none" className="absolute top-1/2 -translate-y-1/2" style={{ left: EDGE, width: ART_W }}>
        <defs>
          <filter id="twx-sky-blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="7" /></filter>
        </defs>
        <g filter="url(#twx-sky-blur)" style={{ opacity: cloud * 0.9 }}>
          <ellipse cx="60" cy="150" rx="34" ry="18" fill="rgba(244,239,231,0.55)" />
          <ellipse cx="104" cy="120" rx="30" ry="16" fill="rgba(244,239,231,0.5)" />
          <ellipse cx="82" cy="190" rx="40" ry="20" fill="rgba(244,239,231,0.45)" />
          <ellipse cx="78" cy="70" rx="26" ry="14" fill="rgba(249,201,182,0.4)" />
        </g>
        <g stroke={accepted ? ACCENT : BASE} strokeWidth="1.3" strokeLinecap="round"
          style={{
            opacity: gone ? 0 : 1 - ease,
            transform: `translateY(${-28 * ease}px)`,
            filter: flash
              ? "drop-shadow(0 0 7px rgba(239,122,90,0.95))"
              : `drop-shadow(0 0 ${accepted ? 3 : 0}px rgba(239,122,90,0.6)) blur(${7 * ease}px)`,
            transition: accepted && !gone ? "stroke .25s, filter .35s" : "none",
          }}>
          {LINES.map((l, i) => {
            const p = clamp01((t - i * STEP) / DRAW_MS);
            return <path key={i} d={l.d} pathLength={1} strokeDasharray="1" strokeDashoffset={1 - p} />;
          })}
        </g>
        {/* Pipa-jelvény a csúcsnál */}
        <g style={{
          opacity: accepted ? Math.max(0, 1 - ease * 1.6) : 0,
          transform: `translate(112px, ${22 - 28 * ease}px) scale(${accepted ? 1 : 0.6})`,
          transformOrigin: "0 0",
          transition: "opacity .25s, transform .35s cubic-bezier(.22,1.4,.36,1)",
        }}>
          <circle r="10" fill="var(--twx-coral)" />
          <path d="M-4.5 0.5 L-1.5 3.5 L5 -3.5" stroke="#1c1005" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      </svg>

      {/* ===== Naptár — jobb szél ===== */}
      <div
        className="absolute top-1/2 overflow-hidden rounded-xl"
        style={{
          right: EDGE, width: ART_W,
          background: "rgba(28,24,21,0.9)",
          border: "1px solid rgba(255,255,255,0.14)",
          boxShadow: "0 16px 40px rgba(0,0,0,0.5)",
          opacity: calOpacity,
          transform: `translateY(calc(-50% + ${(1 - calIn) * 14}px)) scale(${0.92 + 0.08 * calIn})`,
          transition: "opacity .2s",
        }}
      >
        <div className="flex items-center justify-between px-2.5 py-1.5" style={{ background: "var(--twx-coral)", color: "#1c1005" }}>
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em]">Szeptember</span>
          <span className="text-[9px] font-semibold tabular-nums">{ticked}/{DAYS}</span>
        </div>
        <div className="grid grid-cols-7 gap-[3px] px-2 pt-1.5 text-center text-[7px] font-semibold" style={{ color: "var(--twx-on-dark-muted)" }}>
          {["H", "K", "Sz", "Cs", "P", "Sz", "V"].map((w, i) => <span key={i}>{w}</span>)}
        </div>
        <div className="grid grid-cols-7 gap-[3px] px-2 pb-2 pt-1">
          {Array.from({ length: FIRST_OFFSET }).map((_, i) => <span key={`e${i}`} />)}
          {Array.from({ length: DAYS }).map((_, i) => {
            const on = i < ticked;
            return (
              <span key={i} className="flex aspect-square items-center justify-center rounded-[4px] text-[8px] tabular-nums"
                style={{
                  background: on ? "var(--twx-coral)" : "rgba(255,255,255,0.06)",
                  color: on ? "#1c1005" : "var(--twx-on-dark-muted)",
                  transform: on ? "scale(1)" : "scale(0.96)",
                  transition: "background .12s, transform .12s",
                }}>
                {on ? (
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5 9-10" /></svg>
                ) : i + 1}
              </span>
            );
          })}
        </div>
        <div className="px-2.5 pb-2 text-center text-[8px] font-semibold"
          style={{ color: "var(--twx-coral)", opacity: allDone ? 1 : 0, transition: "opacity .3s" }}>
          ✓ Minden feladat kész
        </div>
      </div>
    </div>
  );
}
