// A cégvezető „Hozzáférések" ablaka (terv 13 / 3. szakasz; szövegek: terv 22 / 6. D).
//   Fej: a cég neve + „Itt kezeled, ki használja a cégetek moduljait."
//   Modulonként egy sor (helyek használt/összes, érvényes eddig); egyszerre egy sor nyitva, fix magasság, belül görget.
//   Kibontva: kollégák (Aktív / Meghívva / Lejárt) „⋯" menüvel, meghívó mező, „Használom én is".
//   Alul: Cégvezetők doboz (kinevezés a cég aktív tagjai közül, lemondás a saját státuszról).
// Ha a meghívó levél nem ment ki (Resend), a link egyszer megjelenik másolásra.
"use client";

import { useCallback, useEffect, useState } from "react";
import SelectField from "@/components/SelectField";
import { ActionMenu, MenuDots, MI, useActionMenu, type MenuItem } from "@/components/ui/ActionMenu";
import { showToast } from "@/components/Toast";
import type { HeadCompany, HeadModule } from "@/lib/company-access";

const API = "/api/company/access";
const fmtDate = (iso: string | null) => (iso ? new Intl.DateTimeFormat("hu-HU", { year: "numeric", month: "short", day: "numeric" }).format(new Date(iso.length === 10 ? iso + "T12:00:00" : iso)) : "—");
type Act = (body: Record<string, unknown>) => Promise<boolean>;

function Confirm({ title, text, ok, onOk, onClose, busy }: { title: string; text: string; ok: string; onOk: () => void; onClose: () => void; busy: boolean }) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" style={{ background: "rgba(18,16,14,0.55)" }} onMouseDown={onClose}>
      <div className="twx-card w-full max-w-md p-6" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal>
        <h3 className="font-display text-lg font-semibold">{title}</h3>
        <p className="mt-3 text-sm">{text}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="twx-btn-outline" onClick={onClose}>Mégse</button>
          <button type="button" className="twx-btn" disabled={busy} onClick={onOk}>{ok}</button>
        </div>
      </div>
    </div>
  );
}

function PersonRow({ label, sub, tag, tagStyle, items }: { label: string; sub?: string; tag: string; tagStyle: React.CSSProperties; items: MenuItem[] }) {
  const menu = useActionMenu();
  return (
    <li className="flex h-12 items-center gap-3 border-b last:border-b-0" style={{ borderColor: "var(--twx-line)" }} onContextMenu={menu.openAtEvent}>
      <span className="min-w-0 flex-1 truncate text-sm"><strong>{label}</strong>{sub && <span className="ml-2 text-xs" style={{ color: "var(--twx-ink-muted)" }}>{sub}</span>}</span>
      <span className="w-36 flex-none text-right"><span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={tagStyle}>{tag}</span></span>
      <MenuDots onClick={menu.openAtButton} />
      {menu.open && <ActionMenu at={menu.at} items={items} onClose={menu.close} />}
    </li>
  );
}

