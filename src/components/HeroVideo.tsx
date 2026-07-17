// Hero háttérvideó — megbízható auto-indítással.
// A React a `muted`-et néha nem attribútumként teszi ki (Safari emiatt blokkolhatja
// az autoplay-t), ezért ref-en át biztosítjuk, és programozottan is elindítjuk.
"use client";

import { useEffect, useRef } from "react";

export default function HeroVideo() {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.muted = true; // biztos, ami biztos (autoplay feltétele)
    const tryPlay = () => {
      const p = v.play();
      if (p && typeof p.catch === "function") p.catch(() => {});
    };
    tryPlay();
    const t = setTimeout(tryPlay, 350); // Safari néha késve engedi
    return () => clearTimeout(t);
  }, []);

  return (
    <video
      ref={ref}
      autoPlay
      muted
      loop
      playsInline
      preload="auto"
      poster="/design/hero-bg.jpg"
      className="h-full w-full object-cover"
      style={{ opacity: 0.72, filter: "contrast(1.08) saturate(1.05)" }}
    >
      <source src="/design/hero.mp4" type="video/mp4" />
    </video>
  );
}
