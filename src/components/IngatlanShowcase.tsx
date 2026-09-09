// /ingatlan — „Egy ingatlan, 7 kész anyag": ugyanaz az ingatlan végigmegy a
// hét modulon, és a kimeneteket kártyás, vízszintesen lapozható történetként
// mutatjuk. A fájlok a public/showcase/ mappából jönnek (lásd
// docs/showcase-anyagok.md); ami még hiányzik, az „Minta hamarosan" csempét kap,
// így a blokk a teljes anyag nélkül is működik.
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

/* ----------------------------- Adatok ----------------------------- */

const SHOWCASE = "/showcase";

type Step = {
  key: string;
  no: string;
  title: string;
  lead: string;
  body: React.ReactNode;
};

// A hirdetésszöveg és a szöveg-ellenőrzés mintája: cseréld a valódi kimenetre.
const AD_TEXTS = [
  { ch: "Facebook", text: "Napfényes, 68 m²-es lakás a XIII. kerület csendes utcájában — felújított, azonnal költözhető, erkéllyel. Nézd meg, mielőtt más teszi!" },
  { ch: "Instagram", text: "☀️ 68 m² · 2 szoba · erkély · XIII. ker. Felújítva, azonnal költözhető. Részletek a bióban." },
  { ch: "Google Ads", text: "Eladó lakás XIII. kerület — 68 m², felújított, erkélyes. Kérj időpontot még ma." },
];

const AD_CHECK = {
  score: 84,
  points: [
    { ok: true, t: "Erős nyitó mondat, konkrét méret és állapot" },
    { ok: true, t: "Cselekvésre hívás a végén" },
    { ok: false, t: "Hiányzik: emelet, fűtés típusa, rezsi-információ" },
  ],
};

/* --------------------------- Kis elemek --------------------------- */

