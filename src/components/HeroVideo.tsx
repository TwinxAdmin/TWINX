// Hero háttér — HIBRID: sima videó ott, ahol a böngésző engedi az autoplay-t (a legtöbb
// bedugott desktop), és animált WEBP fallback, ahol a videó tiltott (akkumulátoros
// energiatakarékos mód / „Reduce Motion"). Így MINDIG magától indul, és ahol lehet, a
// hardveresen dekódolt videó adja a sima, jó minőségű mozgást.
"use client";

import { useEffect, useRef, useState } from "react";

export default function HeroVideo() {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.muted = true;

    const tryPlay = () => {
      const p = v.play();
      if (p && typeof p.catch === "function") p.catch(() => {});
    };
    tryPlay();
    const t = setTimeout(tryPlay, 350);

    // Ha a videó blokkolva van, felhasználói interakcióra / lapváltásra átveszi a helyet
    // az animált WebP-től (finoman átúszik).
    const kick = () => tryPlay();
    const opts: AddEventListenerOptions = { passive: true };
    window.addEventListener("pointerdown", kick, opts);
    window.addEventListener("scroll", kick, opts);
    const onVis = () => { if (!document.hidden) tryPlay(); };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      clearTimeout(t);
      window.removeEventListener("pointerdown", kick);
      window.removeEventListener("scroll", kick);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return (
    <div className="absolute inset-0" style={{ opacity: 0.72, filter: "contrast(1.08) saturate(1.05)" }}>
      {/* Alap réteg: animált WebP — mindig, magától fut (minden beállításnál). */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/design/hero-fallback.webp"
        alt=""
        aria-hidden
        decoding="async"
        className="absolute inset-0 h-full w-full object-cover"
        style={{ backgroundImage: "url(/design/hero-bg.jpg)", backgroundSize: "cover", backgroundPosition: "center" }}
      />
      {/* Felső réteg: a sima videó — csak akkor látszik, ha ténylegesen elindult. */}
      <video
        ref={ref}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        poster="/design/hero-bg.jpg"
        onPlaying={() => setPlaying(true)}
        className="absolute inset-0 h-full w-full object-cover"
        style={{ opacity: playing ? 1 : 0, transition: "opacity 0.6s ease" }}
      >
        <source src="/design/hero.mp4" type="video/mp4" />
      </video>
    </div>
  );
}
