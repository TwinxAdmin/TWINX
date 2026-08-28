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
  /** Elem saját nevének mentése (ha nincs megadva, nincs átnevezés gomb). */
  onRenameItem?: (item: T, name: string) => Promise<unknown>;
  /** Végleges törlés (ha nincs megadva, nincs törlés gomb). */
  onDelete?: (item: T) => Promise<unknown>;
  /** Saját mappa átnevezése (ha nincs megadva, nincs átnevezés gomb). */
  onRenameFolder?: (folderId: string, name: string) => Promise<unknown>;
  /** Saját mappa törlése (a benne lévő elemek visszakerülnek a dátum-mappába). */
  onDeleteFolder?: (folderId: string) => Promise<unknown>;
  /** Letöltési URL (ha nincs, nincs letöltés gomb). */
  downloadUrl?: (item: T) => string | null;
  emptyText?: string;
  /** Az elem típusának neve a szövegekhez (pl. „videó", „hirdetés"). */
  noun?: string;
  /**
   * Hány elem legyen egymás mellett a megnyitott mappában. Képeknél (hirdetés)
   * 4 az ideális: kisebb, de teljes egészében látszó előnézetek; videónál 2.
   */
  cols?: 2 | 3 | 4;
};

const GRID_CLASS: Record<2 | 3 | 4, string> = {
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-2 sm:grid-cols-3",
  4: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4",
};

