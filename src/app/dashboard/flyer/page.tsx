// dashboard/flyer — Hirdetéskép készítő: rövid indítóoldal + varázsló ablak.
// (Az útvonal és a belső azonosítók maradnak "flyer" — csak a megjelenő név változott.)
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
        title="Hirdetéskép készítő"
        subtitle={`Kész, posztolható hirdetéskép percek alatt: válaszd ki a sablont és a méretet, tölts fel 1–${MAX_FLYER_IMAGES} fotót, add meg az adatokat — a képet a Twinx rajzolja meg. Az előnézet ingyenes, csak az elfogadott kép kerül kreditbe.`}
        icon="flyer"
        chips={["Posztolásra kész kép", "Saját arculat", "Instagram · Facebook · portál"]}
      />

      <section className="twx-card flex flex-col items-start gap-3 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <h2 className="font-display text-lg font-semibold">Új hirdetéskép</h2>
          <p className="mt-0.5 text-sm" style={{ color: "var(--twx-ink-muted)" }}>
            Öt lépés, néhány perc. Az elsőben kész mintákon látod, milyen képet fogsz kapni.
          </p>
        </div>
        <button type="button" onClick={() => setOpen(true)}
          className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white" style={{ background: "var(--twx-coral)" }}>
          Hirdetéskép készítése
        </button>
      </section>

      <section className="twx-card p-5 sm:p-6">
        <h3 className="mb-3 text-sm font-semibold">Korábbi hirdetésképeim</h3>
        {loading ? (
          <p className="text-sm" style={{ color: "var(--twx-ink-muted)" }}>Betöltés…</p>
        ) : (
          <FolderLibrary<FlyerItem>
            items={items}
            folders={folders}
            noun="hirdetés"
            emptyText="Még nincs elkészült hirdetésed."
            downloadUrl={(f) => toDownloadUrl(f.url)}
            cols={4}
            renderItem={(f) => (
              <button type="button" onClick={() => setViewUrl(f.url)}
                className="flex h-36 w-full items-center justify-center overflow-hidden rounded-lg"
                style={{ border: "1px solid var(--twx-line)", background: "var(--twx-cream)" }}
                title="Kattints a nagy nézethez">
                {/* A TELJES hirdetés látszik (nincs levágás), csak kisebb méretben. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={f.url} alt={f.title} className="max-h-full max-w-full object-contain" />
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
            onRenameItem={(f, title) =>
              send("/api/flyer/manage", {
                method: "PATCH", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: f.id, title }),
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
