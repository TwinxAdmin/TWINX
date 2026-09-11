// Modul-forgó — „Nézd meg működés közben". Egy üvegkártya, amiben 4–5
// másodpercenként VALÓDI kimenetek váltják egymást (crossfade). A felirat mindig
// az eredményt nevezi meg, nem a szakmát.
//
// MÉDIA: a fájlok a public/showcase mappából jönnek (lásd lib/landing.ts, ott van
// kommentelve, melyik slotba mi kerül). Amíg egy fájl hiányzik, a kártya egy
// visszafogott helyőrzőt mutat a slot nevével — NEM hamis képet.
"use client";

import { useEffect, useRef, useState } from "react";
import type { ShowcaseSlide } from "@/lib/landing";
import ValuationDemo, { VALUATION_DEMO_MS } from "@/components/landing/ValuationDemo";
import VideoDemo, { VIDEO_DEMO_MS } from "@/components/landing/VideoDemo";

const INTERVAL_MS = 4800;
/** Előtte/utána csúszka: a 7 s-os CSS-ciklus (globals.css twx-ba-clip) 80%-a —
 *  eredeti → feltárás → megállás a kész képen; itt vált a forgó. A ciklus maga
 *  ismétlődik, hogy egérrel megállítva újra nézhető legyen. Együtt jár a CSS-sel. */
const BA_MS = 7000 * 0.8;
/** A dia saját hossza — MINDEN animált dia végigmegy, és csak utána vált a forgó
 *  (aki nem lapoz kézzel, az is a teljes bemutatót látja). */
const slideMs = (s: ShowcaseSlide) => {
  if (s.kind === "demo-valuation") return Math.max(s.durationMs, VALUATION_DEMO_MS);
  if (s.kind === "demo-video") return Math.max(s.durationMs, VIDEO_DEMO_MS);
  if (s.kind === "before-after") return BA_MS;
  return INTERVAL_MS;
};

export default function HeroShowcase({ slides }: { slides: ShowcaseSlide[] }) {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const timer = useRef<number | null>(null);

  // Automatikus váltás — egérrel fölé érve megáll, hogy nyugodtan nézhető legyen.
  // Diánként más a hossz (a jelenetnek végig kell érnie), ezért setTimeout, nem interval.
  useEffect(() => {
    if (paused || slides.length < 2) return;
    timer.current = window.setTimeout(() => setIdx((i) => (i + 1) % slides.length), slideMs(slides[idx]));
    return () => { if (timer.current) window.clearTimeout(timer.current); };
  }, [paused, slides, idx]);

  const go = (i: number) => setIdx((i + slides.length) % slides.length);
  const cur = slides[idx];

  return (
    <div
      className="mx-auto w-full max-w-4xl"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Üvegkártya */}
      <div
        className="relative overflow-hidden rounded-3xl"
        style={{
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.14)",
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          boxShadow: "0 30px 80px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.10)",
        }}
      >
        {/* Média-terület — fix arány, hogy a váltásnál ne ugráljon a magasság */}
        <div className="relative aspect-[16/10] w-full sm:aspect-[16/9]">
          {slides.map((s, i) => (
            <div
              key={s.title}
              className="absolute inset-0 transition-opacity duration-700 ease-out"
              style={{ opacity: i === idx ? 1 : 0, pointerEvents: i === idx ? "auto" : "none" }}
              aria-hidden={i !== idx}
            >
              <Slide slide={s} active={i === idx} />
            </div>
          ))}
        </div>

        {/* Felirat-sáv a kártya alján */}
        {/* Nem törik sorba: a szöveg rugalmas és levágódik, a lapozó mindig jobb szélen marad. */}
        <div className="flex flex-nowrap items-center justify-between gap-4 border-t px-5 py-4" style={{ borderColor: "rgba(255,255,255,0.10)" }}>
          <div className="min-w-0 flex-1">
            <div className="font-display truncate text-base font-semibold sm:text-lg" style={{ color: "var(--twx-on-dark)" }}>
              {cur.title}
            </div>
            <div className="truncate text-xs" style={{ color: "var(--twx-on-dark-muted)" }} title={cur.note}>{cur.note}</div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button type="button" onClick={() => go(idx - 1)} aria-label="Előző" className="flex h-8 w-8 items-center justify-center rounded-full text-lg transition hover:bg-white/10" style={{ color: "var(--twx-on-dark)", border: "1px solid rgba(255,255,255,0.18)" }}>‹</button>
            <div className="flex items-center gap-1.5 px-1" role="tablist" aria-label="Példák">
              {slides.map((s, i) => (
                <button
                  key={s.title}
                  type="button"
                  role="tab"
                  aria-selected={i === idx}
                  aria-label={s.title}
                  onClick={() => go(i)}
                  className="h-1.5 rounded-full transition-all"
                  style={{ width: i === idx ? 22 : 8, background: i === idx ? "var(--twx-coral)" : "rgba(255,255,255,0.28)" }}
                />
              ))}
            </div>
            <button type="button" onClick={() => go(idx + 1)} aria-label="Következő" className="flex h-8 w-8 items-center justify-center rounded-full text-lg transition hover:bg-white/10" style={{ color: "var(--twx-on-dark)", border: "1px solid rgba(255,255,255,0.18)" }}>›</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Egy-egy dia. Mindegyik a saját kimenet-típusát mutatja be; a hiányzó fájl
