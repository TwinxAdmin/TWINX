// Admin → Cégek (terv 12 / 1.3): a cégek listája; a kibontható sor az áttekintő: tagok (cégvezető jelölve),
// tag hozzáadása e-mail címmel, a cég története. A modulok, helyek és lejárat a 4. lépésben kerülnek ide.
// Soronként „⋯" menü. Fix magasságú doboz, belül görgetés.
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ActionMenu, MenuDots, MI, useActionMenu, type MenuItem } from "@/components/ui/ActionMenu";
import { showToast } from "@/components/Toast";
import { CompanyFinance } from "@/components/admin/Finance";
import {
  COMPANY_LOG_LABEL, COMPANY_STATUS_LABEL,
  type AdminCompany, type CompanyLogEntry, type CompanyMember,
} from "@/lib/companies";

type Payload = { migrated: boolean; error?: string; companies: AdminCompany[]; notice?: string; createdId?: string | null };
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
    { label: "Cég lezárása", icon: MI.trash, disabled: true, hint: "Hamarosan (terv 21).", onClick: () => {} },
  ];

  return (
    <li className="border-b last:border-b-0" style={{ borderColor: "var(--twx-line)" }}>
      <div className="flex h-14 cursor-pointer items-center gap-3 px-4 text-sm" onClick={onToggle} onContextMenu={menu.openAtEvent}>
        <span className="min-w-0 flex-1 truncate font-medium">{c.name}</span>
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
    return (data?.companies ?? []).filter((c) => c.status !== "lezart"
      && (!s || c.name.toLowerCase().includes(s) || c.members.some((m) => (m.email + " " + m.name).toLowerCase().includes(s))));
  }, [data, q]);

  if (!data) return <div className="twx-card h-[640px] animate-pulse" />;
  if (!data.migrated) return <div className="twx-card p-6 text-sm">Futtasd le a <code>20261123220000_companies.sql</code> migrációt.</div>;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <input className="twx-input w-72 text-sm" placeholder="Keresés: cég, tag neve vagy e-mail" value={q} onChange={(e) => setQ(e.target.value)} />
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
