// A gömbös 3D ábra burkolója (terv 30, D72): fix 1:1 arányú doboz, így semmi nem ugrik betöltés közben.
// A Three.js-es rész (GlassOrbs3D) csak a böngészőben, külön darabban, és csak akkor töltődik be, amikor a doboz a
// képernyő közelébe ér (IntersectionObserver, 400 px előre). Ha nincs WebGL, a 7 szó kapszulákban jelenik meg.
// Akadálymentesség: role="img", az aria-label felsorolja a szavakat.
"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { ORB_WORDS } from "@/lib/site-copy";

const GlassOrbs3D = dynamic(() => import("@/components/site/b/GlassOrbs3D"), { ssr: false });

function hasWebGL(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch { return false; }
}

function Capsules() {
  return (
    <div aria-hidden className="absolute inset-0 flex flex-wrap content-center items-center justify-center gap-2.5 p-6">
      {ORB_WORDS.map((w, i) => (
        <span key={w} className={`rounded-full border border-[#8a5233] px-[18px] py-2.5 text-b-on-dark ${i === 0 ? "bg-white/[0.06] font-semibold" : ""}`}>{w}</span>
      ))}
    </div>
  );
}

export default function GlassOrbs({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const [gl, setGl] = useState<boolean | null>(null);
  const onFail = useCallback(() => setGl(false), []);

  useEffect(() => {
    setGl(hasWebGL());
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setNear(true); io.disconnect(); } }, { rootMargin: "400px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} role="img" aria-label={`Üveggömbökből álló ábra a TWINX előnyeivel: ${ORB_WORDS.join(", ")}.`}
      className={`relative aspect-square w-full ${className}`}>
      {gl === false ? <Capsules /> : near && gl ? <GlassOrbs3D onFail={onFail} /> : null}
    </div>
  );
}
