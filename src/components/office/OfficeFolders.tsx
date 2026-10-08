// OfficeFolders — közös irodai mappák: FIX MAGASSÁGÚ kártya (a lista belül görget).
// Az új mappa, a szerkesztés és a mappa tartalma FELUGRÓ ABLAKBAN nyílik — így a
// kártya alatti blokkok (pl. kredit-mozgások) soha nem tolódnak el.
// Munkát a „Korábbi munkák" oldalon lehet mappába tenni („Megosztás az irodával").
"use client";

import { useEffect, useState, type FormEvent } from "react";
import { FOLDER_NAME_MAX, type OfficeFolder, type OfficeFolderItem } from "@/lib/office";
import { avatarColor, fmtWhen, initials } from "@/lib/office-format";
import { EmptyState, Icons, OfficeCard, OfficeDialog } from "@/components/office/OfficeUi";

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
        <OfficeDialog title={open.name} onClose={() => setOpenId(null)} wide>
          <p className="mb-3 text-xs" style={{ color: "var(--twx-ink-muted)" }}>
            {open.everyone ? "Az egész iroda látja" : `Látja: ${[open.createdByName, ...open.memberIds.map(nameOf)].join(", ")}`}
            {open.canManage && (
              <>
                {" · "}
                <button type="button" className="underline" onClick={() => { setEditing(open); setOpenId(null); }}>Szerkesztés</button>
                {" · "}
                <button type="button" className="underline" style={{ color: "#c0392b" }} onClick={() => remove(open)}>Törlés</button>
              </>
            )}
          </p>
          <FolderContents folder={open}
            onCountChange={(n) => setFolders((list) => (list ?? []).map((f) => (f.id === open.id ? { ...f, itemCount: n } : f)))} />
        </OfficeDialog>
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

function FolderContents({ folder, onCountChange }: { folder: OfficeFolder; onCountChange: (n: number) => void }) {
  const [items, setItems] = useState<OfficeFolderItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [historyOf, setHistoryOf] = useState<string | null>(null);

  useEffect(() => {
    setItems(null);
    fetch(`/api/office/folders/items?folderId=${folder.id}`)
      .then((r) => r.json())
      .then((d) => (d.error ? setError(d.error) : setItems(d.items)))
      .catch(() => setError("Nem sikerült betölteni."));
  }, [folder.id]);

  async function takeOut(it: OfficeFolderItem) {
    const res = await fetch("/api/office/folders/items", {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folderId: folder.id, historyId: it.historyId }),
    });
    if (res.ok) {
      const next = (items ?? []).filter((x) => x.historyId !== it.historyId);
      setItems(next); onCountChange(next.length);
    }
  }

  return (
    <div className="space-y-2">
      {error && <p className="text-xs text-red-600">{error}</p>}
      {!items && !error && <p className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>Betöltés…</p>}
      {items && items.length === 0 && (
        <p className="text-sm" style={{ color: "var(--twx-ink-muted)" }}>Üres mappa. Munkát a „Korábbi munkák” oldalon tehetsz bele.</p>
      )}
      {items && items.length > 0 && (
        <ul className="space-y-2">
          {items.map((it) => (
            <li key={it.historyId} className="flex flex-wrap items-center gap-3 rounded-xl p-3" style={{ border: "1px solid var(--twx-line)" }}>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{it.title}</p>
                <p className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                  {it.typeLabel} · készítette: {it.ownerName} · {new Date(it.createdAt).toLocaleDateString("hu-HU")}
                </p>
              </div>
              {it.url && <a href={it.url} target="_blank" rel="noreferrer" className="twx-btn-outline text-xs">Megnyitás</a>}
              {/* A mappa tagjai javíthatnak — jelenleg az értékbecslés szövege szerkeszthető (IR8). */}
              {it.feature === "valuation" && (
                <a href={`/dashboard/real-estate/valuation?shared=${it.historyId}`} className="twx-btn text-xs">Szerkesztés</a>
              )}
              {it.feature === "valuation" && (
                <button type="button" className="text-xs underline" onClick={() => setHistoryOf(historyOf === it.historyId ? null : it.historyId)}>
                  Előzmények
                </button>
              )}
              {it.canRemove && (
                <button type="button" className="text-xs underline" style={{ color: "var(--twx-ink-muted)" }} onClick={() => takeOut(it)}>
                  Kivétel
                </button>
              )}
              {historyOf === it.historyId && <WorkVersions historyId={it.historyId} />}
            </li>
          ))}
        </ul>
      )}
    </div>
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
              {v.url && <a href={v.url} target="_blank" rel="noreferrer" className="underline">PDF</a>}
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
