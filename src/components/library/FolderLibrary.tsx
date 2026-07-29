// Közös könyvtár-nézet: hónap szerinti automatikus mappák + saját mappák.
// A mappára kattintva ABLAK (modal) nyílik a tartalommal. Elemenként áthelyezés
// és végleges törlés. A videó- és a hirdetés-könyvtár is ezt használja; a
// tartalom megjelenítését a hívó adja meg (renderItem).
"use client";

import { useEffect, useMemo, useState } from "react";
import { showToast } from "@/components/Toast";

export type LibraryItem = {
  id: string;
  title: string;
  createdAt: string;
  folderId: string | null;
  /** Borítókép a mappa-csempéhez (ha van). */
  coverUrl?: string | null;
};
export type LibraryFolder = { id: string; name: string };

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

export type FolderLibraryProps<T extends LibraryItem> = {
  items: T[];
  folders: LibraryFolder[];
  /** Egy elem megjelenítése a megnyitott mappában (a műveletsor alá kerül). */
  renderItem: (item: T) => React.ReactNode;
  /** Új mappa létrehozása. Ha visszaadja a létrejött mappát, az áthelyezés-panelből
   *  létrehozott mappába rögtön bele is kerül az elem. */
  onCreateFolder: (name: string) => Promise<LibraryFolder | void>;
  /** Elem áthelyezése mappába (null = vissza a dátum-mappába). */
  onMove: (itemId: string, folderId: string | null) => Promise<unknown>;
  /** Végleges törlés (ha nincs megadva, nincs törlés gomb). */
  onDelete?: (item: T) => Promise<unknown>;
  /** Letöltési URL (ha nincs, nincs letöltés gomb). */
  downloadUrl?: (item: T) => string | null;
  emptyText?: string;
  /** Az elem típusának neve a szövegekhez (pl. „videó", „hirdetés"). */
  noun?: string;
};

