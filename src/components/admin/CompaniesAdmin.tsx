// Admin → Cégek (terv 12 / 1.3): a cégek listája; a kibontható sor az áttekintő: tagok (cégvezető jelölve),
// tag hozzáadása e-mail címmel, a cég története. A modulok, helyek és lejárat a 4. lépésben kerülnek ide.
// Soronként „⋯" menü. Fix magasságú doboz, belül görgetés.
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ActionMenu, MenuDots, MI, useActionMenu, type MenuItem } from "@/components/ui/ActionMenu";
import { showToast } from "@/components/Toast";
import SelectField from "@/components/SelectField";
import { CompanyFinance } from "@/components/admin/Finance";
import {
  COMPANY_LOG_LABEL, COMPANY_STATUS_LABEL,
  type AdminCompany, type CompanyLogEntry, type CompanyMember, type DeletionRequest,
} from "@/lib/companies";

type Payload = { migrated: boolean; error?: string; companies: AdminCompany[]; notice?: string; createdId?: string | null;
  requests?: DeletionRequest[]; approvers?: { id: string; name: string; active: boolean }[] };
const API = "/api/admin/companies";
const fmt = (iso: string) => new Intl.DateTimeFormat("hu-HU", { timeZone: "Europe/Budapest", year: "numeric", month: "short", day: "numeric" }).format(new Date(iso));
const fmtTs = (iso: string) => new Intl.DateTimeFormat("hu-HU", { timeZone: "Europe/Budapest", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

type Act = (body: Record<string, unknown>) => Promise<Payload | null>;

function Dialog({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" style={{ background: "rgba(18,16,14,0.55)" }} onMouseDown={onClose}>
      <div className="twx-card w-full max-w-md p-6" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal>
        <h3 className="font-display text-lg font-semibold">{title}</h3>
        {children}
      </div>
    </div>
  );
}

function MemberRow({ c, m, busy, act }: { c: AdminCompany; m: CompanyMember; busy: boolean; act: Act }) {
  const menu = useActionMenu();
  const heads = c.members.filter((x) => x.isHead).length;
  const lastHead = m.isHead && heads <= 1;
  const items: MenuItem[] = [
    m.isHead
      ? { label: "Cégvezetői státusz elvétele", icon: MI.out, disabled: busy || lastHead,
          hint: lastHead ? "Az utolsó cégvezető nem vehető le — előbb nevezz ki egy másikat." : undefined,
          onClick: () => act({ action: "remove_head", id: c.id, userId: m.userId }) }
      : { label: "Kinevezés cégvezetővé", icon: MI.restore, disabled: busy, onClick: () => act({ action: "appoint_head", id: c.id, userId: m.userId }) },
    { kind: "divider" },
    { label: "Eltávolítás a cégből", icon: MI.trash, danger: true, disabled: busy || lastHead,
      hint: lastHead ? "Az utolsó cégvezető nem távolítható el." : undefined,
      onClick: () => act({ action: "remove_member", id: c.id, userId: m.userId }) },
  ];
  return (
    <li className="flex h-11 items-center gap-3 border-b last:border-b-0" style={{ borderColor: "var(--twx-line)" }} onContextMenu={menu.openAtEvent}>
      <span className="min-w-0 flex-1 truncate text-sm">{m.name || m.email}{m.name && <span className="ml-2 text-xs" style={{ color: "var(--twx-ink-muted)" }}>{m.email}</span>}</span>
      <span className="w-24 flex-none text-right">{m.isHead && <span className="twx-badge">Cégvezető</span>}</span>
      <MenuDots onClick={menu.openAtButton} />
      {menu.open && <ActionMenu at={menu.at} items={items} onClose={menu.close} />}
    </li>
  );
}

function CompanyRow({ c, open, onToggle, busy, act }: { c: AdminCompany; open: boolean; onToggle: () => void; busy: boolean; act: Act }) {
  const menu = useActionMenu();
  const [email, setEmail] = useState("");
  const [log, setLog] = useState<CompanyLogEntry[] | null>(null);
  const [edit, setEdit] = useState(false);
  const [finance, setFinance] = useState(false);
  // Terv 21: lezárás, újranyitás, visszaadás, törlés kérése, végleges törlés
  const [dlg, setDlg] = useState<null | "close" | "export" | "delreq" | "purge">(null);
  const [f, setF] = useState({ reason: "", force: false, confirm: "", check: false, before: false, moduleKey: "", note: "" });
  const closed = c.status === "lezart";
  const [name, setName] = useState(c.name);
  const [note, setNote] = useState(c.note ?? "");
  const heads = c.members.filter((m) => m.isHead);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    fetch(`${API}?log=${c.id}`).then((r) => r.json()).then((d) => { if (alive) setLog(d.log ?? []); }).catch(() => {});
    return () => { alive = false; };
  }, [open, c.id, c.members.length, heads.length, c.name]);

  const items: MenuItem[] = [
    { label: "Adatok szerkesztése", icon: MI.rename, onClick: () => { setName(c.name); setNote(c.note ?? ""); setEdit(true); } },
    { label: "Pénzügy (ajánlatok, fizetések)", icon: MI.folder, onClick: () => setFinance(true) },
    { kind: "link", label: "Modulok és előfizetés", icon: MI.open, href: "/admin/egyedi-modulok" },
    { kind: "divider" },
    closed
      ? { label: "Újranyitás", icon: MI.restore, disabled: busy, hint: "A tagokat és a modulokat újra be kell állítani.", onClick: () => act({ action: "reopen", id: c.id }) }
      : { label: "Cég lezárása", icon: MI.out, disabled: busy, hint: "Archiválás: a tagok Besorolatlanok lesznek, a munkáik megmaradnak.",
          onClick: () => { setF({ reason: "", force: false, confirm: "", check: false, before: false, moduleKey: "", note: "" }); setDlg("close"); } },
    { label: "Ügyféladatok visszaadása", icon: MI.download, disabled: busy, hint: "A visszaadás (export) naplózása.",
      onClick: () => { setF({ reason: "", force: false, confirm: "", check: false, before: false, moduleKey: c.modules[0]?.key ?? "", note: "" }); setDlg("export"); } },
    { label: "Ügyféladatok törlésének kérése", icon: MI.trash, disabled: busy || !closed, hint: closed ? "Egy másik, kijelölt admin hagyja jóvá." : "Csak lezárt cégnél.",
      onClick: () => { setF({ reason: "", force: false, confirm: "", check: false, before: false, moduleKey: "", note: "" }); setDlg("delreq"); } },
    { label: "Végleges törlés", icon: MI.trash, danger: true, disabled: busy || c.hasPayments,
      hint: c.hasPayments ? "Fizetési tétellel rendelkező cég csak lezárható." : "Csak tesztadathoz (nincs fizetési tétele).",
      onClick: () => { setF({ reason: "", force: false, confirm: "", check: false, before: false, moduleKey: "", note: "" }); setDlg("purge"); } },
  ];

  return (
    <li className="border-b last:border-b-0" style={{ borderColor: "var(--twx-line)" }}>
      <div className="flex h-14 cursor-pointer items-center gap-3 px-4 text-sm" onClick={onToggle} onContextMenu={menu.openAtEvent}>
        <span className="min-w-0 flex-1 truncate font-medium" style={{ opacity: closed ? 0.6 : 1 }}>{c.name}
          {closed && <span className="ml-2 rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: "#ece8e2", color: "#6e655c" }}>Lezárt cég</span>}
        </span>
        <span className="hidden w-48 flex-none truncate text-xs sm:block" style={{ color: heads.length ? "var(--twx-ink-muted)" : "#b5372f" }}>
          {heads.length ? `Cégvezető: ${heads.map((h) => h.name || h.email).join(", ")}` : "Nincs cégvezető"}
        </span>
        <span className="w-16 flex-none text-right text-xs tabular-nums" style={{ color: "var(--twx-ink-muted)" }}>{c.members.length} tag</span>
        <span className="hidden w-28 flex-none text-right text-xs md:block" style={{ color: "var(--twx-ink-muted)" }}>{c.fromBooking ? "foglalásból" : "kézzel"}</span>
        <span className="w-20 flex-none text-right text-xs" style={{ color: "var(--twx-ink-muted)" }}>{COMPANY_STATUS_LABEL[c.status]}</span>
        <span onClick={(e) => e.stopPropagation()}><MenuDots onClick={menu.openAtButton} /></span>
      </div>
      {menu.open && <ActionMenu at={menu.at} items={items} onClose={menu.close} />}

      {open && (
        <div className="grid gap-5 px-4 pb-5 pt-1 md:grid-cols-[1.3fr_1fr]" style={{ background: "#fbf8f2" }}>
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--twx-ink-muted)" }}>Tagok</p>
            {c.members.length === 0 ? (
              <p className="py-3 text-sm" style={{ color: "var(--twx-ink-muted)" }}>Még nincs tagja. Add hozzá a kapcsolattartót, majd nevezd ki cégvezetőnek.</p>
            ) : (
              <ul className="max-h-56 overflow-y-auto rounded-xl px-3" style={{ background: "#fff", border: "1px solid var(--twx-line)" }}>
                {c.members.map((m) => <MemberRow key={m.userId} c={c} m={m} busy={busy} act={act} />)}
              </ul>
            )}
            <form className="mt-3 flex gap-2" onSubmit={async (e) => { e.preventDefault(); if (await act({ action: "add_member", id: c.id, email })) setEmail(""); }}>
              <input className="twx-input min-w-0 flex-1 text-sm" type="email" placeholder="Regisztrált felhasználó e-mail címe" value={email} onChange={(e) => setEmail(e.target.value)} />
              <button type="submit" className="twx-btn-outline flex-none text-xs" disabled={busy || !email.trim()}>Tag hozzáadása</button>
            </form>
            {heads.length === 0 && c.members.length > 0 && (
              <p className="mt-2 text-xs" style={{ color: "#8a2a22" }}>A cégnek még nincs cégvezetője — a modul aktiválásához kell egy (a tag „⋯” menüjéből).</p>
            )}
            {c.note && <p className="mt-3 whitespace-pre-wrap text-xs" style={{ color: "var(--twx-ink-muted)" }}>Megjegyzés: {c.note}</p>}
            <p className="mt-3 text-xs" style={{ color: "var(--twx-ink-muted)" }}>
              Létrehozva: {fmt(c.createdAt)}{c.bookingAt ? ` · foglalás: ${fmt(c.bookingAt)}` : ""} · Pénzügy: a „⋯” menüben
            </p>
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--twx-ink-muted)" }}>Története</p>
            <ul className="max-h-64 space-y-1 overflow-y-auto text-xs">
              {log === null ? <li style={{ color: "var(--twx-ink-muted)" }}>Betöltés…</li> : log.map((e) => (
                <li key={e.id} className="flex gap-2">
                  <span className="w-24 flex-none tabular-nums" style={{ color: "var(--twx-ink-muted)" }}>{fmtTs(e.at)}</span>
                  <span><b>{COMPANY_LOG_LABEL[e.action] ?? e.action}</b>{e.target ? `: ${e.target}` : ""} <span style={{ color: "var(--twx-ink-muted)" }}>({e.actor})</span></span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {finance && <CompanyFinance companyId={c.id} companyName={c.name} onClose={() => setFinance(false)} />}
      {dlg === "close" && (
        <Dialog title="Cég lezárása (archiválás)" onClose={() => setDlg(null)}>
          <p className="mt-2 text-sm">A tagok eltávolítódnak (Besorolatlanok lesznek; a fiókjuk és a munkáik megmaradnak), minden hozzáférés és nyitott meghívó megszűnik. A cég, a modulok története és a pénzügyi adatok archívumként megmaradnak; a modulok kódja nem törlődik.</p>
          {c.liveModules > 0 && (
            <label className="mt-3 flex items-start gap-2 rounded-lg p-2 text-xs" style={{ background: "#fdecea", color: "#8a2a22" }}>
              <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#b5372f]" checked={f.force} onChange={(e) => setF({ ...f, force: e.target.checked })} />
              A cégnek {c.liveModules} még nem lemondott modulja van. Azonnali lezárás: a megmaradt kifizetett időszak elvész.
            </label>
          )}
          <label className="mt-3 block text-xs" style={{ color: "var(--twx-ink-muted)" }}>Indok *
            <input className="twx-input mt-1 w-full text-sm" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} />
          </label>
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" className="twx-btn-outline" onClick={() => setDlg(null)}>Mégse</button>
            <button type="button" className="twx-btn" disabled={busy || !f.reason.trim() || (c.liveModules > 0 && !f.force)}
              onClick={async () => { if (await act({ action: "close", id: c.id, reason: f.reason, force: f.force })) setDlg(null); }}>Lezárás</button>
          </div>
        </Dialog>
      )}
      {dlg === "export" && (
        <Dialog title="Ügyféladatok visszaadása" onClose={() => setDlg(null)}>
          <p className="mt-2 text-sm">Az exportot a modul adatkezelési leírása szerint végzed; itt a visszaadást naplózod (ki, mikor, melyik modul).</p>
          {c.modules.length > 0 ? (
            <label className="mt-3 block text-xs" style={{ color: "var(--twx-ink-muted)" }}>Modul
              <div className="mt-1"><SelectField size="sm" value={f.moduleKey} onChange={(v) => setF({ ...f, moduleKey: v })} searchable={false}
                options={c.modules.map((m) => ({ value: m.key, label: `${m.name}${m.storesData ? "" : " (nem tárol ügyféladatot)"}` }))} /></div>
            </label>
          ) : <p className="mt-3 text-xs" style={{ color: "var(--twx-ink-muted)" }}>A cégnek nincs modulja.</p>}
          <label className="mt-3 block text-xs" style={{ color: "var(--twx-ink-muted)" }}>Megjegyzés (hogyan, kinek adtuk át)
            <input className="twx-input mt-1 w-full text-sm" maxLength={300} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
          </label>
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" className="twx-btn-outline" onClick={() => setDlg(null)}>Mégse</button>
            <button type="button" className="twx-btn" disabled={busy} onClick={async () => { if (await act({ action: "export_data", id: c.id, moduleKey: f.moduleKey, note: f.note })) setDlg(null); }}>Naplózás</button>
          </div>
        </Dialog>
      )}
      {dlg === "delreq" && (
        <Dialog title="Ügyféladatok törlésének kérése" onClose={() => setDlg(null)}>
          <p className="mt-2 text-sm">A kérés önmagában nem töröl semmit. Egy másik, kijelölt admin hagyja jóvá (négy szem elv), utána hajtható végre. Csak az ügyfél adatát és kimeneteit érinti — a kódot, a regisztert és a számviteli adatot nem.</p>
          <p className="mt-2 text-xs" style={{ color: "var(--twx-ink-muted)" }}>Megőrzési határidő: {c.retentionUntil ? fmt(c.retentionUntil) : "nincs megadva (az NDA-val együtt döntjük el)"}</p>
          <label className="mt-3 block text-xs" style={{ color: "var(--twx-ink-muted)" }}>Írd be a cég nevét: <b>{c.name}</b>
            <input className="twx-input mt-1 w-full text-sm" value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} />
          </label>
          <label className="mt-3 flex items-start gap-2 text-xs">
            <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#ef7a5a]" checked={f.check} onChange={(e) => setF({ ...f, check: e.target.checked })} />
            A megőrzési határidő lejárt, vagy az ügyfél írásban jóváhagyta; a visszaadás megtörtént vagy nem kell.
          </label>
          <label className="mt-2 flex items-start gap-2 text-xs">
            <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#ef7a5a]" checked={f.before} onChange={(e) => setF({ ...f, before: e.target.checked })} />
            A határidő előtt kérem, az ügyfél írásbeli kérésére.
          </label>
          <label className="mt-3 block text-xs" style={{ color: "var(--twx-ink-muted)" }}>Indoklás *
            <input className="twx-input mt-1 w-full text-sm" maxLength={1000} value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} />
          </label>
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" className="twx-btn-outline" onClick={() => setDlg(null)}>Mégse</button>
            <button type="button" className="twx-btn" disabled={busy || !f.check || !f.reason.trim() || f.confirm.trim().toLowerCase() !== c.name.trim().toLowerCase()}
              onClick={async () => { if (await act({ action: "request_deletion", id: c.id, reason: f.reason, confirmName: f.confirm, beforeDeadline: f.before })) setDlg(null); }}>Kérés rögzítése</button>
          </div>
        </Dialog>
      )}
      {dlg === "purge" && (
        <Dialog title="Végleges törlés" onClose={() => setDlg(null)}>
          <p className="mt-2 text-sm">Csak tesztadathoz: a cég, a tagságai, a moduljai és az ajánlatai véglegesen törlődnek. Nem visszavonható.</p>
          <label className="mt-3 block text-xs" style={{ color: "var(--twx-ink-muted)" }}>Írd be a cég nevét: <b>{c.name}</b>
            <input className="twx-input mt-1 w-full text-sm" value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} />
          </label>
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" className="twx-btn-outline" onClick={() => setDlg(null)}>Mégse</button>
            <button type="button" className="twx-btn" style={{ background: "#b5372f", color: "#fff" }} disabled={busy || f.confirm.trim().toLowerCase() !== c.name.trim().toLowerCase()}
              onClick={async () => { if (await act({ action: "delete_company", id: c.id, confirmName: f.confirm })) setDlg(null); }}>Végleges törlés</button>
          </div>
        </Dialog>
      )}
      {edit && (
        <Dialog title="Cég adatai" onClose={() => setEdit(false)}>
          <label className="mt-4 block text-xs" style={{ color: "var(--twx-ink-muted)" }}>Név
            <input className="twx-input mt-1 w-full text-sm" value={name} maxLength={160} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="mt-3 block text-xs" style={{ color: "var(--twx-ink-muted)" }}>Megjegyzés (csak követés — titkos ügyféladat ne kerüljön ide)
            <textarea className="twx-input mt-1 h-24 w-full resize-none text-sm" value={note} maxLength={2000} onChange={(e) => setNote(e.target.value)} />
          </label>
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" className="twx-btn-outline" onClick={() => setEdit(false)}>Mégse</button>
            <button type="button" className="twx-btn" disabled={busy || !name.trim()}
              onClick={async () => { if (await act({ action: "update", id: c.id, name, note })) setEdit(false); }}>Mentés</button>
          </div>
        </Dialog>
      )}
    </li>
  );
}

