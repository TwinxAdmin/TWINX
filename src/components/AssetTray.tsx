// Közös "korábbi munkák" tálca — minden képes ingatlan-modul alján ugyanaz.
// Mappák (elnevezett ingatlan-mappák + dátum-mappák) + Kedvencek. Egy mappára kattintva
// a tartalma jobb oldalt, a lap margójában, becsúszó panelben nyílik meg.
// Lehet: + új mappa, mappa átnevezése (a Kedvencek kivételével), és képet egy mappához
// rendelni (címkézés) legördülőből VAGY a mappára húzva. A képek a munkába is behúzhatók.
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { showToast } from "@/components/Toast";
import { compressImage } from "@/lib/image-compress";
import { WorkDot, isWorkKind, type WorkKind } from "@/components/WorkBadge";

export const TWX_DRAG_TYPE = "application/x-twinx-url";
export function readTwxDragUrl(dt: DataTransfer): string {
  return dt.getData(TWX_DRAG_TYPE) || "";
}

type Folder = { id: string | null; key: string; kind: "named" | "date"; label: string; urls: string[] };
const FAV_KEY = "__fav__";
const API = "/api/real-estate";

export default function AssetTray({
  onPick,
  selectedUrls = [],
  title = "Korábbi munkák",
  note = "Válassz egy mappát, majd húzd a képet a munkádba, vagy kattints rá a hozzáadáshoz.",
  reloadKey = 0,
}: {
  // onPick: a kattintott kép + a mappa teljes képlistája, az index (lapozáshoz)
  // és a munkatípus-jelölések (url -> milyen munkák mentek végbe rajta)
  onPick?: (url: string, folderUrls: string[], index: number, badges?: Record<string, WorkKind[]>) => void;
  selectedUrls?: string[];
  title?: string;
  note?: string;
  reloadKey?: number;
}) {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [badges, setBadges] = useState<Record<string, WorkKind[]>>({});
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(false);

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null); // folder key
  const [renameValue, setRenameValue] = useState("");
  const [assignFor, setAssignFor] = useState<string | null>(null); // image url
  const [menuFor, setMenuFor] = useState<string | null>(null); // folder key (⋯ menü)
  const [uploading, setUploading] = useState(false);
  const uploadRef = useRef<HTMLInputElement>(null);

  const fetchAssets = useCallback(async () => {
    try {
      const res = await fetch(`${API}/assets`);
      const data = await res.json();
      if (res.ok) {
        setFolders(data.folders ?? []);
        setFavorites(data.favorites ?? []);
        const raw = (data.badges ?? {}) as Record<string, string[]>;
        const clean: Record<string, WorkKind[]> = {};
        for (const [url, ks] of Object.entries(raw)) clean[url] = ks.filter(isWorkKind);
        setBadges(clean);
      }
    } catch {
      /* tálca nélkül is működik a modul */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { setLoading(true); void fetchAssets(); }, [fetchAssets, reloadKey]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(null); setAssignFor(null); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const selected = new Set(selectedUrls);
  const namedFolders = folders.filter((f) => f.kind === "named");
  const openFolder = folders.find((f) => f.key === open);
  const openUrls = open === FAV_KEY ? favorites : (openFolder?.urls ?? []);
  const openLabel = open === FAV_KEY ? "Kedvencek" : (openFolder?.label ?? "");

  // --- Mappa-műveletek ---
  async function createFolder(name: string, assignUrl?: string) {
    const n = name.trim();
    if (!n) return;
    try {
      const res = await fetch(`${API}/folders`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: n }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (assignUrl && data.folder?.id) {
        await fetch(`${API}/folders/items`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ folderId: data.folder.id, url: assignUrl }) });
      }
      showToast("Mappa létrehozva.", "success");
      setCreating(false); setNewName("");
      await fetchAssets();
    } catch { showToast("Nem sikerült létrehozni a mappát.", "error"); }
  }
  async function renameFolder(f: Folder, name: string) {
    const n = name.trim();
    if (!n) return;
    const payload = f.kind === "named" ? { id: f.id, name: n } : { dateKey: f.key.replace(/^date:/, ""), name: n };
    try {
      const res = await fetch(`${API}/folders`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error();
      showToast("Átnevezve.", "success");
      setRenaming(null);
      await fetchAssets();
    } catch { showToast("Nem sikerült átnevezni.", "error"); }
  }
  async function deleteFolder(f: Folder) {
    // Elnevezett mappa: valódi törlés. Dátum-mappa: elrejtés (a képek megmaradnak).
    const qs = f.kind === "named" && f.id
      ? `id=${encodeURIComponent(f.id)}`
      : `dateKey=${encodeURIComponent(f.key.replace(/^date:/, ""))}`;
    try {
      const res = await fetch(`${API}/folders?${qs}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      if (open === f.key) setOpen(null);
      showToast("Mappa törölve.", "info");
      await fetchAssets();
    } catch { showToast("Nem sikerült törölni.", "error"); }
  }
  // Megerősítő szöveg mappa-típus szerint.
  const confirmDelete = (f: Folder) =>
    confirm(
      f.kind === "named"
        ? `Törlöd a(z) „${f.label}" mappát? A képek megmaradnak.`
        : `Eltávolítod a(z) „${f.label}" mappát a listából? A képek megmaradnak a fiókodban.`
    );
  async function assignToFolder(folderId: string, url: string) {
    try {
      const res = await fetch(`${API}/folders/items`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ folderId, url }) });
      if (!res.ok) throw new Error();
      showToast("Áthelyezve a mappába.", "success");
      setAssignFor(null);
      await fetchAssets();
    } catch { showToast("Nem sikerült áthelyezni.", "error"); }
  }
  async function removeFromFolder(folderId: string, url: string) {
    try {
      const res = await fetch(`${API}/folders/items?folderId=${encodeURIComponent(folderId)}&url=${encodeURIComponent(url)}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      showToast("Kivéve a mappából.", "info");
      await fetchAssets();
    } catch { showToast("Nem sikerült.", "error"); }
  }
  async function uploadToFolder(folderId: string, files: FileList | null) {
    if (!files || !files.length) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("folderId", folderId);
      for (const f of Array.from(files)) fd.append("images", await compressImage(f, 1600, 0.85));
      const res = await fetch(`${API}/folders/upload`, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showToast("Kép feltöltve a mappába.", "success");
      await fetchAssets();
    } catch {
      showToast("Nem sikerült feltölteni.", "error");
    } finally {
      setUploading(false);
    }
  }
  async function addFavorite(url: string) {
    try {
      const res = await fetch(`${API}/image-enhance/favorites`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enhanced: url, original: url }) });
      if (!res.ok) throw new Error();
      showToast("Kedvencekhez adva.", "success");
      await fetchAssets();
    } catch { showToast("Nem sikerült.", "error"); }
  }

  const dragStart = (e: React.DragEvent, url: string) => {
    e.dataTransfer.setData(TWX_DRAG_TYPE, url);
    e.dataTransfer.setData("text/plain", url);
    e.dataTransfer.effectAllowed = "copy";
  };
  const dropOnEntry = (e: React.DragEvent, entry: { kind: string; id?: string | null }) => {
    e.preventDefault();
    const url = readTwxDragUrl(e.dataTransfer);
    if (!url) return;
    if (entry.kind === "named" && entry.id) void assignToFolder(entry.id, url);
    else if (entry.kind === "fav") void addFavorite(url);
  };

  // --- Lista (max 9 + kereső) ---
  type Entry = { key: string; label: string; count: number; kind: "fav" | "named" | "date"; id?: string | null };
  const entries: Entry[] = [
    ...(favorites.length > 0 ? [{ key: FAV_KEY, label: "Kedvencek", count: favorites.length, kind: "fav" as const }] : []),
    ...folders.map((f) => ({ key: f.key, label: f.label, count: f.urls.length, kind: f.kind, id: f.id })),
  ];
  const q = query.trim().toLowerCase();
  const filtered = q ? entries.filter((e) => e.label.toLowerCase().includes(q)) : entries;
  const LIMIT = 8;
  const visibleEntries = expanded ? filtered : filtered.slice(0, LIMIT);

  if (loading) {
    return (
      <section className="twx-card p-5 sm:p-6">
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="mt-2 text-sm" style={{ color: "var(--twx-ink-muted)" }}>Betöltés…</p>
      </section>
    );
  }

  return (
    <>
      <section className="twx-card p-5 sm:p-6">
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="mt-0.5 text-xs" style={{ color: "var(--twx-ink-muted)" }}>{note}</p>

        {entries.length > LIMIT && (
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Keresés a mappák közt…"
            className="twx-input mt-3 w-full text-sm"
          />
        )}

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {visibleEntries.map((e) => {
            const on = open === e.key;
            const canEdit = e.kind !== "fav";
            const isRenaming = renaming === e.key;
            return (
              <div
                key={e.key}
                onDragOver={(ev) => { if (e.kind === "named" || e.kind === "fav") ev.preventDefault(); }}
                onDrop={(ev) => dropOnEntry(ev, e)}
                className="group relative rounded-xl border transition hover:shadow-sm"
                style={{ borderColor: on ? "var(--twx-coral)" : "var(--twx-line)", background: on ? "var(--twx-coral-soft)" : "#fff" }}
              >
                {isRenaming ? (
                  <div className="flex items-center gap-1 p-2">
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={(ev) => setRenameValue(ev.target.value)}
                      onKeyDown={(ev) => { if (ev.key === "Enter") { const f = folders.find((x) => x.key === e.key); if (f) void renameFolder(f, renameValue); } if (ev.key === "Escape") setRenaming(null); }}
                      className="twx-input w-full text-sm"
                      placeholder="Mappa neve"
                    />
                    <button type="button" onClick={() => { const f = folders.find((x) => x.key === e.key); if (f) void renameFolder(f, renameValue); }} className="rounded px-2 py-1 text-xs font-semibold text-white" style={{ background: "var(--twx-coral)" }}>OK</button>
                  </div>
                ) : (
                  <button type="button" onClick={() => setOpen((cur) => (cur === e.key ? null : e.key))} className="flex w-full items-center justify-between gap-2 p-3 text-left">
                    <span className="flex min-w-0 items-center gap-2">
                      {e.kind === "fav" ? (
                        <StarIcon />
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" className="shrink-0" style={{ color: "var(--twx-coral)" }} aria-hidden>
                          <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
                        </svg>
                      )}
                      <span className="truncate font-display text-sm font-semibold">{e.label}</span>
                    </span>
                    <span className="shrink-0 text-xs" style={{ color: "var(--twx-ink-muted)" }}>{e.count}</span>
                  </button>
                )}

                {/* Három-pont menü (átnevezés / törlés) — Kedvenceknél nem */}
                {canEdit && !isRenaming && (
                  <div className="absolute right-1 top-1">
                    <button type="button" aria-label="Lehetőségek"
                      onClick={(ev) => { ev.stopPropagation(); setMenuFor(menuFor === e.key ? null : e.key); }}
                      className="flex h-6 w-6 items-center justify-center rounded-full" style={{ background: "rgba(255,255,255,0.9)", border: "1px solid var(--twx-line)" }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ color: "var(--twx-ink-muted)" }} aria-hidden><circle cx="5" cy="12" r="1.7" /><circle cx="12" cy="12" r="1.7" /><circle cx="19" cy="12" r="1.7" /></svg>
                    </button>
                    {menuFor === e.key && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={(ev) => { ev.stopPropagation(); setMenuFor(null); }} />
                        <div className="absolute right-0 z-20 mt-1 w-36 overflow-hidden rounded-lg border text-sm shadow-lg" style={{ borderColor: "var(--twx-line)", background: "#fff" }} onClick={(ev) => ev.stopPropagation()}>
                          <button type="button" onClick={() => { setRenaming(e.key); setRenameValue(e.label); setMenuFor(null); }} className="block w-full px-3 py-2 text-left hover:bg-black/[0.04]">Átnevezés</button>
                          <button type="button" onClick={() => { const f = folders.find((x) => x.key === e.key); setMenuFor(null); if (f && confirmDelete(f)) void deleteFolder(f); }} className="block w-full px-3 py-2 text-left text-red-600 hover:bg-black/[0.04]">Törlés</button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* + Új mappa */}
          {creating ? (
            <div className="flex items-center gap-1 rounded-xl border p-2" style={{ borderColor: "var(--twx-coral)", background: "#fff" }}>
              <input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void createFolder(newName); if (e.key === "Escape") { setCreating(false); setNewName(""); } }}
                placeholder="Pl. Kossuth u. 12." className="twx-input w-full text-sm" />
              <button type="button" onClick={() => void createFolder(newName)} className="rounded px-2 py-1 text-xs font-semibold text-white" style={{ background: "var(--twx-coral)" }}>OK</button>
            </div>
          ) : (
            <button type="button" onClick={() => setCreating(true)}
              className="flex items-center justify-center gap-2 rounded-xl border border-dashed p-3 text-sm font-medium transition hover:shadow-sm"
              style={{ borderColor: "var(--twx-line)", color: "var(--twx-coral)", background: "#fff" }}>
              <span className="text-lg leading-none">＋</span> Új mappa
            </button>
          )}
        </div>

        {visibleEntries.length === 0 && (
          <p className="mt-2 text-sm" style={{ color: "var(--twx-ink-muted)" }}>Nincs találat.</p>
        )}
        {filtered.length > LIMIT && (
          <button type="button" onClick={() => setExpanded((v) => !v)}
            className="mt-2 rounded-xl border px-4 py-2 text-xs font-medium transition hover:shadow-sm"
            style={{ borderColor: "var(--twx-line)", color: "var(--twx-coral)", background: "#fff" }}>
            {expanded ? "Kevesebb" : `Továbbiak (${filtered.length - LIMIT})`}
          </button>
        )}
      </section>

      {/* Jobb oldalt becsúszó panel — a lap margójában */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="drawer"
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 40 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="fixed right-4 top-28 z-40 flex max-h-[74vh] w-[min(360px,92vw)] flex-col overflow-hidden rounded-2xl"
            style={{ background: "var(--twx-cream-card)", border: "1px solid var(--twx-line)", boxShadow: "0 24px 60px rgba(0,0,0,0.18)" }}
          >
            <div className="flex items-center justify-between gap-2 border-b p-3" style={{ borderColor: "var(--twx-line)" }}>
              {renaming === open && open !== FAV_KEY ? (
                <div className="flex flex-1 items-center gap-1">
                  <input autoFocus value={renameValue} onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && openFolder) void renameFolder(openFolder, renameValue); if (e.key === "Escape") setRenaming(null); }}
                    className="twx-input w-full text-sm" placeholder="Mappa neve" />
                  <button type="button" onClick={() => openFolder && void renameFolder(openFolder, renameValue)} className="rounded px-2 py-1 text-xs font-semibold text-white" style={{ background: "var(--twx-coral)" }}>OK</button>
                </div>
              ) : (
                <div className="min-w-0 flex-1 truncate font-display text-sm font-semibold">{openLabel} · {openUrls.length} kép</div>
              )}
              <div className="flex shrink-0 items-center gap-1">
                {open !== FAV_KEY && renaming !== open && (
                  <button type="button" title="Átnevezés" aria-label="Átnevezés" onClick={() => { setRenaming(open); setRenameValue(openLabel); }}
                    className="flex h-7 w-7 items-center justify-center rounded-full" style={{ border: "1px solid var(--twx-line)" }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--twx-ink-muted)" }}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
                  </button>
                )}
                {openFolder && (
                  <button type="button" title="Törlés" aria-label="Törlés" onClick={() => { if (confirmDelete(openFolder)) void deleteFolder(openFolder); }}
                    className="flex h-7 w-7 items-center justify-center rounded-full" style={{ border: "1px solid var(--twx-line)" }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "#dc2626" }}><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" /></svg>
                  </button>
                )}
                <button onClick={() => { setOpen(null); setAssignFor(null); }} className="rounded-lg px-2 text-lg" style={{ color: "var(--twx-ink-muted)" }} aria-label="Bezár">×</button>
              </div>
            </div>

            {/* Kép feltöltése ebbe a mappába (csak elnevezett mappánál) */}
            {openFolder?.kind === "named" && openFolder.id && (
              <div className="border-b p-3" style={{ borderColor: "var(--twx-line)" }}>
                <button type="button" onClick={() => uploadRef.current?.click()} disabled={uploading}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); const url = readTwxDragUrl(e.dataTransfer); if (url && openFolder.id) { void assignToFolder(openFolder.id, url); } else if (openFolder.id) { void uploadToFolder(openFolder.id, e.dataTransfer.files); } }}
                  className="w-full rounded-xl border-2 border-dashed p-3 text-center text-xs disabled:opacity-60" style={{ borderColor: "var(--twx-line)", color: "var(--twx-ink-muted)" }}>
                  {uploading ? "Feltöltés…" : "Kép feltöltése ide — tallózás vagy húzd ide (JPG, PNG, WEBP)"}
                </button>
                <input ref={uploadRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden"
                  onChange={(e) => { if (openFolder.id) void uploadToFolder(openFolder.id, e.target.files); e.currentTarget.value = ""; }} />
              </div>
            )}

            {/* Áthelyezés menü (egy kijelölt képhez) */}
            {assignFor && (
              <div className="border-b p-3" style={{ borderColor: "var(--twx-line)", background: "var(--twx-cream)" }}>
                <div className="mb-2 text-xs font-semibold">Áthelyezés mappába:</div>
                <div className="flex flex-wrap gap-1.5">
                  {namedFolders.length === 0 && (
                    <span className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>Még nincs ingatlan-mappád — hozz létre egyet a ＋ gombbal.</span>
                  )}
                  {namedFolders.map((f) => (
                    <button key={f.key} type="button" onClick={() => f.id && void assignToFolder(f.id, assignFor)}
                      className="rounded-full border px-3 py-1 text-xs font-medium transition hover:shadow-sm"
                      style={{ borderColor: "var(--twx-line)", background: "#fff" }}>{f.label}</button>
                  ))}
                  <button type="button" onClick={() => { const name = prompt("Új mappa neve (pl. ingatlan címe):"); if (name) void createFolder(name, assignFor); }}
                    className="rounded-full px-3 py-1 text-xs font-semibold text-white" style={{ background: "var(--twx-coral)" }}>＋ Új mappa</button>
                  <button type="button" onClick={() => setAssignFor(null)} className="rounded-full px-3 py-1 text-xs" style={{ color: "var(--twx-ink-muted)" }}>Mégse</button>
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-3">
              {openUrls.length === 0 ? (
                <p className="text-sm" style={{ color: "var(--twx-ink-muted)" }}>Nincs kép ebben a mappában.</p>
              ) : (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {openUrls.map((url, idx) => {
                    const isSel = selected.has(url);
                    return (
                      <div key={url} className="relative overflow-hidden rounded-lg border-2" style={{ borderColor: isSel ? "var(--twx-coral)" : "var(--twx-line)" }}>
                        <button
                          type="button"
                          draggable
                          onDragStart={(e) => dragStart(e, url)}
                          onClick={() => onPick?.(url, openUrls, idx, badges)}
                          title={onPick ? "Kattints a hozzáadáshoz, vagy húzd a munkádba / egy mappára" : "Húzd a munkádba vagy egy mappára"}
                          className="block w-full cursor-grab active:cursor-grabbing"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={url} alt="Korábbi kép" draggable={false} className="h-20 w-full object-cover" />
                        </button>
                        {/* Munkatípus-jelölések: milyen munka ment végbe ezen a képen */}
                        {(badges[url] ?? []).length > 0 && (
                          <span className="pointer-events-none absolute bottom-1 left-1 flex gap-1">
                            {(badges[url] ?? []).map((k) => <WorkDot key={k} kind={k} size={20} />)}
                          </span>
                        )}
                        {/* Áthelyezés gomb */}
                        <button type="button" title="Áthelyezés mappába" aria-label="Áthelyezés mappába"
                          onClick={() => setAssignFor(assignFor === url ? null : url)}
                          className="absolute left-1 top-1 flex h-6 w-6 items-center justify-center rounded-full" style={{ background: "rgba(255,255,255,0.92)", border: "1px solid var(--twx-line)" }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" style={{ color: "var(--twx-coral)" }}><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" /></svg>
                        </button>
                        {/* Kivétel a mappából (csak elnevezett mappa nézetében) */}
                        {openFolder?.kind === "named" && openFolder.id && (
                          <button type="button" title="Kivétel a mappából" aria-label="Kivétel a mappából"
                            onClick={() => openFolder.id && void removeFromFolder(openFolder.id, url)}
                            className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full text-sm" style={{ background: "rgba(20,12,8,0.6)", color: "#fff" }}>×</button>
                        )}
                        {isSel && (
                          <span className="absolute bottom-1 right-1 flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold" style={{ background: "var(--twx-coral)", color: "#1c1005" }}>✓</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function StarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" strokeWidth="1.6" strokeLinejoin="round" className="shrink-0" fill="var(--twx-coral)" stroke="var(--twx-coral)" aria-hidden>
      <path d="m12 3 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 18.3 6.2 21.4l1.1-6.5L2.6 10l6.5-.9L12 3Z" />
    </svg>
  );
}
