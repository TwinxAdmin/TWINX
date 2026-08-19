// WelcomeHero — a Portál Központ vizuális nyitánya.
//
// Szándékosan RÖVID: köszönés + szlogen + (ha jár) a próbakredit-jelvény, és
// utána rögtön a modul-vitrin. Minden csempén egy RAJZOLT előnézet (a
// hirdetésnél egy valódi minta), a kredit-ár és a várható idő — a habozás oka
// általában az, hogy nem tudja, mit kap és mibe kerül.
"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import ModulePoster from "@/components/dashboard/ModulePoster";
import Wordmark from "@/components/Wordmark";
import { SHOWCASE } from "@/lib/onboarding";

const EASE = [0.22, 1, 0.36, 1] as const;

export default function WelcomeHero({
  firstName,
  balance,
  hasWelcomeCredits,
}: {
  firstName: string;
  balance: number;
  hasWelcomeCredits: boolean; // még nem használt semmit — érdemes kiemelni a próbakreditet
}) {
  return (
    <div className="space-y-6">
      {/* ---------------------------- ÜDVÖZLŐ SÁV ---------------------------- */}
      <motion.section
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: EASE }}
        className="relative overflow-hidden rounded-3xl"
        style={{
          border: "1px solid var(--twx-line)",
          background: "linear-gradient(120deg, var(--twx-cream-card) 52%, rgba(239,122,90,0.12))",
        }}
      >
        <div
          className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full"
          style={{ background: "radial-gradient(circle, rgba(239,122,90,0.22), transparent 70%)" }}
          aria-hidden
        />

        <div className="relative flex flex-wrap items-center justify-between gap-4 p-7 sm:p-9">
          <div className="max-w-xl">
            <h2 className="font-display text-3xl font-semibold sm:text-4xl">
              {firstName ? `Szia ${firstName}!` : "Üdv a TWINX-ben!"}
            </h2>
            <p className="mt-2 text-base" style={{ color: "var(--twx-ink-muted)" }}>
              Egy helyen minden eszköz a gyorsabb, igényesebb mindennapi munkához.
            </p>
          </div>

          {/* Jobb oldal: a wordmark, alatta (ha jár) a próbakredit-jelvény.
              Jobbra zárva, hogy a logó és a jelvény egy tengelyen álljon. */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18, duration: 0.5, ease: EASE }}
            className="flex flex-col items-start gap-3 sm:items-end"
          >
            <Wordmark
              className="font-display text-4xl font-semibold tracking-wide sm:text-5xl"
              style={{ color: "var(--twx-ink)" }}
            />

            {hasWelcomeCredits && (
              <span
                className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold"
                style={{ background: "var(--twx-coral)", color: "#1c1005" }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <rect x="3" y="8" width="18" height="13" rx="2" />
                  <path d="M12 8v13M3 12h18" />
                  <path d="M12 8S9 3 6.5 4.5 8 8 12 8ZM12 8s3-5 5.5-3.5S16 8 12 8Z" />
                </svg>
                {balance} próbakredit
              </span>
            )}
          </motion.div>
        </div>
      </motion.section>

      {/* ---------------------------- MODUL-VITRIN ---------------------------- */}
      <section>
        <h3 className="font-display text-xl font-medium">Próbáld ki</h3>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SHOWCASE.map((m, i) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.08, duration: 0.5, ease: EASE }}
            >
              <Link
                href={m.href}
                className="group flex h-full flex-col overflow-hidden rounded-2xl transition-shadow hover:shadow-lg"
                style={{ border: "1px solid var(--twx-line)", background: "var(--twx-cream-card)" }}
              >
                <div className="relative aspect-[16/9] overflow-hidden" style={{ background: "var(--twx-cream)" }}>
                  {m.sample ? (
                    // A hirdetéskép csempéjén VALÓDI minta, a saját motorunkkal generálva.
                    <Image
                      src={m.sample}
                      alt=""
                      fill
                      sizes="(max-width: 640px) 100vw, 25vw"
                      className="object-cover object-top transition-transform duration-500 group-hover:scale-[1.04]"
                    />
                  ) : (
                    <div className="h-full w-full transition-transform duration-500 group-hover:scale-[1.04]">
                      <ModulePoster kind={m.poster} />
                    </div>
                  )}
                </div>

                <div className="flex flex-1 flex-col p-4">
                  <p className="font-display text-lg font-medium">{m.title}</p>
                  <p className="mt-1 flex-1 text-sm" style={{ color: "var(--twx-ink-muted)" }}>{m.desc}</p>
                  <div className="mt-3 flex items-center gap-2">
                    <span
                      className="rounded-lg px-2 py-1 text-xs font-semibold"
                      style={{ background: "var(--twx-coral-soft)", color: "#7a2e17" }}
                    >
                      {m.credits} kredit
                    </span>
                    <span className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>{m.duration}</span>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
}