export default function CompaniesAdmin() {
  const [data, setData] = useState<Payload | null>(null);
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [showClosed, setShowClosed] = useState(false);
  const [decide, setDecide] = useState<null | { id: string; approve: boolean }>(null);
  const [decideReason, setDecideReason] = useState("");

  const load = useCallback(async () => {
    const r = await fetch(API);
    const d = (await r.json().catch(() => null)) as Payload | null;
    setData(d ?? { migrated: false, companies: [] });
    // A foglalásból érkező hivatkozás (?ceg=<id>) kibontja az adott céget.
    const id = new URLSearchParams(window.location.search).get("ceg");
    if (id) setOpenId(id);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const act: Act = useCallback(async (body) => {
    setBusy(true);
    try {
      const r = await fetch(API, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { showToast(d.error ?? "Nem sikerült.", "error"); return null; }
      setData(d as Payload);
      if (d.notice) showToast(d.notice, "success");
      return d as Payload;
    } finally { setBusy(false); }
  }, []);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (data?.companies ?? []).filter((c) => (showClosed || c.status !== "lezart")
      && (!s || c.name.toLowerCase().includes(s) || c.members.some((m) => (m.email + " " + m.name).toLowerCase().includes(s))));
  }, [data, q, showClosed]);
  const pending = (data?.requests ?? []).filter((r) => ["kerve", "jovahagyva", "reszben_vegrehajtva"].includes(r.status));

  if (!data) return <div className="twx-card h-[640px] animate-pulse" />;
  if (!data.migrated) return <div className="twx-card p-6 text-sm">Futtasd le a <code>20261123220000_companies.sql</code> migrációt.</div>;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <input className="twx-input w-72 text-sm" placeholder="Keresés: cég, tag neve vagy e-mail" value={q} onChange={(e) => setQ(e.target.value)} />
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" className="h-4 w-4 accent-[#ef7a5a]" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} />
          Lezártak is
        </label>
        <span className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>{list.length} cég</span>
        <button type="button" className="twx-btn ml-auto text-sm" onClick={() => { setNewName(""); setCreating(true); }}>Új cég</button>
      </div>
      <section className="twx-card h-[640px] overflow-y-auto">
        {list.length === 0 ? (
          <p className="flex h-full items-center justify-center px-6 text-center text-sm" style={{ color: "var(--twx-ink-muted)" }}>
            {data.companies.length === 0
              ? "Még nincs cég. Egy beérkezett foglalásból a „⋯” → „Céggé alakítás”-sal hozhatsz létre, vagy kézzel az „Új cég” gombbal."
              : "Nincs találat."}
          </p>
        ) : (
          <ul>
            {list.map((c) => (
              <CompanyRow key={c.id} c={c} open={openId === c.id} busy={busy} act={act}
                onToggle={() => setOpenId((v) => (v === c.id ? null : c.id))} />
            ))}
          </ul>
        )}
      </section>

      {/* Jóváhagyások (terv 21 / 5.) — függő ügyféladat-törlési kérések; fix magasságú doboz */}
      <section className="twx-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-display text-base font-semibold">Jóváhagyások — ügyféladat törlése</h3>
          <span className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>A kérést egy másik, kijelölt admin hagyja jóvá (négy szem elv).</span>
        </div>
        <ul className="mt-3 h-40 overflow-y-auto">
          {pending.length === 0 ? <li className="py-6 text-center text-sm" style={{ color: "var(--twx-ink-muted)" }}>Nincs függő kérés.</li> : pending.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-3 border-b py-2 text-sm last:border-b-0" style={{ borderColor: "var(--twx-line)" }}>
              <span className="min-w-0 flex-1 truncate"><b>{r.companyName}</b> · {r.reason}{r.beforeDeadline ? " · határidő előtt" : ""} <span className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>(kérte: {r.requestedBy})</span></span>
              <span className="text-xs">{r.status === "kerve" ? "Jóváhagyásra vár" : r.status === "jovahagyva" ? "Jóváhagyva" : "Részben végrehajtva"}</span>
              {r.status === "kerve" ? (
                <>
                  <button type="button" className="twx-btn text-xs" disabled={busy} onClick={() => { setDecideReason(""); setDecide({ id: r.id, approve: true }); }}>Jóváhagyás</button>
                  <button type="button" className="twx-btn-outline text-xs" disabled={busy} onClick={() => { setDecideReason(""); setDecide({ id: r.id, approve: false }); }}>Elutasítás</button>
                  <button type="button" className="text-xs underline" style={{ color: "var(--twx-ink-muted)" }} disabled={busy} onClick={() => act({ action: "withdraw", requestId: r.id })}>Visszavonás</button>
                </>
              ) : (
                <button type="button" className="twx-btn text-xs" style={{ background: "#b5372f", color: "#fff" }} disabled={busy} onClick={() => act({ action: "execute_deletion", requestId: r.id })}>
                  {r.status === "jovahagyva" ? "Végrehajtás" : "Újraindítás"}
                </button>
              )}
            </li>
          ))}
        </ul>
        <div className="mt-3 flex flex-wrap items-center gap-3 border-t pt-3 text-xs" style={{ borderColor: "var(--twx-line)" }}>
          <span style={{ color: "var(--twx-ink-muted)" }}>Kijelölt jóváhagyók:</span>
          {(data.approvers ?? []).map((a) => (
            <label key={a.id} className="flex cursor-pointer items-center gap-1.5">
              <input type="checkbox" className="h-4 w-4 accent-[#ef7a5a]" checked={a.active} disabled={busy}
                onChange={(e) => act({ action: "approver", userId: a.id, active: e.target.checked })} />{a.name}
            </label>
          ))}
        </div>
      </section>

      {decide && (
        <Dialog title={decide.approve ? "Törlés jóváhagyása" : "Törlés elutasítása"} onClose={() => setDecide(null)}>
          {(() => { const r = pending.find((x) => x.id === decide.id); const co = data.companies.find((c) => c.id === r?.companyId); return (
            <div className="mt-2 text-sm">
              <p><b>{r?.companyName}</b> — {r?.reason}</p>
              <p className="mt-2 text-xs" style={{ color: "var(--twx-ink-muted)" }}>Törlendő ügyféladat modulonként:</p>
              <ul className="mt-1 list-disc pl-5 text-xs">
                {(co?.modules ?? []).length === 0 ? <li>nincs modul</li> : co!.modules.map((m) => <li key={m.key}>{m.name}: {m.storesData ? "ügyféladat és kimenetek törlése a modul leírása szerint" : "nem tárol ügyféladatot"}</li>)}
              </ul>
            </div>
          ); })()}
          {!decide.approve && (
            <label className="mt-3 block text-xs" style={{ color: "var(--twx-ink-muted)" }}>Indoklás *
              <input className="twx-input mt-1 w-full text-sm" value={decideReason} onChange={(e) => setDecideReason(e.target.value)} />
            </label>
          )}
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" className="twx-btn-outline" onClick={() => setDecide(null)}>Mégse</button>
            <button type="button" className="twx-btn" disabled={busy || (!decide.approve && !decideReason.trim())}
              onClick={async () => { if (await act({ action: "decide", requestId: decide.id, approve: decide.approve, reason: decideReason })) setDecide(null); }}>
              {decide.approve ? "Jóváhagyom" : "Elutasítom"}
            </button>
          </div>
        </Dialog>
      )}

      {creating && (
        <Dialog title="Új cég" onClose={() => setCreating(false)}>
          <label className="mt-4 block text-xs" style={{ color: "var(--twx-ink-muted)" }}>A cég neve
            <input autoFocus className="twx-input mt-1 w-full text-sm" value={newName} maxLength={160} onChange={(e) => setNewName(e.target.value)} />
          </label>
          <p className="mt-2 text-xs" style={{ color: "var(--twx-ink-muted)" }}>Ha foglalásból jön, inkább a Foglalások → „⋯” → „Céggé alakítás”-t használd: így összekapcsolódnak.</p>
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" className="twx-btn-outline" onClick={() => setCreating(false)}>Mégse</button>
            <button type="button" className="twx-btn" disabled={busy || !newName.trim()}
              onClick={async () => { const d = await act({ action: "create", name: newName }); if (d) { setCreating(false); if (d.createdId) setOpenId(d.createdId); } }}>
              Létrehozás
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
