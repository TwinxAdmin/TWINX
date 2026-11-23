// Admin → Egyedi modulok (view="modules") és Előfizetések (view="subscriptions") — terv 12 / 1.4, 1.6; terv 23.
// Egy közös lista két nézetben: a fejlesztés követése (állapot, felelős, átadás, Aktiválás), illetve az előfizetés
// (helyek: foglalt / összes, érvényesség, lejárati jelzés). Soronként „⋯" menü; kibontott sor: részletek, átadás,
// történet. Fix magasságú doboz, belül görgetés; a felugró adatlapok fix méretűek.
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import SelectField from "@/components/SelectField";
import DateField from "@/components/DateField";
import { ActionMenu, MenuDots, MI, useActionMenu, type MenuItem } from "@/components/ui/ActionMenu";
import { showToast } from "@/components/Toast";
import {
  HANDOVER_VIA, MANUAL_STATES, MODULE_STATE_META,
  type AdminCompanyModule, type CompanyLogEntry, type ModuleState,
} from "@/lib/companies";

type Payload = {
  migrated: boolean; error?: string; modules: AdminCompanyModule[]; notice?: string;
  companies: { id: string; name: string }[]; admins: { id: string; name: string }[]; registry: { key: string; name: string }[];
};
type Act = (body: Record<string, unknown>) => Promise<boolean>;
const API = "/api/admin/company-modules";

