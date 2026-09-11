// Főoldali hero-háttér — LOOP-VIDEÓ a Higgsfieldből (a selyemszalagok lágy
// szellőben, vízcsepp a nyakon), alatta ugyanaz az állókép, amiről a klip indul
// és amire visszaér (public/design/hero-bg.jpg = a klip első és utolsó képkockája).
//
// KÉT VÉDELEM a „látszik, hogy elölről indul" ellen:
//   1) A klipet a MODELL loopolja (start_image = end_image) — utólag nem vágjuk.
//   2) KERESZTÚSZTATÁS a loop-pontnál: két videóréteg fut felváltva. Amikor az
//      aktív réteg a vége előtt CROSS_S másodperccel jár, a másik réteg elindul
//      0-ról, és a kettő lágyan egymásba úszik. Így ha az első és az utolsó
//      képkocka mégis hajszálnyit eltérne, az sem látszik — nincs ugrás.
//
// A korábbi CSS Ken Burns (közelít–távolít) teljesen kikerült, a tartalék állókép
// is mozdulatlan. Ha a videó nem indul (energiatakarékos mód, hiányzó fájl),
// nyugodt állókép marad.
//
// Fájl: public/design/hero-loop.mp4 — beemelés: npm run landing:hero
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ?v= a böngésző-gyorsítótár miatt: ugyanazon a néven cserélt fájlnál növeld.
const VIDEO_VERSION = 1;
const VIDEO_MP4 = `/design/hero-loop.mp4?v=${VIDEO_VERSION}`;
const POSTER = "/design/hero-bg.jpg";
/** A keresztúsztatás hossza másodpercben a loop-pontnál. */
const CROSS_S = 1.2;

const LAYER_STYLE = { filter: "contrast(1.08) saturate(1.05)", objectPosition: "64% 42%" } as const;

export default function HeroVideo() {
  const refA = useRef<HTMLVideoElement>(null);
  const refB = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  // Melyik réteg látszik éppen (a másik készenlétben, 0-nál áll).
  const [active, setActive] = useState<"a" | "b">("a");
  const switching = useRef(false);

  const play = useCallback((v: HTMLVideoElement | null) => {
    if (!v) return;
    const p = v.play();
    if (p && typeof p.catch === "function") p.catch(() => setReady(false));
  }, []);

  // Indítás + háttérből előtérbe kerülve újraindítás.
  useEffect(() => {
    play(refA.current);
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      const cur = active === "a" ? refA.current : refB.current;
      if (cur && cur.paused) play(cur);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [active, play]);

  // A loop-pont figyelése: az aktív réteg vége előtt indul a másik, és átveszi.
  const onTimeUpdate = useCallback((which: "a" | "b") => {
    if (which !== active || switching.current) return;
    const cur = which === "a" ? refA.current : refB.current;
    const next = which === "a" ? refB.current : refA.current;
    if (!cur || !next || !Number.isFinite(cur.duration)) return;
    if (cur.duration - cur.currentTime > CROSS_S) return;
    switching.current = true;
    next.currentTime = 0;
    play(next);
    setActive(which === "a" ? "b" : "a");
    // Amikor a régi réteg teljesen elhalványult, visszaállítjuk 0-ra és megállítjuk,
    // hogy a következő körben tiszta lappal induljon.
    window.setTimeout(() => {
      cur.pause();
      cur.currentTime = 0;
      switching.current = false;
    }, CROSS_S * 1000 + 100);
  }, [active, play]);

  const layer = (which: "a" | "b", ref: React.RefObject<HTMLVideoElement | null>) => (
    <video
      ref={ref}
      className="absolute inset-0 h-full w-full object-cover"
      style={{
        ...LAYER_STYLE,
        opacity: ready && active === which ? 0.72 : 0,
        transition: `opacity ${CROSS_S}s ease-in-out`,
      }}
      muted
      playsInline
      preload="auto"
      poster={POSTER}
      onPlaying={() => setReady(true)}
      onError={() => setReady(false)}
      onTimeUpdate={() => onTimeUpdate(which)}
    >
      <source src={VIDEO_MP4} type="video/mp4" />
    </video>
  );

  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden>
      {/* Állókép — mindig ott van; a videó fölé úszik, ha tud. Szándékosan NINCS
          rajta mozgás: ha a videó nem megy, nyugodt kép marad. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={POSTER}
        alt=""
        decoding="async"
        fetchPriority="high"
        className="h-full w-full object-cover"
        style={{ ...LAYER_STYLE, opacity: ready ? 0 : 0.72, transition: "opacity 1s ease" }}
      />
      {layer("a", refA)}
      {layer("b", refB)}
    </div>
  );
}
