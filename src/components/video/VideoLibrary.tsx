// Videó-könyvtár: dátum-mappák + saját mappák, bennük a videók előképpel.
// Műveletek videónként: letöltés, áthelyezés saját mappába, végleges törlés.
"use client";

import { useMemo, useState } from "react";
import { showToast } from "@/components/Toast";
import { toDownloadUrl } from "@/lib/files";

export type VideoItem = {
  id: string;
  status: string;
  output_url: string | null;
  poster_url: string | null;
  title: string;
  package: string;
  format: string;
  imageCount: number;
  folderId: string | null;
  createdAt: string;
};
export type Folder = { id: string; name: string };

const MONTHS = ["január", "február", "március", "április", "május", "június",
  "július", "augusztus", "szeptember", "október", "november", "december"];

function monthKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function monthLabel(key: string): string {
  const [y, m] = key.split("-");
  return `${y}. ${MONTHS[Number(m) - 1]}`;
}

export default function VideoLibrary({
  items, folders, onChanged,
}: { items: VideoItem[]; folders: Folder[]; onChanged: () => void }) {
  const [openKey, setOpenKey] = useState<string | null>(null); // "date:2026-07" | "folder:<id>"
  const [busy, setBusy] = useState(false);
  const [moveFor, setMoveFor] = useState<string | null>(null);
  const [newFolder, setNewFolder] = useState("");

  // Csoportosítás: saját mappák előre, majd a mappa nélküliek hónap szerint.
  const groups = useMemo(() => {
    const byFolder = new Map<string, VideoItem[]>();
    const byMonth = new Map<string, VideoItem[]>();
    for (const v of items) {
      if (v.folderId) {
        byFolder.set(v.folderId, [...(byFolder.get(v.folderId) ?? []), v]);
      } else {
        const k = monthKey(v.createdAt);
        byMonth.set(k, [...(byMonth.get(k) ?? []), v]);
      }
    }
    const folderGroups = folders.map((f) => ({
      key: `folder:${f.id}`, label: f.name, kind: "folder" as const, id: f.id,
      items: byFolder.get(f.id) ?? [],
    }));
    const monthGroups = [...byMonth.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([k, v]) => ({ key: `date:${k}`, label: monthLabel(k), kind: "date" as const, id: k, items: v }));
    return [...folderGroups, ...monthGroups];
  }, [items, folders]);

  async function createFolder() {
    const name = newFolder.trim();
    if (!name) return;
    setBusy(true);
    try {
      const res = await fetch("/api/real-estate/video/folders", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setNewFolder("");
      showToast("Mappa létrehozva.", "success");
      onChanged();
    } catch (e) {
      showToast((e as Error).message || "Nem sikerült a mappa létrehozása.", "error");
    } finally { setBusy(false); }
  }

  async function moveTo(videoId: string, folderId: string | null) {
    setBusy(true);
    try {
      const res = await fetch("/api/real-estate/video/manage", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: videoId, folderId }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setMoveFor(null);
      showToast("Áthelyezve.", "success");
      onChanged();
    } catch (e) {
      showToast((e as Error).message || "Nem sikerült az áthelyezés.", "error");
    } finally { setBusy(false); }
  }

  async function remove(v: VideoItem) {
    if (!confirm(`Biztosan törlöd véglegesen? „${v.title}"\n\nA videó a tárhelyről is törlődik, és nem állítható vissza.`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/real-estate/video/manage?id=${v.id}`, { method: "DELETE" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      showToast("A videó törölve.", "success");
      onChanged();
    } catch (e) {
      showToast((e as Error).message || "Nem sikerült a törlés.", "error");
    } finally { setBusy(false); }
  }

  const open = groups.find((g) => g.key === openKey);

  // --- Megnyitott mappa: a videók ---
  if (open) {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button type="button" onClick={() => setOpenKey(null)} className="text-sm font-medium" style={{ color: "var(--twx-coral)" }}>
            ← Vissza a mappákhoz
          </button>
          <p className="text-sm font-semibold">{open.label} · {open.items.length} videó</p>
        </div>

        {open.items.length === 0 ? (
          <p className="twx-card p-6 text-center text-sm" style={{ color: "var(--twx-ink-muted)" }}>
            Ez a mappa üres. Egy videó „Áthelyezés" gombjával tehetsz ide videót.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {open.items.map((v) => (
              <div key={v.id} className="twx-card overflow-hidden p-3">
                {v.output_url ? (
                  <video
                    src={v.output_url}
                    poster={v.poster_url ?? undefined}
                    controls
                    preload="none"
                    className="w-full rounded-lg bg-black"
                    style={{ maxHeight: 300 }}
                  />
                ) : (
                  <div className="flex h-40 items-center justify-center rounded-lg text-xs"
                    style={{ background: "var(--twx-line)", color: "var(--twx-ink-muted)" }}>
                    {v.status === "failed" ? "Sikertelen (kredit visszatérítve)" : "Készül…"}
                  </div>
                )}

                <p className="mt-2 truncate text-sm font-semibold">{v.title}</p>
                <p className="text-[11px]" style={{ color: "var(--twx-ink-muted)" }}>
                  {new Date(v.createdAt).toLocaleDateString("hu-HU")} · {v.format} ·{" "}
                  {v.package === "pro" ? "PRO" : "Alap"} · {v.imageCount} kép
                </p>

                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {v.output_url && (
                    <a href={toDownloadUrl(v.output_url)}
                      className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
                      style={{ background: "var(--twx-coral)" }}>
                      Letöltés
                    </a>
                  )}
                  <button type="button" onClick={() => setMoveFor(moveFor === v.id ? null : v.id)} disabled={busy}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-40"
                    style={{ border: "1px solid var(--twx-line)", background: "#fff" }}>
                    Áthelyezés
                  </button>
                  <button type="button" onClick={() => remove(v)} disabled={busy}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-40"
                    style={{ border: "1px solid #f0b3b3", color: "#c0392b", background: "#fff" }}>
                    Törlés
                  </button>
                </div>

                {moveFor === v.id && (
                  <div className="mt-2 space-y-1 rounded-xl p-2" style={{ border: "1px solid var(--twx-coral)", background: "var(--twx-coral-soft)" }}>
                    <p className="text-[11px] font-semibold" style={{ color: "#7a2e17" }}>Áthelyezés mappába</p>
                    {folders.map((f) => (
                      <button key={f.id} type="button" onClick={() => moveTo(v.id, f.id)} disabled={busy || v.folderId === f.id}
                        className="block w-full rounded-lg px-2 py-1.5 text-left text-xs disabled:opacity-40"
                        style={{ background: "#fff", border: "1px solid var(--twx-line)" }}>
                        {f.name}{v.folderId === f.id ? " (itt van)" : ""}
                      </button>
                    ))}
                    {v.folderId && (
                      <button type="button" onClick={() => moveTo(v.id, null)} disabled={busy}
                        className="block w-full rounded-lg px-2 py-1.5 text-left text-xs"
                        style={{ background: "#fff", border: "1px solid var(--twx-line)" }}>
                        Vissza a dátum szerinti mappába
                      </button>
                    )}
                    <div className="flex gap-1.5 pt-1">
                      <input type="text" value={newFolder} onChange={(e) => setNewFolder(e.target.value)}
                        placeholder="Új mappa neve" className="twx-input flex-1 text-xs" />
                      <button type="button" onClick={createFolder} disabled={busy || !newFolder.trim()}
                        className="rounded-lg px-3 text-xs font-semibold text-white disabled:opacity-40"
                        style={{ background: "var(--twx-coral)" }}>
                        Létrehoz
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // --- Mappanézet ---
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {groups.map((g) => {
          const cover = g.items.find((v) => v.poster_url)?.poster_url ?? null;
          return (
            <button key={g.key} type="button" onClick={() => setOpenKey(g.key)}
              className="twx-card overflow-hidden p-0 text-left transition hover:shadow-md">
              <div className="relative h-24 w-full" style={{ background: "var(--twx-line)" }}>
                {cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={cover} alt="" className="h-full w-full object-cover opacity-80" />
                ) : null}
                <span className="absolute left-3 top-3 flex h-8 w-10 items-end rounded-md"
                  style={{ background: g.kind === "folder" ? "var(--twx-coral)" : "#e8c97a" }} />
              </div>
              <div className="p-3">
                <p className="truncate text-sm font-semibold">{g.label}</p>
                <p className="text-[11px]" style={{ color: "var(--twx-ink-muted)" }}>
                  {g.items.length} videó{g.kind === "folder" ? " · saját mappa" : ""}
                </p>
              </div>
            </button>
          );
        })}

        {/* Új mappa */}
        <div className="twx-card flex flex-col justify-center gap-2 p-3" style={{ borderStyle: "dashed" }}>
          <p className="text-xs font-semibold">Új mappa</p>
          <input type="text" value={newFolder} onChange={(e) => setNewFolder(e.target.value)}
            placeholder="pl. Sas utca 12." className="twx-input text-xs" />
          <button type="button" onClick={createFolder} disabled={busy || !newFolder.trim()}
            className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
            style={{ background: "var(--twx-coral)" }}>
            Létrehozás
          </button>
        </div>
      </div>

      {!items.length && (
        <p className="text-sm" style={{ color: "var(--twx-ink-muted)" }}>Még nincs elkészült videód.</p>
      )}
    </div>
  );
}