const todayKey = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Budapest" }).format(new Date());
const fmtDate = (d: string | null) => (d ? new Intl.DateTimeFormat("hu-HU", { year: "numeric", month: "short", day: "numeric" }).format(new Date(d + "T12:00:00")) : "—");
const fmtTs = (iso: string) => new Intl.DateTimeFormat("hu-HU", { timeZone: "Europe/Budapest", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
function daysLeft(d: string | null): number | null {
  if (!d) return null;
  return Math.round((new Date(d + "T12:00:00").getTime() - new Date(todayKey() + "T12:00:00").getTime()) / 86400000);
}

const LOG_LABEL: Record<string, string> = {
  modul_allapot_valtozott: "Állapot", helyek_modositva: "Helyek módosítva", ervenyesseg_modositva: "Érvényesség módosítva",
  atadas_rogzitve: "Átadás rögzítve", atadas_felulirva: "Új átadás (felülírva)", atadas_visszavonva: "Átadás visszavonva",
  modul_aktivalva: "Aktiválva", modul_kikapcsolva: "Kikapcsolva", meghivva: "Meghívva", meghivo_ujrakuldve: "Meghívó újraküldve",
  meghivo_visszavonva: "Meghívó visszavonva", meghivo_elfogadva: "Meghívó elfogadva", hozzaferes_megadva: "Hozzáférés megadva",
  hozzaferes_eltavolitva: "Hozzáférés eltávolítva",
};

function StatePill({ s }: { s: ModuleState }) {
  const m = MODULE_STATE_META[s];
  return <span className="inline-flex w-[92px] justify-center rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: m.bg, color: m.fg }}>{m.label}</span>;
}

function Dialog({ title, children, onClose, wide }: { title: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" style={{ background: "rgba(18,16,14,0.55)" }} onMouseDown={onClose}>
      <div className={`twx-card w-full ${wide ? "max-w-lg" : "max-w-md"} p-6`} onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal>
        <h3 className="font-display text-lg font-semibold">{title}</h3>
        {children}
      </div>
    </div>
  );
}
const Label = ({ t, children }: { t: string; children: React.ReactNode }) => (
  <label className="mt-3 block text-xs" style={{ color: "var(--twx-ink-muted)" }}>{t}<div className="mt-1">{children}</div></label>
);

function SubscriptionDialog({ m, busy, act, onClose }: { m: AdminCompanyModule; busy: boolean; act: Act; onClose: () => void }) {
  const [seats, setSeats] = useState(String(m.seats));
  const [valid, setValid] = useState(m.validUntil ?? "");
  const [costly, setCostly] = useState(m.isApiCostly);
  const [cap, setCap] = useState(m.monthlyCap === null ? "" : String(m.monthlyCap));
  const [u, setU] = useState({ unitLabel: m.unitLabel ?? "", includedUnits: m.includedUnits == null ? "" : String(m.includedUnits),
    packUnits: m.packUnits == null ? "" : String(m.packUnits), packCostFt: m.packCostFt == null ? "" : String(m.packCostFt),
    packPriceNet: m.packPriceNet == null ? "" : String(m.packPriceNet) });
  const num = (k: keyof typeof u) => (e: React.ChangeEvent<HTMLInputElement>) => setU((p) => ({ ...p, [k]: e.target.value.replace(/\D/g, "") }));
  const capLocked = m.monthlyCap !== null;
  return (
    <Dialog title={`Előfizetés — ${m.moduleName}`} onClose={onClose} wide>
      <p className="mt-1 text-xs" style={{ color: "var(--twx-ink-muted)" }}>{m.companyName} · foglalt hely: {m.seatsUsed}</p>
      <Label t="Helyek száma"><input className="twx-input w-full text-sm" inputMode="numeric" value={seats} onChange={(e) => setSeats(e.target.value.replace(/\D/g, ""))} /></Label>
      <Label t="Érvényes eddig"><DateField value={valid} onChange={setValid} clearable /></Label>
      <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-[#ef7a5a]" checked={costly} onChange={(e) => setCostly(e.target.checked)} />API-költséges modul (kép, videó, kutatás)</label>
      <Label t={capLocked ? "Havi keret (Ft, nettó önköltség) — módosítás a „⋯” → Keret módosítása ponttal, indoklással" : "Havi keret (Ft, nettó önköltség) — API-költséges modulnál az Aktiválás előtt kötelező"}>
        <input className="twx-input w-full text-sm" inputMode="numeric" value={cap} placeholder="üres = nincs" disabled={capLocked} onChange={(e) => setCap(e.target.value.replace(/\D/g, ""))} />
      </Label>
      <div className="grid grid-cols-2 gap-x-3">
        <Label t="Egység neve (pl. kép)"><input className="twx-input w-full text-sm" maxLength={40} value={u.unitLabel} onChange={(e) => setU((p) => ({ ...p, unitLabel: e.target.value }))} /></Label>
        <Label t="Havi díjban foglalt mennyiség"><input className="twx-input w-full text-sm" inputMode="numeric" value={u.includedUnits} onChange={num("includedUnits")} /></Label>
        <Label t="Pluszcsomag: mennyiség"><input className="twx-input w-full text-sm" inputMode="numeric" value={u.packUnits} onChange={num("packUnits")} /></Label>
        <Label t="Pluszcsomag: keret-kiegészítés (Ft)"><input className="twx-input w-full text-sm" inputMode="numeric" value={u.packCostFt} onChange={num("packCostFt")} /></Label>
        <Label t="Pluszcsomag: nettó ár (Ft)"><input className="twx-input w-full text-sm" inputMode="numeric" value={u.packPriceNet} onChange={num("packPriceNet")} /></Label>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" className="twx-btn-outline" onClick={onClose}>Mégse</button>
        <button type="button" className="twx-btn" disabled={busy || seats === ""}
          onClick={async () => { if (await act({ action: "subscription", id: m.id, seats: Number(seats), validUntil: valid || null, isApiCostly: costly, monthlyCap: cap === "" ? null : Number(cap), ...u })) onClose(); }}>
          Mentés
        </button>
      </div>
    </Dialog>
  );
}

function HandoverDialog({ m, busy, act, onClose }: { m: AdminCompanyModule; busy: boolean; act: Act; onClose: () => void }) {
  const [f, setF] = useState({ name: "", role: "", via: "email", on: todayKey(), summary: "", note: "" });
  const set = (k: keyof typeof f) => (v: string) => setF((p) => ({ ...p, [k]: v }));
  const ready = f.name.trim() && f.summary.trim() && f.on;
  return (
    <Dialog title={m.state === "teszt" ? "Átadás rögzítése" : "Új átadás rögzítése"} onClose={onClose} wide>
      <p className="mt-1 text-xs" style={{ color: "var(--twx-ink-muted)" }}>{m.moduleName} · {m.companyName}{m.state === "teszt" ? " — mentés után a modul Átadva állapotba lép." : " — az előző bejegyzés Felülírt lesz."}</p>
      <div className="grid gap-x-3 sm:grid-cols-2">
        <Label t="Elfogadó neve (a cég részéről) *"><input className="twx-input w-full text-sm" maxLength={120} value={f.name} onChange={(e) => set("name")(e.target.value)} /></Label>
        <Label t="Szerepe"><input className="twx-input w-full text-sm" maxLength={80} value={f.role} placeholder="pl. cégvezető" onChange={(e) => set("role")(e.target.value)} /></Label>
        <Label t="Hogyan fogadta el *"><SelectField size="sm" value={f.via} onChange={set("via")} searchable={false} options={Object.entries(HANDOVER_VIA).map(([value, label]) => ({ value, label }))} /></Label>
        <Label t="Mikor *"><DateField size="sm" value={f.on} onChange={set("on")} max={todayKey()} /></Label>
      </div>
      <Label t="Mit kapott meg (leírás, verzió vagy címke) *"><textarea className="twx-input h-20 w-full resize-none text-sm" maxLength={1000} value={f.summary} onChange={(e) => set("summary")(e.target.value)} /></Label>
      <Label t="Megjegyzés"><input className="twx-input w-full text-sm" maxLength={1000} value={f.note} onChange={(e) => set("note")(e.target.value)} /></Label>
      <p className="mt-2 text-[11px]" style={{ color: "var(--twx-ink-muted)" }}>Csak követési adat — ügyfél titkos (NDA) adata ne kerüljön ide.</p>
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" className="twx-btn-outline" onClick={onClose}>Mégse</button>
        <button type="button" className="twx-btn" disabled={busy || !ready} onClick={async () => { if (await act({ action: "handover", id: m.id, ...f })) onClose(); }}>Mentés</button>
      </div>
    </Dialog>
  );
}

function Row({ m, view, open, onToggle, busy, act, admins }: {
  m: AdminCompanyModule; view: "modules" | "subscriptions"; open: boolean; onToggle: () => void; busy: boolean; act: Act;
  admins: { id: string; name: string }[];
}) {
  const menu = useActionMenu();
  const [dlg, setDlg] = useState<null | "sub" | "handover" | "revoke" | "edit" | "pack" | "cap" | "cancel">(null);
  const [cancel, setCancel] = useState({ effectiveOn: "", reason: "" });
  const cancelled = !!m.cancelEffectiveOn || m.state === "lemondva";
  const [pack, setPack] = useState({ extraCostFt: "", extraUnits: "", priceNet: "", reason: "" });
  const [capEdit, setCapEdit] = useState({ capFt: "", reason: "" });
  const [events, setEvents] = useState<{ id: string; operation_key: string; units: number; estimated_cost_ft: number; actual_cost_ft: number | null; status: string; created_at: string }[] | null>(null);
  const pct = m.usage?.pct ?? null;
  const [log, setLog] = useState<CompanyLogEntry[] | null>(null);
  const [reason, setReason] = useState("");
  const [owner, setOwner] = useState(m.ownerId ?? "");
  const [note, setNote] = useState(m.note ?? "");
  const valid = m.handovers.find((h) => h.status === "ervenyes");
  const dl = daysLeft(m.validUntil);
  const expiring = m.state === "aktiv" && dl !== null && dl <= 3;

  useEffect(() => {
    if (!open) return;
    let alive = true;
    fetch(`${API}?log=${m.id}`).then((r) => r.json()).then((d) => { if (alive) setLog(d.log ?? []); }).catch(() => {});
    fetch(`${API}?usage=${m.id}`).then((r) => r.json()).then((d) => { if (alive) setEvents(d.events ?? []); }).catch(() => {});
    return () => { alive = false; };
  }, [open, m.id, m.state, m.seats, m.validUntil, m.handovers.length]);

  const items: MenuItem[] = [
    { kind: "sub", label: "Állapot", icon: MI.restore, title: "Új állapot",
      items: MANUAL_STATES.map((s) => ({ id: s, label: MODULE_STATE_META[s].label, checked: m.state === s,
        disabled: m.state === "aktiv", onClick: async () => { await act({ action: "set_state", id: m.id, state: s }); menu.close(); } })) },
    { label: "Előfizetés szerkesztése", icon: MI.rename, onClick: () => setDlg("sub") },
    { label: "Felelős és megjegyzés", icon: MI.rename, onClick: () => { setOwner(m.ownerId ?? ""); setNote(m.note ?? ""); setDlg("edit"); } },
    { label: "Pluszcsomag hozzáadása", icon: MI.folder, disabled: m.monthlyCap === null, hint: m.monthlyCap === null ? "Előbb állíts be havi keretet." : "Erre a hónapra bővíti a keretet.",
      onClick: () => { setPack({ extraCostFt: m.packCostFt == null ? "" : String(m.packCostFt), extraUnits: m.packUnits == null ? "" : String(m.packUnits), priceNet: m.packPriceNet == null ? "" : String(m.packPriceNet), reason: "" }); setDlg("pack"); } },
    { label: "Keret módosítása", icon: MI.rename, onClick: () => { setCapEdit({ capFt: m.monthlyCap == null ? "" : String(m.monthlyCap), reason: "" }); setDlg("cap"); } },
    { kind: "divider" },
    m.state === "teszt"
      ? { label: "Átadás rögzítése", icon: MI.send, onClick: () => setDlg("handover") }
      : { label: "Új átadás rögzítése", icon: MI.send, disabled: !["atadva", "aktiv"].includes(m.state),
          hint: ["atadva", "aktiv"].includes(m.state) ? "Érdemi változás után; hibajavításnál nem kell." : "Előbb Teszt állapot kell.", onClick: () => setDlg("handover") },
    { label: "Átadás visszavonása", icon: MI.out, disabled: m.state !== "atadva", hint: m.state === "atadva" ? undefined : "Csak Átadva állapotban.", onClick: () => { setReason(""); setDlg("revoke"); } },
    { kind: "divider" },
    cancelled
      ? { label: m.state === "lemondva" ? "Újranyitás" : "Lemondás visszavonása", icon: MI.restore, disabled: busy,
          hint: m.state === "lemondva" ? "Szünetel állapotba kerül; az Aktiválással kapcsolható vissza." : "A modul a lemondás nélkül fut tovább.",
          onClick: () => act({ action: "reopen", id: m.id }) }
      : { label: "Lemondás rögzítése", icon: MI.out, disabled: busy, hint: "A kifizetett időszak végéig működik (terv 21).",
          onClick: () => { setCancel({ effectiveOn: m.validUntil ?? "", reason: "" }); setDlg("cancel"); } },
    m.state === "aktiv"
      ? { label: "Kikapcsolás", icon: MI.out, danger: true, onClick: () => act({ action: "deactivate", id: m.id }) }
      : { label: "Aktiválás", icon: MI.restore, disabled: !["atadva", "szunetel"].includes(m.state),
          hint: ["atadva", "szunetel"].includes(m.state) ? "Feltételek: regiszter + adatkezelési leírás, érvényes átadás és előfizetés, plafon (ha költséges), cégvezető." : "Előbb Átadva állapot kell.",
          onClick: () => act({ action: "activate", id: m.id }) },
  ];

  return (
    <li className="border-b last:border-b-0" style={{ borderColor: "var(--twx-line)" }}>
      <div className="flex h-14 cursor-pointer items-center gap-3 px-4 text-sm" onClick={onToggle} onContextMenu={menu.openAtEvent}>
        <StatePill s={m.state} />
        <span className="min-w-0 flex-1 truncate font-medium" style={{ opacity: m.state === "lemondva" ? 0.6 : 1 }}>{m.moduleName}
          {!m.registered && <span className="ml-2 text-[11px] font-normal" style={{ color: "var(--twx-ink-muted)" }}>(kód: még nincs a regiszterben)</span>}
          {m.cancelEffectiveOn && m.state !== "lemondva" && <span className="ml-2 rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: "#fdecea", color: "#8a2a22" }}>Lemondva {fmtDate(m.cancelEffectiveOn)}-től</span>}
        </span>
        <span className="hidden w-40 flex-none truncate text-xs sm:block" style={{ color: "var(--twx-ink-muted)" }}>{m.companyName}</span>
        {view === "modules" ? (
          <>
            <span className="hidden w-20 flex-none truncate text-xs md:block" style={{ color: "var(--twx-ink-muted)" }}>{m.ownerName ?? "—"}</span>
            <span className="hidden w-24 flex-none text-right text-xs md:block" style={{ color: "var(--twx-ink-muted)" }}>{fmtTs(m.updatedAt)}</span>
          </>
        ) : (
          <>
            <span className="w-20 flex-none text-right text-xs tabular-nums">{m.seatsUsed} / {m.seats} hely</span>
            {/* Havi keret-sáv (terv 20): fix szélesség; 80% fölött narancs, 100%-nál piros */}
            <span className="hidden w-32 flex-none md:block" title={m.usage?.capFt != null ? `${m.usage.usedFt.toLocaleString("hu-HU")} / ${m.usage.capFt.toLocaleString("hu-HU")} Ft` : "Nincs keret"}>
              {m.usage?.capFt != null ? (
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full" style={{ background: "#ece3d7" }}>
                    <span className="block h-full" style={{ width: `${Math.min(100, pct ?? 0)}%`, background: (pct ?? 0) >= 100 ? "#b5372f" : (pct ?? 0) >= 80 ? "#e08a2b" : "#3f8a5c" }} />
                  </span>
                  <span className="w-9 text-right text-[11px] tabular-nums">{pct ?? 0}%</span>
                </span>
              ) : <span className="text-[11px]" style={{ color: "var(--twx-ink-muted)" }}>nincs keret</span>}
            </span>
            <span className="w-28 flex-none text-right text-xs tabular-nums" style={{ color: expiring ? "#b5372f" : "var(--twx-ink-muted)", fontWeight: expiring ? 700 : 400 }}>
              {fmtDate(m.validUntil)}{expiring ? (dl! < 0 ? " · lejárt" : ` · ${dl} nap`) : ""}
            </span>
          </>
        )}
        <span onClick={(e) => e.stopPropagation()}><MenuDots onClick={menu.openAtButton} /></span>
      </div>
      {menu.open && <ActionMenu at={menu.at} items={items} onClose={menu.close} />}

      {open && (
        <div className="grid gap-5 px-4 pb-5 pt-1 text-sm md:grid-cols-2" style={{ background: "#fbf8f2" }}>
          <div className="space-y-1.5">
            <p><span style={{ color: "var(--twx-ink-muted)" }}>Kulcs:</span> <code>{m.moduleKey}</code> · {m.registered ? (m.hasDataPolicy ? "regiszterben, adatkezeléssel" : "regiszterben, adatkezelési leírás nélkül") : "nincs a regiszterben"}</p>
            <p><span style={{ color: "var(--twx-ink-muted)" }}>Előfizetés:</span> {m.seatsUsed} / {m.seats} hely · érvényes: {fmtDate(m.validUntil)}{m.isApiCostly ? ` · API-költséges, plafon: ${m.monthlyCap === null ? "nincs beállítva" : `${m.monthlyCap.toLocaleString("hu-HU")} Ft`}` : ""}</p>
            <p><span style={{ color: "var(--twx-ink-muted)" }}>Cégvezető:</span> {m.hasHead ? "van" : <span style={{ color: "#b5372f" }}>nincs (Cégek lap)</span>} · felelős: {m.ownerName ?? "—"}</p>
            {m.usage?.capFt != null && (
              <p><span style={{ color: "var(--twx-ink-muted)" }}>E havi keret:</span> {m.usage.usedFt.toLocaleString("hu-HU")} / {m.usage.capFt.toLocaleString("hu-HU")} Ft ({m.usage.pct ?? 0}%) · {m.usage.units}{m.unitLabel ? ` ${m.unitLabel}` : " művelet"}{m.includedUnits != null ? ` (díjban: ${m.includedUnits})` : ""}</p>
            )}
            {m.note && <p className="whitespace-pre-wrap text-xs" style={{ color: "var(--twx-ink-muted)" }}>Megjegyzés: {m.note}</p>}
            <p className="pt-2 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--twx-ink-muted)" }}>Átadás</p>
            <div className="h-32 overflow-y-auto rounded-xl p-3 text-xs" style={{ background: "#fff", border: "1px solid var(--twx-line)" }}>
              {m.handovers.length === 0 ? <p style={{ color: "var(--twx-ink-muted)" }}>Még nincs átadás rögzítve.</p> : m.handovers.map((h) => (
                <p key={h.id} className="mb-1.5" style={{ opacity: h.status === "ervenyes" ? 1 : 0.55 }}>
                  <b>{h.status === "ervenyes" ? "Érvényes" : h.status === "felulirva" ? "Felülírt" : "Visszavont"}</b> · {fmtDate(h.on)} · {h.name}{h.role ? ` (${h.role})` : ""} · {HANDOVER_VIA[h.via] ?? h.via}<br />
                  <span style={{ color: "var(--twx-ink-muted)" }}>{h.summary}{h.revokedReason ? ` — visszavonás oka: ${h.revokedReason}` : ""}</span>
                </p>
              ))}
            </div>
            {!valid && ["atadva", "aktiv"].includes(m.state) && <p className="text-xs" style={{ color: "#b5372f" }}>Nincs érvényes átadási bejegyzés.</p>}
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--twx-ink-muted)" }}>Használat (legutóbbi műveletek)</p>
            <ul className="mb-3 h-24 space-y-0.5 overflow-y-auto rounded-xl p-2 text-xs" style={{ background: "#fff", border: "1px solid var(--twx-line)" }}>
              {events === null ? <li style={{ color: "var(--twx-ink-muted)" }}>Betöltés…</li> : events.length === 0 ? <li style={{ color: "var(--twx-ink-muted)" }}>Még nincs használat.</li> : events.map((e) => (
                <li key={e.id} className="flex gap-2">
                  <span className="w-24 flex-none tabular-nums" style={{ color: "var(--twx-ink-muted)" }}>{fmtTs(e.created_at)}</span>
                  <span className="min-w-0 flex-1 truncate">{e.operation_key} × {e.units}</span>
                  <span className="flex-none tabular-nums">{(e.actual_cost_ft ?? e.estimated_cost_ft).toLocaleString("hu-HU")} Ft</span>
                  <span className="w-16 flex-none text-right" style={{ color: e.status === "feloldott" ? "var(--twx-ink-muted)" : undefined }}>{e.status === "elszamolt" ? "elszámolt" : e.status}</span>
                </li>
              ))}
            </ul>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--twx-ink-muted)" }}>Története</p>
            <ul className="h-56 space-y-1 overflow-y-auto text-xs">
              {log === null ? <li style={{ color: "var(--twx-ink-muted)" }}>Betöltés…</li> : log.length === 0 ? <li style={{ color: "var(--twx-ink-muted)" }}>Még nincs esemény.</li> : log.map((e) => (
                <li key={e.id} className="flex gap-2">
                  <span className="w-24 flex-none tabular-nums" style={{ color: "var(--twx-ink-muted)" }}>{fmtTs(e.at)}</span>
                  <span className="min-w-0 break-words"><b>{LOG_LABEL[e.action] ?? e.action}</b>{e.target ? ` · ${e.target}` : ""} <span style={{ color: "var(--twx-ink-muted)" }}>({e.actor})</span></span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {dlg === "sub" && <SubscriptionDialog m={m} busy={busy} act={act} onClose={() => setDlg(null)} />}
      {dlg === "handover" && <HandoverDialog m={m} busy={busy} act={act} onClose={() => setDlg(null)} />}
      {dlg === "revoke" && (
        <Dialog title="Átadás visszavonása" onClose={() => setDlg(null)}>
          <p className="mt-2 text-sm">A bejegyzés Visszavont lesz, a modul Teszt állapotba lép vissza.</p>
          <Label t="Indoklás *"><input className="twx-input w-full text-sm" value={reason} onChange={(e) => setReason(e.target.value)} /></Label>
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" className="twx-btn-outline" onClick={() => setDlg(null)}>Mégse</button>
            <button type="button" className="twx-btn" disabled={busy || !reason.trim()} onClick={async () => { if (await act({ action: "revoke_handover", id: m.id, reason })) setDlg(null); }}>Visszavonás</button>
          </div>
        </Dialog>
      )}
      {dlg === "cancel" && (
        <Dialog title="Lemondás rögzítése" onClose={() => setDlg(null)}>
          <p className="mt-2 text-sm">A modul a hatályos napig működik, utána minden kollégától megszűnik. A nyitott meghívók most visszavonódnak; új meghívó, „Használom én is”, hosszabbítás és lejárati figyelmeztetés nem lesz. A modul kódja és regisztere megmarad.</p>
          <Label t="Hatályos nap (alapból a kifizetett időszak vége)"><DateField size="sm" value={cancel.effectiveOn} onChange={(v) => setCancel((c) => ({ ...c, effectiveOn: v }))} /></Label>
          <Label t="Indok * (belső, a cégvezető nem látja)"><input className="twx-input w-full text-sm" maxLength={500} value={cancel.reason} onChange={(e) => setCancel((c) => ({ ...c, reason: e.target.value }))} /></Label>
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" className="twx-btn-outline" onClick={() => setDlg(null)}>Mégse</button>
            <button type="button" className="twx-btn" disabled={busy || !cancel.reason.trim()}
              onClick={async () => { if (await act({ action: "cancel", id: m.id, ...cancel })) setDlg(null); }}>Lemondás rögzítése</button>
          </div>
        </Dialog>
      )}
      {dlg === "pack" && (
        <Dialog title="Pluszcsomag hozzáadása" onClose={() => setDlg(null)}>
          <p className="mt-1 text-xs" style={{ color: "var(--twx-ink-muted)" }}>{m.moduleName} · {m.companyName} — erre a hónapra azonnal bővíti a keretet. Ha megadod a nettó árat, Esedékes fizetési tétel is létrejön.</p>
          <div className="grid grid-cols-2 gap-x-3">
            <Label t="Keret-kiegészítés (Ft) *"><input className="twx-input w-full text-sm" inputMode="numeric" value={pack.extraCostFt} onChange={(e) => setPack((p) => ({ ...p, extraCostFt: e.target.value.replace(/\D/g, "") }))} /></Label>
            <Label t={`Mennyiség${m.unitLabel ? ` (${m.unitLabel})` : ""}`}><input className="twx-input w-full text-sm" inputMode="numeric" value={pack.extraUnits} onChange={(e) => setPack((p) => ({ ...p, extraUnits: e.target.value.replace(/\D/g, "") }))} /></Label>
            <Label t="Nettó ár az ügyfélnek (Ft)"><input className="twx-input w-full text-sm" inputMode="numeric" value={pack.priceNet} onChange={(e) => setPack((p) => ({ ...p, priceNet: e.target.value.replace(/\D/g, "") }))} /></Label>
          </div>
          <Label t="Indoklás *"><input className="twx-input w-full text-sm" maxLength={500} value={pack.reason} onChange={(e) => setPack((p) => ({ ...p, reason: e.target.value }))} /></Label>
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" className="twx-btn-outline" onClick={() => setDlg(null)}>Mégse</button>
            <button type="button" className="twx-btn" disabled={busy || !pack.extraCostFt || !pack.reason.trim()}
              onClick={async () => { if (await act({ action: "add_pack", id: m.id, extraCostFt: Number(pack.extraCostFt), extraUnits: pack.extraUnits, priceNet: pack.priceNet, reason: pack.reason })) setDlg(null); }}>Hozzáadás</button>
          </div>
        </Dialog>
      )}
      {dlg === "cap" && (
        <Dialog title="Havi keret módosítása" onClose={() => setDlg(null)}>
          <Label t="Új havi keret (Ft, nettó önköltség; üres = nincs keret)"><input className="twx-input w-full text-sm" inputMode="numeric" value={capEdit.capFt} onChange={(e) => setCapEdit((p) => ({ ...p, capFt: e.target.value.replace(/\D/g, "") }))} /></Label>
          <Label t="Indoklás *"><input className="twx-input w-full text-sm" maxLength={500} value={capEdit.reason} onChange={(e) => setCapEdit((p) => ({ ...p, reason: e.target.value }))} /></Label>
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" className="twx-btn-outline" onClick={() => setDlg(null)}>Mégse</button>
            <button type="button" className="twx-btn" disabled={busy || !capEdit.reason.trim()}
              onClick={async () => { if (await act({ action: "set_cap", id: m.id, capFt: capEdit.capFt === "" ? null : Number(capEdit.capFt), reason: capEdit.reason })) setDlg(null); }}>Mentés</button>
          </div>
        </Dialog>
      )}
      {dlg === "edit" && (
        <Dialog title="Felelős és megjegyzés" onClose={() => setDlg(null)}>
          <Label t="Felelős admin"><SelectField size="sm" value={owner} onChange={setOwner} searchable={false} options={[{ value: "", label: "—" }, ...admins.map((a) => ({ value: a.id, label: a.name }))]} /></Label>
          <Label t="Megjegyzés (csak követés, NDA-adat nem)"><textarea className="twx-input h-24 w-full resize-none text-sm" maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} /></Label>
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" className="twx-btn-outline" onClick={() => setDlg(null)}>Mégse</button>
            <button type="button" className="twx-btn" disabled={busy} onClick={async () => { if (await act({ action: "update", id: m.id, ownerId: owner, note })) setDlg(null); }}>Mentés</button>
          </div>
        </Dialog>
      )}
    </li>
  );
}

export default function CompanyModulesAdmin({ view }: { view: "modules" | "subscriptions" }) {
  const [data, setData] = useState<Payload | null>(null);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState(view === "subscriptions" ? "elo" : "all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [nc, setNc] = useState({ companyId: "", moduleKey: "", ownerId: "" });

  const load = useCallback(async () => {
    const r = await fetch(API);
    setData(((await r.json().catch(() => null)) as Payload | null) ?? { migrated: false, modules: [], companies: [], admins: [], registry: [] });
  }, []);
  useEffect(() => { void load(); }, [load]);

  const act: Act = useCallback(async (body) => {
    setBusy(true);
    try {
      const r = await fetch(API, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { showToast(d.error ?? "Nem sikerült.", "error"); return false; }
      setData(d as Payload);
      if (d.notice) showToast(d.notice, "success");
      return true;
    } finally { setBusy(false); }
  }, []);

  const filters = view === "modules"
    ? [{ value: "all", label: "Mind" }, { value: "dev", label: "Folyamatban (Felmérés–Átadva)" }, ...(Object.keys(MODULE_STATE_META) as ModuleState[]).map((s) => ({ value: s, label: MODULE_STATE_META[s].label }))]
    : [{ value: "elo", label: "Élő (Aktív, Szünetel)" }, { value: "lejaro", label: "Lejáró (3 napon belül)" }, { value: "all", label: "Mind" }];

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (data?.modules ?? []).filter((m) => {
      if (s && !(`${m.moduleName} ${m.moduleKey} ${m.companyName}`.toLowerCase().includes(s))) return false;
      if (filter === "all") return true;
      if (filter === "dev") return ["felmeres", "ajanlat", "fejlesztes", "teszt", "atadva"].includes(m.state);
      if (filter === "elo") return m.state === "aktiv" || m.state === "szunetel";
      if (filter === "lejaro") { const d = daysLeft(m.validUntil); return m.state === "aktiv" && d !== null && d <= 3; }
      return m.state === filter;
    });
  }, [data, q, filter]);

  if (!data) return <div className="twx-card h-[640px] animate-pulse" />;
  if (!data.migrated) return <div className="twx-card p-6 text-sm">Futtasd le a <code>20261124090000_company-modules.sql</code> migrációt.</div>;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <input className="twx-input w-64 text-sm" placeholder="Keresés: modul vagy cég" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="w-64"><SelectField size="sm" value={filter} onChange={setFilter} options={filters} searchable={false} ariaLabel="Szűrő" /></div>
        <span className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>{list.length} tétel</span>
        {view === "modules" && (
          <button type="button" className="twx-btn ml-auto text-sm" onClick={() => { setNc({ companyId: data.companies[0]?.id ?? "", moduleKey: "", ownerId: "" }); setCreating(true); }}>Új modul</button>
        )}
      </div>
      <section className="twx-card h-[640px] overflow-y-auto">
        {list.length === 0 ? (
          <p className="flex h-full items-center justify-center px-6 text-center text-sm" style={{ color: "var(--twx-ink-muted)" }}>
            {data.modules.length === 0
              ? "Még nincs egyedi modul. Egy céghez az „Új modul” gombbal veheted fel (Felmérés állapotban)."
              : "Ezzel a szűrővel nincs találat."}
          </p>
        ) : (
          <ul>{list.map((m) => <Row key={m.id} m={m} view={view} open={openId === m.id} onToggle={() => setOpenId((v) => (v === m.id ? null : m.id))} busy={busy} act={act} admins={data.admins} />)}</ul>
        )}
      </section>

      {creating && (
        <Dialog title="Új egyedi modul egy cégnek" onClose={() => setCreating(false)}>
          {data.companies.length === 0 ? (
            <p className="mt-3 text-sm">Előbb hozz létre egy céget (Cégek lap vagy Foglalások → Céggé alakítás).</p>
          ) : (
            <>
              <Label t="Cég"><SelectField size="sm" value={nc.companyId} onChange={(v) => setNc((p) => ({ ...p, companyId: v }))} options={data.companies.map((c) => ({ value: c.id, label: c.name }))} /></Label>
              <Label t="Modul kulcsa (kisbetű, szám, kötőjel — a kód regiszterében ezzel szerepel)">
                <input className="twx-input w-full text-sm" list="twx-registry" placeholder="pl. szerzodes-ellenorzo" value={nc.moduleKey}
                  onChange={(e) => setNc((p) => ({ ...p, moduleKey: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") }))} />
                <datalist id="twx-registry">{data.registry.map((r) => <option key={r.key} value={r.key}>{r.name}</option>)}</datalist>
              </Label>
              <Label t="Felelős admin"><SelectField size="sm" value={nc.ownerId} onChange={(v) => setNc((p) => ({ ...p, ownerId: v }))} searchable={false} options={[{ value: "", label: "—" }, ...data.admins.map((a) => ({ value: a.id, label: a.name }))]} /></Label>
            </>
          )}
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" className="twx-btn-outline" onClick={() => setCreating(false)}>Mégse</button>
            <button type="button" className="twx-btn" disabled={busy || !nc.companyId || nc.moduleKey.length < 2}
              onClick={async () => { if (await act({ action: "create", ...nc })) setCreating(false); }}>Felvétel</button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