// helyőrzőre esik vissza (lásd MediaImage).
// ---------------------------------------------------------------------------
function Slide({ slide, active }: { slide: ShowcaseSlide; active: boolean }) {
  if (slide.kind === "demo-valuation") {
    return <ValuationDemo active={active} />;
  }
  if (slide.kind === "demo-video") {
    return <VideoDemo active={active} credits={slide.credits} />;
  }

  if (slide.kind === "before-after") {
    return (
      <div className="relative h-full w-full">
        <MediaImage src={slide.after} alt="Feljavított fotó" slot="előtte/utána — feljavított kép" />
        {/* Az eredeti balról a csúszkáig — induláskor teljesen az eredeti látszik,
            a csúszka a jobb szélről indul és balra húzva tárja fel az eredményt.
            Az animációs osztály csak aktív dián van rajta, így minden körben
            elölről indul. */}
        <div className={`absolute inset-0 overflow-hidden ${active ? "twx-ba-clip" : ""}`} style={{ clipPath: "inset(0 0% 0 0)" }}>
          <MediaImage src={slide.before} alt="Eredeti fotó" slot="előtte/utána — eredeti kép" />
        </div>
        <div className={`pointer-events-none absolute inset-y-0 ${active ? "twx-ba-line" : ""}`} style={{ left: "100%" }}>
          <div className="absolute inset-y-0 -ml-px w-0.5" style={{ background: "rgba(255,255,255,0.95)", boxShadow: "0 0 8px rgba(0,0,0,0.5)" }} />
          <div className="absolute top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full" style={{ background: "#fff", boxShadow: "0 2px 10px rgba(0,0,0,0.35)" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1c1815" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 7-5 5 5 5M15 7l5 5-5 5" /></svg>
          </div>
        </div>
        <Tag left>Eredeti</Tag>
        <Tag>{slide.afterLabel ?? "Feljavítva"}</Tag>
      </div>
    );
  }

  if (slide.kind === "document") {
    return (
      <div className="relative flex h-full w-full items-end justify-center overflow-hidden px-8 pt-8" style={{ background: "radial-gradient(80% 70% at 50% 100%, rgba(239,122,90,0.18), transparent 70%)" }}>
        {/* A lap alulról úszik be, amíg a dia aktív */}
        <div className={`w-[68%] max-w-[420px] overflow-hidden rounded-t-lg ${active ? "twx-doc-rise" : ""}`} style={{ boxShadow: "0 -10px 40px rgba(0,0,0,0.45)", background: "#fff" }}>
          <MediaImage src={slide.src} alt="Egyoldalas riport" slot="egyoldalas riport (A4 PNG)" light />
        </div>
      </div>
    );
  }

  if (slide.kind === "video") {
    return (
      <div className="relative h-full w-full">
        <MediaImage src={slide.poster} alt="Videó" slot="videó poszter" />
        {/* IDE JÖN a néma, 3 mp-es MP4 (slide.src) — amíg nincs, a poszter áll. */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full" style={{ background: "rgba(255,255,255,0.92)", boxShadow: "0 8px 30px rgba(0,0,0,0.4)" }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="#1c1815"><path d="M8 5v14l11-7z" /></svg>
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-full w-full items-center justify-center p-6" style={{ background: "radial-gradient(70% 70% at 50% 50%, rgba(239,122,90,0.14), transparent 70%)" }}>
      <div className="h-full max-h-full overflow-hidden rounded-xl" style={{ boxShadow: "0 18px 50px rgba(0,0,0,0.45)" }}>
        <MediaImage src={slide.src} alt="Kész hirdetéskép" slot="hirdetéskép" contain />
      </div>
    </div>
  );
}

function Tag({ children, left }: { children: React.ReactNode; left?: boolean }) {
  return (
    <span
      className={`pointer-events-none absolute bottom-3 rounded-full px-2.5 py-1 text-[11px] font-semibold ${left ? "left-3" : "right-3"}`}
      style={{ background: "rgba(28,24,21,0.72)", color: "#fff" }}
    >
      {children}
    </span>
  );
}

/**
 * Kép, ami hiányzó fájl esetén helyőrzőt mutat. A helyőrző szándékosan
 * visszafogott: egy halvány keret és a slot neve — így a fejlesztésnél látszik,
 * mi hiányzik, de a látogatónak sem tűnik hibának.
 */
function MediaImage({ src, alt, slot, light, contain }: { src: string; alt: string; slot: string; light?: boolean; contain?: boolean }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div
        className="flex h-full w-full items-center justify-center p-6 text-center text-xs"
        style={{
          background: light ? "#f7f3ec" : "rgba(255,255,255,0.04)",
          color: light ? "var(--twx-ink-muted)" : "var(--twx-on-dark-muted)",
          border: "1px dashed rgba(255,255,255,0.18)",
          minHeight: light ? 260 : undefined,
        }}
      >
        <span>Ide jön: {slot}</span>
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      draggable={false}
      onError={() => setFailed(true)}
      className={`h-full w-full ${contain ? "object-contain" : "object-cover"}`}
    />
  );
}
