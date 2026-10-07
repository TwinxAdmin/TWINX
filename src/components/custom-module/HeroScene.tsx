"use client";

// HERO-JELENET: a nagy HeroFlow-ábra (adatok → egyedi modul → kész anyagok);
// a jobb oldalán egymás alatt ikon-buborékok (szöveg nélkül) a vállalkozásról és a munkaidő gyorsításáról.
// Alatta váltakozva egy-egy kulcsszó; a hozzá tartozó buborék „megnyomódik” és kiemelődik.
import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import HeroFlow from "@/components/custom-module/HeroFlow";

const C = "#ef7a5a";
const T = "#f4efe7";

/* ---------- Mini-ikonok (28×28, SMIL) ---------- */
function Stopwatch() {
  return (
    <svg viewBox="0 0 28 28" className="h-7 w-7" aria-hidden>
      <rect x="11.5" y="2" width="5" height="3" rx="1" fill={C} />
      <circle cx="14" cy="16" r="9.5" fill="none" stroke={T} strokeOpacity="0.85" strokeWidth="2" />
      <path d="M14 16 L14 9.5" stroke={C} strokeWidth="2" strokeLinecap="round">
        <animateTransform attributeName="transform" type="rotate" from="0 14 16" to="360 14 16" dur="2.6s" repeatCount="indefinite" />
      </path>
      <circle cx="14" cy="16" r="1.6" fill={T} />
    </svg>
  );
}
function GrowthBars() {
  const bars = [
    { x: 4, v: "6;9;6", dur: "2.2s" },
    { x: 11, v: "9;14;9", dur: "2.2s" },
    { x: 18, v: "13;20;13", dur: "2.2s" },
  ];
  return (
    <svg viewBox="0 0 28 28" className="h-7 w-7" aria-hidden>
      {bars.map((b, i) => (
        <rect key={i} x={b.x} width="6" rx="1.5" fill={i === 2 ? C : T} fillOpacity={i === 2 ? 1 : 0.55}>
          <animate attributeName="height" values={b.v} dur={b.dur} begin={`${i * 0.25}s`} repeatCount="indefinite" />
          <animate attributeName="y" values={b.v.split(";").map((h) => String(25 - Number(h))).join(";")} dur={b.dur} begin={`${i * 0.25}s`} repeatCount="indefinite" />
        </rect>
      ))}
      <path d="M3 13 L11 8 L16 10 L25 3" fill="none" stroke={C} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="30" strokeDashoffset="30">
        <animate attributeName="stroke-dashoffset" values="30;0;0;30" keyTimes="0;0.4;0.85;1" dur="3s" repeatCount="indefinite" />
      </path>
    </svg>
  );
}
function Bolt() {
  return (
    <svg viewBox="0 0 28 28" className="h-7 w-7" aria-hidden>
      <circle cx="14" cy="14" r="11" fill={C} fillOpacity="0.15">
        <animate attributeName="r" values="8;12.5;8" dur="1.6s" repeatCount="indefinite" />
        <animate attributeName="fill-opacity" values="0.3;0.05;0.3" dur="1.6s" repeatCount="indefinite" />
      </circle>
      <path d="M15.5 3.5 L7 15.5 h6 l-1.5 9 L21 12.5 h-6 z" fill={C}>
        <animate attributeName="opacity" values="1;0.55;1" dur="1.6s" repeatCount="indefinite" />
      </path>
    </svg>
  );
}
function CalendarCheck() {
  return (
    <svg viewBox="0 0 28 28" className="h-7 w-7" aria-hidden>
      <rect x="3.5" y="5.5" width="21" height="19" rx="3" fill="none" stroke={T} strokeOpacity="0.85" strokeWidth="1.8" />
      <rect x="3.5" y="5.5" width="21" height="5" rx="2" fill={C} />
      <path d="M9 3 v4 M19 3 v4" stroke={T} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M9.5 17 l3 3 l6 -6" fill="none" stroke={C} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="14" strokeDashoffset="14">
        <animate attributeName="stroke-dashoffset" values="14;0;0;14" keyTimes="0;0.35;0.85;1" dur="2.8s" repeatCount="indefinite" />
      </path>
    </svg>
  );
}
function Briefcase() {
  return (
    <svg viewBox="0 0 28 28" className="h-7 w-7" aria-hidden>
      <path d="M10.5 8 V6 a1.5 1.5 0 0 1 1.5 -1.5 h4 A1.5 1.5 0 0 1 17.5 6 V8" fill="none" stroke={T} strokeWidth="1.8" />
      <rect x="3.5" y="8" width="21" height="15" rx="3" fill="none" stroke={T} strokeOpacity="0.85" strokeWidth="1.8" />
      <path d="M3.5 14 h21" stroke={T} strokeOpacity="0.5" strokeWidth="1.4" />
      <rect x="12" y="12.5" width="4" height="3.5" rx="1" fill={C} />
      <path d="M23 2.5 l0.9 2.1 l2.1 0.9 l-2.1 0.9 l-0.9 2.1 l-0.9 -2.1 l-2.1 -0.9 l2.1 -0.9 z" fill={C}>
        <animateTransform attributeName="transform" type="scale" values="0.6;1.15;0.6" dur="2s" repeatCount="indefinite" additive="sum" />
        <animate attributeName="opacity" values="0.4;1;0.4" dur="2s" repeatCount="indefinite" />
      </path>
    </svg>
  );
}
function ClientsUp() {
  return (
    <svg viewBox="0 0 28 28" className="h-7 w-7" aria-hidden>
      <circle cx="10" cy="10" r="4" fill="none" stroke={T} strokeOpacity="0.85" strokeWidth="1.8" />
      <path d="M3 23 a7 7 0 0 1 14 0" fill="none" stroke={T} strokeOpacity="0.85" strokeWidth="1.8" strokeLinecap="round" />
      <g>
        <animateTransform attributeName="transform" type="translate" values="0 2;0 -2;0 2" dur="1.8s" repeatCount="indefinite" />
        <circle cx="21" cy="11" r="5.5" fill={C} />
        <path d="M21 8.5 v5 M18.5 11 h5" stroke="#1c1005" strokeWidth="1.8" strokeLinecap="round" />
      </g>
    </svg>
  );
}

