// OfficeFolders — közös irodai mappák: lista, létrehozás (ki láthatja), megnyitás,
// a benne lévő munkák megnézése / letöltése / kivétele, mappa szerkesztése és törlése.
// Munkát a „Korábbi munkák" oldalon lehet mappába tenni („Megosztás az irodával").
"use client";

import { useEffect, useState, type FormEvent } from "react";
import { FOLDER_NAME_MAX, type OfficeFolder, type OfficeFolderItem } from "@/lib/office";

type Member = { userId: string; name: string };

export default function OfficeFolders() {
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

  async function remove(f: OfficeFolder) {
    if (!window.confirm(`Törlöd a(z) „${f.name}” mappát? A benne lévő munkák a készítőiknél megmaradnak, csak a mappa szűnik meg.`)) return;
    const res = await fetch("/api/office/folders", {
      method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: f.id }),
    });
    const d = await res.json();
    if (res.ok) { setFolders(d.folders); if (openId === f.id) setOpenId(null); }
    else setError(d.error ?? "Nem sikerült törölni.");
  }

  const nameOf = (id: string) => members.find((m) => m.userId === id)?.name ?? "—";
  const open = folders?.find((f) => f.id === openId) ?? null;

  return (
    <div className="space-y-3 rounded-2xl p-5" style={{ border: "1px solid var(--twx-line)" }}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-display text-lg font-semibold">Közös irodai mappák</h3>
          <p className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>
            Munkát a „Korábbi munkák” oldalon tudsz egy mappába tenni (Megosztás az irodával). Mindenki csak azt látja, amit oda betettek.
          </p>
        </div>
        <button type="button" className="twx-btn" onClick={() => setEditing("new")}>+ Új mappa</button>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
      {!folders && !error && <p className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>Betöltés…</p>}

      {editing && (
        <FolderForm
          initial={editing === "new" ? null : editing}
          members={members.filter((m) => m.userId !== meId)}
          onCancel={() => setEditing(null)}
          onSaved={(list) => { setFolders(list); setEditing(null); }}
        />
      )}

      {folders && folders.length === 0 && !editing && (
        <p className="text-sm" style={{ color: "var(--twx-ink-muted)" }}>Még nincs közös mappa.</p>
      )}

      {folders && folders.length > 0 && (
        <ul className="grid gap-2 sm:grid-cols-2">
          {folders.map((f) => (
            <li key={f.id} className="rounded-xl p-3" style={{
              border: `1.5px solid ${openId === f.id ? "var(--twx-coral)" : "var(--twx-line)"}`,
              background: openId === f.id ? "rgba(239,122,90,0.06)" : "transparent",
            }}>
              <button type="button" className="w-full text-left" onClick={() => setOpenId(openId === f.id ? null : f.id)}>
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <span aria-hidden>📁</span>{f.name}
                  <span className="ml-auto text-xs font-normal" style={{ color: "var(--twx-ink-muted)" }}>{f.itemCount} munka</span>
                </span>
                <span className="mt-0.5 block text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                  {f.everyone ? "Az egész iroda látja" : `Látja: ${[f.createdByName, ...f.memberIds.map(nameOf)].join(", ")}`}
                </span>
              </button>
              {f.canManage && (
                <div className="mt-2 flex gap-3 text-xs">
                  <button type="button" className="underline" onClick={() => setEditing(f)}>Szerkesztés</button>
                  <button type="button" className="underline" style={{ color: "#c0392b" }} onClick={() => remove(f)}>Törlés</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {open && <FolderContents folder={open} onCountChange={(n) => setFolders((list) => (list ?? []).map((f) => (f.id === open.id ? { ...f, itemCount: n } : f)))} />}
    </div>
  );
}

function FolderForm({ initial, members, onCancel, onSaved }: {
  initial: OfficeFolder | null; members: Member[]; onCancel: () => void; onSaved: (list: OfficeFolder[]) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [everyone, setEveryone] = useState(initial?.everyone ?? false);
  const [picked, setPicked] = useState<string[]>(initial?.memberIds ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) { setError("Adj nevet a mappának."); return; }
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
    <form onSubmit={save} className="space-y-3 rounded-xl p-4" style={{ background: "var(--twx-cream)" }} noValidate>
      <input className="twx-input" placeholder="Mappa neve (pl. Sas utca 12. — eladás)" maxLength={FOLDER_NAME_MAX}
        value={name} onChange={(e) => setName(e.target.value)} />
      <div className="space-y-1.5 text-sm">
        <p className="font-medium">Ki láthatja?</p>
        <label className="flex items-center gap-2">
          <input type="radio" checked={everyone} onChange={() => setEveryone(true)} className="accent-[#ef7a5a]" /> Az egész iroda
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" checked={!everyone} onChange={() => setEveryone(false)} className="accent-[#ef7a5a]" /> Csak a kiválasztott kollégák (és én)
        </label>
        {!everyone && (
          <div className="ml-6 flex flex-wrap gap-x-4 gap-y-1">
            {members.length === 0 && <span className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>Még nincs más tag az irodában.</span>}
            {members.map((m) => (
              <label key={m.userId} className="flex items-center gap-1.5 text-sm">
                <input type="checkbox" className="accent-[#ef7a5a]" checked={picked.includes(m.userId)}
                  onChange={(e) => setPicked((p) => (e.target.checked ? [...p, m.userId] : p.filter((x) => x !== m.userId)))} />
                {m.name}
              </label>
            ))}
          </div>
        )}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" className="twx-btn" disabled={busy}>{busy ? "Mentés…" : initial ? "Mentés" : "Mappa létrehozása"}</button>
        <button type="button" className="twx-btn-outline" onClick={onCancel}>Mégse</button>
      </div>
    </form>
  );
}

function FolderContents({ folder, onCountChange }: { folder: OfficeFolder; onCountChange: (n: number) => void }) {
  const [items, setItems] = useState<OfficeFolderItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    <div className="space-y-2 border-t pt-3" style={{ borderColor: "var(--twx-line)" }}>
      <p className="text-sm font-semibold">📂 {folder.name}</p>
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
              {it.canRemove && (
                <button type="button" className="text-xs underline" style={{ color: "var(--twx-ink-muted)" }} onClick={() => takeOut(it)}>
                  Kivétel
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
