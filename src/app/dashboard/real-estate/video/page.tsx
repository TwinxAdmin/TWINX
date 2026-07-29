// dashboard/real-estate/video — Videó 2.0: rövid indítóoldal + varázsló ablak.
// A videó lépésről lépésre készül: Arculat → Képek → Adatok → Beállítás → Generálás.
// Nincs előnézet: a kész videó azonnal mentve, innen (és az ablakból) letölthető.
"use client";

import { useEffect, useState } from "react";
import ModuleIntro from "@/components/ModuleIntro";
import VideoWizard from "@/components/video/VideoWizard";
import VideoLibrary, { type VideoItem, type Folder } from "@/components/video/VideoLibrary";
import type { BrandingProfile } from "@/lib/branding";
import { MIN_VIDEO_IMAGES, MAX_VIDEO_IMAGES } from "@/lib/video";

export default function VideoPage() {
  const [profiles, setProfiles] = useState<BrandingProfile[]>([]);
  const [items, setItems] = useState<VideoItem[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
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
        setFolders(v.folders ?? []);
      }
    } catch {
      /* lista nélkül is használható */
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void load(); }, []);

  // A folyamatban lévő videókat 6 mp-enként megpiszkáljuk: a státusz-végpont
  // lekérdezi a fal.ai / Shotstack állapotát, és befejezi a jobot, ha kész
  // (így akkor sem ragad be, ha a webhook nem érkezett meg).
  useEffect(() => {
    const pending = items.filter((i) => i.status !== "done" && i.status !== "failed");
    if (!pending.length) return;
    const t = setInterval(async () => {
      let changed = false;
      for (const it of pending) {
        try {
          const res = await fetch(`/api/real-estate/video/${it.id}`);
          if (!res.ok) continue;
          const d = await res.json();
          if (d.status !== it.status || d.output_url) changed = true;
        } catch { /* következő kör */ }
      }
      if (changed) void load();
    }, 6000);
    return () => clearInterval(t);
  }, [items]);

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
        <h3 className="mb-3 text-sm font-semibold">Korábbi videóim</h3>
        {loading ? (
          <p className="text-sm" style={{ color: "var(--twx-ink-muted)" }}>Betöltés…</p>
        ) : (
          <VideoLibrary items={items} folders={folders} onChanged={() => void load()} />
        )}
      </section>

      {open && <VideoWizard profiles={profiles} onClose={() => { setOpen(false); void load(); }} onDone={() => void load()} />}
    </main>
  );
}
