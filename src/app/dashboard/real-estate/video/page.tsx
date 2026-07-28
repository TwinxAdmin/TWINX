// dashboard/real-estate/video — Videó 2.0: rövid indítóoldal + varázsló ablak.
// A videó lépésről lépésre készül: Arculat → Képek → Adatok → Beállítás → Generálás.
// Nincs előnézet: a kész videó azonnal mentve, innen (és az ablakból) letölthető.
"use client";

import { useEffect, useState } from "react";
import ModuleIntro from "@/components/ModuleIntro";
import VideoWizard from "@/components/video/VideoWizard";
import { toDownloadUrl } from "@/lib/files";
import type { BrandingProfile } from "@/lib/branding";
import { MIN_VIDEO_IMAGES, MAX_VIDEO_IMAGES } from "@/lib/video";

type VideoItem = { id: string; status: string; output_url: string | null; created_at: string; package: string };

export default function VideoPage() {
  const [profiles, setProfiles] = useState<BrandingProfile[]>([]);
  const [items, setItems] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  async function load() {
    try {
      const [pRes, vRes] = await Promise.all([
        fetch("/api/branding"),
        fetch("/api/real-estate/video/list"),
      ]);
      const p = await pRes.json();
      if (pRes.ok) setProfiles(p.profiles ?? []);
      if (vRes.ok) {
        const v = await vRes.json();
        setItems(v.items ?? []);
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
        title="Videó készítő"
        subtitle={`Profi, zenés ingatlan-videó percek alatt: ${MIN_VIDEO_IMAGES}–${MAX_VIDEO_IMAGES} fotóból arculati nyitó- és zárókártyával, felirat-sávokkal. A kész videó azonnal mentésre kerül és letölthető.`}
        icon="video"
        chips={["Arculati kártyák", "Zene", "1:1 és 9:16"]}
      />

      <section className="twx-card flex flex-col items-start gap-3 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <h2 className="font-display text-lg font-semibold">Új videó</h2>
          <p className="mt-0.5 text-sm" style={{ color: "var(--twx-ink-muted)" }}>
            Öt lépés, a generálás 1–3 perc. Arculat nélkül is működik.
          </p>
        </div>
        <button type="button" onClick={() => setOpen(true)}
          className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white" style={{ background: "var(--twx-coral)" }}>
          Videó készítése
        </button>
      </section>

      <section className="twx-card p-5 sm:p-6">
        <h3 className="text-sm font-semibold">Korábbi videóim</h3>
        {loading ? (
          <p className="mt-2 text-sm" style={{ color: "var(--twx-ink-muted)" }}>Betöltés…</p>
        ) : items.length === 0 ? (
          <p className="mt-2 text-sm" style={{ color: "var(--twx-ink-muted)" }}>Még nincs elkészült videód.</p>
        ) : (
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {items.map((it) => (
              <div key={it.id} className="overflow-hidden rounded-xl bg-white p-3" style={{ border: "1px solid var(--twx-line)" }}>
                {it.output_url ? (
                  <video src={it.output_url} controls preload="metadata" className="w-full rounded-lg" style={{ maxHeight: 260 }} />
                ) : (
                  <p className="py-6 text-center text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                    {it.status === "failed" ? "Sikertelen (kredit visszatérítve)" : "Készül…"}
                  </p>
                )}
                <div className="mt-2 flex items-center justify-between text-[11px]" style={{ color: "var(--twx-ink-muted)" }}>
                  <span>{new Date(it.created_at).toLocaleDateString("hu-HU")} · {it.package === "pro" ? "PRO" : "Alap"}</span>
                  {it.output_url && (
                    <a href={toDownloadUrl(it.output_url)} className="font-semibold" style={{ color: "var(--twx-coral)" }}>Letöltés</a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {open && <VideoWizard profiles={profiles} onClose={() => { setOpen(false); void load(); }} onDone={() => void load()} />}
    </main>
  );
}
