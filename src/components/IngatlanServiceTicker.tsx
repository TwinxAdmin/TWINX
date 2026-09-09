// /ingatlan hero — jobb oldali „felugró főcímek": a szolgáltatások fő címei
// váltják egymást a mintakép helyén. Egy cím látszik egyszerre, alulról úszik
// be, felfelé tűnik el; alatta pontok mutatják, hányadik a hétből.
// Nincs doboz: a szöveg közvetlenül a filmes jeleneten áll, jobbra igazítva,
// a hosszabb címek (pl. „Hirdetési szöveg generátor") két sorba törhetnek.
// A címeket a landing APPS listájából kapja, így egy helyen karbantartható.
"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

const INTERVAL_MS = 2600;

type Props = { titles: string[] };

export default function IngatlanServiceTicker({ titles }: Props) {
  const [i, setI] = useState(0);

  useEffect(() => {
    if (titles.length < 2) return;
    const t = setInterval(() => setI((n) => (n + 1) % titles.length), INTERVAL_MS);
    return () => clearInterval(t);
  }, [titles.length]);

  const current = titles[i] ?? "";

  return (
    <div
      className="relative z-10 w-full text-center lg:absolute lg:bottom-24 lg:right-8 lg:w-[min(44vw,620px)] lg:text-right xl:right-14"
      aria-live="polite"
    >
      {/* Kis üveges címke a felirat mögött — a világos jeleneten enélkül
          elveszne a vékony, ritkított szöveg. */}
      <p
        className="inline-block rounded-full px-4 py-2 font-display text-sm font-semibold uppercase"
        style={{
          color: "var(--twx-coral)",
          letterSpacing: "0.22em",
          background: "rgba(20,16,14,0.72)",
          border: "1px solid rgba(239,122,90,0.35)",
          boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
        }}
      >
        Amit a TWINX elkészít neked
      </p>

      {/* Színpad: két sornyi minimum-magasság, hogy a váltás ne mozgassa a
          layoutot, de a hosszú címek se vágódjanak le. mode="wait" miatt
          egyszerre csak egy cím van a DOM-ban, ezért nem kell abszolút pozíció. */}
      <div className="mt-4 flex min-h-[2.4em] items-center justify-center lg:justify-end"
        style={{ fontSize: "clamp(2.4rem, 4.4vw, 4rem)" }}>
        <AnimatePresence mode="wait">
          <motion.span
            key={current}
            initial={{ opacity: 0, y: 30, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -24, filter: "blur(6px)" }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="block font-display font-semibold leading-[1.04]"
            style={{ color: "var(--twx-on-dark)", textShadow: "0 6px 30px rgba(0,0,0,0.6)", textWrap: "balance" }}
          >
            {current}
            <span aria-hidden style={{ color: "var(--twx-coral)" }}>.</span>
          </motion.span>
        </AnimatePresence>
      </div>

      {/* Haladás-pontok: az aktív korall, a többi halvány. */}
      <div className="mt-5 flex items-center justify-center gap-2 lg:justify-end" aria-hidden>
        {titles.map((t, k) => (
          <span
            key={t}
            className="h-2 rounded-full transition-all duration-500"
            style={{
              width: k === i ? 30 : 8,
              background: k === i ? "var(--twx-coral)" : "rgba(244,239,231,0.28)",
            }}
          />
        ))}
      </div>
    </div>
  );
}
