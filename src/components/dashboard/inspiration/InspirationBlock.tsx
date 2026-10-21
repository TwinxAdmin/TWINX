// Inspirációs blokk — a Portálközpont 2. blokkja (design/portal-vegleges.html).
// Fix méretű sötét doboz, benne váltakozó diák: 7 mp-enként lapoz, a pöttyökkel kézzel is,
// telefonon ujjal húzva is. Egérrel fölé állva / billentyűvel benne állva megáll;
// csökkentett mozgásnál nem lapoz magától. A diák tartalmát a hívó adja (slides.tsx).
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const INTERVAL_MS = 7000;

export type InspirationSlide = { key: string; label: string; node: React.ReactNode };

export default function InspirationBlock({
  slides,
  footer,
}: {
  slides: InspirationSlide[];
  footer?: React.ReactNode; // bal lent (pl. megtakarítás-számláló)
}) {
  const [index, setIndex] = useState(0);
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  const [reduced, setReduced] = useState(false);
  const touchX = useRef<number | null>(null);
  const count = slides.length;
  const paused = hover || focus || reduced;

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const go = useCallback((k: number) => setIndex(((k % count) + count) % count), [count]);

  // Automatikus lapozás. A szünet csak megállítja az időzítőt; utána az aktuális diától indul újra.
  // (A pötty haladás-csíkja ugyanígy áll meg — lásd .twx-insp[data-paused] a globals.css-ben.)
  useEffect(() => {
    if (paused || count < 2) return;
    const t = window.setTimeout(() => go(index + 1), INTERVAL_MS);
    return () => window.clearTimeout(t);
  }, [index, paused, count, go]);

  if (count === 0) return null;

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Mire képes a TWINX"
      className="twx-insp"
      data-paused={paused}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setFocus(true)}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocus(false); }}
      onTouchStart={(e) => { touchX.current = e.touches[0]?.clientX ?? null; }}
      onTouchEnd={(e) => {
        const start = touchX.current;
        touchX.current = null;
        const end = e.changedTouches[0]?.clientX;
        if (start == null || end == null || Math.abs(end - start) < 40) return;
        go(end < start ? index + 1 : index - 1);
      }}
    >
      <span className="twx-insp-glow" aria-hidden />

      {slides.map((s, k) => (
        <div key={s.key} className="twx-insp-slide" data-on={k === index}
          role="group" aria-roledescription="dia" aria-label={`${k + 1} / ${count}: ${s.label}`}
          aria-hidden={k !== index} inert={k !== index}>
          {s.node}
        </div>
      ))}

      {/* Alsó sáv: bal oldalt a lábléc (ha van), jobb oldalt a pöttyök */}
      <div className="absolute inset-x-[18px] bottom-3 z-10 flex items-center justify-between gap-3 sm:inset-x-10 sm:bottom-4">
        <div className="min-w-0 text-[12.5px]" style={{ color: "var(--twx-on-dark-muted)" }}>{footer}</div>
        {count > 1 && (
          <div className="flex flex-none gap-2">
            {slides.map((s, k) => (
              <button key={s.key} type="button" onClick={() => go(k)} aria-label={`${k + 1}. dia: ${s.label}`}
                aria-current={k === index} className="twx-insp-dot" data-on={k === index} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
