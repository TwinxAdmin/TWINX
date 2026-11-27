// GDN-referencia bemutató a főoldalon (B arculat, Márk döntése 2026-11-24) — a korábbi 3 referencia-kártya helyén.
// Bal oldalt a GDN Mandala Ingatlanirodának fejlesztett modulok (fülek), jobbra egy FIX méretű „színpad":
//   • Látványtervező, Képjavító: valódi előtte–utána kép, húzható csúszkával (magától is lassan pásztáz);
//   • Hirdetés-ellenőrző, Hirdetésszöveg, Értékbecslés, Alaprajzból 3D: rajzolt, animált mini-felület.
// Alatta „Előtte / Most" összevetés — SZÁM NÉLKÜL (terv 11: szám/idézet csak GDN által jóváhagyott adattal).
// Magától lapoz (8 mp; a 3D-fül a teljes animációig), kattintásra / egér fölötte megáll. „Mozgás csökkentése": nincs lapozás, nincs pásztázás.
// Szövegek: src/lib/site-copy.ts (GDN_SHOWCASE).
"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { GDN_SHOWCASE } from "@/lib/site-copy";
import dynamic from "next/dynamic";
import { FLOORPLAN_DEMO_MS } from "@/components/site/b/floorplanDemoTiming";

// Az „Alaprajzból 3D" demó (Three.js) késleltetve, külön darabban töltődik (csak a böngészőben); amíg betölt, a színpad
// helyén ugyanakkora sötét felület áll, így semmi nem ugrik.
const Floorplan3DDemo = dynamic(() => import("@/components/site/b/Floorplan3DDemo"), {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-[radial-gradient(120%_100%_at_70%_0%,#3a2a20,#1d1712_65%)]" />,
});

type Key = (typeof GDN_SHOWCASE.modules)[number]["key"];
const MODS = GDN_SHOWCASE.modules;
const ROTATE_MS = 8000;
/** Egy fül ideje: a 3D-animáció hosszabb, végigfut, mielőtt továbblapoz. */
const durationOf = (k: Key) => (k === "3d" ? FLOORPLAN_DEMO_MS : ROTATE_MS);

export default function GdnShowcase() {
  const reduce = useReducedMotion();
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [touched, setTouched] = useState(false); // kattintás után már nem lapoz magától
  // Csak akkor lapoz, ha a blokk látszik (különben a 3D-animáció — ami ilyenkor áll — „lemaradna" a fülről).
  const rootRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (reduce || paused || touched || !inView) return;
    const t = window.setTimeout(() => setIdx((v) => (v + 1) % MODS.length), durationOf(MODS[idx].key));
    return () => window.clearTimeout(t);
  }, [idx, reduce, paused, touched, inView]);

  // Mobilon (vízszintes fülsor) az aktív fül mindig látszódjon — csak a sort görgetjük, az oldalt nem.
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = listRef.current;
    if (!el || el.scrollWidth <= el.clientWidth) return;
    const btn = el.children[idx] as HTMLElement | undefined;
    if (btn) el.scrollTo({ left: btn.offsetLeft - 16, behavior: reduce ? "auto" : "smooth" });
  }, [idx, reduce]);

  const m = MODS[idx];

  return (
    <div ref={rootRef} className="grid grid-cols-1 gap-5 lg:grid-cols-[280px_minmax(0,1fr)]"
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      {/* Fülek — mobilon vízszintesen görgethető sor, asztalin oszlop. Fix magasság. */}
      <div ref={listRef} role="tablist" aria-label="A GDN-nek fejlesztett modulok"
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0">
        {MODS.map((mod, i) => {
          const on = i === idx;
          return (
            <button key={mod.key} role="tab" aria-selected={on} type="button"
              onClick={() => { setIdx(i); setTouched(true); }}
              className={`relative flex h-[64px] w-[200px] flex-none flex-col justify-center overflow-hidden rounded-2xl border px-4 text-left transition-colors lg:w-full ${on ? "border-b-accent bg-b-card shadow-b" : "border-b-line bg-b-surface-2 hover:bg-b-card"}`}>
              <span className={`text-[15px] font-semibold ${on ? "text-b-ink" : "text-b-ink-2"}`}>{mod.label}</span>
              <span className="truncate text-xs text-b-ink-3">{mod.short}</span>
              {/* lapozás-jelző sáv az aktív fül alján */}
              {on && !reduce && !touched && inView && (
                <motion.span key={`${idx}-${paused}-${inView}`} aria-hidden className="absolute bottom-0 left-0 h-[3px] bg-b-accent"
                  initial={{ width: "0%" }} animate={{ width: paused ? undefined : "100%" }}
                  transition={{ duration: durationOf(mod.key) / 1000, ease: "linear" }} />
              )}
            </button>
          );
        })}
      </div>

      {/* Színpad */}
      <div className="overflow-hidden rounded-3xl border border-b-line bg-b-card shadow-b-lg" role="tabpanel" aria-label={m.label}>
        <div className="relative h-[300px] overflow-hidden bg-b-surface sm:h-[400px]">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={m.key} className="absolute inset-0"
              initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }}>
              <Stage k={m.key} reduce={!!reduce} />
            </motion.div>
          </AnimatePresence>
        </div>
        {/* Előtte / Most — fix magasság, a szöveg nem tolja el a dobozt */}
        <div className="grid grid-cols-1 gap-px bg-b-line sm:grid-cols-2">
          <div className="h-[118px] bg-b-card p-5 sm:h-[128px]">
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[1.2px] text-b-ink-3">Előtte</p>
            <p className="text-[14px] leading-[1.5] text-b-ink-2">{m.before}</p>
          </div>
          <div className="h-[118px] bg-b-accent-tint p-5 sm:h-[128px]">
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[1.2px] text-b-accent-ink">Most, a modullal</p>
            <p className="text-[14px] font-medium leading-[1.5] text-b-ink">{m.now}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stage({ k, reduce }: { k: Key; reduce: boolean }) {
  switch (k) {
    case "latvanyterv":
      return <BeforeAfter before="/showcase/visual-before.jpg" after="/showcase/visual-after.jpg" badge="Koncepcióterv" reduce={reduce} />;
    case "kepjavito":
      return <BeforeAfter before="/showcase/enhance-before.jpg" after="/showcase/enhance-after.jpg" badge="AI-val javított kép" reduce={reduce} />;
    case "ellenorzo": return <AdCheckStage reduce={reduce} />;
    case "szoveg": return <AdTextStage reduce={reduce} />;
    case "ertekbecsles": return <ValuationStage reduce={reduce} />;
    case "3d": return <Floorplan3DDemo reduce={reduce} />;
  }
}