function ModuleRow({ m, meId, open, onToggle, busy, act }: { m: HeadModule; meId: string; open: boolean; onToggle: () => void; busy: boolean; act: Act }) {
  const [email, setEmail] = useState("");
  const [confirm, setConfirm] = useState<{ userId: string; name: string } | null>(null);
  const full = m.used >= m.seats;
  return (
    <li className="border-b last:border-b-0" style={{ borderColor: "var(--twx-line)" }}>
      <button type="button" onClick={onToggle} className="flex h-14 w-full items-center gap-3 px-5 text-left text-sm">
        <span className="min-w-0 flex-1 truncate font-display font-semibold">{m.name}</span>
        <span className="w-24 flex-none text-right tabular-nums">{m.used} / {m.seats} hely</span>
        <span className="hidden w-40 flex-none text-right text-xs sm:block" style={{ color: "var(--twx-ink-muted)" }}>érvényes: {fmtDate(m.validUntil)}</span>
        <span className="w-5 flex-none text-center text-xs" aria-hidden>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="px-5 pb-5" style={{ background: "#fbf8f2" }}>
          <ul className="max-h-60 overflow-y-auto rounded-xl px-3" style={{ background: "#fff", border: "1px solid var(--twx-line)" }}>
            {m.active.length === 0 && m.invites.length === 0 && (
              <li className="py-4 text-sm" style={{ color: "var(--twx-ink-muted)" }}>Még nem hívtál meg senkit. Add meg egy kolléga e-mail címét, és belép.</li>
            )}
            {m.active.map((p) => (
              <PersonRow key={p.userId} label={p.name || p.email} sub={p.name ? p.email : undefined} tag={p.userId === meId ? "Aktív (te)" : "Aktív"}
                tagStyle={{ background: "#e6f2ea", color: "#1f6b43" }}
                items={[{ label: p.userId === meId ? "Nem használom tovább" : "Eltávolítás", icon: MI.trash, danger: true, disabled: busy,
                  onClick: () => setConfirm({ userId: p.userId, name: p.name || p.email }) }]} />
            ))}
            {m.invites.map((i) => (
              <PersonRow key={i.id} label={i.email} sub={i.expired ? undefined : `lejár: ${fmtDate(i.expiresAt)}`}
                tag={i.expired ? "Lejárt" : "Meghívva"}
                tagStyle={i.expired ? { background: "#ece8e2", color: "#6e655c" } : { background: "#fde3d8", color: "#9a3b1f" }}
                items={[
                  { label: "Újraküldés", icon: MI.send, disabled: busy, hint: "Új link megy ki, a régi érvénytelen lesz.", onClick: () => act({ action: "resend", invId: i.id }) },
                  { label: "Meghívó visszavonása", icon: MI.trash, danger: true, disabled: busy || i.expired, onClick: () => act({ action: "revoke", invId: i.id }) },
                ]} />
            ))}
          </ul>
          <form className="mt-3 flex flex-wrap gap-2" onSubmit={async (e) => { e.preventDefault(); if (await act({ action: "invite", cmId: m.id, email })) setEmail(""); }}>
            <input className="twx-input min-w-0 flex-1 text-sm" type="email" placeholder={full ? "Nincs szabad hely" : "Kolléga e-mail címe"} disabled={full}
              value={email} onChange={(e) => setEmail(e.target.value)} />
            <button type="submit" className="twx-btn flex-none text-sm" disabled={busy || full || !email.trim()}>Meghívás</button>
            {!m.meHasAccess && (
              <button type="button" className="twx-btn-outline flex-none text-sm" disabled={busy || full} onClick={() => act({ action: "self", cmId: m.id })}
                title="A saját fiókodnak adsz egy helyet ebben a modulban.">Használom én is</button>
            )}
          </form>
          <p className="mt-1.5 h-4 text-xs" style={{ color: "var(--twx-ink-muted)" }}>
            {full ? "Nincs szabad hely. A bővítéshez jelezd nekünk: office@twinx.hu." : ""}
          </p>
        </div>
      )}
      {confirm && (
        <Confirm busy={busy} title={confirm.userId === meId ? "Nem használod tovább?" : "Eltávolítás"}
          text={confirm.userId === meId
            ? `A(z) ${m.name} hozzáférésed megszűnik, a helyed felszabadul. A munkáid nálad maradnak.`
            : `Eltávolítod ${confirm.name}-t a(z) ${m.name} használói közül? A hozzáférése azonnal megszűnik, a munkái nála maradnak.`}
          ok="Eltávolítás" onClose={() => setConfirm(null)}
          onOk={async () => { await act({ action: "remove", cmId: m.id, userId: confirm.userId }); setConfirm(null); }} />
      )}
    </li>
  );
}