/* ---------- Kulcsszavak (máshol is felhasználjuk) ---------- */
// A hero-ban a nagy ábra alatt váltakozva jönnek elő; máshol is felhasználhatók
// (pl. előny-sáv, landing, hirdetés).
export const HERO_KEYWORDS = {
  timeSaved: { title: "−10 óra / hét", sub: "kézi munka helyett" },
  instant: { title: "Másodpercek alatt", sub: "kész anyag, 1 kattintás" },
  efficiency: { title: "Hatékonyság ↑", sub: "több munka, ugyanannyi idő" },
  tailored: { title: "A te vállalkozásodra szabva", sub: "a saját igényeidhez készül" },
  autoReport: { title: "Heti riport", sub: "magától elkészül" },
  clientTime: { title: "Több idő az ügyfélre", sub: "kevesebb adminisztráció" },
} as const;

/* ---------- Ikon-buborékok + váltakozó kulcsszó ---------- */
// A buborékok állnak; csak a mini-ikonok animálnak. Egyszerre EGY kulcsszó látszik a nagy ábra alatt;
// amikor előjön, a hozzá tartozó buborék „megnyomódik” (kis benyomódás + gyűrű), és élesebb lesz,
// a többi kicsit halványabb/lágyabb. A buborékra kattintva is előhívható a kulcsszó.
type Bubble = { icon: ReactNode; k: keyof typeof HERO_KEYWORDS };

