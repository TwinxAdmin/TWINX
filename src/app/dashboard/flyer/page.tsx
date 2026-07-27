// dashboard/flyer — Hirdetéskészítő: rövid indítóoldal + varázsló ablak.
// A hirdetés lépésről lépésre készül: Arculat → Képek → Adatok → Stílus → Előnézet.
// A hirdetést kódból rajzoljuk (nincs AI): a fotókat sablonba rendezzük, a feliratokat élesen írjuk rá.
"use client";

import { useEffect, useState } from "react";
import ModuleIntro from "@/components/ModuleIntro";
import AdWizard from "@/components/flyer/AdWizard";
import { toDownloadUrl } from "@/lib/files";
import type { BrandingProfile } from "@/lib/branding";
import { MAX_FLYER_IMAGES } from "@/lib/flyer";

type HistoryItem = { url: string; title: string; created_at: string };

export default function FlyerPage() {
  const [profiles, setProfiles] = useState<BrandingProfile[]>([]);
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [viewIdx, setViewIdx] = useState<number | null>(null); // megtekintő ablak indexe

  async function load() {
    try {
      const [pRes, hRes] = await Promise.all([fetch("/api/branding"), fetch("/api/flyer/history")]);
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
        subtitle={`Profi, márkázott ingatlanhirdetés percek alatt: tölts fel 1–${MAX_FLYER_IMAGES} képet, add meg az adatokat, a többit a Twinx elvégzi. Az előnézet ingyenes, csak az elfogadott hirdetés kerül kreditbe.`}
        icon="flyer"
        chips={["Kész sablon", "Saját arculat", "Social méretek"]}
      />

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

      <section className="twx-card p-5 sm:p-6">
        <h3 className="text-sm font-semibold">Korábbi hirdetéseim</h3>
        {loading ? (
          <p className="mt-2 text-sm" style={{ color: "var(--twx-ink-muted)" }}>Betöltés…</p>
        ) : items.length === 0 ? (
          <p className="mt-2 text-sm" style={{ color: "var(--twx-ink-muted)" }}>Még nincs elkészült hirdetésed.</p>
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {items.map((it, i) => (
              <button key={it.url} type="button" onClick={() => setViewIdx(i)}
                className="overflow-hidden rounded-xl bg-white text-left transition hover:shadow-md"
                style={{ border: "1px solid var(--twx-line)" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={it.url} alt={it.title || "Hirdetés"} className="aspect-square w-full object-cover" />
                <span className="block truncate px-2 py-1.5 text-[11px]" style={{ color: "var(--twx-ink-muted)" }}>
                  {it.title || new Date(it.created_at).toLocaleDateString("hu-HU")}
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      {open && <AdWizard profiles={profiles} onClose={() => setOpen(false)} onDone={() => void load()} />}
      {viewIdx !== null && items[viewIdx] && (
        <HistoryViewer
          items={items}
          index={viewIdx}
          onIndex={setViewIdx}
          onClose={() => setViewIdx(null)}
        />
      )}
    </main>
  );
}

function HistoryViewer({
  items, index, onIndex, onClose,
}: {
  items: HistoryItem[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
}) {
  const it = items[index];
  const hasPrev = index > 0;
  const hasNext = index < items.length - 1;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && index > 0) onIndex(index - 1);
      if (e.key === "ArrowRight" && index < items.length - 1) onIndex(index + 1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, items.length, onClose, onIndex]);

  return (
    <div onClick={onClose} className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: "rgba(20,12,8,0.6)" }}>
      <div onClick={(e) => e.stopPropagation()} className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl"
        style={{ background: "var(--twx-cream-card)", border: "1px solid var(--twx-line)", boxShadow: "0 24px 60px rgba(0,0,0,0.28)" }}>
        <div className="flex items-center justify-between gap-3 border-b p-4" style={{ borderColor: "var(--twx-line)" }}>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{it.title || "Hirdetés"}</p>
            <p className="text-[11px]" style={{ color: "var(--twx-ink-muted)" }}>
              {new Date(it.created_at).toLocaleDateString("hu-HU")} · {index + 1} / {items.length}
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg px-2 text-xl" style={{ color: "var(--twx-ink-muted)" }} aria-label="Bezár">×</button>
        </div>

        <div className="relative flex flex-1 items-center justify-center overflow-y-auto p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={it.url} alt={it.title || "Hirdetés"} className="mx-auto max-h-[64vh] rounded-xl" style={{ border: "1px solid var(--twx-line)" }} />
          {hasPrev && (
            <button type="button" onClick={() => onIndex(index - 1)} aria-label="Előző"
              className="absolute left-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-xl shadow"
              style={{ background: "rgba(255,255,255,0.95)" }}>‹</button>
          )}
          {hasNext && (
            <button type="button" onClick={() => onIndex(index + 1)} aria-label="Következő"
              className="absolute right-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-xl shadow"
              style={{ background: "rgba(255,255,255,0.95)" }}>›</button>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t p-4" style={{ borderColor: "var(--twx-line)" }}>
          <div className="flex gap-2">
            <button type="button" onClick={() => onIndex(index - 1)} disabled={!hasPrev}
              className="rounded-xl px-4 py-2 text-sm font-medium disabled:opacity-40" style={{ border: "1px solid var(--twx-line)" }}>Előző</button>
            <button type="button" onClick={() => onIndex(index + 1)} disabled={!hasNext}
              className="rounded-xl px-4 py-2 text-sm font-medium disabled:opacity-40" style={{ border: "1px solid var(--twx-line)" }}>Következő</button>
          </div>
          <a href={toDownloadUrl(it.url)} className="rounded-xl px-5 py-2 text-sm font-semibold text-white" style={{ background: "var(--twx-coral)" }}>
            Letöltés
          </a>
        </div>
      </div>
    </div>
  );
}
