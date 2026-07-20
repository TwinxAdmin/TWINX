// Hero háttér — animált WEBP (nem <video>).
// Miért nem videó? A böngésző/OS (akkumulátoros energiatakarékos mód, „Reduce Motion")
// a <video autoplay>-t leállíthatja, és ezt JS-ből nem lehet gesztus nélkül felülírni.
// Az ANIMÁLT KÉP viszont erre nem vonatkozik: mindig, magától, minden beállításnál fut.
// A .jpg a háttérben áll, amíg a webp betölt — így nincs villanás.
"use client";

export default function HeroVideo() {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/design/hero.webp"
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