const BUBBLES: Bubble[] = [
  { icon: <Stopwatch />, k: "timeSaved" },
  { icon: <Bolt />, k: "instant" },
  { icon: <GrowthBars />, k: "efficiency" },
  { icon: <Briefcase />, k: "tailored" },
  { icon: <CalendarCheck />, k: "autoReport" },
  { icon: <ClientsUp />, k: "clientTime" },
];
const STEP_MS = 3200;

function IconBubble({ b, active, tick, onPick }: { b: Bubble; active: boolean; tick: number; onPick: () => void }) {
  const kwd = HERO_KEYWORDS[b.k];
  return (
    <motion.button type="button" onClick={onPick} aria-label={`${kwd.title} — ${kwd.sub}`} aria-pressed={active}
      className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-[#ef7a5a] md:h-12 md:w-12 xl:h-14 xl:w-14 [&>svg]:h-7 [&>svg]:w-7 md:[&>svg]:h-8 md:[&>svg]:w-8 xl:[&>svg]:h-9 xl:[&>svg]:w-9"
      style={{
        background: active ? "rgba(239,122,90,0.16)" : "rgba(28,24,21,0.88)",
        border: `1px solid ${active ? "rgba(239,122,90,0.95)" : "rgba(239,122,90,0.25)"}`,
        boxShadow: active ? "0 10px 30px rgba(0,0,0,0.35), 0 0 26px rgba(239,122,90,0.45)" : "0 10px 30px rgba(0,0,0,0.30)",
        transition: "background .35s, border-color .35s, box-shadow .35s",
      }}
      animate={active
        ? { scale: [1, 0.86, 1.08, 1], opacity: 1, filter: "blur(0px) saturate(1.15)" }
        : { scale: 1, opacity: 0.5, filter: "blur(0.7px) saturate(0.6)" }}
      transition={{ duration: active ? 0.55 : 0.35, ease: "easeOut" }}>
      {b.icon}
      {active && (
        <motion.span key={tick} aria-hidden className="pointer-events-none absolute inset-0 rounded-2xl"
          style={{ border: "2px solid #ef7a5a" }}
          initial={{ scale: 1, opacity: 0.85 }} animate={{ scale: 1.5, opacity: 0 }} transition={{ duration: 0.7, ease: "easeOut" }} />
      )}
    </motion.button>
  );
}

export default function HeroScene() {
  const [active, setActive] = useState(0);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => { setActive((a) => (a + 1) % BUBBLES.length); setTick((n) => n + 1); }, STEP_MS);
    return () => clearTimeout(t);
  }, [tick]);
  const pick = (i: number) => { setActive(i); setTick((n) => n + 1); };
  const cur = HERO_KEYWORDS[BUBBLES[active].k];

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
      <div className="rounded-3xl p-2 sm:p-3 md:col-start-1 md:row-start-1" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(244,239,231,0.10)" }}>
        <HeroFlow />
      </div>

      {/* Váltakozó kulcsszó a nagy ábra alatt — mindig csak egy látszik */}
      <div className="relative flex min-h-[4.25rem] items-center justify-center overflow-hidden text-center md:col-start-1 md:row-start-2">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={active}
            initial={{ opacity: 0, y: 14, filter: "blur(4px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -10, filter: "blur(4px)" }} transition={{ duration: 0.4, ease: "easeOut" }}>
            <p className="font-display text-xl font-semibold sm:text-2xl" style={{ color: T }}>{cur.title}</p>
            <p className="mt-0.5 text-sm sm:text-base" style={{ color: C }}>{cur.sub}</p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Asztali: jobb oldalt egymás alatt; mobilon a kulcsszó alatt egy sorban */}
      <div className="flex flex-wrap justify-center gap-2.5 md:col-start-2 md:row-start-1 md:flex-col md:flex-nowrap">
        {BUBBLES.map((b, i) => <IconBubble key={b.k} b={b} active={i === active} tick={tick} onPick={() => pick(i)} />)}
      </div>
    </div>
  );
}
