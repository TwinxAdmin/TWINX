// WorksLibrary — a „Korábbi munkák" oldal, fájlkezelő-elrendezésben.
//
//   BAL  oldalsáv:  MUNKÁK         Összes munkám + típus szerint (Videók, Értékbecslések…)
//                   SAJÁT MAPPÁIM  (+ új · átnevezés · törlés — csak te látod)
//                   IRODAI MAPPÁK  (irodai tagnak; a kollégákkal közös)
//   JOBB fő rész:   fejléc (név, darabszám) · kereső · típus-szűrő · kártyarács
//                   kártyán: bélyegkép + típus/fájl címke; „Mappába" gyorsgomb; kattintásra a közös nézegető.
// Mobilon az oldalsáv egy vízszintesen görgethető választó-sávvá alakul.
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { WorkItem } from "@/components/dashboard/WorksBrowser";
import type { OfficeFolder, OfficeFolderItem } from "@/lib/office";
import { WORK_FOLDER_NAME_MAX, type WorkFolder, type WorkFolderLink } from "@/lib/work-folders";
import { fmtWhen } from "@/lib/office-format";
import { showToast } from "@/components/Toast";
import { toDownloadUrl } from "@/lib/files";
import { ActionMenu, MI, MenuDots, useActionMenu, type MenuItem, type SubItem } from "@/components/ui/ActionMenu";
import WorkViewer, { type ViewerWork } from "@/components/works/WorkViewer";
import WorkThumb from "@/components/works/WorkThumb";
import WorkTypeBadge, { CATEGORY_META, FileTag, workCategory, type WorkCategory } from "@/components/works/WorkTypeBadge";

type Sel =
  | { kind: "all" }
  | { kind: "mine"; id: string }
  | { kind: "cat"; cat: WorkCategory }
  | { kind: "office"; id: string }
  | { kind: "hidden" };

/** Egy kártya adatai — saját és irodai munkához egyaránt. */
type Card = {
  id: string; feature: string; title: string; typeLabel: string; url: string | null; createdAt: string;
  mine: boolean; ownerName?: string | null;
  canRemove?: boolean;   // irodai mappában: kiveheti-e (készítő / betevő / mappa-kezelő)
};

/** Saját drag-típus: csak a munkakártyák húzhatók a mappákra (más húzott tartalom nem). */
const DRAG_TYPE = "application/x-twx-work";

/** Kis „cédula" húzás közben a kártya teljes képe helyett. */
function dragGhost(title: string): HTMLElement {
  const el = document.createElement("div");
  el.textContent = `📄 ${title.length > 40 ? `${title.slice(0, 39)}…` : title}`;
  Object.assign(el.style, {
    position: "fixed", top: "-1000px", left: "-1000px", padding: "8px 12px", borderRadius: "999px",
    background: "#1C1A17", color: "#fff", font: "600 12px system-ui, sans-serif", whiteSpace: "nowrap",
    boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
  });
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 0);
  return el;
}

const CAT_PLURAL: Record<WorkCategory, string> = {
  video: "Videók", valuation: "Értékbecslések", visual: "Látványtervek", enhance: "Képjavítások",
  ad: "Hirdetések", text: "Elemzések", other: "Egyéb",
};