/* ---------- Előtte–utána csúszka (valódi képek) ---------- */
function BeforeAfter({ before, after, badge, reduce }: { before: string; after: string; badge: string; reduce: boolean }) {
  const [pos, setPos] = useState(50);
  const [manual, setManual] = useState(false);
  const raf = useRef(0);
  useEffect(() => {
    if (reduce || manual) return;
    const start = performance.now();
    const tick = (t: number) => {
      setPos(50 + 28 * Math.sin((t - start) / 1400));
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [reduce, manual]);

  return (
    <div className="absolute inset-0 select-none">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={after} alt="Utána" className="absolute inset-0 h-full w-full object-cover" draggable={false} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={before} alt="Előtte" className="absolute inset-0 h-full w-full object-cover" draggable={false}
        style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }} />
      <div aria-hidden className="absolute inset-y-0 w-[2px] bg-white shadow-[0_0_8px_rgba(0,0,0,0.35)]" style={{ left: `${pos}%` }}>
        <span className="absolute left-1/2 top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-xs font-bold text-b-ink shadow-b">⇆</span>
      </div>
      <span className="absolute left-3 top-3 rounded-full bg-b-dark/80 px-2.5 py-1 text-[11px] font-semibold text-white">Előtte</span>
      <span className="absolute right-3 top-3 rounded-full bg-b-accent px-2.5 py-1 text-[11px] font-semibold text-white">{badge}</span>
      <input type="range" min={0} max={100} value={Math.round(pos)} aria-label="Előtte–utána csúszka"
        onChange={(e) => { setManual(true); setPos(Number(e.target.value)); }}
        className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0" />
    </div>
  );
}

/* ---------- Közös keret a rajzolt mini-felületekhez ---------- */
function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(120%_90%_at_80%_0%,#fbe3da,transparent_60%)] p-4 sm:p-8">
      <div className="w-full max-w-[520px] rounded-2xl border border-b-line bg-b-card p-4 shadow-b sm:p-5">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[1.2px] text-b-accent-ink">{title}</p>
        {children}
      </div>
    </div>
  );
}

/** A lépések sorban „felkapcsolnak" (csökkentett mozgásnál mind egyszerre látszik). */
function useSteps(n: number, reduce: boolean, ms = 650) {
  const [s, setS] = useState(reduce ? n : 0);
  useEffect(() => {
    if (reduce) return;
    if (s >= n) return;
    const t = window.setTimeout(() => setS((v) => v + 1), ms);
    return () => window.clearTimeout(t);
  }, [s, n, reduce, ms]);
  return s;
}