export default function FolderLibrary<T extends LibraryItem>({
  items, folders, renderItem, onCreateFolder, onMove, onDelete, downloadUrl,
  emptyText = "Még nincs elkészült munkád.",
  noun = "elem",
}: FolderLibraryProps<T>) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [moveFor, setMoveFor] = useState<string | null>(null);
  const [newFolder, setNewFolder] = useState("");     // a mappanézet mezője
  const [moveFolder, setMoveFolder] = useState("");   // az áthelyezés-panel mezője

  // Csoportosítás: saját mappák előre, majd a mappa nélküliek hónap szerint.
  const groups = useMemo(() => {
    const byFolder = new Map<string, T[]>();
    const byMonth = new Map<string, T[]>();
    for (const v of items) {
      if (v.folderId) byFolder.set(v.folderId, [...(byFolder.get(v.folderId) ?? []), v]);
      else {
        const k = monthKey(v.createdAt);
        byMonth.set(k, [...(byMonth.get(k) ?? []), v]);
      }
    }
    const folderGroups = folders.map((f) => ({
      key: `folder:${f.id}`, label: f.name, kind: "folder" as const, items: byFolder.get(f.id) ?? [],
    }));
    const monthGroups = [...byMonth.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([k, v]) => ({ key: `date:${k}`, label: monthLabel(k), kind: "date" as const, items: v }));
    return [...folderGroups, ...monthGroups];
  }, [items, folders]);

  const open = groups.find((g) => g.key === openKey) ?? null;

  // Escape zárja az ablakot.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpenKey(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function guard(fn: () => Promise<void>, okMsg?: string) {
    setBusy(true);
    try {
      await fn();
      if (okMsg) showToast(okMsg, "success");
    } catch (e) {
      showToast((e as Error).message || "A művelet nem sikerült.", "error");
    } finally { setBusy(false); }
  }

  const createFolder = () => {
    const name = newFolder.trim();
    if (!name) return;
    return guard(async () => { await onCreateFolder(name); setNewFolder(""); }, "Mappa létrehozva.");
  };

  return (
    <div className="space-y-3">
      {/* --- MAPPANÉZET --- */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {groups.map((g) => {
          const cover = g.items.find((v) => v.coverUrl)?.coverUrl ?? null;
          return (
            <button key={g.key} type="button" onClick={() => setOpenKey(g.key)}
              className="twx-card overflow-hidden p-0 text-left transition hover:shadow-md">
              <div className="relative h-24 w-full" style={{ background: "var(--twx-line)" }}>
                {cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={cover} alt="" className="h-full w-full object-cover opacity-80" />
                ) : null}
                <span className="absolute left-3 top-3 h-8 w-10 rounded-md"
                  style={{ background: g.kind === "folder" ? "var(--twx-coral)" : "#e8c97a" }} />
              </div>
              <div className="p-3">
                <p className="truncate text-sm font-semibold">{g.label}</p>
                <p className="text-[11px]" style={{ color: "var(--twx-ink-muted)" }}>
                  {g.items.length} {noun}{g.kind === "folder" ? " · saját mappa" : ""}
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
        <p className="text-sm" style={{ color: "var(--twx-ink-muted)" }}>{emptyText}</p>
      )}

      {/* --- MEGNYITOTT MAPPA: ABLAK --- */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(20,16,14,0.55)" }}
          onClick={() => setOpenKey(null)}>
          <div className="flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b px-5 py-3"
              style={{ borderColor: "var(--twx-line)" }}>
              <div>
                <p className="text-sm font-semibold">{open.label}</p>
                <p className="text-[11px]" style={{ color: "var(--twx-ink-muted)" }}>
                  {open.items.length} {noun}
                </p>
              </div>
              <button type="button" onClick={() => setOpenKey(null)}
                className="rounded-lg px-3 py-1.5 text-sm" aria-label="Bezárás"
                style={{ border: "1px solid var(--twx-line)" }}>
                ✕
              </button>
            </div>

            <div className="overflow-y-auto p-4">
              {open.items.length === 0 ? (
                <p className="py-10 text-center text-sm" style={{ color: "var(--twx-ink-muted)" }}>
                  Ez a mappa üres. Egy {noun} „Áthelyezés" gombjával tehetsz ide tartalmat.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {open.items.map((it) => {
                    const dl = downloadUrl?.(it) ?? null;
                    return (
                      <div key={it.id} className="rounded-xl p-3"
                        style={{ border: "1px solid var(--twx-line)" }}>
                        {renderItem(it)}

                        <p className="mt-2 truncate text-sm font-semibold">{it.title}</p>
                        <p className="text-[11px]" style={{ color: "var(--twx-ink-muted)" }}>
                          {new Date(it.createdAt).toLocaleDateString("hu-HU")}
                        </p>

                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          {dl && (
                            <a href={dl} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
                              style={{ background: "var(--twx-coral)" }}>
                              Letöltés
                            </a>
                          )}
                          <button type="button" disabled={busy}
                            onClick={() => setMoveFor(moveFor === it.id ? null : it.id)}
                            className="rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-40"
                            style={{ border: "1px solid var(--twx-line)", background: "#fff" }}>
                            Áthelyezés
                          </button>
                          {onDelete && (
                            <button type="button" disabled={busy}
                              onClick={() => {
                                if (!confirm(`Biztosan törlöd véglegesen? „${it.title}"\n\nA tárhelyről is törlődik, és nem állítható vissza.`)) return;
                                void guard(async () => { await onDelete(it); }, "Törölve.");
                              }}
                              className="rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-40"
                              style={{ border: "1px solid #f0b3b3", color: "#c0392b", background: "#fff" }}>
                              Törlés
                            </button>
                          )}
                        </div>

                        {moveFor === it.id && (
                          <div className="mt-2 space-y-1 rounded-xl p-2"
                            style={{ border: "1px solid var(--twx-coral)", background: "var(--twx-coral-soft)" }}>
                            <p className="text-[11px] font-semibold" style={{ color: "#7a2e17" }}>Áthelyezés mappába</p>
                            {folders.map((f) => (
                              <button key={f.id} type="button" disabled={busy || it.folderId === f.id}
                                onClick={() => void guard(async () => { await onMove(it.id, f.id); setMoveFor(null); }, "Áthelyezve.")}
                                className="block w-full rounded-lg px-2 py-1.5 text-left text-xs disabled:opacity-40"
                                style={{ background: "#fff", border: "1px solid var(--twx-line)" }}>
                                {f.name}{it.folderId === f.id ? " (itt van)" : ""}
                              </button>
                            ))}
                            {it.folderId && (
                              <button type="button" disabled={busy}
                                onClick={() => void guard(async () => { await onMove(it.id, null); setMoveFor(null); }, "Áthelyezve.")}
                                className="block w-full rounded-lg px-2 py-1.5 text-left text-xs"
                                style={{ background: "#fff", border: "1px solid var(--twx-line)" }}>
                                Vissza a dátum szerinti mappába
                              </button>
                            )}
                            <div className="flex gap-1.5 pt-1">
                              <input type="text" value={moveFolder} onChange={(e) => setMoveFolder(e.target.value)}
                                placeholder="Új mappa neve" className="twx-input flex-1 text-xs" />
                              <button type="button" disabled={busy || !moveFolder.trim()}
                                onClick={() => void guard(async () => {
                                  // Létrehozás UTÁN rögtön ide is helyezzük az elemet —
                                  // különben a partner azt hinné, hogy áthelyezte.
                                  const name = moveFolder.trim();
                                  const created = await onCreateFolder(name);
                                  if (created?.id) await onMove(it.id, created.id);
                                  setMoveFolder("");
                                  setMoveFor(null);
                                }, "Mappa létrehozva, az elem áthelyezve.")}
                                className="rounded-lg px-3 text-xs font-semibold text-white disabled:opacity-40"
                                style={{ background: "var(--twx-coral)" }}>
                                Létrehoz
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
