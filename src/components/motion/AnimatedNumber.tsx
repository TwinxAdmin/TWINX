// AnimatedNumber — felpörgő számláló + villanás változáskor (kredit-egyenleghez).
// Az animáció MINDIG fut — a reduced-motion beállítást szándékosan nem figyeljük.
"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  value: number;
  className?: string;
  duration?: number; // ms
  animateOnMount?: boolean; // betöltéskor 0-ról pörögjön fel
};

export default function AnimatedNumber({ value, className, duration = 800, animateOnMount = false }: Props) {
  const [display, setDisplay] = useState(animateOnMount ? 0 : value);
  const [flash, setFlash] = useState<null | "up" | "down">(null);
  const prev = useRef(animateOnMount ? 0 : value);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    const from = prev.current;
    const to = value;
    if (from === to) return;

    setFlash(to > from ? "up" : "down");
    const flashTimer = setTimeout(() => setFlash(null), 700);

    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      setDisplay(Math.round(from + (to - from) * eased));
      if (p < 1) raf.current = requestAnimationFrame(tick);
      else prev.current = to;
    };
    raf.current = requestAnimationFrame(tick);

    return () => {
      clearTimeout(flashTimer);
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [value, duration]);

  return (
    <span
      className={className}
      style={{
        display: "inline-block",
        transition: "color .3s ease, transform .3s ease",
        color: flash === "up" ? "var(--twx-coral)" : undefined,
        transform: flash ? "scale(1.14)" : "scale(1)",
      }}
    >
      {display.toLocaleString("hu-HU")}
    </span>
  );
}
