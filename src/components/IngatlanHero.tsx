// /ingatlan hero-háttér — „Filmes hero": sötét, természetes fényű nappali,
// bronz–korall fényhálóval. Asztalon néma, végtelenített loop-videó; mobilon és
// takarékos módban állókép lassú Ken Burns-mozgással (a főoldal bevált mintája).
//
// Fájlok (lásd docs/ingatlan-hero-brief.md):
//   public/ingatlan/hero.mp4         — loop-videó (asztali)
//   public/ingatlan/hero-poster.jpg  — poszter / fallback
//   public/ingatlan/hero-mobile.jpg  — álló mobil-kép (opcionális)
// Amíg ezek nincsenek meg, a főoldal hero-háttere (design/hero-bg.jpg) fut —
// az oldal így a videó nélkül is kész, a fájlok bemásolása után magától vált.
"use client";

import { useEffect, useRef, useState } from "react";

// A ?v= a böngésző-gyorsítótár miatt kell: ugyanazon a néven cserélt fájlt
// különben a régi (cache-elt) példány takarhatja. Új videónál növeld.
const VIDEO_VERSION = 4;
const VIDEO_MP4 = `/ingatlan/hero.mp4?v=${VIDEO_VERSION}`;
const POSTER = "/ingatlan/hero-poster.jpg";
const MOBILE = "/ingatlan/hero-mobile.jpg";
const FALLBACK = "/design/hero-bg.jpg";

export default function IngatlanHero() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [useVideo, setUseVideo] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [poster, setPoster] = useState(POSTER);
  const [mobile, setMobile] = useState(MOBILE);

  // Videó CSAK asztali méreten, és csak ha a látogató nem kérte a mozgás csökkentését.
  // Mobilon nem töltjük le — ott az állókép a helyes (adatforgalom, akkumulátor).
  useEffect(() => {
    const wide = window.matchMedia("(min-width: 1024px)");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const decide = () => setUseVideo(wide.matches && !reduce.matches);
    decide();
    wide.addEventListener("change", decide);
    reduce.addEventListener("change", decide);
    return () => { wide.removeEventListener("change", decide); reduce.removeEventListener("change", decide); };
  }, []);

  // Ha a böngésző mégis megtagadja az autoplay-t (energiatakarékos mód), marad az állókép.
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !useVideo) return;
    let cancelled = false;
    const tryPlay = () => {
      const p = v.play();
      if (p && typeof p.catch === "function") p.catch(() => { if (!cancelled) setVideoReady(false); });
    };
    v.load();
    tryPlay();
    // Ha a lap háttérből előtérbe kerül, a böngésző néha megállítja — indítsuk újra.
    const onVisible = () => { if (document.visibilityState === "visible" && v.paused) tryPlay(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { cancelled = true; document.removeEventListener("visibilitychange", onVisible); };
  }, [useVideo]);

  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden>
      {/* Állókép réteg — mindig ott van; a videó fölé úszik, ha tud. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={poster}
        onError={() => setPoster(FALLBACK)}
        alt=""
        decoding="async"
        fetchPriority="high"
        className={`twx-hero-bg hidden h-full w-full object-cover sm:block ${videoReady ? "opacity-0" : "opacity-100"} transition-opacity duration-700`}
        style={{ objectPosition: "70% 45%" }}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={mobile}
        onError={() => setMobile(poster === FALLBACK ? FALLBACK : POSTER)}
        alt=""
        decoding="async"
        className="twx-hero-bg block h-full w-full object-cover sm:hidden"
        style={{ objectPosition: "60% 30%" }}
      />

      {useVideo && (
        <video
          ref={videoRef}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${videoReady ? "opacity-100" : "opacity-0"}`}
          style={{ objectPosition: "70% 45%" }}
          muted
          loop
          playsInline
          autoPlay
          preload="auto"
          poster={poster}
          onPlaying={() => setVideoReady(true)}
          onPause={() => setVideoReady(false)}
          onError={() => setVideoReady(false)}
        >
          <source src={VIDEO_MP4} type="video/mp4" />
        </video>
      )}

      {/* Sötét maszk a bal harmadon: ide kerül a szöveg és a gomb, ezért itt
          KÖTELEZŐ a kontraszt — a jelenet a jobb oldalon marad látható. */}
      <div className="absolute inset-0"
        style={{ background: "linear-gradient(90deg, rgba(20,16,14,0.92) 0%, rgba(20,16,14,0.82) 32%, rgba(20,16,14,0.45) 58%, rgba(20,16,14,0.25) 100%)" }} />
      {/* Alsó átmenet, hogy a következő szekcióba lágyan folyjon át. */}
      <div className="absolute inset-x-0 bottom-0 h-40"
        style={{ background: "linear-gradient(180deg, transparent, var(--twx-dark))" }} />
      {/* Bronz–korall fényháló: a TWINX melegsége a jeleneten. */}
      <div className="absolute inset-0 mix-blend-soft-light"
        style={{ background: "radial-gradient(90% 70% at 78% 35%, rgba(239,122,90,0.55), transparent 62%), radial-gradient(60% 50% at 20% 85%, rgba(232,201,122,0.35), transparent 60%)" }} />
    </div>
  );
}