function Img({ src, alt, className, fallback }: { src: string; alt: string; className?: string; fallback?: string }) {
  const [s, setS] = useState(src);
  const [missing, setMissing] = useState(false);
  if (missing) {
    return (
      <div className={`flex items-center justify-center text-center text-xs ${className ?? ""}`}
        style={{ background: "var(--twx-cream-card)", color: "var(--twx-ink-muted)", border: "1px dashed var(--twx-line)" }}>
        Minta hamarosan
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={s} alt={alt} className={className} loading="lazy" decoding="async"
    onError={() => { if (fallback && s !== fallback) setS(fallback); else setMissing(true); }} />;
}

// Előtte / utána csúszka — egérrel vagy ujjal húzható.
function BeforeAfter({ before, after, ratio = "4 / 3" }: { before: string; after: string; ratio?: string }) {
  const [pos, setPos] = useState(55);
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef(false);
  const update = useCallback((clientX: number) => {
    const el = ref.current; if (!el) return;
    const r = el.getBoundingClientRect();
    setPos(Math.min(96, Math.max(4, ((clientX - r.left) / r.width) * 100)));
  }, []);
  return (
    <div ref={ref} className="relative w-full select-none overflow-hidden rounded-xl" style={{ aspectRatio: ratio, touchAction: "none" }}
      onPointerDown={(e) => { drag.current = true; update(e.clientX); }}
      onPointerMove={(e) => { if (drag.current) update(e.clientX); }}
      onPointerUp={() => { drag.current = false; }}
      onPointerLeave={() => { drag.current = false; }}>
      <Img src={after} alt="Utána" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 overflow-hidden" style={{ width: `${pos}%` }}>
        <Img src={before} alt="Előtte" className="absolute inset-0 h-full w-full object-cover" />
      </div>
      <div className="absolute inset-y-0" style={{ left: `${pos}%`, width: 2, background: "var(--twx-on-dark)", transform: "translateX(-1px)" }} />
      <div className="absolute top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-xs font-bold shadow-lg"
        style={{ left: `${pos}%`, background: "var(--twx-coral)", color: "#1c1005" }}>⇔</div>
      <span className="absolute left-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: "rgba(28,16,5,0.7)", color: "var(--twx-on-dark)" }}>Előtte</span>
      <span className="absolute right-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: "var(--twx-coral)", color: "#1c1005" }}>Utána</span>
    </div>
  );
}

function VideoCard() {
  const [ok, setOk] = useState(true);
  if (!ok) return <Img src={`${SHOWCASE}/video-poster.jpg`} fallback="/video-samples/aurora-hero.jpg" alt="TWINX videó" className="aspect-video w-full rounded-xl object-cover" />;
  return (
    <video className="aspect-video w-full rounded-xl bg-black object-cover" controls muted playsInline preload="metadata"
      poster={`${SHOWCASE}/video-poster.jpg`} onError={() => setOk(false)}>
      <source src={`${SHOWCASE}/video.mp4`} type="video/mp4" />
    </video>
  );
}

/* ---------------------------- Lépések ---------------------------- */

const STEPS: Step[] = [
  {
    key: "kepjavito", no: "01", title: "Képjavító",
    lead: "A telefonos fotóból rendezett, világos, hirdetésre kész kép — a rendetlenség eltűnik, a színek helyükre kerülnek.",
    body: <BeforeAfter before={`${SHOWCASE}/kepjavito-elotte.jpg`} after={`${SHOWCASE}/kepjavito-utana.jpg`} />,
  },
  {
    key: "latvanyterv", no: "02", title: "Látványtervező",
    lead: "Ugyanaz a szoba felújítva és berendezve — a vevő azt látja, amivé az ingatlan válhat.",
    body: <BeforeAfter before={`${SHOWCASE}/latvanyterv-elotte.jpg`} after={`${SHOWCASE}/latvanyterv-utana.jpg`} />,
  },
  {
    key: "hirdeteskep", no: "03", title: "Hirdetési kép készítő",
    lead: "Story, poszt és négyzetes formátum a saját arculatoddal — posztolásra készen.",
    body: (
      <div className="grid grid-cols-3 items-end gap-3">
        <Img src="/flyer-samples/openhouse-9x16.png" alt="Story 9:16" className="w-full rounded-lg object-cover" />
        <Img src="/flyer-samples/openhouse-4x3.png" alt="Poszt 4:3" className="w-full rounded-lg object-cover" />
        <Img src="/flyer-samples/openhouse-1x1.png" alt="Négyzetes 1:1" className="w-full rounded-lg object-cover" />
      </div>
    ),
  },
  {
    key: "video", no: "04", title: "Videó generálás",
    lead: "Zenés, feliratos ingatlanbemutató videó a fotókból — nyitó adatlappal és záró névjeggyel.",
    body: <VideoCard />,
  },
  {
    key: "ertekbecsles", no: "05", title: "Értékbecslő",
    lead: "Valós piaci adatokra épülő, korrekciókkal levezetett ár — szerkeszthető, PDF-be menthető riport.",
    body: <Img src={`${SHOWCASE}/ertekbecsles.jpg`} alt="TWINX értékbecslés riport" className="mx-auto w-full max-w-[360px] rounded-lg object-cover shadow-md" />,
  },
  {
    key: "hirdetesszoveg", no: "06", title: "Hirdetési szöveg generátor",
    lead: "Csatornára szabott szövegek egy kattintással — Facebook, Instagram és Google Ads.",
    body: (
      <div className="space-y-3">
        {AD_TEXTS.map((a) => (
          <div key={a.ch} className="rounded-xl px-4 py-3" style={{ background: "var(--twx-cream-card)", border: "1px solid var(--twx-line)" }}>
            <p className="text-[11px] font-semibold uppercase" style={{ color: "var(--twx-coral)", letterSpacing: "0.14em" }}>{a.ch}</p>
            <p className="mt-1 text-sm leading-relaxed">{a.text}</p>
          </div>
        ))}
      </div>
    ),
  },
  {
    key: "szovegellenorzes", no: "07", title: "Szöveg ellenőrzés",
    lead: "Pontszám, konkrét hiányok és átfogalmazott, erősebb változat — mielőtt posztolnád.",
    body: (
      <div className="rounded-xl p-5" style={{ background: "var(--twx-cream-card)", border: "1px solid var(--twx-line)" }}>
        <div className="flex items-end gap-3">
          <span className="font-display text-6xl font-semibold leading-none" style={{ color: "var(--twx-coral)" }}>{AD_CHECK.score}</span>
          <span className="pb-1 text-sm" style={{ color: "var(--twx-ink-muted)" }}>/ 100 pont</span>
        </div>
        <ul className="mt-4 space-y-2 text-sm">
          {AD_CHECK.points.map((p) => (
            <li key={p.t} className="flex gap-2">
              <span aria-hidden style={{ color: p.ok ? "#2f9e5f" : "var(--twx-coral)" }}>{p.ok ? "✓" : "!"}</span>
              <span>{p.t}</span>
            </li>
          ))}
        </ul>
      </div>
    ),
  },
];

/* --------------------------- A blokk maga --------------------------- */

// Egyszerre EGY kártya látszik középen; a nyilak, a lépés-gombok, a billentyűk
// (←/→) és a húzás (swipe) léptetnek. A kártya oldalra csúszva cserélődik.
export default function IngatlanShowcase() {
  const [active, setActive] = useState(0);
  const [dir, setDir] = useState(1);

  const go = useCallback((i: number) => {
    const idx = (i + STEPS.length) % STEPS.length;
    setDir(idx > active || (active === STEPS.length - 1 && idx === 0) ? 1 : -1);
    setActive(idx);
  }, [active]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(active + 1);
      if (e.key === "ArrowLeft") go(active - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, go]);

  const s = STEPS[active];

  return (
    <div>
      {/* Lépés-gombok */}
      <div className="mt-8 flex flex-wrap justify-center gap-1.5">
        {STEPS.map((st, i) => (
          <button key={st.key} type="button" onClick={() => go(i)}
            className="rounded-full px-3 py-1.5 text-xs font-semibold transition-colors"
            style={{
              background: i === active ? "var(--twx-coral)" : "var(--twx-cream-card)",
              color: i === active ? "#1c1005" : "var(--twx-ink-muted)",
              border: "1px solid " + (i === active ? "var(--twx-coral)" : "var(--twx-line)"),
            }}>
            {st.no} · {st.title}
          </button>
        ))}
      </div>

      {/* Színpad: egy kártya középen, kétoldalt nyilak */}
      <div className="relative mx-auto mt-6 max-w-[640px]">
        <button type="button" aria-label="Előző" onClick={() => go(active - 1)}
          className="absolute left-0 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-lg shadow-md transition-transform hover:scale-105 sm:-left-16"
          style={{ background: "#fff", border: "1px solid var(--twx-line)" }}>←</button>
        <button type="button" aria-label="Következő" onClick={() => go(active + 1)}
          className="absolute right-0 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-lg shadow-md transition-transform hover:scale-105 sm:-right-16"
          style={{ background: "#fff", border: "1px solid var(--twx-line)" }}>→</button>

        <div className="overflow-hidden px-8 sm:px-0">
          <AnimatePresence mode="wait" initial={false} custom={dir}>
            <motion.article
              key={s.key}
              custom={dir}
              initial={{ opacity: 0, x: 60 * dir }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -60 * dir }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              drag="x" dragConstraints={{ left: 0, right: 0 }} dragElastic={0.15}
              onDragEnd={(_, info) => { if (info.offset.x < -60) go(active + 1); else if (info.offset.x > 60) go(active - 1); }}
              className="rounded-2xl p-5 sm:p-7"
              style={{ background: "#fff", border: "1px solid var(--twx-line)", boxShadow: "0 18px 40px rgba(28,16,5,0.08)" }}
            >
              <div className="flex items-baseline gap-3">
                <span className="font-display text-sm font-semibold" style={{ color: "var(--twx-coral)" }}>{s.no}</span>
                <h3 className="font-display text-xl font-semibold sm:text-2xl">{s.title}</h3>
                <span className="ml-auto text-xs" style={{ color: "var(--twx-ink-muted)" }}>{active + 1} / {STEPS.length}</span>
              </div>
              <p className="mt-2 text-sm leading-relaxed sm:text-base" style={{ color: "var(--twx-ink-muted)" }}>{s.lead}</p>
              <div className="mt-5">{s.body}</div>
            </motion.article>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
