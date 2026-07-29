// dashboard/flyer — Hirdetéskészítő: rövid indítóoldal + varázsló ablak.
// A hirdetés lépésről lépésre készül: Arculat → Képek → Adatok → Stílus → Előnézet.
// A hirdetést kódból rajzoljuk (nincs AI): a fotókat sablonba rendezzük, a feliratokat élesen írjuk rá.
"use client";

import { useEffect, useState } from "react";
import ModuleIntro from "@/components/ModuleIntro";
import AdWizard from "@/components/flyer/AdWizard";
import FolderLibrary, { type LibraryFolder } from "@/components/library/FolderLibrary";
import { toDownloadUrl } from "@/lib/files";
import type { BrandingProfile } from "@/lib/branding";
import { MAX_FLYER_IMAGES } from "@/lib/flyer";

type FlyerItem = {
  id: string;
  title: string;
  url: string;
  createdAt: string;
  folderId: string | null;
  coverUrl?: string | null;
};

export default function FlyerPage() {
  const [profiles, setProfiles] = useState<BrandingProfile[]>([]);
  const [items, setItems] = useState<FlyerItem[]>([]);
  const [folders, setFolders] = useState<LibraryFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [viewUrl, setViewUrl] = useState<string | null>(null); // nagy nézet

  async function load() {
    try {
      const [pRes, hRes] = await Promise.all([fetch("/api/branding"), fetch("/api/flyer/library")]);
      const p = await pRes.json();
      if (pRes.ok) setProfiles(p.profiles ?? []);
      if (hRes.ok) {
        const h = await hRes.json();
        const list = (h.flyers ?? []) as FlyerItem[];
        setItems(list.map((f) => ({ ...f, coverUrl: f.url })));
        setFolders(h.folders ?? []);
      }
    } catch {
      /* lista nélkül is használható */
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void load(); }, []);

  // A könyvtár-műveletek után újratöltünk; hibát a FolderLibrary jelzi.
  async function send(url: string, init: RequestInit) {
    const res = await fetch(url, init);
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(d.error || "A művelet nem sikerült.");
    await load();
    return d as { folder?: LibraryFolder };
  }

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
        <h3 className="mb-3 text-sm font-semibold">Korábbi hirdetéseim</h3>
        {loading ? (
          <p className="text-sm" style={{ color: "var(--twx-ink-muted)" }}>Betöltés…</p>
        ) : (
          <FolderLibrary<FlyerItem>
            items={items}
            folders={folders}
            noun="hirdetés"
            emptyText="Még nincs elkészült hirdetésed."
            downloadUrl={(f) => toDownloadUrl(f.url)}
            renderItem={(f) => (
              <button type="button" onClick={() => setViewUrl(f.url)}
                className="block w-full overflow-hidden rounded-lg"
                style={{ border: "1px solid var(--twx-line)" }} title="Kattints a nagy nézethez">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={f.url} alt={f.title} className="aspect-[3/4] w-full object-cover" />
              </button>
            )}
            onCreateFolder={async (name) => {
              const d = await send("/api/flyer/folders", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name }),
              });
              return d.folder;
            }}
            onMove={(id, folderId) =>
              send("/api/flyer/manage", {
                method: "PATCH", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, folderId }),
              })
            }
            onDelete={(f) => send(`/api/flyer/manage?id=${f.id}`, { method: "DELETE" })}
          />
        )}
      </section>

      {open && <AdWizard profiles={profiles} onClose={() => setOpen(false)} onDone={() => void load()} />}

      {/* Nagy nézet egy hirdetésre */}
      {viewUrl && (
        <div onClick={() => setViewUrl(null)}
          className="fixed inset-0 z-[60] flex flex-col items-center justify-center p-4"
          style={{ background: "rgba(12,11,10,0.9)" }}>
          <div onClick={(e) => e.stopPropagation()} className="mb-3 flex items-center gap-2">
            <a href={toDownloadUrl(viewUrl)} download className="twx-btn">
              Letöltés
            </a>
            <button type="button" onClick={() => setViewUrl(null)} aria-label="Bezárás"
              className="flex h-9 w-9 items-center justify-center rounded-full text-lg"
              style={{ background: "rgba(255,255,255,0.14)", color: "#fff" }}>
              ×
            </button>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={viewUrl} alt="" onClick={(e) => e.stopPropagation()}
            className="max-h-[80vh] w-auto rounded-lg object-contain"
            style={{ boxShadow: "0 24px 60px rgba(0,0,0,0.5)" }} />
        </div>
      )}
    </main>
  );
}
