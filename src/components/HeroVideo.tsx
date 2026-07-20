// Hero háttér — állókép + CSS Ken Burns (lassú zoom + sodródás).
// Miért nem videó/WebP? A <video autoplay>-t az energiatakarékos mód / „Reduce Motion"
// leállíthatja (kattintásra indulna), az animált WebP-et pedig a böngésző szoftveresen
// dekódolja, ezért gyengébb gépen akadozik. A CSS-transzformáció GPU-n fut: MINDEN gépen
// tökéletesen sima, és minden beállításnál magától indul — kattintás nélkül.
"use client";

export default function HeroVideo() {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/design/hero-bg.jpg"
      alt=""
      aria-hidden
      decoding="async"
      fetchPriority="high"
      className="twx-hero-bg h-full w-full object-cover"
      style={{ opacity: 0.72, filter: "contrast(1.08) saturate(1.05)" }}
    />
  );
}
