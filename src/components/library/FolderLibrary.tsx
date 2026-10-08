// Közös könyvtár-nézet: hónap szerinti automatikus mappák + saját mappák.
// A mappára kattintva ABLAK (modal) nyílik a tartalommal. Elemenként áthelyezés
// és törlés (= elrejtés, a fájl megmarad). A videó- és a hirdetés-könyvtár is ezt használja; a
// tartalom megjelenítését a hívó adja meg (renderItem).
// Az elemek műveletei (letöltés, áthelyezés, átnevezés, törlés) egyetlen „⋯" menüben vannak (jobb klikkre is).
"use client";

import { useEffect, useMemo, useState } from "react";
import { showToast } from "@/components/Toast";
import { ActionMenu, MI, MenuDots, useActionMenu, type MenuItem, type SubItem } from "@/components/ui/ActionMenu";

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
  /** Törlés = elrejtés (a fájl megmarad; ha nincs megadva, nincs törlés pont). */
  onDelete?: (item: T) => Promise<unknown>;
  /** Saját mappa átnevezése (ha nincs megadva, nincs átnevezés gomb). */
  onRenameFolder?: (folderId: string, name: string) => Promise<unknown>;
  /** Saját mappa törlése (a benne lévő elemek visszakerülnek a dátum-mappába). */
  onDeleteFolder?: (folderId: string) => Promise<unknown>;
  /**
   * Az elemhez tartozó usage_history azonosító. Ha meg van adva, az „Áthelyezés" almenüben a modul
   * mappái mellett a Korábbi munkák SAJÁT mappái és a KÖZÖS irodai mappák is megjelennek.
   */
  historyIdOf?: (item: T) => string | null;
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
  onRenameFolder, onDeleteFolder, onRenameItem, historyIdOf,
  emptyText = "Még nincs elkészült munkád.",
  noun = "elem",
  cols = 2,
}: FolderLibraryProps<T>) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [newFolder, setNewFolder] = useState("");     // a mappanézet mezője
  const [renameFor, setRenameFor] = useState<string | null>(null); // elem átnevezése
  const [itemName, setItemName] = useState("");
  const [renaming, setRenaming] = useState(false);    // a megnyitott mappa átnevezése
  const [renameVal, setRenameVal] = useState("");
  // ⋯ menük: egy elem műveletei, illetve a megnyitott saját mappa műveletei
  const itemMenu = useActionMenu();
  const [menuItem, setMenuItem] = useState<T | null>(null);
  const folderMenu = useActionMenu();

  // ---- Korábbi munkák saját mappái + közös irodai mappák (a modultól független rendszerezés) ----
  type F = { id: string; name: string };
  const [wf, setWf] = useState<{ folders: F[]; links: { folderId: string; historyId: string }[] } | null>(null);
  const [of, setOf] = useState<F[]>([]);
  const [ofIn, setOfIn] = useState<Record<string, string[]>>({});   // historyId → közös mappa-azonosítók
  const crossOn = !!historyIdOf;
  useEffect(() => {
    if (!crossOn) return;
    const loadWf = () => fetch("/api/work-folders").then((r) => r.json())
      .then((d) => setWf({ folders: d.folders ?? [], links: d.links ?? [] })).catch(() => setWf({ folders: [], links: [] }));
    void loadWf();
    fetch("/api/office/folders").then((r) => (r.ok ? r.json() : { folders: [] }))
      .then((d) => setOf((d.folders ?? []).map((f: F) => ({ id: f.id, name: f.name })))).catch(() => {});
    window.addEventListener("twx-works-changed", loadWf);
    return () => window.removeEventListener("twx-works-changed", loadWf);
  }, [crossOn]);

  function openItemMenu(e: React.MouseEvent<HTMLElement>, it: T, how: "button" | "event") {
    setMenuItem(it);
    if (how === "button") itemMenu.openAtButton(e); else itemMenu.openAtEvent(e);
    const hid = historyIdOf?.(it);
    if (hid && of.length && !ofIn[hid]) {
      fetch(`/api/office/folders/items?historyId=${hid}`).then((r) => r.json())
        .then((d) => setOfIn((m) => ({ ...m, [hid]: d.folderIds ?? [] }))).catch(() => {});
    }
  }

  async function toggleCross(kind: "work" | "office", f: F, hid: string, isIn: boolean) {
    const res = await fetch(kind === "work" ? "/api/work-folders/items" : "/api/office/folders/items", {
      method: isIn ? "DELETE" : "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folderId: f.id, historyId: hid }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { showToast(d.error ?? "Nem sikerült.", "error"); return; }
    if (kind === "work") {
      setWf((w) => w && ({ ...w, links: isIn ? w.links.filter((l) => !(l.folderId === f.id && l.historyId === hid)) : [...w.links, { folderId: f.id, historyId: hid }] }));
    } else {
      setOfIn((m) => ({ ...m, [hid]: isIn ? (m[hid] ?? []).filter((x) => x !== f.id) : [...(m[hid] ?? []), f.id] }));
    }
    showToast(isIn ? `Kivetted: „${f.name}”.` : `Betéve: „${f.name}”${kind === "office" ? " (közös mappa)" : ""}.`, "success");
    window.dispatchEvent(new CustomEvent("twx-works-changed"));
  }

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
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !itemMenu.open && !folderMenu.open) setOpenKey(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, itemMenu.open, folderMenu.open]);

  async function guard(fn: () => Promise<void>, okMsg?: string) {
    setBusy(true);
    try {
      await fn();
      if (okMsg) showToast(okMsg, "success");
    } catch (e) {
      showToast((e as Error).message || "A művelet nem sikerült.", "error");
    } finally { setBusy(false); }
  }

  /** Egy elem ⋯ menüje: Letöltés · Áthelyezés (almenü) · Átnevezés · Törlés. */
  function itemMenuItems(it: T): MenuItem[] {
    const list: MenuItem[] = [];
    const dl = downloadUrl?.(it) ?? null;
    if (dl) list.push({ kind: "link", label: "Letöltés", icon: MI.download, href: dl, download: true });
    const hid = historyIdOf?.(it) ?? null;
    const moduleItems: SubItem[] = [
      { id: "__date", label: "Dátum szerinti mappa", checked: !it.folderId, disabled: busy || !it.folderId,
        onClick: () => guard(async () => { await onMove(it.id, null); }, "Áthelyezve.") },
      ...folders.map((f) => ({
        id: f.id, label: f.name, checked: it.folderId === f.id, disabled: busy || it.folderId === f.id,
        onClick: () => guard(async () => { await onMove(it.id, f.id); }, "Áthelyezve."),
      })),
    ];
    // a modul saját mappái (egy helyen lehet) + a Korábbi munkák saját mappái és a közös mappák (több helyen is lehet ✓)
    const crossItems: SubItem[] = [];
    if (hid && wf && wf.folders.length) {
      crossItems.push({ id: "__h_work", header: "Saját mappáim", hint: "Korábbi munkák" });
      for (const f of wf.folders) {
        const isIn = wf.links.some((l) => l.folderId === f.id && l.historyId === hid);
        crossItems.push({ id: `w:${f.id}`, label: f.name, checked: isIn, onClick: () => toggleCross("work", f, hid, isIn) });
      }
    }
    if (hid && of.length) {
      crossItems.push({ id: "__h_office", header: "Közös irodai mappák", hint: "a kollégák is látják" });
      for (const f of of) {
        const isIn = (ofIn[hid] ?? []).includes(f.id);
        crossItems.push({ id: `o:${f.id}`, label: f.name, checked: isIn, onClick: () => toggleCross("office", f, hid, isIn) });
      }
    }
    list.push({
      kind: "sub", label: "Áthelyezés", icon: MI.move, title: "Hová kerüljön?",
      items: crossItems.length ? [{ id: "__h_mod", header: `Ebben a modulban` }, ...moduleItems, ...crossItems] : moduleItems,
    });
    if (onRenameItem) list.push({ label: "Átnevezés", icon: MI.rename, onClick: () => { setItemName(it.title); setRenameFor(it.id); } });
    if (onDelete) {
      list.push({ kind: "divider" }, {
        label: "Törlés", icon: MI.trash, danger: true,
        onClick: () => {
          if (!confirm(`Törlöd a listádból? „${it.title}"\n\nA fájl megmarad — a Korábbi munkák „Elrejtett munkák” nézetéből visszahozhatod.`)) return;
          void guard(async () => { await onDelete(it); }, "Törölve.");
        },
      });
    }
    return list;
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
                {open.kind === "folder" && !renaming && (onRenameFolder || onDeleteFolder) && (
                  <MenuDots label="Mappa műveletei" onClick={folderMenu.openAtButton} />
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
                  Ez a mappa üres. Egy {noun} ⋯ menüjében az „Áthelyezés” ponttal tehetsz ide tartalmat.
                </p>
              ) : (
                <div className={`grid gap-3 ${GRID_CLASS[cols]}`}>
                  {open.items.map((it) => {
                    return (
                      <div key={it.id} className="rounded-xl p-3"
                        onContextMenu={(e) => openItemMenu(e, it, "event")}
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
                          // cím + dátum, jobbra egyetlen ⋯ — a műveletek (letöltés, áthelyezés, átnevezés, törlés) a menüben
                          <div className="mt-2 flex items-start gap-1">
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold" title={it.title}>{it.title}</p>
                              <p className="text-[11px]" style={{ color: "var(--twx-ink-muted)" }}>
                                {new Date(it.createdAt).toLocaleDateString("hu-HU")}
                              </p>
                            </div>
                            <MenuDots label={`Műveletek: ${it.title}`} onClick={(e) => openItemMenu(e, it, "button")} />
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
      {itemMenu.open && menuItem && <ActionMenu at={itemMenu.at} items={itemMenuItems(items.find((x) => x.id === menuItem.id) ?? menuItem)} onClose={itemMenu.close} />}
      {folderMenu.open && open && open.kind === "folder" && (
        <ActionMenu at={folderMenu.at} onClose={folderMenu.close} items={[
          ...(onRenameFolder ? [{ label: "Mappa átnevezése", icon: MI.rename, onClick: () => { setRenameVal(open.label); setRenaming(true); } }] : []),
          ...(onDeleteFolder ? [{ kind: "divider" as const }, {
            label: "Mappa törlése", icon: MI.trash, danger: true,
            onClick: () => {
              const fid = open.key.replace("folder:", "");
              if (!confirm(`Törlöd a(z) „${open.label}" mappát?\n\nA benne lévő ${noun}ek NEM törlődnek, visszakerülnek a dátum szerinti mappába.`)) return;
              void guard(async () => { await onDeleteFolder(fid); setOpenKey(null); }, "Mappa törölve.");
            },
          }] : []),
        ]} />
      )}
    </div>
  );
}
