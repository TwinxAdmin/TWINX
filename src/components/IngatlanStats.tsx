// Hook-effekt az /ingatlan landinghez: számok, amelyek felpörögnek, amikor a
// sáv legörgetéskor először láthatóvá válik (IntersectionObserver). A page maga
// server-komponens, ezért ez külön kliens-sziget.
"use client";

import { useEffect, useRef, useState } from "react";

type Stat = { to: number; prefix?: string; suffix?: string; label: string };

const STATS: Stat[] = [
  { to: 7, suffix: "", label: "profi eszköz egy helyen" },
  { to: 2, prefix: "~", suffix: " perc", label: "és kész egy k/hirdetés-anyag" },
  { to: 0, suffix: " Ft", label: "havi díj — csak használat alapon" },
  { to: 10, suffix: "", label: "ajándék kredit az induláshoz" },
];

function CountUp({ stat, run }: { stat: Stat; run: boolean }) {
  const [n, setN] = useState(0);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    if (!run) return;
    const duration = 1100;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      setN(Math.round(stat.to * eased));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [run, stat.to]);

  return (
    <span>
      {stat.prefix ?? ""}
      {n.toLocaleString("hu-HU")}
      {stat.suffix ?? ""}
    </span>
  );
}

export default function IngatlanStats() {
  const [run, setRun] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setRun(true);
          io.disconnect();
        }
      },
      { threshold: 0.35 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className="grid grid-cols-2 gap-6 lg:grid-cols-4">
      {STATS.map((s) => (
        <div key={s.label} className="text-center">
          <div
            className="font-display font-semibold leading-none"
            style={{ fontSize: "clamp(2.2rem, 5vw, 3.2rem)", color: "var(--twx-coral)" }}
          >
            <CountUp stat={s} run={run} />
          </div>
          <p className="mt-2 text-sm leading-snug" style={{ color: "var(--twx-ink-muted)" }}>
            {s.label}
          </p>
        </div>
      ))}
    </div>
  );
}
