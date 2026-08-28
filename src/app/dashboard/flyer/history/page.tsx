// dashboard/flyer/history — Korábbi hirdetések, hónap szerinti és saját mappákban.
// A mappára kattintva ABLAK nyílik a tartalommal; onnan a hirdetés nagyban is
// megnézhető (nézegető), letölthető, áthelyezhető és véglegesen törölhető.
"use client";

import { useCallback, useEffect, useState } from "react";
import { toDownloadUrl } from "@/lib/files";
import ModuleIntro from "@/components/ModuleIntro";
import FolderLibrary, { type LibraryFolder } from "@/components/library/FolderLibrary";

type FlyerItem = {
  id: string;
  title: string;
  url: string;
  createdAt: string;
  folderId: string | null;
  coverUrl?: string | null;
};

export default function FlyerHistoryPage() {
  const [flyers, setFlyers] = useState<FlyerItem[]>([]);
  const [folders, setFolders] = useState<LibraryFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewUrl, setViewUrl] = useState<string | null>(null); // nagy nézegető

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/flyer/library");
      const data = await res.json();
      if (res.ok) {
        const list = (data.flyers ?? []) as FlyerItem[];
        setFlyers(list.map((f) => ({ ...f, coverUrl: f.url })));
        setFolders(data.folders ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  // Esc zárja a nézegetőt.
  useEffect(() => {
    if (!viewUrl) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setViewUrl(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [viewUrl]);

  async function post(url: string, init: RequestInit) {
    const res = await fetch(url, init);
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(d.error || "A művelet nem sikerült.");
    await load();
    return d as { folder?: LibraryFolder };
  }

  return (
    <main className="mx-auto max-w-4xl space-y-6">
      <ModuleIntro
        eyebrow="Hirdetéskép készítő · Archívum"
        title="Korábbi hirdetések"
        subtitle="A hirdetéseid hónap szerinti mappákba rendezve. Nyiss meg egy mappát, és ott megnézheted, letöltheted, másik mappába helyezheted vagy törölheted őket."
        icon="history"
        chips={["Mappák", "Áthelyezés", "Letöltés"]}
      />

      {loading ? (
        <p className="text-sm" style={{ color: "var(--twx-ink-muted)" }}>Betöltés…</p>
      ) : (
        <section className="twx-card p-5 sm:p-6">
          <FolderLibrary<FlyerItem>
            items={flyers}
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
              const d = await post("/api/flyer/folders", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name }),
              });
              return d.folder;
            }}
            onMove={(id, folderId) =>
              post("/api/flyer/manage", {
                method: "PATCH", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, folderId }),
              })
            }
            onRenameItem={(f, title) =>
              post("/api/flyer/manage", {
                method: "PATCH", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: f.id, title }),
              })
            }
            onDelete={(f) => post(`/api/flyer/manage?id=${f.id}`, { method: "DELETE" })}
          />
        </section>
      )}

      {/* Nagy nézegető */}
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
