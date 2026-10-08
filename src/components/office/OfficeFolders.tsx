// OfficeFolders — közös irodai mappák: FIX MAGASSÁGÚ kártya (a lista belül görget).
// Az új mappa, a szerkesztés és a mappa tartalma FELUGRÓ ABLAKBAN nyílik — így a
// kártya alatti blokkok (pl. kredit-mozgások) soha nem tolódnak el.
// Munkát a „Korábbi munkák" oldalon lehet mappába tenni („Megosztás az irodával").
"use client";

import { toDownloadUrl } from "@/lib/files";
import { useEffect, useState, type FormEvent } from "react";
import { FOLDER_NAME_MAX, WORK_TITLE_MAX, type OfficeFolder, type OfficeFolderItem } from "@/lib/office";
import { avatarColor, fmtWhen, initials } from "@/lib/office-format";
import { EmptyState, Icons, OfficeCard, OfficeDialog } from "@/components/office/OfficeUi";
import WorkViewer from "@/components/works/WorkViewer";
import WorkThumb from "@/components/works/WorkThumb";
import WorkTypeBadge, { CATEGORY_META, FileTag, workCategory, type WorkCategory } from "@/components/works/WorkTypeBadge";
import { showToast } from "@/components/Toast";

type Member = { userId: string; name: string };

