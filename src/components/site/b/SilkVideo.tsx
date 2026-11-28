"use client";

// Selymes háttérvideó a sötét sávokba (B arculat, Márk döntése 2026-11-24): a bronz selyemszalagos AI-klip,
// ÁTTŰNÉSES hurokká vágva (a vége 2 mp alatt az elejébe úszik), így a sima `loop` sem ugrik.
//
// Fájlok: public/design/silk-loop.mp4 (1600 px, hang nélkül, ~1,4 MB) + silk-poster.jpg (első képkocka).
// Újravágás a forrásból (13 mp, 1920×1080):
//   ffmpeg -i forras.mov -filter_complex "[0:v]split[a][b];[a]trim=0:2,setpts=PTS-STARTPTS[h];
//     [b]trim=2:13.1667,setpts=PTS-STARTPTS[t];[t][h]xfade=transition=fade:duration=2:offset=9.1667,
//     scale=1600:-2,format=yuv420p[v]" -map "[v]" -an -c:v libx264 -crf 25 -movflags +faststart silk-loop.mp4
//
// Csak díszítés: aria-hidden, nem kattintható, a szülő `relative overflow-hidden` legyen. A kép bal fele fekete,
// oda kerül a szöveg; balról sötét átmenet védi az olvashatóságot. Mobilon és „mozgás csökkentése" beállításnál
// állókép látszik (kevesebb adat, nincs mozgás).
//
// Automatikus indítás (javítás 2026-11-28): a React a `muted` jelzőt nem írja bele a szerveren előállított HTML-be,
// ezért a böngésző hangosnak hitte a videót, és nem engedte magától elindulni (csak kattintásra). Most betöltés után
// kódból némítjuk és indítjuk; ha a böngésző mégis tiltja (pl. energiatakarékos mód), az első érintésre / görgetésre indul.
// Ha a böngésző a néma videót sem engedi (Safari energiatakarékos módban / oldalanként tiltva), a látogató a szép
// állóképet látja: a videó csak akkor jelenik meg, amikor ténylegesen játszik, a Safari lejátszás-ikonja rejtve van.
import { useEffect, useRef, useState } from "react";

const VERSION = 1;
const MP4 = `/design/silk-loop.mp4?v=${VERSION}`;
const POSTER = `/design/silk-poster.jpg?v=${VERSION}`;
const POS = "object-[68%_38%]";

export default function SilkVideo() {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.muted = true;
    v.defaultMuted = true;
    v.setAttribute("muted", "");
    const tryPlay = () => { if (v.paused) void v.play().catch(() => {}); };
    const onGesture = () => { tryPlay(); off(); };
    const off = () => {
      window.removeEventListener("pointerdown", onGesture);
      window.removeEventListener("touchstart", onGesture);
      window.removeEventListener("scroll", onGesture);
      window.removeEventListener("keydown", onGesture);
    };
    const onPlaying = () => setPlaying(true);
    if (!v.paused && v.readyState > 2) setPlaying(true);
    v.addEventListener("playing", onPlaying);
    tryPlay();
    v.addEventListener("canplay", tryPlay);
    const onVis = () => { if (document.visibilityState === "visible") tryPlay(); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pointerdown", onGesture, { passive: true });
    window.addEventListener("touchstart", onGesture, { passive: true });
    window.addEventListener("scroll", onGesture, { passive: true });
    window.addEventListener("keydown", onGesture);
    return () => { v.removeEventListener("playing", onPlaying); v.removeEventListener("canplay", tryPlay); document.removeEventListener("visibilitychange", onVis); off(); };
  }, []);

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={POSTER} alt="" decoding="async" className={`absolute inset-0 h-full w-full object-cover ${POS}`} />
      <video
        ref={ref}
        className={`twx-bg-video absolute inset-0 hidden h-full w-full object-cover transition-opacity duration-700 sm:block motion-reduce:hidden ${playing ? "opacity-100" : "opacity-0"} ${POS}`}
        autoPlay muted loop playsInline preload="auto" poster={POSTER}
      >
        <source src={MP4} type="video/mp4" />
      </video>
      {/* Olvashatóság: balról a sáv színébe olvad; mobilon (ahol a szöveg teljes szélességű) egyenletesebben sötétít. */}
      <div className="absolute inset-0 bg-[linear-gradient(90deg,#1d1712_0%,rgba(29,23,18,0.94)_34%,rgba(29,23,18,0.45)_62%,rgba(29,23,18,0.1)_100%)] max-sm:bg-[rgba(29,23,18,0.78)]" />
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-b-dark to-transparent" />
      <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-b-dark to-transparent" />
    </div>
  );
}

/**
 * Állókép-változat ugyanazzal a sötét átmenettel (a „Mi az egyedi modul?" sávba, Márk kérése 2026-11-25):
 * AI-val generált, a videóhoz illő bronz selyem kép. Fájl: public/design/silk-still.png. CSS-háttérként töltjük,
 * így ha a fájl még nincs a helyén, a sáv egyszerűen sötét marad (nincs törött kép).
 */
export function SilkStill({ src = "/design/silk-still.png?v=1" }: { src?: string }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-cover bg-[position:70%_45%]" style={{ backgroundImage: `url("${src}")` }} />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,#1d1712_0%,rgba(29,23,18,0.92)_34%,rgba(29,23,18,0.4)_62%,rgba(29,23,18,0.08)_100%)] max-sm:bg-[rgba(29,23,18,0.78)]" />
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-b-dark to-transparent" />
      <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-b-dark to-transparent" />
    </div>
  );
}
