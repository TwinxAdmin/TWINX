// „Kinek?" — iparág-fülek a főoldalon. Az Ingatlan, a Vendéglátás és a Minden
// vállalkozás EGYENRANGÚ fül; a negyedik („Hamarosan") halványabb, és csak azt
// mondja, hogy a kínálat bővül. A modul-kártyák EREDMÉNY-nyelvű címet viselnek.
"use client";

import { useState } from "react";
import type { AudienceKey, LandingModule } from "@/lib/landing";

export type Audience = { key: AudienceKey; label: string; blurb: string; modules: LandingModule[]; muted?: boolean };

export default function AudienceTabs({ audiences }: { audiences: Audience[] }) {
  const [active, setActive] = useState<AudienceKey>(audiences[0]?.key ?? "ingatlan");
  const cur = audiences.find((a) => a.key === active) ?? audiences[0];

  return (
    <div>
      {/* Fülek */}
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Kinek szól">
        {audiences.map((a) => {
          const on = a.key === active;
          return (
            <button
              key={a.key}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setActive(a.key)}
              className="rounded-full px-4 py-2 text-sm font-semibold transition"
              style={
                on
                  ? { background: "var(--twx-ink)", color: "var(--twx-cream)" }
                  : a.muted
                    ? { background: "transparent", color: "var(--twx-ink-muted)", border: "1px dashed var(--twx-line)" }
                    : { background: "var(--twx-cream-card)", color: "var(--twx-ink)", border: "1px solid var(--twx-line)" }
              }
            >
              {a.label}
            </button>
          );
        })}
      </div>

      <p className="mt-5 max-w-2xl text-base" style={{ color: "var(--twx-ink-muted)" }}>{cur.blurb}</p>

      {/* Kártyák */}
      {cur.modules.length > 0 ? (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cur.modules.map((m) => (
            <ModuleCard key={m.title} m={m} />
          ))}
        </div>
      ) : (
        <div className="mt-8 rounded-2xl p-8 text-center" style={{ border: "1px dashed var(--twx-line)", color: "var(--twx-ink-muted)" }}>
          <p className="text-sm">Ugyanaz a három lépés — új szakmákra. Az Ötletládában megírhatod, mire lenne szükséged.</p>
        </div>
      )}
    </div>
  );
}

function ModuleCard({ m }: { m: LandingModule }) {
  return (
    <article
      className="flex h-full flex-col overflow-hidden rounded-2xl transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgba(28,24,21,0.10)]"
      style={{ background: "var(--twx-cream-card)", border: "1px solid var(--twx-line)", opacity: m.soon ? 0.82 : 1 }}
    >
      {/* Eredmény-kép — ha nincs, halvány, ikon nélküli sáv (nem hamis kép). */}
      <div className="relative aspect-[16/9] w-full overflow-hidden" style={{ background: "linear-gradient(135deg, var(--twx-coral-soft), var(--twx-cream))" }}>
        {m.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={m.image} alt="" className="h-full w-full object-cover" loading="lazy" />
        )}
        {m.soon && (
          <span className="absolute left-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: "var(--twx-ink)", color: "var(--twx-cream)" }}>
            Hamarosan
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="font-display text-lg font-semibold leading-snug">{m.title}</h3>
        <p className="mt-1 text-sm" style={{ color: "var(--twx-ink-muted)" }}>Beteszed: {m.input}</p>
        {typeof m.credits === "number" && !m.soon && (
          <span className="mt-3 self-start rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: "var(--twx-coral-soft)", color: "#7a2e17" }}>
            {m.credits} kredit
          </span>
        )}
      </div>
    </article>
  );
}