export default function OfficeFolders({ height = 300 }: { height?: number }) {
  const [folders, setFolders] = useState<OfficeFolder[] | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [meId, setMeId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<OfficeFolder | "new" | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/office/folders")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setError(d.error); return; }
        setFolders(d.folders); setMembers(d.members ?? []); setMeId(d.meId ?? "");
      })
      .catch(() => setError("Nem sikerült betölteni a mappákat."));
  }, []);

  // Egy üzenetben csatolt mappára kattintva ez a kártya nyitja meg a mappát (felugró ablakban).
  useEffect(() => {
    const onOpen = (e: Event) => {
      const id = (e as CustomEvent<{ id: string }>).detail?.id;
      if (id) setOpenId(id);
    };
    window.addEventListener("open-office-folder", onOpen);
    return () => window.removeEventListener("open-office-folder", onOpen);
  }, []);

  async function remove(f: OfficeFolder) {
    if (!window.confirm(`Törlöd a(z) „${f.name}” mappát? A benne lévő munkák a készítőiknél megmaradnak, csak a mappa szűnik meg.`)) return;
    const res = await fetch("/api/office/folders", {
      method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: f.id }),
    });
    const d = await res.json();
    if (res.ok) { setFolders(d.folders); setOpenId(null); }
    else setError(d.error ?? "Nem sikerült törölni.");
  }

  const nameOf = (id: string) => members.find((m) => m.userId === id)?.name ?? "—";
  const firstNames = (f: OfficeFolder) =>
    f.everyone ? "mindenki" : [f.createdByName, ...f.memberIds.map(nameOf)].map((n) => n.split(" ").slice(-1)[0]).join(", ");
  const open = folders?.find((f) => f.id === openId) ?? null;

  return (
    <>
      <OfficeCard title="Közös mappák" height={height}
        action={
          <button type="button" onClick={() => setEditing("new")}
            className="h-[30px] rounded-full px-2.5 text-xs font-semibold" style={{ background: "#fff", border: "1px solid #E1D6C9", color: "#1C1A17" }}>
            + Új mappa
          </button>
        }>
        {error && <p className="text-xs text-red-600">{error}</p>}
        {!folders && !error && <p className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>Betöltés…</p>}

        {folders && folders.length === 0 && (
          <EmptyState icon={Icons.folder} title="Még nincs közös mappa"
            text="Hozz létre egy mappát egy ügyfélnek vagy ingatlannak, és a kollégák munkái egy helyre kerülnek. Munkát a „Korábbi munkák” oldalon tehetsz bele." />
        )}

        {folders && folders.length > 0 && (
          <ul className="flex flex-col gap-1.5">
            {folders.map((f, i) => (
              <li key={f.id}>
                <button type="button" onClick={() => setOpenId(f.id)}
                  className="flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left transition-colors hover:bg-[#FFF6F1]"
                  style={{ background: "#fff", border: "1px solid #EFE7DD" }}>
                  <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg"
                    style={i === 0 && f.itemCount > 0 ? { background: "#FBE1D6", color: "#C2512F" } : { background: "#F1EAE1", color: "#6B6258" }}>
                    {Icons.folder}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold">{f.name}</span>
                    <span className="block truncate text-xs" style={{ color: "#6B6258" }}>
                      {f.itemCount} anyag · {firstNames(f)} · {fmtWhen(f.lastAddedAt ?? f.createdAt, false)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </OfficeCard>

      {editing && (
        <OfficeDialog title={editing === "new" ? "Új közös mappa" : "Mappa szerkesztése"} onClose={() => setEditing(null)}>
          <FolderForm
            initial={editing === "new" ? null : editing}
            members={members.filter((m) => m.userId !== meId)}
            onCancel={() => setEditing(null)}
            onSaved={(list) => { setFolders(list); setEditing(null); }}
          />
        </OfficeDialog>
      )}

      {open && (
        <FolderWindow folder={open}
          scope={open.everyone ? "Az egész iroda látja" : `Látja: ${[open.createdByName, ...open.memberIds.map(nameOf)].join(", ")}`}
          onClose={() => setOpenId(null)}
          onEdit={open.canManage ? () => { setEditing(open); setOpenId(null); } : undefined}
          onDelete={open.canManage ? () => void remove(open) : undefined}
          onCountChange={(n) => setFolders((list) => (list ?? []).map((f) => (f.id === open.id ? { ...f, itemCount: n } : f)))} />
      )}
    </>
  );
}

/**
 * Új / szerkesztett mappa űrlapja (felugró ablakban).
 *  • Név — számlálóval.
 *  • „Ki láthatja?" — két nagy, kattintható választó-kártya (Egész iroda / Kiválasztott kollégák).
 *  • Kollégaválasztó: kereső + „Mind / Egyik sem", FIX MAGASSÁGÚ, görgethető lista —
 *    10, 30 vagy 100 kollégánál is ugyanakkora marad az ablak.
 */
function FolderForm({ initial, members, onCancel, onSaved }: {
  initial: OfficeFolder | null; members: Member[]; onCancel: () => void; onSaved: (list: OfficeFolder[]) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [everyone, setEveryone] = useState(initial?.everyone ?? true);
  const [picked, setPicked] = useState<string[]>(initial?.memberIds ?? []);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const q = query.trim().toLowerCase();
  const shown = q ? members.filter((m) => m.name.toLowerCase().includes(q)) : members;
  const allShownPicked = shown.length > 0 && shown.every((m) => picked.includes(m.userId));

  function togglePick(id: string) {
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  }
  function toggleAllShown() {
    const ids = shown.map((m) => m.userId);
    setPicked((p) => (allShownPicked ? p.filter((x) => !ids.includes(x)) : [...new Set([...p, ...ids])]));
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) { setError("Adj nevet a mappának."); return; }
    if (!everyone && picked.length === 0 && members.length > 0) { setError("Jelölj ki legalább egy kollégát, vagy válaszd „Az egész iroda” lehetőséget."); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/office/folders", {
        method: initial ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: initial?.id, name, everyone, memberIds: everyone ? [] : picked }),
      });
      const d = await res.json();
      if (!res.ok) { setError(d.errors?.name ?? d.error ?? "Nem sikerült menteni."); return; }
      onSaved(d.folders);
    } catch {
      setError("Hálózati hiba.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-5" noValidate>
      {/* NÉV */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between">
          <label htmlFor="folder-name" className="text-[13px] font-semibold">Mappa neve</label>
          <span className="text-[11px] tabular-nums" style={{ color: "#8F857B" }}>{name.length}/{FOLDER_NAME_MAX}</span>
        </div>
        <input id="folder-name" autoFocus className="twx-input" placeholder="pl. Sas utca 12. — eladás" maxLength={FOLDER_NAME_MAX}
          value={name} onChange={(e) => setName(e.target.value)} />
      </div>

      {/* KI LÁTHATJA */}
      <div className="flex flex-col gap-2">
        <p className="text-[13px] font-semibold">Ki láthatja?</p>
        <div className="grid gap-2 sm:grid-cols-2" role="radiogroup">
          <ScopeCard selected={everyone} onClick={() => setEveryone(true)} icon={Icons.users}
            title="Az egész iroda" text="Minden mostani és később csatlakozó kolléga látja." />
          <ScopeCard selected={!everyone} onClick={() => setEveryone(false)} icon={Icons.folder}
            title="Kiválasztott kollégák" text={picked.length ? `${picked.length} kolléga + te` : "Csak akiket kijelölsz (és te)."} />
        </div>
      </div>

      {/* KOLLÉGAVÁLASZTÓ — MINDIG ugyanakkora helyet foglal: a két mód között váltva az ablak
          mérete nem változik. „Az egész iroda" módban letiltva, rajta egy rövid magyarázattal. */}
      <div className="relative">
        <div aria-hidden={everyone} inert={everyone} className={everyone ? "pointer-events-none select-none opacity-35" : undefined}>
        <div className="flex flex-col overflow-hidden rounded-xl" style={{ border: "1px solid #E1D6C9", background: "#fff" }}>
          <div className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: "1px solid #EFE7DD" }}>
            <span aria-hidden style={{ color: "#8F857B" }}>⌕</span>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Kolléga keresése…"
              aria-label="Kolléga keresése" className="min-w-0 flex-1 bg-transparent text-[13px] outline-none" />
            {members.length > 0 && (
              <button type="button" onClick={toggleAllShown} className="flex-none text-xs font-semibold" style={{ color: "#C2512F" }}>
                {allShownPicked ? "Egyik sem" : q ? "Találatok kijelölése" : "Mind"}
              </button>
            )}
          </div>

          <ul className="h-[208px] overflow-y-auto overscroll-contain py-1">
            {members.length === 0 && (
              <li className="px-4 py-6 text-center text-xs" style={{ color: "#6B6258" }}>
                Még nincs más tag az irodában. Hívd meg őket a csatlakozási kóddal — később ide is hozzáadhatod őket.
              </li>
            )}
            {members.length > 0 && shown.length === 0 && (
              <li className="px-4 py-6 text-center text-xs" style={{ color: "#6B6258" }}>Nincs ilyen nevű kolléga.</li>
            )}
            {shown.map((m) => {
              const on = picked.includes(m.userId);
              const av = avatarColor(m.userId);
              return (
                <li key={m.userId}>
                  <label className="flex cursor-pointer items-center gap-3 px-3 py-2 transition-colors hover:bg-[#FFF6F1]"
                    style={on ? { background: "#FFF6F1" } : undefined}>
                    <input type="checkbox" className="sr-only" checked={on} onChange={() => togglePick(m.userId)} />
                    <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full text-xs font-semibold" style={{ background: av.bg, color: av.fg }}>
                      {initials(m.name)}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{m.name}</span>
                    <span aria-hidden className="flex h-5 w-5 flex-none items-center justify-center rounded-md text-[11px] font-bold transition-colors"
                      style={on ? { background: "#E3683F", color: "#fff" } : { border: "1.5px solid #D5C8B9" }}>
                      {on ? "✓" : ""}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>

          <div className="flex items-center justify-between px-3 py-2 text-xs" style={{ borderTop: "1px solid #EFE7DD", background: "#FCFAF7", color: "#6B6258" }}>
            <span><strong style={{ color: "#1C1A17" }}>{picked.length}</strong> kiválasztva{members.length ? ` / ${members.length}` : ""}</span>
            {picked.length > 0 && (
              <button type="button" onClick={() => setPicked([])} className="font-semibold underline">Kijelölés törlése</button>
            )}
          </div>
        </div>
        </div>
        {everyone && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 rounded-xl px-6 text-center"
            style={{ background: "rgba(253,251,246,0.72)" }}>
            <span className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: "#FBE1D6", color: "#C2512F" }}>{Icons.users}</span>
            <p className="text-[13px] font-semibold">Az egész iroda látja</p>
            <p className="max-w-[300px] text-xs" style={{ color: "#6B6258" }}>
              Nem kell senkit kijelölni. Ha csak néhány kollégának szánod, válaszd a „Kiválasztott kollégák” lehetőséget.
            </p>
          </div>
        )}
      </div>

      {error && <p className="rounded-lg px-3 py-2 text-xs" style={{ background: "#FDECEA", color: "#B3261E" }}>{error}</p>}

      {/* LÁBLÉC */}
      <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end" style={{ borderTop: "1px solid #EFE7DD", paddingTop: 16 }}>
        <button type="button" className="twx-btn-outline" onClick={onCancel}>Mégse</button>
        <button type="submit" className="twx-btn" disabled={busy}>{busy ? "Mentés…" : initial ? "Mentés" : "Mappa létrehozása"}</button>
      </div>
    </form>
  );
}

function ScopeCard({ selected, onClick, icon, title, text }: {
  selected: boolean; onClick: () => void; icon: React.ReactNode; title: string; text: string;
}) {
  return (
    <button type="button" role="radio" aria-checked={selected} onClick={onClick}
      className="flex items-start gap-3 rounded-xl p-3 text-left transition-colors"
      style={selected
        ? { background: "#FFF6F1", border: "1.5px solid #E3683F" }
        : { background: "#fff", border: "1.5px solid #E9E0D5" }}>
      <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg"
        style={selected ? { background: "#FBE1D6", color: "#C2512F" } : { background: "#F1EAE1", color: "#6B6258" }}>
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-[13px] font-semibold">{title}</span>
        <span className="block text-xs leading-snug" style={{ color: "#6B6258" }}>{text}</span>
      </span>
    </button>
  );
}

/**
 * Mappa-ablak — áttekinthető „fájlkezelő": fejléc (név, ki látja, kezelés), típus-szűrő chipek
 * darabszámmal + kereső, alatta FIX magasságú, görgethető lista. Minden sorban bélyegkép
 * (videó első képkockája / kép / PDF), színes típus-címke + fájltípus, cím, készítő, dátum,
 * jobbra ikon-gombok. Sorra kattintva a közös nézegető nyílik.
 */
function FolderWindow({ folder, scope, onClose, onEdit, onDelete, onCountChange }: {
  folder: OfficeFolder; scope: string; onClose: () => void;
  onEdit?: () => void; onDelete?: () => void; onCountChange: (n: number) => void;
}) {
  const [items, setItems] = useState<OfficeFolderItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cat, setCat] = useState<WorkCategory | "all">("all");
  const [q, setQ] = useState("");
  const [viewId, setViewId] = useState<string | null>(null);
  const [historyOf, setHistoryOf] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState("");

  useEffect(() => {
    setItems(null);
    fetch(`/api/office/folders/items?folderId=${folder.id}`)
      .then((r) => r.json())
      .then((d) => { if (d.error) setError(d.error); setItems(d.items ?? []); })
      .catch(() => { setError("Nem sikerült betölteni."); setItems([]); });
  }, [folder.id]);

  useEffect(() => {
    // Esc: ha épp egy mezőben (átnevezés, kereső) gépel, az csak azt zárja — az ablakot nem.
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest?.("input, textarea")) return;
      if (e.key === "Escape" && viewId === null) onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose, viewId]);

  async function saveRename(it: OfficeFolderItem) {
    if (renaming !== it.historyId) return;
    const title = renameVal.trim();
    setRenaming(null);
    if (!title || title === it.title) return;
    const res = await fetch("/api/office/folders/items", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folderId: folder.id, historyId: it.historyId, title }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { showToast(d.error ?? "Nem sikerült átnevezni.", "error"); return; }
    setItems((list) => (list ?? []).map((x) => (x.historyId === it.historyId ? { ...x, title } : x)));
    window.dispatchEvent(new CustomEvent("twx-works-changed"));
    showToast("Átnevezve.", "success");
  }

  async function takeOut(it: OfficeFolderItem) {
    if (!window.confirm(`Kiveszed a(z) „${it.title}” munkát a mappából? A munka a készítőjénél megmarad.`)) return;
    const res = await fetch("/api/office/folders/items", {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folderId: folder.id, historyId: it.historyId }),
    });
    if (res.ok) {
      const next = (items ?? []).filter((x) => x.historyId !== it.historyId);
      setItems(next); onCountChange(next.length);
      showToast("Kivetted a mappából.", "success");
    } else {
      const d = await res.json().catch(() => ({}));
      showToast(d.error ?? "Nem sikerült kivenni.", "error");
    }
  }

  // típusonkénti darabszám a szűrő-chipekhez (csak a ténylegesen előforduló típusok)
  const counts = new Map<WorkCategory, number>();
  for (const it of items ?? []) counts.set(workCategory(it.feature), (counts.get(workCategory(it.feature)) ?? 0) + 1);
  const cats = [...counts.entries()].sort((a, b) => b[1] - a[1]);

  const needle = q.trim().toLowerCase();
  const shown = (items ?? []).filter((it) =>
    (cat === "all" || workCategory(it.feature) === cat) &&
    (!needle || `${it.title} ${it.typeLabel} ${it.ownerName}`.toLowerCase().includes(needle)));
  const viewIdx = viewId ? shown.findIndex((x) => x.historyId === viewId) : -1;

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(12,11,10,0.72)" }}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={folder.name}
        className="flex h-[min(680px,90vh)] w-full max-w-[900px] flex-col overflow-hidden rounded-2xl"
        style={{ background: "#FDFBF6", border: "1px solid #E8E1D6", color: "#1C1815", boxShadow: "0 30px 80px rgba(0,0,0,0.5)" }}>

        {/* ── fejléc ── */}
        <div className="flex flex-none items-start gap-4 px-6 pb-5 pt-5"
          style={{ background: "#121110", backgroundImage: "radial-gradient(ellipse 420px 200px at 90% 0%, rgba(238,123,91,0.22), transparent 70%)", color: "#F3EDE6" }}>
          <span className="flex h-12 w-12 flex-none items-center justify-center rounded-xl" style={{ background: "rgba(238,123,91,0.16)", color: "#F4A48A" }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
            </svg>
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: "#EE7B5B" }}>Közös mappa</p>
            <h2 className="truncate font-display text-[24px] font-semibold leading-tight">{folder.name}</h2>
            <p className="mt-0.5 truncate text-xs" style={{ color: "#A89E94" }}>
              {scope} · {items ? items.length : folder.itemCount} munka · létrehozta: {folder.createdByName}
            </p>
          </div>
          <div className="flex flex-none items-center gap-1.5">
            {onEdit && <HeadBtn onClick={onEdit}>Szerkesztés</HeadBtn>}
            {onDelete && <HeadBtn onClick={onDelete} danger>Törlés</HeadBtn>}
            <button type="button" onClick={onClose} aria-label="Bezárás (Esc)" title="Bezárás (Esc)"
              className="ml-1 flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/15" style={{ background: "rgba(255,255,255,0.08)" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
            </button>
          </div>
        </div>

        {/* ── szűrő-sáv ── */}
        <div className="flex flex-none flex-wrap items-center gap-2 px-6 py-3" style={{ borderBottom: "1px solid #EFE7DD" }}>
          <FilterBtn on={cat === "all"} onClick={() => setCat("all")}>Mind <Count n={items?.length ?? 0} /></FilterBtn>
          {cats.map(([c, n]) => (
            <FilterBtn key={c} on={cat === c} onClick={() => setCat(c)}>
              <span style={{ color: cat === c ? undefined : CATEGORY_META[c].fg }}>{CATEGORY_META[c].icon}</span>
              {CATEGORY_META[c].label} <Count n={n} />
            </FilterBtn>
          ))}
          <div className="flex h-8 w-full items-center gap-2 rounded-full px-3 sm:ml-auto sm:w-[200px]" style={{ background: "#fff", border: "1px solid #E1D6C9" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#8F857B" strokeWidth="2" strokeLinecap="round" aria-hidden><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Keresés a mappában…" aria-label="Keresés a mappában"
              className="min-w-0 flex-1 bg-transparent text-xs outline-none" />
          </div>
        </div>

        {/* ── lista ── */}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {error && <p className="text-sm text-red-600">{error}</p>}
          {!items && !error && <p className="text-sm" style={{ color: "#6B6258" }}>Betöltés…</p>}
          {items && items.length === 0 && !error && (
            <div className="h-full">
              <EmptyState icon={Icons.folder} title="Üres mappa"
                text="Nyiss meg egy munkát a Munkáim listában vagy a Korábbi munkák oldalon, és az „Áthelyezés” gombbal tedd bele." />
            </div>
          )}
          {items && items.length > 0 && shown.length === 0 && (
            <p className="py-10 text-center text-sm" style={{ color: "#6B6258" }}>Nincs a szűrésnek megfelelő munka.</p>
          )}
          {shown.length > 0 && (
            <ul className="flex flex-col gap-2">
              {shown.map((it) => (
                <li key={it.historyId} className="overflow-hidden rounded-xl" style={{ background: "#fff", border: "1px solid #EFE7DD" }}>
                  <div className="group flex items-center gap-4 p-2.5 pr-3">
                    <button type="button" onClick={() => setViewId(it.historyId)} aria-label={`${it.title} megnézése`}
                      className="relative h-[56px] w-[84px] flex-none overflow-hidden rounded-lg sm:h-[68px] sm:w-[104px]" style={{ background: "#F1EAE1" }}>
                      <WorkThumb url={it.url} />
                    </button>
                    <div className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <WorkTypeBadge feature={it.feature} label={it.typeLabel} />
                        <FileTag url={it.url} />
                      </span>
                      {renaming === it.historyId ? (
                        <input autoFocus value={renameVal} maxLength={WORK_TITLE_MAX} aria-label="Új név"
                          onChange={(e) => setRenameVal(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") void saveRename(it); if (e.key === "Escape") { e.stopPropagation(); setRenaming(null); } }}
                          onBlur={() => void saveRename(it)}
                          className="mt-1 block h-[22px] w-full rounded-md px-1.5 text-[14px] font-semibold outline-none"
                          style={{ background: "#FFF6F1", border: "1px solid #F08A68" }} />
                      ) : (
                        <button type="button" onClick={() => setViewId(it.historyId)} title={it.title}
                          className="mt-1 block h-[22px] w-full truncate text-left text-[14px] font-semibold hover:underline">{it.title}</button>
                      )}
                      <span className="block truncate text-xs" style={{ color: "#6B6258" }}>
                        {it.mine ? "Te készítetted" : `Készítette: ${it.ownerName}`} · {fmtWhen(it.createdAt, false)}
                        {it.addedByName && it.addedByName !== it.ownerName ? ` · betette: ${it.addedByName}` : ""}
                        {it.feature === "valuation" && (
                          <>
                            {" · "}
                            <a href={`/dashboard/real-estate/valuation?shared=${it.historyId}`} className="font-semibold underline" style={{ color: "#C2512F" }}>szöveg szerkesztése</a>
                            {" · "}
                            <button type="button" onClick={() => setHistoryOf(historyOf === it.historyId ? null : it.historyId)}
                              className="font-semibold underline" style={{ color: "#C2512F" }}>előzmények</button>
                          </>
                        )}
                      </span>
                    </div>
                    {/* EGYSÉGES művelet-sor, minden fájltípusnál ugyanott: Megnézem · Letöltés · Átnevezés · Kivétel.
                        Ami az adott munkánál nem érhető el, az halványan látszik (nem tűnik el, nem ugrik a sor). */}
                    <div className="flex flex-none items-center gap-1">
                      <RowBtn label="Megnézem" primary onClick={() => setViewId(it.historyId)}>
                        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" />
                      </RowBtn>
                      {it.url ? (
                        <RowLink label="Letöltés" href={toDownloadUrl(it.url)}>
                          <path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" />
                        </RowLink>
                      ) : (
                        <RowBtn label="Ehhez a munkához nincs letölthető fájl" disabled onClick={() => {}}>
                          <path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" />
                        </RowBtn>
                      )}
                      <RowBtn label={it.canRemove ? "Átnevezés" : "Csak a készítő vagy a mappa kezelője nevezheti át"} disabled={!it.canRemove}
                        on={renaming === it.historyId} onClick={() => { setRenaming(it.historyId); setRenameVal(it.title); }}>
                        <path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                      </RowBtn>
                      <RowBtn label={it.canRemove ? "Kivétel a mappából" : "Csak a készítő, a betevő vagy a mappa kezelője veheti ki"} disabled={!it.canRemove}
                        danger onClick={() => void takeOut(it)}>
                        <path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="m6 6 1 14h10l1-14" />
                      </RowBtn>
                    </div>
                  </div>
                  {historyOf === it.historyId && (
                    <div className="px-3 pb-3"><WorkVersions historyId={it.historyId} /></div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {viewIdx >= 0 && (
        <div onClick={(e) => e.stopPropagation()}>
          <WorkViewer index={viewIdx} onIndex={(i) => setViewId(shown[i]?.historyId ?? null)} onClose={() => setViewId(null)} canShare
            works={shown.map((x) => ({ id: x.historyId, title: x.title, typeLabel: x.typeLabel, url: x.url, createdAt: x.createdAt, ownerName: x.mine ? null : x.ownerName, mine: !!x.mine }))} />
        </div>
      )}
    </div>
  );
}

function HeadBtn({ children, onClick, danger = false }: { children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button type="button" onClick={onClick} className="h-9 rounded-full px-3.5 text-xs font-semibold transition-colors hover:bg-white/15"
      style={{ background: "rgba(255,255,255,0.08)", color: danger ? "#F4A48A" : "#F3EDE6", border: "1px solid rgba(255,255,255,0.14)" }}>
      {children}
    </button>
  );
}

function FilterBtn({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on}
      className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-colors"
      style={on ? { background: "#1C1A17", color: "#fff" } : { background: "#F1EAE1", color: "#4A433C" }}>
      {children}
    </button>
  );
}

function Count({ n }: { n: number }) {
  return <span className="tabular-nums opacity-60">{n}</span>;
}

const rowBtnCls = "flex h-9 w-9 items-center justify-center rounded-full transition-colors";
function RowBtn({ label, onClick, children, primary = false, danger = false, on = false, disabled = false }: {
  label: string; onClick: () => void; children: React.ReactNode; primary?: boolean; danger?: boolean; on?: boolean; disabled?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={label} title={label}
      className={`${rowBtnCls} ${primary ? "" : "hover:bg-[#F1EAE1]"} disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent`}
      style={primary ? { background: "#F08A68", color: "#1C1A17" } : on ? { background: "#1C1A17", color: "#fff" } : { color: danger ? "#B4432A" : "#4A433C" }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{children}</svg>
    </button>
  );
}
function RowLink({ label, href, children }: { label: string; href: string; children: React.ReactNode }) {
  return (
    <a href={href} aria-label={label} title={label} className={`${rowBtnCls} hover:bg-[#F1EAE1]`} style={{ color: "#4A433C" }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{children}</svg>
    </a>
  );
}

/** Módosítási napló: ki, mikor mentette; bármelyik változat visszaállítható. */
function WorkVersions({ historyId }: { historyId: string }) {
  type V = { id: string; kind: string; savedBy: string; url: string | null; createdAt: string; current: boolean };
  const [versions, setVersions] = useState<V[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  function load() {
    fetch(`/api/office/works/versions?historyId=${historyId}`)
      .then((r) => r.json())
      .then((d) => (d.error ? setError(d.error) : setVersions(d.versions)))
      .catch(() => setError("Nem sikerült betölteni."));
  }
  useEffect(load, [historyId]);

  async function restore(v: V) {
    if (!window.confirm(`Visszaállítod a ${new Date(v.createdAt).toLocaleString("hu-HU")} változatot? A mostani állapot is megmarad a naplóban.`)) return;
    setBusy(v.id);
    const res = await fetch("/api/office/works/versions", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ versionId: v.id }),
    });
    const d = await res.json();
    setBusy(null);
    if (!res.ok) { setError(d.error ?? "Nem sikerült visszaállítani."); return; }
    load();
  }

  const LABEL: Record<string, string> = { original: "Eredeti", edit: "Módosítás", restore: "Visszaállítás" };

  return (
    <div className="w-full rounded-lg p-3 text-xs" style={{ background: "var(--twx-cream)" }}>
      {error && <p className="text-red-600">{error}</p>}
      {!versions && !error && <p>Betöltés…</p>}
      {versions && versions.length === 0 && <p>Még nem módosította senki.</p>}
      {versions && versions.length > 0 && (
        <ul className="space-y-1.5">
          {versions.map((v) => (
            <li key={v.id} className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{LABEL[v.kind] ?? v.kind}</span>
              <span>· {v.savedBy} · {new Date(v.createdAt).toLocaleString("hu-HU")}</span>
              {v.current && <span className="rounded-full px-1.5" style={{ background: "#fff" }}>aktuális</span>}
              {v.url && <a href={toDownloadUrl(v.url)} className="underline">PDF letöltése</a>}
              {!v.current && (
                <button type="button" className="underline" disabled={busy === v.id} onClick={() => restore(v)}>Visszaállítás</button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
