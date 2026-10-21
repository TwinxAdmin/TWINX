// WelcomeHero — a Portál Központ modul-vitrinje („Próbáld ki").
//
// A korábbi köszöntő sávot (köszönés + próbakredit-jelvény) a kreditblokk és az
// inspirációs blokk váltotta (design/portal-vegleges.html); a vitrint a 3. lépésben
// az „Ezzel kezdd" kártyák váltják. Minden csempén egy RAJZOLT előnézet (a
// hirdetésnél egy valódi minta), a kredit-ár és a várható idő — a habozás oka
// általában az, hogy nem tudja, mit kap és mibe kerül.
"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import ModulePoster from "@/components/dashboard/ModulePoster";
import { SHOWCASE } from "@/lib/onboarding";

const EASE = [0.22, 1, 0.36, 1] as const;

export default function WelcomeHero() {
  return (
    <div className="space-y-6">
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
