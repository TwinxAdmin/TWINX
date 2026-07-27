// dashboard/flyer — Hirdetéskészítő: rövid indítóoldal + varázsló ablak.
// A hosszú, görgetős űrlap helyett a hirdetés egy felugró ablakban készül el,
// lépésről lépésre: Arculat → Sablon → Képek → Adatok → Előnézet (vízjeles) → elfogadás.
"use client";

import { useEffect, useState } from "react";
import ModuleIntro from "@/components/ModuleIntro";
import FlyerWizard from "@/components/flyer/FlyerWizard";
import { toDownloadUrl } from "@/lib/files";
import type { BrandingProfile } from "@/lib/branding";
import { FLYER_STYLES, FLYER_RATIOS } from "@/lib/flyer-design";
import { MAX_FLYER_IMAGES } from "@/lib/flyer";

type HistoryItem = { url: string; title: string; created_at: string };

export default function FlyerPage() {
  const [profiles, setProfiles] = useState<BrandingProfile[]>([]);
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  async function load() {
    try {
      const [pRes, hRes] = await Promise.all([
        fetch("/api/branding"),
        fetch("/api/flyer/history"),
      ]);
      const p = await pRes.json();
      if (pRes.ok) setProfiles(p.profiles ?? []);
      if (hRes.ok) {
        const h = await hRes.json();
        setItems(h.items ?? []);
      }
    } catch {
      /* lista nélkül is használható */
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void load(); }, []);

  return (
    <main className="mx-auto max-w-4xl space-y-6">
      <ModuleIntro
        eyebrow="Ingatlan · Marketing"
        title="Hirdetéskészítő"
        subtitle={`Percek alatt kész, márkázott ingatlanhirdetés: válassz sablont, tölts fel 1–${MAX_FLYER_IMAGES} képet, a szöveget az AI megírja. Az előnézet ingyenes, csak az elfogadott hirdetés kerül kreditbe.`}
        icon="flyer"
        chips={[`${FLYER_STYLES.length} sablon`, `${FLYER_RATIOS.length} méret`, "AI-szöveg"]}
      />

      {/* Indítás */}
      <section className="twx-card flex flex-col items-start gap-3 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <h2 className="font-display text-lg font-semibold">Új hirdetés</h2>
          <p className="mt-0.5 text-sm" style={{ color: "var(--twx-ink-muted)" }}>
            Öt lépés, néhány perc. Arculat nélkül is működik — a neved és elérhetőséged elég.
          </p>
        </div>
        <button type="button" onClick={() => setOpen(true)}
          className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white" style={{ background: "var(--twx-coral)" }}>
          Hirdetés készítése
        </button>
      </section>

      {/* Sablonok bemutatása — hogy lássa, mit kap */}
      <section className="twx-card p-5 sm:p-6">
        <h3 className="text-sm font-semibold">Választható stílusok</h3>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FLYER_STYLES.map((s) => (
            <div key={s.id} className="rounded-xl p-3" style={{ border: "1px solid var(--twx-line)", background: "#fff" }}>
              <p className="text-sm font-semibold">{s.label}</p>
              <p className="mt-0.5 text-[11px]" style={{ color: "var(--twx-ink-muted)" }}>{s.desc}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs" style={{ color: "var(--twx-ink-muted)" }}>
          Minden stílus elérhető {FLYER_RATIOS.map((r) => r.id).join(" · ")} méretben, 1–{MAX_FLYER_IMAGES} képes elrendezésben.
        </p>
      </section>

      {/* Korábbi hirdetések */}
      <section className="twx-card p-5 sm:p-6">
        <h3 className="text-sm font-semibold">Korábbi hirdetéseim</h3>
        {loading ? (
          <p className="mt-2 text-sm" style={{ color: "var(--twx-ink-muted)" }}>Betöltés…</p>
        ) : items.length === 0 ? (
          <p className="mt-2 text-sm" style={{ color: "var(--twx-ink-muted)" }}>
            Még nincs elkészült hirdetésed.
          </p>
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {items.map((it) => (
              <a key={it.url} href={toDownloadUrl(it.url)} className="group overflow-hidden rounded-xl bg-white transition hover:shadow-md"
                style={{ border: "1px solid var(--twx-line)" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={it.url} alt={it.title || "Hirdetés"} className="aspect-[3/4] w-full object-cover" />
                <span className="block truncate px-2 py-1.5 text-[11px]" style={{ color: "var(--twx-ink-muted)" }}>
                  {it.title || new Date(it.created_at).toLocaleDateString("hu-HU")}
                </span>
              </a>
            ))}
          </div>
        )}
      </section>

      {open && (
        <FlyerWizard
          profiles={profiles}
          onClose={() => setOpen(false)}
          onDone={() => void load()}
        />
      )}
    </main>
  );
}
