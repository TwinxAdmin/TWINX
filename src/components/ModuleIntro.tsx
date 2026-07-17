// ModuleIntro — modul-tetejére kerülő kis hero: ikon-vizuál + cím + „érezd, mit tud"
// szöveg + jellemző-chipek. Egységes akcent, finom belépő + lebegő animáció.
"use client";

import { motion, useReducedMotion } from "framer-motion";
import ModuleIcon from "@/components/ModuleIcon";

type Props = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  icon?: string;
  chips?: string[];
};

export default function ModuleIntro({ eyebrow, title, subtitle, icon, chips }: Props) {
  const reduce = useReducedMotion();
  return (
    <motion.section
      initial={{ opacity: 0, y: reduce ? 0 : 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="relative mb-8 overflow-hidden rounded-3xl"
      style={{
        border: "1px solid var(--twx-line)",
        background: "linear-gradient(120deg, var(--twx-cream-card) 55%, rgba(239,122,90,0.10))",
      }}
    >
      {/* dekor glow */}
      <div
        className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(239,122,90,0.22), transparent 70%)" }}
        aria-hidden
      />
      <div className="relative flex flex-col gap-6 p-7 sm:flex-row sm:items-center sm:justify-between sm:p-9">
        <div className="max-w-xl">
          {eyebrow && (
            <p className="text-xs font-semibold uppercase tracking-[0.22em]" style={{ color: "var(--twx-coral)" }}>
              {eyebrow}
            </p>
          )}
          <h1 className="font-display mt-2 text-3xl font-semibold sm:text-4xl" style={{ color: "var(--twx-ink)" }}>
            {title}
          </h1>
          {subtitle && (
            <p className="mt-3 text-base leading-relaxed" style={{ color: "var(--twx-ink-muted)" }}>
              {subtitle}
            </p>
          )}
          {chips && chips.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {chips.map((c) => (
                <span
                  key={c}
                  className="rounded-full px-3 py-1 text-xs font-medium"
                  style={{ background: "var(--twx-coral-soft)", color: "#7a2e17" }}
                >
                  {c}
                </span>
              ))}
            </div>
          )}
        </div>

        <motion.div
          animate={reduce ? undefined : { y: [0, -8, 0] }}
          transition={reduce ? undefined : { duration: 6, repeat: Infinity, ease: "easeInOut" }}
          className="relative flex h-24 w-24 flex-none items-center justify-center rounded-2xl sm:h-28 sm:w-28"
          style={{
            background: "rgba(239,122,90,0.12)",
            border: "1px solid rgba(239,122,90,0.30)",
            color: "var(--twx-coral)",
            boxShadow: "0 18px 40px rgba(239,122,90,0.14)",
          }}
          aria-hidden
        >
          <ModuleIcon name={icon} size={48} />
        </motion.div>
      </div>
    </motion.section>
  );
}
