// /ingatlan — „Három lépés, és kész" szekció beépített bemutatóvideója.
// A valódi, 9:16-os TWINX marketingvideó (ráégetett feliratokkal + záró
// ajánlat-kártyával). Némítva, loopolva, autoplay-jel indul (a böngészők a
// hangos autoplay-t blokkolják), a felhasználó a gombbal kapcsol hangot.
//
// VEZÉRLŐK: a telefonkeret ALATT, külön gombsorban — a videón belül
// kitakarták a lent futó, ráégetett feliratokat.
//
// SAFARI: a korábbi telefon-demónál a <video> feketén renderelt, mert
// `backdrop-filter`-es ősök alatt volt. Ez a blokk KÖVETKEZETESEN kerüli a
// backdrop-filtert; a videó `muted` VALÓDI attribútumként (nemcsak React
// prop) kerül ki, `playsInline`-nal, és GPU-kompozit hinttel (translateZ)
// renderel — így Safariban is a képkockát festi, nem fekete táblát.
"use client";

import { useEffect, useRef, useState } from "react";

const MP4 = "/marketing/landing-intro.mp4";
const WEBM = "/marketing/landing-intro.webm";
const POSTER = "/marketing/landing-intro-poster.jpg";

export default function LandingIntroVideo() {
  const ref = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(true);

  // Safari-biztos autoplay: a muted-et valódi attribútumként állítjuk be,
  // majd megpróbáljuk lejátszani; ha a böngésző blokkol, a poszter marad.
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.muted = true;
    v.setAttribute("muted", "");
    v.playsInline = true;
    const p = v.play();
    if (p && typeof p.then === "function") p.catch(() => setPlaying(false));
  }, []);

  function toggleSound() {
    const v = ref.current;
    if (!v) return;
    const next = !muted;
    v.muted = next;
    setMuted(next);
    if (!next && v.paused) {
      v.play().catch(() => {});
      setPlaying(true);
    }
  }

  function togglePlay() {
    const v = ref.current;
    if (!v) return;
    if (v.paused) {
      v.play().catch(() => {});
      setPlaying(true);
    } else {
      v.pause();
      setPlaying(false);
    }
  }

  // Újraindítás az elejéről — a videó a 0. másodpercre ugrik és megy tovább.
  function restart() {
    const v = ref.current;
    if (!v) return;
    v.currentTime = 0;
    v.play().catch(() => {});
    setPlaying(true);
  }

  // Közös gombstílus: sötét „ink" pirula, krém felirat — a világos blokkon
  // kontrasztos, és a sötét telefonkerettel egy nyelvet beszél.
  const btnBase =
    "inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition-all hover:-translate-y-0.5 active:translate-y-0";

  return (
    <div className="mx-auto w-full max-w-[300px]">
      {/* Telefon-keret: tömör, sötét perem, backdrop-filter NÉLKÜL. */}
      <div
        className="relative overflow-hidden rounded-[2rem]"
        style={{
          border: "1px solid rgba(255,255,255,0.14)",
          background: "#0b0a09",
          boxShadow: "0 30px 80px rgba(28,24,21,0.35), 0 0 0 6px rgba(28,24,21,0.9)",
          transform: "translateZ(0)",
        }}
      >
        <video
          ref={ref}
          className="block h-auto w-full cursor-pointer"
          poster={POSTER}
          muted
          loop
          autoPlay
          playsInline
          preload="metadata"
          style={{ aspectRatio: "9 / 16", transform: "translateZ(0)", backgroundColor: "#0b0a09" }}
          onClick={togglePlay}
          aria-label="TWINX bemutatóvideó — kattints a lejátszás/szünet váltásához"
        >
          <source src={WEBM} type="video/webm" />
          <source src={MP4} type="video/mp4" />
        </video>
      </div>

      {/* Vezérlők a keret ALATT — nem takarják a videó feliratait. */}
      <div className="mt-4 flex items-center justify-center gap-2.5">
        {/* Elölről — csak ikon, felirat nélkül */}
        <button
          type="button"
          onClick={restart}
          aria-label="Lejátszás elölről"
          title="Elölről"
          className="flex h-10 w-10 items-center justify-center rounded-full transition-all hover:-translate-y-0.5 active:translate-y-0"
          style={{
            background: "var(--twx-coral-soft)",
            color: "#7a2e17",
            border: "1px solid rgba(239,122,90,0.45)",
            boxShadow: "0 8px 20px rgba(239,122,90,0.20)",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M3 12a9 9 0 1 0 3-6.7" />
            <path d="M3 4v5h5" />
          </svg>
        </button>

        <button
          type="button"
          onClick={togglePlay}
          aria-label={playing ? "Szünet" : "Lejátszás"}
          aria-pressed={!playing}
          className={btnBase}
          style={{
            background: "var(--twx-ink)",
            color: "var(--twx-cream)",
            boxShadow: "0 8px 20px rgba(28,24,21,0.22)",
          }}
        >
          {playing ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <rect x="6" y="5" width="4" height="14" rx="1" />
              <rect x="14" y="5" width="4" height="14" rx="1" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
          {playing ? "Szünet" : "Lejátszás"}
        </button>

        <button
          type="button"
          onClick={toggleSound}
          aria-label={muted ? "Hang bekapcsolása" : "Némítás"}
          aria-pressed={!muted}
          className={btnBase}
          style={
            muted
              ? {
                  background: "var(--twx-cream-card)",
                  color: "var(--twx-ink)",
                  border: "1px solid var(--twx-line)",
                  boxShadow: "0 8px 20px rgba(28,24,21,0.10)",
                }
              : {
                  background: "var(--twx-coral)",
                  color: "#1c1005",
                  boxShadow: "0 8px 20px rgba(239,122,90,0.35)",
                }
          }
        >
          {muted ? (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M11 5 6 9H2v6h4l5 4V5z" />
              <path d="m23 9-6 6M17 9l6 6" />
            </svg>
          ) : (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M11 5 6 9H2v6h4l5 4V5z" />
              <path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a9 9 0 0 1 0 14" />
            </svg>
          )}
          {muted ? "Hang be" : "Hang ki"}
        </button>
      </div>
    </div>
  );
}