function AdCheckStage({ reduce }: { reduce: boolean }) {
  const items = [
    { ok: true, t: "Cím és elhelyezkedés" },
    { ok: true, t: "Alapterület, szobák" },
    { ok: false, t: "Rezsi és fűtés hiányzik" },
    { ok: false, t: "Kevés kép a konyháról" },
  ];
  const s = useSteps(items.length + 2, reduce);
  return (
    <Panel title="Hirdetés-ellenőrző">
      <div className="mb-3 flex h-9 items-center gap-2 rounded-lg bg-b-surface px-3 text-[12px] text-b-ink-3">
        <span className="h-2 w-2 rounded-full bg-b-accent" /> hirdetés linkje bemásolva
      </div>
      <div className="mb-3 h-2 overflow-hidden rounded-full bg-b-surface">
        <motion.div className="h-full rounded-full bg-b-accent" initial={false} animate={{ width: s > 0 ? "68%" : "0%" }} transition={{ duration: reduce ? 0 : 1.2 }} />
      </div>
      <ul className="space-y-1.5">
        {items.map((it, i) => (
          <li key={it.t} className={`flex h-7 items-center gap-2 text-[13px] transition-opacity duration-300 ${s > i ? "opacity-100" : "opacity-0"}`}>
            <span className={`flex h-5 w-5 flex-none items-center justify-center rounded-full text-[11px] font-bold ${it.ok ? "bg-[#e3f1e6] text-[#2f6b3d]" : "bg-b-accent-soft text-b-accent-ink"}`}>{it.ok ? "✓" : "!"}</span>
            {it.t}
          </li>
        ))}
      </ul>
      <p className={`mt-3 text-[12px] font-semibold text-b-accent-ink transition-opacity duration-300 ${s > items.length ? "opacity-100" : "opacity-0"}`}>→ Újraírt hirdetésszöveg kész</p>
    </Panel>
  );
}

function AdTextStage({ reduce }: { reduce: boolean }) {
  const full = "Napfényes, felújított 2 szobás lakás csendes utcában, erkéllyel. Nézd meg személyesen — időpontért írj!";
  const [n, setN] = useState(reduce ? full.length : 0);
  useEffect(() => {
    if (reduce || n >= full.length) return;
    const t = window.setTimeout(() => setN((v) => Math.min(full.length, v + 2)), 28);
    return () => window.clearTimeout(t);
  }, [n, reduce, full.length]);
  return (
    <Panel title="Hirdetésszöveg">
      <div className="mb-3 flex flex-wrap gap-1.5">
        {["2 szoba", "felújított", "erkély", "csendes utca"].map((c) => (
          <span key={c} className="rounded-full bg-b-surface px-2.5 py-1 text-[11px] text-b-ink-2">{c}</span>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {["Facebook", "Google"].map((p, i) => (
          <div key={p} className="h-[118px] rounded-xl border border-b-line bg-b-surface-2 p-3">
            <p className="mb-1 text-[11px] font-semibold text-b-ink-3">{p}</p>
            <p className="text-[12px] leading-[1.45] text-b-ink">{i === 0 ? full.slice(0, n) : full.slice(0, Math.max(0, n - 30))}<span className="text-b-accent">{n < full.length ? "▍" : ""}</span></p>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-b-ink-3">Mintaszöveg — illusztráció.</p>
    </Panel>
  );
}

function ValuationStage({ reduce }: { reduce: boolean }) {
  const s = useSteps(3, reduce, 700);
  return (
    <Panel title="Értékbecslés · egyoldalas PDF">
      <div className="mb-3 grid grid-cols-3 gap-2">
        {["Alapterület", "Állapot", "Környék"].map((t, i) => (
          <div key={t} className={`h-12 rounded-lg bg-b-surface p-2 transition-opacity duration-300 ${s > 0 || i === 0 ? "opacity-100" : "opacity-40"}`}>
            <p className="text-[10px] text-b-ink-3">{t}</p>
            <div className="mt-1.5 h-1.5 w-3/4 rounded bg-b-line" />
          </div>
        ))}
      </div>
      <p className="mb-2 text-[12px] font-semibold">Tájékoztató ársáv</p>
      <div className="relative mb-1 h-3 rounded-full bg-b-surface">
        <motion.div className="absolute inset-y-0 rounded-full bg-[linear-gradient(90deg,#f4b49f,#c8401f)]"
          initial={false} animate={s > 1 ? { left: "28%", right: "22%" } : { left: "50%", right: "50%" }} transition={{ duration: reduce ? 0 : 0.9 }} />
      </div>
      <div className="flex justify-between text-[10px] text-b-ink-3"><span>alsó</span><span>felső</span></div>
      <div className={`mt-3 flex items-center gap-2 transition-opacity duration-300 ${s > 2 ? "opacity-100" : "opacity-0"}`}>
        <span className="rounded-md bg-b-accent px-2 py-1 text-[11px] font-semibold text-white">PDF</span>
        <span className="text-[12px] text-b-ink-2">átadható az eladónak</span>
      </div>
    </Panel>
  );
}
