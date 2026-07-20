// Hero háttér — animált WEBP (nem <video>).
// A <video autoplay>-t az energiatakarékos mód / „Reduce Motion" leállíthatja, és JS-ből
// gesztus nélkül nem indítható — ezért NEM videót használunk. Az animált kép mindig,
// magától, minden böngészőben és beállításnál fut. 25 fps a sima mozgásért.
// A .jpg a háttérben áll, amíg a webp betölt (nincs villanás).
"use client";

export default function HeroVideo() {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/design/hero-fallback.webp"
      alt=""
      aria-hidden
      decoding="async"
      fetchPriority="high"
      className="h-full w-full object-cover"
      style={{
        opacity: 0.72,
        filter: "contrast(1.08) saturate(1.05)",
        backgroundImage: "url(/design/hero-bg.jpg)",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    />
  );
}