export default function AccessWindow({ meId }: { meId: string }) {
  const [companies, setCompanies] = useState<HeadCompany[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cid, setCid] = useState<string>("");
  const [openMod, setOpenMod] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [appoint, setAppoint] = useState("");
  const [dlg, setDlg] = useState<null | "appoint" | "resign">(null);

  const load = useCallback(async () => {
    const r = await fetch(API);
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { setError(d.error ?? "Nem sikerült betölteni."); setCompanies([]); return; }
    setCompanies(d.companies ?? []);
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (companies?.length && !companies.some((c) => c.id === cid)) setCid(companies[0].id); }, [companies, cid]);

  const act: Act = useCallback(async (body) => {
    setBusy(true);
    try {
      const r = await fetch(API, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { showToast(d.error ?? "Nem sikerült.", "error"); return false; }
      setCompanies(d.companies ?? []);
      if (d.link) setLink(d.link);
      if (d.notice) showToast(d.notice, d.link ? "info" : "success");
      return true;
    } finally { setBusy(false); }
  }, []);

  if (companies === null) return <div className="twx-card h-[560px] animate-pulse" />;
  if (error) return <div className="twx-card p-6 text-sm">{error}</div>;
  if (companies.length === 0) {
    return <div className="twx-card flex min-h-[200px] items-center justify-center p-6 text-center text-sm" style={{ color: "var(--twx-ink-muted)" }}>
      A Hozzáférések ablakot a cégvezető látja. Ha a céged cégvezetője vagy, és mégsem látod, írj nekünk: office@twinx.hu.
    </div>;
  }
  const c = companies.find((x) => x.id === cid) ?? companies[0];
  const iAmLastHead = c.heads.length <= 1;
  const candidates = c.members.filter((m) => !m.isHead);

  return (
    <div className="space-y-4">
      {companies.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {companies.map((x) => (
            <button key={x.id} type="button" onClick={() => { setCid(x.id); setOpenMod(null); }}
              className="h-9 rounded-full px-4 text-sm font-medium" style={x.id === c.id ? { background: "var(--twx-dark)", color: "var(--twx-on-dark)" } : { border: "1px solid var(--twx-line)" }}>
              {x.name}
            </button>
          ))}
        </div>
      )}

      <section className="twx-card flex h-[560px] flex-col overflow-hidden">
        <header className="flex-none border-b px-5 py-4" style={{ borderColor: "var(--twx-line)" }}>
          <h2 className="font-display text-lg font-semibold">{c.name}</h2>
          <p className="text-sm" style={{ color: "var(--twx-ink-muted)" }}>Itt kezeled, ki használja a cégetek moduljait.</p>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {c.modules.length === 0 ? (
            <p className="flex h-full items-center justify-center px-6 text-center text-sm" style={{ color: "var(--twx-ink-muted)" }}>
              Itt jelennek meg a céged moduljai, amint aktiváljuk őket.
            </p>
          ) : (
            <ul>{c.modules.map((m) => <ModuleRow key={m.id} m={m} meId={meId} busy={busy} act={act} open={openMod === m.id} onToggle={() => setOpenMod((v) => (v === m.id ? null : m.id))} />)}</ul>
          )}
        </div>
      </section>

      {/* Cégvezetők doboz */}
      <section className="twx-card p-5">
        <h3 className="font-display text-base font-semibold">Cégvezetők</h3>
        <ul className="mt-2 space-y-1 text-sm">
          {c.heads.map((h) => (
            <li key={h.userId} className="flex h-9 items-center justify-between gap-3">
              <span className="truncate">{h.name || h.email}{h.userId === meId ? " (te)" : ""}</span>
              {h.userId === meId && (
                <button type="button" className="twx-btn-outline flex-none text-xs" disabled={busy || iAmLastHead}
                  title={iAmLastHead ? "Előbb nevezz ki másik cégvezetőt." : undefined} onClick={() => setDlg("resign")}>
                  Lemondok a cégvezetői státuszról
                </button>
              )}
            </li>
          ))}
        </ul>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="w-72"><SelectField size="sm" value={appoint} onChange={setAppoint} placeholder={candidates.length ? "Válassz a cég tagjai közül" : "Nincs más aktív tag"}
            options={candidates.map((m) => ({ value: m.userId, label: m.name ? `${m.name} (${m.email})` : m.email }))} disabled={!candidates.length} /></div>
          <button type="button" className="twx-btn-outline text-sm" disabled={busy || !appoint} onClick={() => setDlg("appoint")}>Kinevezés cégvezetőnek</button>
        </div>
      </section>

      {dlg === "appoint" && (() => {
        const p = candidates.find((m) => m.userId === appoint);
        return <Confirm busy={busy} title="Kinevezés cégvezetővé" ok="Kinevezés" onClose={() => setDlg(null)}
          text={`${p?.name || p?.email} cégvezető lesz a(z) ${c.name} cégnél. Meghívhat, eltávolíthat, kinevezhet másokat, és fizethet is. Biztosan?`}
          onOk={async () => { if (await act({ action: "appoint", companyId: c.id, userId: appoint })) setAppoint(""); setDlg(null); }} />;
      })()}
      {dlg === "resign" && (
        <Confirm busy={busy} title="Lemondás" ok="Lemondok" onClose={() => setDlg(null)}
          text="Lemondasz a cégvezetői státuszról? Utána nem tudsz meghívni és eltávolítani. Új státuszt csak másik cégvezető vagy mi adhatunk."
          onOk={async () => { await act({ action: "resign", companyId: c.id }); setDlg(null); }} />
      )}

      {/* A meghívó linkje, ha a levél nem ment ki — egyszer látszik */}
      {link && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" style={{ background: "rgba(18,16,14,0.55)" }} onMouseDown={() => setLink(null)}>
          <div className="twx-card w-full max-w-lg p-6" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal>
            <h3 className="font-display text-lg font-semibold">Küldd el te a meghívót</h3>
            <p className="mt-2 text-sm">A levelet most nem tudtuk elküldeni. Másold ki ezt a linket, és küldd el a kollégádnak (e-mailben, üzenetben). A link 7 napig érvényes, és csak erre az e-mail címre szól. Bezárás után nem látod újra — újraküldéssel kérhetsz újat.</p>
            <input readOnly className="twx-input mt-3 w-full font-mono text-xs" value={link} onFocus={(e) => e.currentTarget.select()} />
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className="twx-btn-outline" onClick={() => setLink(null)}>Bezárás</button>
              <button type="button" className="twx-btn" onClick={() => { void navigator.clipboard.writeText(link).then(() => showToast("Link kimásolva.", "success")).catch(() => {}); }}>Link másolása</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