export default function FolderLibrary<T extends LibraryItem>({
  items, folders, renderItem, onCreateFolder, onMove, onDelete, downloadUrl,
  onRenameFolder, onDeleteFolder, onRenameItem,
  emptyText = "Még nincs elkészült munkád.",
  noun = "elem",
  cols = 2,
}: FolderLibraryProps<T>) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [moveFor, setMoveFor] = useState<string | null>(null);
  const [newFolder, setNewFolder] = useState("");     // a mappanézet mezője
  const [renameFor, setRenameFor] = useState<string | null>(null); // elem átnevezése
  const [itemName, setItemName] = useState("");
  const [renaming, setRenaming] = useState(false);    // a megnyitott mappa átnevezése
  const [renameVal, setRenameVal] = useState("");

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
            <div className="flex items-center justify-between gap-3 border-b px-5 py-3"
              style={{ borderColor: "var(--twx-line)" }}>
              <div className="min-w-0 flex-1">
                {renaming && open.kind === "folder" ? (
                  <div className="flex items-center gap-2">
                    <input type="text" value={renameVal} autoFocus
                      onChange={(e) => setRenameVal(e.target.value)}
                      className="twx-input text-sm" placeholder="Mappa neve" />
                    <button type="button" disabled={busy || !renameVal.trim()}
                      onClick={() => {
                        const fid = open.key.replace("folder:", "");
                        void guard(async () => { await onRenameFolder?.(fid, renameVal.trim()); setRenaming(false); }, "Átnevezve.");
                      }}
                      className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
                      style={{ background: "var(--twx-coral)" }}>
                      Mentés
                    </button>
                    <button type="button" onClick={() => setRenaming(false)}
                      className="rounded-lg px-3 py-1.5 text-xs" style={{ border: "1px solid var(--twx-line)" }}>
                      Mégse
                    </button>
                  </div>
                ) : (
                  <>
                    <p className="truncate text-sm font-semibold">{open.label}</p>
                    <p className="text-[11px]" style={{ color: "var(--twx-ink-muted)" }}>
                      {open.items.length} {noun}{open.kind === "folder" ? " · saját mappa" : ""}
                    </p>
                  </>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                {open.kind === "folder" && !renaming && onRenameFolder && (
                  <button type="button" disabled={busy}
                    onClick={() => { setRenameVal(open.label); setRenaming(true); }}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-40"
                    style={{ border: "1px solid var(--twx-line)", background: "#fff" }}>
                    Átnevezés
                  </button>
                )}
                {open.kind === "folder" && !renaming && onDeleteFolder && (
                  <button type="button" disabled={busy}
                    onClick={() => {
                      const fid = open.key.replace("folder:", "");
                      if (!confirm(`Törlöd a(z) „${open.label}" mappát?\n\nA benne lévő ${noun}ek NEM törlődnek, visszakerülnek a dátum szerinti mappába.`)) return;
                      void guard(async () => { await onDeleteFolder(fid); setOpenKey(null); }, "Mappa törölve.");
                    }}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-40"
                    style={{ border: "1px solid #f0b3b3", color: "#c0392b", background: "#fff" }}>
                    Mappa törlése
                  </button>
                )}
                <button type="button" onClick={() => { setRenaming(false); setOpenKey(null); }}
                  className="rounded-lg px-3 py-1.5 text-sm" aria-label="Bezárás"
                  style={{ border: "1px solid var(--twx-line)" }}>
                  ✕
                </button>
              </div>
            </div>

            <div className="overflow-y-auto p-4">
              {open.items.length === 0 ? (
                <p className="py-10 text-center text-sm" style={{ color: "var(--twx-ink-muted)" }}>
                  Ez a mappa üres. Egy {noun} „Áthelyezés&quot; gombjával tehetsz ide tartalmat.
                </p>
              ) : (
                <div className={`grid gap-3 ${GRID_CLASS[cols]}`}>
                  {open.items.map((it) => {
                    const dl = downloadUrl?.(it) ?? null;
                    return (
                      <div key={it.id} className="rounded-xl p-3"
                        style={{ border: "1px solid var(--twx-line)" }}>
                        {renderItem(it)}

                        {/* NÉV — a partner saját elnevezése, helyben szerkeszthető */}
                        {renameFor === it.id ? (
                          <div className="mt-2 flex items-center gap-1.5">
                            <input type="text" value={itemName} autoFocus maxLength={120}
                              onChange={(e) => setItemName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Escape") setRenameFor(null);
                                if (e.key === "Enter" && itemName.trim()) {
                                  void guard(async () => {
                                    await onRenameItem?.(it, itemName.trim()); setRenameFor(null);
                                  }, "Átnevezve.");
                                }
                              }}
                              className="twx-input flex-1 text-sm" placeholder="Add meg a nevét" />
                            <button type="button" disabled={busy || !itemName.trim()}
                              onClick={() => void guard(async () => {
                                await onRenameItem?.(it, itemName.trim()); setRenameFor(null);
                              }, "Átnevezve.")}
                              className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
                              style={{ background: "var(--twx-coral)" }}>
                              Mentés
                            </button>
                            <button type="button" onClick={() => setRenameFor(null)}
                              className="rounded-lg px-2.5 py-1.5 text-xs" style={{ border: "1px solid var(--twx-line)" }}>
                              Mégse
                            </button>
                          </div>
                        ) : (
                          <p className="mt-2 truncate text-sm font-semibold">{it.title}</p>
                        )}
                        <p className="text-[11px]" style={{ color: "var(--twx-ink-muted)" }}>
                          {new Date(it.createdAt).toLocaleDateString("hu-HU")}
                        </p>

                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          {dl && (
                            // `download`: a böngésző töltse le, ne navigáljon el rá.
                            <a href={dl} download
                              className="rounded-lg px-2.5 py-1 text-[11px] font-semibold text-white"
                              style={{ background: "var(--twx-coral)" }}>
                              Letöltés
                            </a>
                          )}
                          {onRenameItem && renameFor !== it.id && (
                            <button type="button" disabled={busy}
                              onClick={() => { setItemName(it.title); setRenameFor(it.id); setMoveFor(null); }}
                              className="rounded-lg px-2.5 py-1 text-[11px] font-medium disabled:opacity-40"
                              style={{ border: "1px solid var(--twx-line)", background: "#fff" }}>
                              Átnevezés
                            </button>
                          )}
                          <button type="button" disabled={busy}
                            onClick={() => { setMoveFor(moveFor === it.id ? null : it.id); setRenameFor(null); }}
                            className="rounded-lg px-2.5 py-1 text-[11px] font-medium disabled:opacity-40"
                            style={{
                              border: `1px solid ${moveFor === it.id ? "var(--twx-coral)" : "var(--twx-line)"}`,
                              background: moveFor === it.id ? "var(--twx-coral-soft)" : "#fff",
                            }}>
                            Áthelyezés
                          </button>
                          {onDelete && (
                            <button type="button" disabled={busy}
                              onClick={() => {
                                if (!confirm(`Biztosan törlöd véglegesen? „${it.title}"\n\nA tárhelyről is törlődik, és nem állítható vissza.`)) return;
                                void guard(async () => { await onDelete(it); }, "Törölve.");
                              }}
                              className="rounded-lg px-2.5 py-1 text-[11px] font-medium disabled:opacity-40"
                              style={{ border: "1px solid #f0b3b3", color: "#c0392b", background: "#fff" }}>
                              Törlés
                            </button>
                          )}
                        </div>

                        {/* ÁTHELYEZÉS: az elem alatt kinyíló mappalista, egy kattintás */}
                        {moveFor === it.id && (
                          <div className="mt-2 overflow-hidden rounded-xl"
                            style={{ border: "1px solid var(--twx-coral)", background: "#fff" }}>
                            <p className="px-3 py-2 text-[11px] font-semibold"
                              style={{ background: "var(--twx-coral-soft)", color: "#7a2e17" }}>
                              Hová kerüljön? Kattints a mappára.
                            </p>
                            <div className="max-h-52 overflow-y-auto p-1.5">
                              {/* Dátum szerinti (alapértelmezett) hely */}
                              <button type="button" disabled={busy || !it.folderId}
                                onClick={() => void guard(async () => { await onMove(it.id, null); setMoveFor(null); }, "Áthelyezve.")}
                                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition hover:bg-[color:var(--twx-cream)] disabled:cursor-default disabled:opacity-100">
                                <span aria-hidden className="inline-block h-4 w-5 shrink-0 rounded-[3px]"
                                  style={{ background: "#e8c97a" }} />
                                <span className="flex-1 truncate">Dátum szerinti mappa</span>
                                {!it.folderId && (
                                  <span className="shrink-0 text-[10px] font-semibold" style={{ color: "var(--twx-ink-muted)" }}>
                                    jelenleg itt
                                  </span>
                                )}
                              </button>
                              {folders.map((f) => {
                                const here = it.folderId === f.id;
                                return (
                                  <button key={f.id} type="button" disabled={busy || here}
                                    onClick={() => void guard(async () => { await onMove(it.id, f.id); setMoveFor(null); }, "Áthelyezve.")}
                                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition hover:bg-[color:var(--twx-cream)] disabled:cursor-default disabled:opacity-100">
                                    <span aria-hidden className="inline-block h-4 w-5 shrink-0 rounded-[3px]"
                                      style={{ background: "var(--twx-coral)" }} />
                                    <span className="flex-1 truncate">{f.name}</span>
                                    {here && (
                                      <span className="shrink-0 text-[10px] font-semibold" style={{ color: "var(--twx-ink-muted)" }}>
                                        jelenleg itt
                                      </span>
                                    )}
                                  </button>
                                );
                              })}
                              {folders.length === 0 && (
                                <p className="px-2.5 py-2 text-[11px]" style={{ color: "var(--twx-ink-muted)" }}>
                                  Még nincs saját mappád. A könyvtár tetején, az „Új mappa&quot; kártyán tudsz létrehozni egyet.
                                </p>
                              )}
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