export default function WorksLibrary({ items, isMember, initial }: {
  items: WorkItem[]; isMember: boolean; initial: Sel;
}) {
  const [sel, setSel] = useState<Sel>(initial);
  const [mine, setMine] = useState<{ folders: WorkFolder[]; links: WorkFolderLink[]; error?: string } | null>(null);
  const [office, setOffice] = useState<OfficeFolder[] | null>(isMember ? null : []);
  const [officeItems, setOfficeItems] = useState<OfficeFolderItem[] | null>(null);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<WorkCategory | "all">("all");
  const [view, setView] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState("");
  const [dragging, setDragging] = useState(false);
  // helyi módosítások (átnevezés / elrejtés) — azonnal látszanak, újratöltés nélkül
  const [patches, setPatches] = useState<Record<string, { title?: string; hidden?: boolean }>>({});
  const [cardRename, setCardRename] = useState<{ id: string; value: string } | null>(null);
  const menu = useActionMenu();
  const [menuCard, setMenuCard] = useState<Card | null>(null);
  const [officeIn, setOfficeIn] = useState<Record<string, string[]>>({});   // munka → közös mappák, ahol már benne van   // épp húznak egy munkát → a mappák jelzik, hogy ide lehet ejteni

  const loadMine = useCallback(() => {
    fetch("/api/work-folders").then((r) => r.json())
      .then((d) => setMine({ folders: d.folders ?? [], links: d.links ?? [], error: d.error }))
      .catch(() => setMine({ folders: [], links: [], error: "Nem sikerült betölteni a mappáidat." }));
  }, []);

  useEffect(() => { loadMine(); }, [loadMine]);
  useEffect(() => {
    const on = () => loadMine();
    window.addEventListener("twx-works-changed", on);
    return () => window.removeEventListener("twx-works-changed", on);
  }, [loadMine]);
  useEffect(() => {
    if (!isMember) return;
    fetch("/api/office/folders").then((r) => r.json()).then((d) => setOffice(d.folders ?? [])).catch(() => setOffice([]));
  }, [isMember]);

  // irodai mappa tartalma
  const officeId = sel.kind === "office" ? sel.id : null;
  useEffect(() => {
    if (!officeId) return;
    setOfficeItems(null);
    fetch(`/api/office/folders/items?folderId=${officeId}`).then((r) => r.json())
      .then((d) => setOfficeItems(d.items ?? [])).catch(() => setOfficeItems([]));
  }, [officeId]);

  // választás → URL (megosztható / visszalépésnél megmarad)
  function choose(s: Sel) {
    setSel(s); setCat("all"); setQ(""); setView(null);
    const url = new URL(window.location.href);
    ["tab", "folder", "mappa", "tipus"].forEach((k) => url.searchParams.delete(k));
    if (s.kind === "mine") url.searchParams.set("mappa", s.id);
    if (s.kind === "office") url.searchParams.set("folder", s.id);
    if (s.kind === "cat") url.searchParams.set("tipus", s.cat);
    window.history.replaceState(null, "", url.toString());
  }

  // ---- kártyák az aktuális nézethez ----
  const allOwn = useMemo(() => items.map((h) => ({
    card: {
      id: h.id, feature: h.feature, title: patches[h.id]?.title ?? h.title, typeLabel: h.typeLabel,
      url: h.output_file_url, createdAt: h.created_at, mine: true,
    } as Card,
    hidden: patches[h.id]?.hidden ?? !!h.hidden,
  })), [items, patches]);
  const ownCards: Card[] = useMemo(() => allOwn.filter((x) => !x.hidden).map((x) => x.card), [allOwn]);
  const hiddenCards: Card[] = useMemo(() => allOwn.filter((x) => x.hidden).map((x) => x.card), [allOwn]);

  const base: Card[] | null = useMemo(() => {
    if (sel.kind === "all") return ownCards;
    if (sel.kind === "hidden") return hiddenCards;
    if (sel.kind === "cat") return ownCards.filter((c) => workCategory(c.feature) === sel.cat);
    if (sel.kind === "mine") {
      if (!mine) return null;
      const ids = new Set(mine.links.filter((l) => l.folderId === sel.id).map((l) => l.historyId));
      return ownCards.filter((c) => ids.has(c.id));
    }
    if (!officeItems) return null;
    return officeItems.map((it) => ({
      id: it.historyId, feature: it.feature, typeLabel: it.typeLabel, url: it.url, createdAt: it.createdAt,
      title: patches[it.historyId]?.title ?? it.title,
      mine: !!it.mine, ownerName: it.mine ? null : it.ownerName, canRemove: it.canRemove,
    }));
  }, [sel, ownCards, hiddenCards, mine, officeItems, patches]);

  const catCounts = useMemo(() => {
    const m = new Map<WorkCategory, number>();
    for (const c of base ?? []) m.set(workCategory(c.feature), (m.get(workCategory(c.feature)) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [base]);

  const needle = q.trim().toLowerCase();
  const shown = (base ?? []).filter((c) =>
    (cat === "all" || workCategory(c.feature) === cat) &&
    (!needle || `${c.title} ${c.typeLabel} ${c.ownerName ?? ""}`.toLowerCase().includes(needle)));

  // oldalsáv darabszámok
  const sideCats = useMemo(() => {
    const m = new Map<WorkCategory, number>();
    for (const c of ownCards) m.set(workCategory(c.feature), (m.get(workCategory(c.feature)) ?? 0) + 1);
    return (Object.keys(CAT_PLURAL) as WorkCategory[]).filter((k) => m.get(k)).map((k) => [k, m.get(k) as number] as const);
  }, [ownCards]);
  const mineCount = (id: string) => mine?.links.filter((l) => l.folderId === id).length ?? 0;

  // fejléc
  const curMine = sel.kind === "mine" ? mine?.folders.find((f) => f.id === sel.id) ?? null : null;
  const curOffice = sel.kind === "office" ? office?.find((f) => f.id === sel.id) ?? null : null;
  const head = sel.kind === "hidden" ? { kicker: "Munkák", title: "Elrejtett munkák", sub: "Amit töröltél a listádból. A fájlok megvannak — innen visszahozhatod őket." }
    : sel.kind === "all" ? { kicker: "Korábbi munkák", title: "Összes munkám", sub: "Minden, amit a modulokban elkészítettél." }
    : sel.kind === "cat" ? { kicker: "Típus szerint", title: CAT_PLURAL[sel.cat], sub: "Automatikusan csoportosítva." }
    : sel.kind === "mine" ? { kicker: "Saját mappa · csak te látod", title: curMine?.name ?? "Mappa", sub: "Saját rendszerezés — a munkák a helyükön maradnak." }
    : { kicker: "Irodai mappa · közös", title: curOffice?.name ?? "Irodai mappa", sub: curOffice ? (curOffice.everyone ? "Az egész iroda látja." : `${curOffice.memberIds.length + 1} tag látja.`) : "" };

  // ---- saját mappa műveletek ----
  async function createFolder() {
    const name = newName.trim();
    if (!name) { setCreating(false); return; }
    const res = await fetch("/api/work-folders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
    const d = await res.json();
    if (!res.ok) { showToast(d.error ?? "Nem sikerült létrehozni.", "error"); return; }
    setMine({ folders: d.folders, links: d.links });
    setNewName(""); setCreating(false);
    choose({ kind: "mine", id: d.id });
    showToast(`Kész: „${name}”. Húzz bele egy munkát, vagy a kártya ⋯ menüjében válaszd az „Áthelyezés” pontot.`, "success");
  }
  async function renameFolder(id: string) {
    const name = renameVal.trim();
    setRenaming(null);
    const old = mine?.folders.find((f) => f.id === id)?.name;
    if (!name || name === old) return;
    const res = await fetch("/api/work-folders", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, name }) });
    const d = await res.json();
    if (!res.ok) { showToast(d.error ?? "Nem sikerült átnevezni.", "error"); return; }
    setMine({ folders: d.folders, links: d.links });
  }
  async function deleteFolder(f: WorkFolder) {
    if (!window.confirm(`Törlöd a(z) „${f.name}” mappát? A benne lévő munkák megmaradnak, csak a mappa szűnik meg.`)) return;
    const res = await fetch("/api/work-folders", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: f.id }) });
    const d = await res.json();
    if (!res.ok) { showToast(d.error ?? "Nem sikerült törölni.", "error"); return; }
    setMine({ folders: d.folders, links: d.links });
    if (sel.kind === "mine" && sel.id === f.id) choose({ kind: "all" });
    showToast("Mappa törölve — a munkák megmaradtak.", "success");
  }
  // ---- drag & drop: munka → mappa a bal sávban ----
  const reloadOffice = () => {
    if (isMember) fetch("/api/office/folders").then((r) => r.json()).then((d) => setOffice(d.folders ?? [])).catch(() => {});
  };
  async function dropInto(target: { kind: "mine" | "office"; id: string; name: string }, historyId: string) {
    setDragging(false);
    if (target.kind === "mine" && mine?.links.some((l) => l.folderId === target.id && l.historyId === historyId)) {
      showToast(`Már benne van a(z) „${target.name}” mappában.`, "info");
      return;
    }
    const res = await fetch(target.kind === "mine" ? "/api/work-folders/items" : "/api/office/folders/items", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ folderId: target.id, historyId }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { showToast(d.error ?? "Nem sikerült a mappába tenni.", "error"); return; }
    if (target.kind === "mine") loadMine(); else reloadOffice();
    showToast(`Betéve a(z) „${target.name}” ${target.kind === "office" ? "közös " : ""}mappába.`, "success");
  }

  async function removeFromMine(c: Card) {
    if (sel.kind !== "mine") return;
    const res = await fetch("/api/work-folders/items", {
      method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ folderId: sel.id, historyId: c.id }),
    });
    if (!res.ok) { showToast("Nem sikerült kivenni.", "error"); return; }
    loadMine();
    showToast("Kivetted a mappából.", "success");
  }

  // ---- kártya-műveletek (⋯ menü) ----
  async function saveCardRename() {
    if (!cardRename) return;
    const { id, value } = cardRename;
    setCardRename(null);
    const title = value.trim();
    const cur = (base ?? []).find((c) => c.id === id)?.title;
    if (!title || title === cur) return;
    const res = await fetch("/api/works", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, title }) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { showToast(d.error ?? "Nem sikerült átnevezni.", "error"); return; }
    setPatches((p) => ({ ...p, [id]: { ...p[id], title } }));
    window.dispatchEvent(new CustomEvent("twx-works-changed"));
  }
  async function setHidden(c: Card, hidden: boolean) {
    if (hidden && !window.confirm(`Törlöd a(z) „${c.title}” munkát a listádból?\n\nA fájl megmarad — az „Elrejtett munkák” közül bármikor visszahozhatod.`)) return;
    const res = await fetch("/api/works", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: c.id, hidden }) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { showToast(d.error ?? "Nem sikerült.", "error"); return; }
    setPatches((p) => ({ ...p, [c.id]: { ...p[c.id], hidden } }));
    showToast(hidden ? "Törölve a listádból — az Elrejtett munkák közül visszahozható." : "Visszahoztad a munkát.", "success");
  }
  async function moveMine(c: Card, toId: string) {
    if (sel.kind !== "mine") return;
    const to = mine?.folders.find((f) => f.id === toId);
    const post = await fetch("/api/work-folders/items", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ folderId: toId, historyId: c.id }) });
    if (!post.ok) { showToast("Nem sikerült áthelyezni.", "error"); return; }
    await fetch("/api/work-folders/items", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ folderId: sel.id, historyId: c.id }) });
    loadMine();
    showToast(`Áthelyezve: „${to?.name ?? "mappa"}”.`, "success");
  }
  async function removeFromOffice(c: Card) {
    if (sel.kind !== "office") return;
    const res = await fetch("/api/office/folders/items", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ folderId: sel.id, historyId: c.id }) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { showToast(d.error ?? "Nem sikerült kivenni.", "error"); return; }
    setOfficeItems((list) => (list ?? []).filter((x) => x.historyId !== c.id));
    reloadOffice();
    showToast("Kivetted a közös mappából.", "success");
  }

  /** A ⋯ menü tartalma — a nézettől és attól függ, hogy a munka a sajátod-e. */
  function menuItems(c: Card): MenuItem[] {
    const list: MenuItem[] = [];
    if (c.url) list.push({ kind: "link", label: "Letöltés", icon: MI.download, href: toDownloadUrl(c.url) });
    if (c.mine && sel.kind !== "hidden") {
      // „Áthelyezés": a menü MELLETT kinyíló lista — Saját mappáim + Közös irodai mappák.
      // Saját mappán belül a többi saját mappa = valódi áthelyezés; egyébként ✓ ki-be (több mappában is lehet).
      const subItems: SubItem[] = [];
      const wfs = mine?.folders ?? [];
      if (wfs.length) {
        subItems.push({ id: "__h_mine", header: "Saját mappáim", hint: "csak te látod" });
        for (const f of wfs) {
          const isIn = !!mine?.links.some((l) => l.folderId === f.id && l.historyId === c.id);
          if (sel.kind === "mine") {
            subItems.push({ id: `w:${f.id}`, label: f.name, checked: f.id === sel.id, disabled: f.id === sel.id, onClick: () => moveMine(c, f.id) });
          } else {
            subItems.push({ id: `w:${f.id}`, label: f.name, checked: isIn, onClick: () => toggleFolder("mine", f.id, f.name, c.id, isIn) });
          }
        }
      }
      if (isMember && (office ?? []).length) {
        subItems.push({ id: "__h_office", header: "Közös irodai mappák", hint: "a kollégák is látják" });
        for (const f of office ?? []) {
          const isIn = (officeIn[c.id] ?? []).includes(f.id);
          subItems.push({ id: `o:${f.id}`, label: f.name, checked: isIn, onClick: () => toggleFolder("office", f.id, f.name, c.id, isIn) });
        }
      }
      list.push({
        kind: "sub", label: "Áthelyezés", icon: MI.move, title: sel.kind === "mine" ? "Melyik mappába kerüljön?" : "Melyik mappába? (✓ = benne van)",
        empty: "Még nincs mappád — a bal sávban a „+” gombbal hozhatsz létre.",
        items: subItems,
      });
      list.push({ label: "Átnevezés", icon: MI.rename, onClick: () => setCardRename({ id: c.id, value: c.title }) });
    }
    if (sel.kind === "mine") {
      list.push({ kind: "divider" }, { label: "Kivétel a mappából", icon: MI.out, onClick: () => void removeFromMine(c) });
    } else if (sel.kind === "office") {
      list.push({ kind: "divider" }, {
        label: "Kivétel a közös mappából", icon: MI.out, onClick: () => void removeFromOffice(c),
        disabled: !c.canRemove, hint: "Csak a készítő, a betevő vagy a mappa kezelője veheti ki.",
      });
    } else if (sel.kind === "hidden") {
      list.push({ label: "Visszahozás", icon: MI.restore, onClick: () => void setHidden(c, false) });
    } else if (c.mine) {
      list.push({ kind: "divider" }, { label: "Törlés", icon: MI.trash, danger: true, onClick: () => void setHidden(c, true) });
    }
    return list;
  }
  const openMenu = (e: React.MouseEvent<HTMLElement>, c: Card, how: "button" | "event") => {
    setMenuCard(c);
    if (how === "button") menu.openAtButton(e); else menu.openAtEvent(e);
    // mely közös mappákban van már (a ✓ jelekhez)
    if (isMember && c.mine && !officeIn[c.id]) {
      fetch(`/api/office/folders/items?historyId=${c.id}`).then((r) => r.json())
        .then((d) => setOfficeIn((m) => ({ ...m, [c.id]: d.folderIds ?? [] }))).catch(() => {});
    }
  };
  async function toggleFolder(kind: "mine" | "office", folderId: string, name: string, historyId: string, isIn: boolean) {
    const res = await fetch(kind === "mine" ? "/api/work-folders/items" : "/api/office/folders/items", {
      method: isIn ? "DELETE" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ folderId, historyId }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { showToast(d.error ?? "Nem sikerült.", "error"); return; }
    if (kind === "mine") loadMine();
    else { setOfficeIn((m) => ({ ...m, [historyId]: isIn ? (m[historyId] ?? []).filter((x) => x !== folderId) : [...(m[historyId] ?? []), folderId] })); reloadOffice(); }
    showToast(isIn ? `Kivetted: „${name}”.` : `Betéve: „${name}”${kind === "office" ? " (közös mappa)" : ""}.`, "success");
  }

  const viewerWorks: ViewerWork[] = shown.map((c) => ({
    id: c.id, title: c.title, typeLabel: c.typeLabel, url: c.url, createdAt: c.createdAt, mine: c.mine, ownerName: c.ownerName ?? null,
  }));

  return (
    <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
      {/* ============================ OLDALSÁV ============================ */}
      <aside className="flex-none lg:sticky lg:top-24 lg:w-[264px]">
        <nav className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:gap-0 lg:overflow-visible lg:rounded-2xl lg:p-2.5 lg:pb-2.5"
          style={{ background: "var(--twx-cream-card)", border: "1px solid var(--twx-line)" }}>
          {/* MUNKÁK: összes + típus szerinti bontás (felül nincs külön szűrő) */}
          <SideHead first title="Munkák" />
          <SideItem on={sel.kind === "all"} onClick={() => choose({ kind: "all" })} count={ownCards.length}
            icon={<><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>}>
            Összes munkám
          </SideItem>

          {sideCats.map(([k, n]) => (
            <SideItem key={k} on={sel.kind === "cat" && sel.cat === k} onClick={() => choose({ kind: "cat", cat: k })} count={n}
              iconNode={<span style={{ color: CATEGORY_META[k].fg === "#F4A48A" ? "#C2512F" : CATEGORY_META[k].fg }}>{CATEGORY_META[k].icon}</span>}>
              {CAT_PLURAL[k]}
            </SideItem>
          ))}

          <SideItem on={sel.kind === "hidden"} onClick={() => choose({ kind: "hidden" })} count={hiddenCards.length}
            icon={<><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="m6 6 1 14h10l1-14" /></>}>
            <span style={{ opacity: hiddenCards.length ? 1 : 0.6 }}>Elrejtett munkák</span>
          </SideItem>

          <button type="button" onClick={() => setCreating(true)}
            className="flex h-9 flex-none items-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-[13px] font-semibold lg:hidden" style={{ color: "#C2512F" }}>
            + Új mappa
          </button>
          <SideHead title="Saját mappáim" action={
            <button type="button" onClick={() => setCreating(true)} aria-label="Új saját mappa" title="Új saját mappa"
              className="flex h-6 w-6 items-center justify-center rounded-full text-sm font-semibold transition-colors hover:bg-[#F1EAE1]" style={{ color: "#C2512F" }}>+</button>
          } />
          {creating && (
            <div className="flex flex-none items-center gap-1.5 px-1 py-1">
              <input autoFocus value={newName} maxLength={WORK_FOLDER_NAME_MAX} onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void createFolder(); if (e.key === "Escape") setCreating(false); }}
                onBlur={() => { if (!newName.trim()) setCreating(false); }}
                placeholder="Mappa neve…" aria-label="Új mappa neve"
                className="h-9 w-[180px] min-w-0 flex-1 rounded-lg px-2.5 text-[13px] outline-none lg:w-auto"
                style={{ background: "#fff", border: "1px solid #F08A68" }} />
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => void createFolder()}
                className="h-9 flex-none rounded-lg px-2.5 text-xs font-semibold" style={{ background: "#1C1A17", color: "#fff" }}>OK</button>
            </div>
          )}
          {mine?.error && <p className="hidden px-3 py-1 text-xs text-red-600 lg:block">{mine.error}</p>}
          {dragging && (
            <p className="hidden rounded-lg px-3 py-2 text-xs font-semibold lg:block" style={{ background: "#FFF6F1", color: "#C2512F" }}>
              Engedd el egy mappán a munkát ↓
            </p>
          )}
          {mine && !mine.error && mine.folders.length === 0 && !creating && (
            <button type="button" onClick={() => setCreating(true)}
              className="hidden w-full rounded-lg px-3 py-2 text-left text-xs leading-relaxed transition-colors hover:bg-[#F7F1EA] lg:block" style={{ color: "#8F857B" }}>
              Rendszerezd a munkáidat ügyfelenként vagy ingatlanonként — <span className="font-semibold" style={{ color: "#C2512F" }}>új mappa</span>
            </button>
          )}
          {mine?.folders.map((f) => (
            renaming === f.id ? (
              <div key={f.id} className="flex-none px-1 py-1">
                <input autoFocus value={renameVal} maxLength={WORK_FOLDER_NAME_MAX} onChange={(e) => setRenameVal(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") void renameFolder(f.id); if (e.key === "Escape") setRenaming(null); }}
                  onBlur={() => void renameFolder(f.id)} aria-label="Mappa új neve"
                  className="h-9 w-full rounded-lg px-2.5 text-[13px] outline-none" style={{ background: "#fff", border: "1px solid #F08A68" }} />
              </div>
            ) : (
              <SideItem key={f.id} on={sel.kind === "mine" && sel.id === f.id} onClick={() => choose({ kind: "mine", id: f.id })} count={mineCount(f.id)}
                dropActive={dragging} onDropWork={(hid) => void dropInto({ kind: "mine", id: f.id, name: f.name }, hid)}
                icon={<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />}
                menu={[
                  { label: "Átnevezés", onClick: () => { setRenaming(f.id); setRenameVal(f.name); } },
                  { label: "Mappa törlése", danger: true, onClick: () => void deleteFolder(f) },
                ]}>
                {f.name}
              </SideItem>
            )
          ))}

          <SideHead title="Irodai mappák" />
          {!isMember && (
            <a href="/dashboard/iroda/bemutato" className="hidden rounded-lg px-3 py-2 text-xs leading-relaxed transition-colors hover:bg-[#F7F1EA] lg:block" style={{ color: "#8F857B" }}>
              Irodai fiókban a kollégákkal közös mappákat is használhattok — <span className="font-semibold" style={{ color: "#C2512F" }}>mi ez?</span>
            </a>
          )}
          {isMember && office && office.length === 0 && (
            <a href="/dashboard/iroda" className="hidden rounded-lg px-3 py-2 text-xs leading-relaxed transition-colors hover:bg-[#F7F1EA] lg:block" style={{ color: "#8F857B" }}>
              Még nincs közös mappa — <span className="font-semibold" style={{ color: "#C2512F" }}>létrehozás az Irodai fiókban</span>
            </a>
          )}
          {office?.map((f) => (
            <SideItem key={f.id} on={sel.kind === "office" && sel.id === f.id} onClick={() => choose({ kind: "office", id: f.id })} count={f.itemCount}
              dropActive={dragging} onDropWork={(hid) => void dropInto({ kind: "office", id: f.id, name: f.name }, hid)}
              iconNode={<span style={{ color: "#C2512F" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" /><circle cx="12" cy="13" r="2" /></svg></span>}>
              {f.name}
            </SideItem>
          ))}
        </nav>
      </aside>

      {/* ============================ FŐ RÉSZ ============================ */}
      <section className="min-w-0 flex-1">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--twx-coral)" }}>{head.kicker}</p>
            <h2 className="truncate font-display text-[28px] font-semibold leading-tight">
              {head.title}
              <span className="ml-2 align-middle text-sm font-normal tabular-nums" style={{ color: "var(--twx-ink-muted)" }}>{base ? base.length : "…"}</span>
            </h2>
            <p className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>{head.sub}</p>
          </div>
          <div className="flex h-9 w-full items-center gap-2 rounded-full px-3.5 sm:w-[260px]" style={{ background: "#fff", border: "1px solid var(--twx-line)" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8F857B" strokeWidth="2" strokeLinecap="round" aria-hidden><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Keresés cím vagy típus szerint…" aria-label="Keresés"
              className="min-w-0 flex-1 bg-transparent text-[13px] outline-none" />
          </div>
        </div>

        {/* típus-szűrő csak a mappákban — az összes munka típus szerinti bontása a bal sávban van */}
        {(sel.kind === "mine" || sel.kind === "office") && catCounts.length > 1 && (
          <div className="mt-4 flex flex-wrap gap-2">
            <Chip on={cat === "all"} onClick={() => setCat("all")}>Mind <span className="opacity-60">{base?.length ?? 0}</span></Chip>
            {catCounts.map(([k, n]) => (
              <Chip key={k} on={cat === k} onClick={() => setCat(k)}>
                <span style={{ color: cat === k ? undefined : CATEGORY_META[k].fg === "#F4A48A" ? "#C2512F" : CATEGORY_META[k].fg }}>{CATEGORY_META[k].icon}</span>
                {CATEGORY_META[k].label} <span className="opacity-60">{n}</span>
              </Chip>
            ))}
          </div>
        )}

        <div className="mt-5">
          {!base && <p className="text-sm" style={{ color: "var(--twx-ink-muted)" }}>Betöltés…</p>}
          {base && base.length === 0 && (
            <Empty
              title={sel.kind === "hidden" ? "Nincs elrejtett munkád" : sel.kind === "mine" ? "Ez a mappa még üres" : sel.kind === "office" ? "Ebben a közös mappában még nincs munka" : "Még nincs elkészült munkád"}
              text={sel.kind === "hidden"
                ? "Ha egy munkát a ⋯ menüből törölsz, ide kerül — a fájl megmarad, és innen visszahozhatod."
                : sel.kind === "mine" || sel.kind === "office"
                ? "Húzz ide egy munkát az „Összes munkám” nézetből, vagy a kártya ⋯ menüjében válaszd az „Áthelyezés” pontot."
                : "Válassz egy modult a menüből — az eredmény itt fog megjelenni."} />
          )}
          {base && base.length > 0 && shown.length === 0 && (
            <p className="py-12 text-center text-sm" style={{ color: "var(--twx-ink-muted)" }}>Nincs a keresésnek megfelelő munka.</p>
          )}
          {shown.length > 0 && (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
              {shown.map((c, i) => (
                <article key={c.id} draggable={c.mine && sel.kind !== "hidden"}
                  onDragStart={(e) => {
                    e.dataTransfer.setData(DRAG_TYPE, c.id);
                    e.dataTransfer.setData("text/plain", c.title);
                    e.dataTransfer.effectAllowed = "copy";
                    e.dataTransfer.setDragImage(dragGhost(c.title), 16, 16);
                    setDragging(true);
                  }}
                  onDragEnd={() => setDragging(false)}
                  onContextMenu={(e) => openMenu(e, c, "event")}
                  className={`group relative flex flex-col overflow-hidden rounded-2xl transition-shadow hover:shadow-lg ${c.mine ? "cursor-grab active:cursor-grabbing" : ""}`}
                  style={{ border: "1px solid var(--twx-line)", background: "var(--twx-cream-card)", opacity: sel.kind === "hidden" ? 0.85 : 1 }}>
                  <button type="button" onClick={() => setView(i)} className="block w-full text-left" aria-label={`${c.title} megnézése`}>
                    <div className="relative aspect-[4/3] overflow-hidden" style={{ background: "var(--twx-cream)" }}>
                      <WorkThumb url={c.url} title={c.title} />
                      <span className="absolute left-2 top-2 flex gap-1"><WorkTypeBadge feature={c.feature} /><FileTag url={c.url} /></span>
                    </div>
                  </button>
                  {/* alsó sáv: 2 soros cím + dátum, jobbra egyetlen halvány ⋯ (jobb kattintásra ugyanez) */}
                  <div className="flex items-start gap-1 py-2.5 pl-3 pr-1.5">
                    <div className="min-w-0 flex-1">
                      {cardRename?.id === c.id ? (
                        <textarea autoFocus value={cardRename.value} maxLength={120} rows={2} aria-label="Új név"
                          onChange={(e) => setCardRename({ id: c.id, value: e.target.value })}
                          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void saveCardRename(); } if (e.key === "Escape") setCardRename(null); }}
                          onBlur={() => void saveCardRename()}
                          className="block h-[40px] w-full resize-none rounded-md px-1.5 py-0.5 text-[13px] font-semibold leading-[18px] outline-none"
                          style={{ background: "#FFF6F1", border: "1px solid #F08A68" }} />
                      ) : (
                        <button type="button" onClick={() => setView(i)} title={c.title}
                          className="line-clamp-2 block h-[40px] w-full text-left text-[13px] font-semibold leading-[20px]">
                          {c.title}
                        </button>
                      )}
                      <p className="mt-0.5 truncate text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                        {c.ownerName ? `${c.ownerName} · ` : ""}{fmtWhen(c.createdAt, false)}
                      </p>
                    </div>
                    <MenuDots onClick={(e) => openMenu(e, c, "button")} label={`Műveletek: ${c.title}`} />
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      {menu.open && menuCard && <ActionMenu at={menu.at} items={menuItems(menuCard)} onClose={menu.close} />}
      {view !== null && viewerWorks[view] && (
        <WorkViewer works={viewerWorks} index={view} onIndex={setView} onClose={() => setView(null)} canShare={isMember} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
function SideHead({ title, action, first = false }: { title: string; action?: React.ReactNode; first?: boolean }) {
  return (
    <div className={`hidden h-9 items-center px-3 lg:flex ${first ? "" : "mt-2 border-t pt-3"}`} style={{ borderColor: "#EFE7DD" }}>
      <span className="text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: "#8F857B" }}>{title}</span>
      <span className="ml-auto">{action}</span>
    </div>
  );
}

function SideItem({ on, onClick, count, icon, iconNode, children, menu, onDropWork, dropActive = false }: {
  on: boolean; onClick: () => void; count?: number; icon?: React.ReactNode; iconNode?: React.ReactNode; children: React.ReactNode;
  menu?: { label: string; onClick: () => void; danger?: boolean }[];
  onDropWork?: (historyId: string) => void;   // drag & drop célpont (mappa)
  dropActive?: boolean;                       // épp húznak valamit — finom jelzés, hogy ide lehet ejteni
}) {
  const [open, setOpen] = useState(false);
  const [over, setOver] = useState(false);
  const accepts = (e: React.DragEvent) => !!onDropWork && e.dataTransfer.types.includes(DRAG_TYPE);
  return (
    <div className="group/side relative flex-none rounded-lg transition-all"
      style={onDropWork && over ? { outline: "2px solid #F08A68", outlineOffset: -2, background: "#FFF1EA", transform: "scale(1.02)" }
        : onDropWork && dropActive ? { outline: "1.5px dashed #E8B9A6", outlineOffset: -2 } : undefined}
      onDragOver={(e) => { if (!accepts(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = "copy"; if (!over) setOver(true); }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(false); }}
      onDrop={(e) => {
        if (!accepts(e)) return;
        e.preventDefault(); setOver(false);
        const id = e.dataTransfer.getData(DRAG_TYPE);
        if (id) onDropWork?.(id);
      }}>
      <button type="button" onClick={onClick} aria-current={on ? "page" : undefined}
        className="flex h-9 w-full items-center gap-2.5 whitespace-nowrap rounded-lg px-3 text-left text-[13px] transition-colors lg:whitespace-normal"
        style={on ? { background: "#1C1A17", color: "#fff" } : { color: "#2E2A25" }}
        onMouseEnter={(e) => { if (!on) e.currentTarget.style.background = "#F3ECE3"; }}
        onMouseLeave={(e) => { if (!on) e.currentTarget.style.background = "transparent"; }}>
        <span className="flex-none" style={{ color: on ? "#F4A48A" : "#8F857B" }}>
          {iconNode ?? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{icon}</svg>}
        </span>
        <span className="min-w-0 flex-1 truncate font-medium">{children}</span>
        {count !== undefined && (
          <span className={`text-[11px] tabular-nums ${menu ? "lg:group-hover/side:invisible" : ""}`} style={{ color: on ? "#BFB4A8" : "#8F857B" }}>{count}</span>
        )}
      </button>
      {menu && (
        <>
          <button type="button" onClick={() => setOpen((o) => !o)} aria-label="Mappa műveletek" title="Műveletek"
            className="absolute right-1.5 top-1/2 hidden h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-sm lg:group-hover/side:flex"
            style={{ color: on ? "#fff" : "#4A433C", background: on ? "rgba(255,255,255,0.12)" : "#EFE7DD" }}>⋯</button>
          {open && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} aria-hidden />
              <div className="absolute right-0 top-[calc(100%+4px)] z-40 w-44 overflow-hidden rounded-xl py-1 shadow-lg"
                style={{ background: "#fff", border: "1px solid var(--twx-line)" }}>
                {menu.map((m) => (
                  <button key={m.label} type="button" onClick={() => { setOpen(false); m.onClick(); }}
                    className="block w-full px-3 py-2 text-left text-[13px] hover:bg-[#F7F1EA]" style={{ color: m.danger ? "#B4432A" : "#2E2A25" }}>
                    {m.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on}
      className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-colors"
      style={on ? { background: "#1C1A17", color: "#fff" } : { background: "#F1EAE1", color: "#4A433C" }}>
      {children}
    </button>
  );
}

function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 rounded-2xl px-6 py-10 text-center"
      style={{ border: "1.5px dashed var(--twx-line)", background: "var(--twx-cream-card)" }}>
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: "var(--twx-coral-soft)", color: "#7a2e17" }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
        </svg>
      </span>
      <p className="font-display text-lg font-semibold">{title}</p>
      <p className="max-w-md text-sm" style={{ color: "var(--twx-ink-muted)" }}>{text}</p>
    </div>
  );
}
