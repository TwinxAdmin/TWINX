// Ajánlat és fizetés az adminban (terv 19 / 6. szakasz):
//   • CompanyFinance — a cég „Pénzügy" ablaka (Cégek → ⋯): Ajánlatok · Fizetések · Számlázási adatok fülek
//   • FinanceOverview — Admin → Pénzügy: Esedékes · Kiszámlázva · Fizetve · Lejáró modulok, cégszűrő, CSV
// Tételek „⋯" menüvel (Számlaszám rögzítése, Fizetve, Visszatérítés, Törlés indoklással). Fix méretű dobozok.
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import SelectField from "@/components/SelectField";
import DateField from "@/components/DateField";
import { ActionMenu, MenuDots, MI, useActionMenu, type MenuItem } from "@/components/ui/ActionMenu";
import { showToast } from "@/components/Toast";
import {
  METHOD, MILESTONE, PAYMENT_KIND, PAYMENT_STATUS, QUOTE_STATUS, huf,
  type ExpiringModule, type Payment, type PaymentKind, type Quote,
} from "@/lib/finance";

const API = "/api/admin/finance";
type Act = (body: Record<string, unknown>) => Promise<boolean>;
const todayKey = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Budapest" }).format(new Date());
const fmtDate = (d: string | null) => (d ? new Intl.DateTimeFormat("hu-HU", { year: "numeric", month: "short", day: "numeric" }).format(new Date(d + "T12:00:00")) : "—");
const digits = (v: string) => v.replace(/\D/g, "");

function Pill({ meta }: { meta: { label: string; bg: string; fg: string } }) {
  return <span className="inline-flex w-[96px] justify-center rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: meta.bg, color: meta.fg }}>{meta.label}</span>;
}
function Dialog({ title, children, onClose, wide }: { title: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" style={{ background: "rgba(18,16,14,0.55)" }} onMouseDown={onClose}>
      <div className={`twx-card w-full ${wide ? "max-w-2xl" : "max-w-md"} p-6`} onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal>
        <h3 className="font-display text-lg font-semibold">{title}</h3>
        {children}
      </div>
    </div>
  );
}
const L = ({ t, children }: { t: string; children: React.ReactNode }) => (
  <label className="mt-3 block text-xs" style={{ color: "var(--twx-ink-muted)" }}>{t}<div className="mt-1">{children}</div></label>
);
function Buttons({ onClose, ok, disabled, onOk }: { onClose: () => void; ok: string; disabled: boolean; onOk: () => void }) {
  return (
    <div className="mt-5 flex justify-end gap-2">
      <button type="button" className="twx-btn-outline" onClick={onClose}>Mégse</button>
      <button type="button" className="twx-btn" disabled={disabled} onClick={onOk}>{ok}</button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fizetési tétel sora (közös a cég ablakában és a Pénzügy listában)
// ---------------------------------------------------------------------------
function PaymentRow({ p, act, busy, showCompany }: { p: Payment; act: Act; busy: boolean; showCompany?: boolean }) {
  const menu = useActionMenu();
  const [dlg, setDlg] = useState<null | "invoice" | "paid" | "refund" | "cancel">(null);
  const [invoice, setInvoice] = useState({ no: "", issued: todayKey() });
  const [paid, setPaid] = useState({ date: todayKey(), method: "atutalas" });
  const [reason, setReason] = useState("");
  const items: MenuItem[] = [
    { label: "Számlaszám rögzítése", icon: MI.rename, disabled: busy || p.status !== "esedekes", hint: "A Számlázz.hu-ban kiállított számla száma.", onClick: () => { setInvoice({ no: "", issued: todayKey() }); setDlg("invoice"); } },
    { label: "Fizetve", icon: MI.restore, disabled: busy || !["esedekes", "kiszamlazva"].includes(p.status),
      hint: p.kind === "havi_dij" ? "Havi díjnál a modul érvényessége az időszakkal nő." : undefined, onClick: () => { setPaid({ date: todayKey(), method: "atutalas" }); setDlg("paid"); } },
    { kind: "divider" },
    { label: "Visszatérítés", icon: MI.out, disabled: busy || p.status !== "fizetve", hint: "Az érvényességet nem vonja vissza automatikusan.", onClick: () => { setReason(""); setDlg("refund"); } },
    { label: "Törlés (indoklással)", icon: MI.trash, danger: true, disabled: busy || !["esedekes", "kiszamlazva"].includes(p.status), hint: "A sor megmarad, Törölve állapotban.", onClick: () => { setReason(""); setDlg("cancel"); } },
  ];
  return (
    <li className="border-b last:border-b-0" style={{ borderColor: "var(--twx-line)" }} onContextMenu={menu.openAtEvent}>
      <div className="flex h-14 items-center gap-3 px-4 text-sm">
        <Pill meta={PAYMENT_STATUS[p.status]} />
        <span className="min-w-0 flex-1 truncate">
          {showCompany && <b>{p.companyName} · </b>}{p.description}
          <span className="ml-2 text-xs" style={{ color: "var(--twx-ink-muted)" }}>
            {PAYMENT_KIND[p.kind]}{p.milestone ? ` · ${MILESTONE[p.milestone]}` : ""}{p.moduleName ? ` · ${p.moduleName}` : ""}{p.periodFrom ? ` · ${fmtDate(p.periodFrom)}–${fmtDate(p.periodTo)}` : ""}
          </span>
        </span>
        <span className="w-28 flex-none text-right tabular-nums">{huf(p.amountNet)}<span className="block text-[10px]" style={{ color: "var(--twx-ink-muted)" }}>nettó</span></span>
        <span className="hidden w-32 flex-none text-right text-xs md:block" style={{ color: p.overdue ? "#b5372f" : "var(--twx-ink-muted)", fontWeight: p.overdue ? 700 : 400 }}>
          {p.status === "fizetve" ? `fizetve: ${fmtDate(p.paidAt)}` : p.invoiceNumber ? p.invoiceNumber : `esedékes: ${fmtDate(p.dueDate)}`}{p.overdue ? " · Késik" : ""}
        </span>
        <MenuDots onClick={menu.openAtButton} />
      </div>
      {menu.open && <ActionMenu at={menu.at} items={items} onClose={menu.close} />}

      {dlg === "invoice" && (
        <Dialog title="Számlaszám rögzítése" onClose={() => setDlg(null)}>
          <p className="mt-1 text-xs" style={{ color: "var(--twx-ink-muted)" }}>{p.description} · {huf(p.amountGross)} bruttó</p>
          <L t="Számlaszám *"><input className="twx-input w-full text-sm" value={invoice.no} onChange={(e) => setInvoice((x) => ({ ...x, no: e.target.value }))} /></L>
          <L t="Számla kelte"><DateField size="sm" value={invoice.issued} onChange={(v) => setInvoice((x) => ({ ...x, issued: v }))} /></L>
          <Buttons onClose={() => setDlg(null)} ok="Mentés" disabled={busy || !invoice.no.trim()}
            onOk={async () => { if (await act({ action: "invoiced", paymentId: p.id, invoice: invoice.no, issued: invoice.issued })) setDlg(null); }} />
        </Dialog>
      )}
      {dlg === "paid" && (
        <Dialog title="Fizetve" onClose={() => setDlg(null)}>
          <p className="mt-1 text-xs" style={{ color: "var(--twx-ink-muted)" }}>{p.description} · {huf(p.amountGross)} bruttó{p.kind === "havi_dij" ? " — a modul érvényessége az időszakkal nő." : ""}</p>
          <L t="Fizetés napja"><DateField size="sm" value={paid.date} onChange={(v) => setPaid((x) => ({ ...x, date: v }))} max={todayKey()} /></L>
          <L t="Mód"><SelectField size="sm" value={paid.method} onChange={(v) => setPaid((x) => ({ ...x, method: v }))} searchable={false} options={Object.entries(METHOD).map(([value, label]) => ({ value, label }))} /></L>
          <Buttons onClose={() => setDlg(null)} ok="Fizetve" disabled={busy}
            onOk={async () => { if (await act({ action: "paid", paymentId: p.id, paid: paid.date, method: paid.method })) setDlg(null); }} />
        </Dialog>
      )}
      {(dlg === "refund" || dlg === "cancel") && (
        <Dialog title={dlg === "refund" ? "Visszatérítés" : "Tétel törlése"} onClose={() => setDlg(null)}>
          <p className="mt-2 text-sm">{dlg === "refund" ? "A tétel Visszatérítve lesz. A modul érvényességét ez nem változtatja meg — ha kell, az Előfizetéseknél állítsd át." : "A tétel Törölve lesz; a sor és a napló megmarad."}</p>
          <L t="Indoklás *"><input className="twx-input w-full text-sm" value={reason} onChange={(e) => setReason(e.target.value)} /></L>
          <Buttons onClose={() => setDlg(null)} ok={dlg === "refund" ? "Visszatérítés" : "Törlés"} disabled={busy || !reason.trim()}
            onOk={async () => { if (await act({ action: "close", paymentId: p.id, status: dlg === "refund" ? "visszateritve" : "torolve", reason })) setDlg(null); }} />
        </Dialog>
      )}
    </li>
  );
}

// ---------------------------------------------------------------------------
// Ajánlat sora
// ---------------------------------------------------------------------------
type ItemDraft = { kind: PaymentKind; milestone: string; description: string; amount_net: string; due_date: string; period_from: string; period_to: string };

function QuoteRow({ q, act, busy, modules }: { q: Quote; act: Act; busy: boolean; modules: { id: string; name: string }[] }) {
  const menu = useActionMenu();
  const [accept, setAccept] = useState(false);
  const [items, setItems] = useState<ItemDraft[]>([]);
  const sum = items.reduce((s, i) => s + (Number(i.amount_net) || 0), 0);
  const open = q.status === "vazlat" || q.status === "elkuldve";
  const preset = (kind: "one" | "split") => {
    const base = { kind: "fejlesztesi_dij" as PaymentKind, description: q.title, due_date: "", period_from: "", period_to: "" };
    if (kind === "one") setItems([{ ...base, milestone: "", amount_net: String(q.amountNet) }]);
    else {
      const half = Math.round(q.amountNet / 2);
      setItems([{ ...base, milestone: "eloleg", amount_net: String(half), description: `${q.title} — előleg` },
                { ...base, milestone: "atadaskor", amount_net: String(q.amountNet - half), description: `${q.title} — átadáskor` }]);
    }
  };
  const items0: MenuItem[] = [
    { label: "Elküldve", icon: MI.send, disabled: busy || q.status !== "vazlat", onClick: () => act({ action: "quote_status", quoteId: q.id, status: "elkuldve" }) },
    { label: "Elfogadva — tételek megadása", icon: MI.restore, disabled: busy || !open, onClick: () => { preset("one"); setAccept(true); } },
    { kind: "divider" },
    { label: "Elutasítva", icon: MI.out, disabled: busy || !open, onClick: () => act({ action: "quote_status", quoteId: q.id, status: "elutasitva" }) },
    { label: "Lejárt", icon: MI.out, disabled: busy || q.status !== "elkuldve", onClick: () => act({ action: "quote_status", quoteId: q.id, status: "lejart" }) },
  ];
  const set = (i: number, k: keyof ItemDraft, v: string) => setItems((xs) => xs.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  return (
    <li className="border-b last:border-b-0" style={{ borderColor: "var(--twx-line)" }} onContextMenu={menu.openAtEvent}>
      <div className="flex h-14 items-center gap-3 px-4 text-sm">
        <Pill meta={QUOTE_STATUS[q.status]} />
        <span className="min-w-0 flex-1 truncate">{q.title}{q.companyModuleId && <span className="ml-2 text-xs" style={{ color: "var(--twx-ink-muted)" }}>{modules.find((m) => m.id === q.companyModuleId)?.name}</span>}</span>
        <span className="w-28 flex-none text-right tabular-nums">{huf(q.amountNet)}<span className="block text-[10px]" style={{ color: "var(--twx-ink-muted)" }}>nettó, {q.vatRate}% ÁFA</span></span>
        <span className="hidden w-28 flex-none text-right text-xs md:block" style={{ color: "var(--twx-ink-muted)" }}>érvényes: {fmtDate(q.validUntil)}</span>
        <MenuDots onClick={menu.openAtButton} />
      </div>
      {menu.open && <ActionMenu at={menu.at} items={items0} onClose={menu.close} />}
      {accept && (
        <Dialog title="Ajánlat elfogadása — fizetési tételek" onClose={() => setAccept(false)} wide>
          <p className="mt-1 text-xs" style={{ color: "var(--twx-ink-muted)" }}>{q.title} · {huf(q.amountNet)} nettó. A tételek összege egyezzen az ajánlatéval.</p>
          <div className="mt-3 flex gap-2">
            <button type="button" className="twx-btn-outline text-xs" onClick={() => preset("one")}>Egy összegben</button>
            <button type="button" className="twx-btn-outline text-xs" onClick={() => preset("split")}>Előleg + átadáskor (50/50)</button>
            <button type="button" className="twx-btn-outline text-xs" onClick={() => setItems((xs) => [...xs, { kind: "fejlesztesi_dij", milestone: "", description: q.title, amount_net: "", due_date: "", period_from: "", period_to: "" }])}>+ Tétel</button>
          </div>
          <div className="mt-3 h-64 space-y-3 overflow-y-auto pr-1">
            {items.map((it, i) => (
              <div key={i} className="grid grid-cols-2 gap-2 rounded-xl p-3 sm:grid-cols-4" style={{ background: "#fbf8f2", border: "1px solid var(--twx-line)" }}>
                <SelectField size="sm" value={it.kind} onChange={(v) => set(i, "kind", v)} searchable={false} options={Object.entries(PAYMENT_KIND).map(([value, label]) => ({ value, label }))} />
                <SelectField size="sm" value={it.milestone} onChange={(v) => set(i, "milestone", v)} searchable={false} options={[{ value: "", label: "— mérföldkő" }, ...Object.entries(MILESTONE).map(([value, label]) => ({ value, label }))]} />
                <input className="twx-input text-sm" inputMode="numeric" placeholder="Nettó Ft" value={it.amount_net} onChange={(e) => set(i, "amount_net", digits(e.target.value))} />
                <DateField size="sm" value={it.due_date} onChange={(v) => set(i, "due_date", v)} placeholder="Esedékes" clearable />
                <input className="twx-input col-span-2 text-sm sm:col-span-4" placeholder="Leírás" value={it.description} onChange={(e) => set(i, "description", e.target.value)} />
                {it.kind === "havi_dij" && (
                  <>
                    <DateField size="sm" value={it.period_from} onChange={(v) => set(i, "period_from", v)} placeholder="Időszak eleje" />
                    <DateField size="sm" value={it.period_to} onChange={(v) => set(i, "period_to", v)} placeholder="Időszak vége" />
                  </>
                )}
                <button type="button" className="text-left text-xs underline" style={{ color: "var(--twx-ink-muted)" }} onClick={() => setItems((xs) => xs.filter((_, j) => j !== i))}>Tétel törlése</button>
              </div>
            ))}
          </div>
          <p className="mt-2 text-sm" style={{ color: sum === q.amountNet ? "#1f6b43" : "#b5372f" }}>Tételek összesen: {huf(sum)} / {huf(q.amountNet)}</p>
          {!q.companyModuleId && modules.length > 0 && <p className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>Az ajánlat nincs modulhoz kötve; havi díjhoz a tételt később a Fizetések fülön, modulhoz kötve rögzítsd.</p>}
          <Buttons onClose={() => setAccept(false)} ok="Elfogadás" disabled={busy || sum !== q.amountNet || items.length === 0}
            onOk={async () => { if (await act({ action: "quote_accept", quoteId: q.id, items: items.map((x) => ({ ...x, amount_net: Number(x.amount_net) })) })) setAccept(false); }} />
        </Dialog>
      )}
    </li>
  );
}

// ---------------------------------------------------------------------------
// A cég Pénzügy ablaka
// ---------------------------------------------------------------------------
type CompanyData = { migrated: boolean; error?: string; quotes: Quote[]; payments: Payment[]; modules: { id: string; name: string }[];
  billing: { name: string; taxNumber: string; address: string; email: string } };

export function CompanyFinance({ companyId, companyName, onClose }: { companyId: string; companyName: string; onClose: () => void }) {
  const [tab, setTab] = useState<"quotes" | "payments" | "billing">("quotes");
  const [d, setD] = useState<CompanyData | null>(null);
  const [busy, setBusy] = useState(false);
  const [newQ, setNewQ] = useState<null | { title: string; amountNet: string; vat: string; validUntil: string; cmId: string; note: string }>(null);
  const [newP, setNewP] = useState<null | { kind: PaymentKind; description: string; amountNet: string; vat: string; due: string; cmId: string; periodFrom: string; periodTo: string }>(null);
  const [bill, setBill] = useState({ name: "", taxNumber: "", address: "", email: "" });

  const load = useCallback(async () => {
    const r = await fetch(`${API}?company=${companyId}`);
    const x = (await r.json().catch(() => null)) as CompanyData | null;
    setD(x); if (x?.billing) setBill(x.billing);
  }, [companyId]);
  useEffect(() => { void load(); }, [load]);

  const act: Act = useCallback(async (body) => {
    setBusy(true);
    try {
      const r = await fetch(API, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ companyId, ...body }) });
      const x = await r.json().catch(() => ({}));
      if (!r.ok) { showToast(x.error ?? "Nem sikerült.", "error"); return false; }
      setD(x as CompanyData); if (x.notice) showToast(x.notice, "success");
      return true;
    } finally { setBusy(false); }
  }, [companyId]);

  const tabBtn = (k: typeof tab, l: string) => (
    <button key={k} type="button" onClick={() => setTab(k)} className="flex h-10 items-center border-b-2 px-4 text-sm"
      style={tab === k ? { borderColor: "var(--twx-coral)", fontWeight: 600 } : { borderColor: "transparent", color: "var(--twx-ink-muted)" }}>{l}</button>
  );
  const modOpts = [{ value: "", label: "— nincs modulhoz kötve" }, ...(d?.modules ?? []).map((m) => ({ value: m.id, label: m.name }))];

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" style={{ background: "rgba(18,16,14,0.55)" }} onMouseDown={onClose}>
      <div className="twx-card flex h-[640px] w-full max-w-4xl flex-col overflow-hidden" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal>
        <header className="flex flex-none items-center justify-between gap-3 border-b px-5 pt-4" style={{ borderColor: "var(--twx-line)" }}>
          <div>
            <h3 className="font-display text-lg font-semibold">Pénzügy — {companyName}</h3>
            <div className="mt-1 flex">{tabBtn("quotes", "Ajánlatok")}{tabBtn("payments", "Fizetések")}{tabBtn("billing", "Számlázási adatok")}</div>
          </div>
          <button type="button" className="twx-btn-outline self-start text-xs" onClick={onClose}>Bezárás</button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {!d ? <p className="p-6 text-sm" style={{ color: "var(--twx-ink-muted)" }}>Betöltés…</p>
            : !d.migrated ? <p className="p-6 text-sm">{d.error}</p>
            : tab === "quotes" ? (
              d.quotes.length === 0 ? <p className="flex h-full items-center justify-center p-6 text-sm" style={{ color: "var(--twx-ink-muted)" }}>Még nincs ajánlat.</p>
                : <ul>{d.quotes.map((q) => <QuoteRow key={q.id} q={q} act={act} busy={busy} modules={d.modules} />)}</ul>
            ) : tab === "payments" ? (
              d.payments.length === 0 ? <p className="flex h-full items-center justify-center p-6 text-sm" style={{ color: "var(--twx-ink-muted)" }}>Még nincs fizetési tétel. Ajánlat elfogadásakor jönnek létre, vagy rögzíts egyet.</p>
                : <ul>{d.payments.map((p) => <PaymentRow key={p.id} p={p} act={act} busy={busy} />)}</ul>
            ) : (
              <div className="max-w-lg p-5">
                <p className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>A fizetési tételek a rögzítés pillanatában lementik ezeket (pillanatkép). A végleges mezőkört a könyvelővel egyeztetjük.</p>
                <L t="Számlázási név"><input className="twx-input w-full text-sm" value={bill.name} onChange={(e) => setBill((b) => ({ ...b, name: e.target.value }))} /></L>
                <L t="Adószám"><input className="twx-input w-full text-sm" value={bill.taxNumber} onChange={(e) => setBill((b) => ({ ...b, taxNumber: e.target.value }))} /></L>
                <L t="Cím"><input className="twx-input w-full text-sm" value={bill.address} onChange={(e) => setBill((b) => ({ ...b, address: e.target.value }))} /></L>
                <L t="Számlázási e-mail"><input className="twx-input w-full text-sm" type="email" value={bill.email} onChange={(e) => setBill((b) => ({ ...b, email: e.target.value }))} /></L>
                <div className="mt-4"><button type="button" className="twx-btn" disabled={busy} onClick={() => act({ action: "billing", ...bill })}>Mentés</button></div>
              </div>
            )}
        </div>
        {d?.migrated && tab !== "billing" && (
          <footer className="flex flex-none justify-end gap-2 border-t px-5 py-3" style={{ borderColor: "var(--twx-line)", background: "#fbf8f2" }}>
            {tab === "quotes"
              ? <button type="button" className="twx-btn text-sm" onClick={() => setNewQ({ title: "", amountNet: "", vat: "27", validUntil: "", cmId: "", note: "" })}>Új ajánlat</button>
              : <button type="button" className="twx-btn text-sm" onClick={() => setNewP({ kind: "havi_dij", description: "", amountNet: "", vat: "27", due: "", cmId: d.modules[0]?.id ?? "", periodFrom: "", periodTo: "" })}>Új fizetési tétel</button>}
          </footer>
        )}

        {newQ && (
          <Dialog title="Új ajánlat" onClose={() => setNewQ(null)}>
            <L t="Cím *"><input className="twx-input w-full text-sm" maxLength={200} value={newQ.title} onChange={(e) => setNewQ({ ...newQ, title: e.target.value })} /></L>
            <div className="grid grid-cols-2 gap-x-3">
              <L t="Nettó összeg (Ft) *"><input className="twx-input w-full text-sm" inputMode="numeric" value={newQ.amountNet} onChange={(e) => setNewQ({ ...newQ, amountNet: digits(e.target.value) })} /></L>
              <L t="ÁFA %"><input className="twx-input w-full text-sm" inputMode="numeric" value={newQ.vat} onChange={(e) => setNewQ({ ...newQ, vat: digits(e.target.value) })} /></L>
            </div>
            <L t="Érvényes eddig"><DateField size="sm" value={newQ.validUntil} onChange={(v) => setNewQ({ ...newQ, validUntil: v })} clearable /></L>
            <L t="Modul"><SelectField size="sm" value={newQ.cmId} onChange={(v) => setNewQ({ ...newQ, cmId: v })} searchable={false} options={modOpts} /></L>
            <L t="Megjegyzés"><input className="twx-input w-full text-sm" value={newQ.note} onChange={(e) => setNewQ({ ...newQ, note: e.target.value })} /></L>
            <Buttons onClose={() => setNewQ(null)} ok="Rögzítés" disabled={busy || !newQ.title.trim() || newQ.amountNet === ""}
              onOk={async () => { if (await act({ action: "quote_create", ...newQ, amountNet: Number(newQ.amountNet), vat: Number(newQ.vat || 27) })) setNewQ(null); }} />
          </Dialog>
        )}
        {newP && (
          <Dialog title="Új fizetési tétel" onClose={() => setNewP(null)}>
            <div className="grid grid-cols-2 gap-x-3">
              <L t="Típus"><SelectField size="sm" value={newP.kind} onChange={(v) => setNewP({ ...newP, kind: v as PaymentKind })} searchable={false} options={Object.entries(PAYMENT_KIND).map(([value, label]) => ({ value, label }))} /></L>
              <L t={newP.kind === "havi_dij" ? "Modul *" : "Modul"}><SelectField size="sm" value={newP.cmId} onChange={(v) => setNewP({ ...newP, cmId: v })} searchable={false} options={modOpts} /></L>
            </div>
            <L t="Leírás *"><input className="twx-input w-full text-sm" value={newP.description} onChange={(e) => setNewP({ ...newP, description: e.target.value })} /></L>
            <div className="grid grid-cols-2 gap-x-3">
              <L t="Nettó összeg (Ft) *"><input className="twx-input w-full text-sm" inputMode="numeric" value={newP.amountNet} onChange={(e) => setNewP({ ...newP, amountNet: digits(e.target.value) })} /></L>
              <L t="Esedékes"><DateField size="sm" value={newP.due} onChange={(v) => setNewP({ ...newP, due: v })} clearable /></L>
            </div>
            {newP.kind === "havi_dij" && (
              <div className="grid grid-cols-2 gap-x-3">
                <L t="Időszak eleje *"><DateField size="sm" value={newP.periodFrom} onChange={(v) => setNewP({ ...newP, periodFrom: v })} /></L>
                <L t="Időszak vége *"><DateField size="sm" value={newP.periodTo} onChange={(v) => setNewP({ ...newP, periodTo: v })} /></L>
              </div>
            )}
            <Buttons onClose={() => setNewP(null)} ok="Rögzítés"
              disabled={busy || !newP.description.trim() || newP.amountNet === "" || (newP.kind === "havi_dij" && (!newP.cmId || !newP.periodFrom || !newP.periodTo))}
              onOk={async () => { if (await act({ action: "payment_add", ...newP, amountNet: Number(newP.amountNet), vat: Number(newP.vat || 27) })) setNewP(null); }} />
          </Dialog>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Admin → Pénzügy
// ---------------------------------------------------------------------------
type Overview = { migrated: boolean; error?: string; payments: Payment[]; expiring: ExpiringModule[]; companies: { id: string; name: string }[] };

export function FinanceOverview() {
  const [d, setD] = useState<Overview | null>(null);
  const [tab, setTab] = useState<"esedekes" | "kiszamlazva" | "fizetve" | "lejaro">("esedekes");
  const [company, setCompany] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => { const r = await fetch(API); setD((await r.json().catch(() => null)) as Overview | null); }, []);
  useEffect(() => { void load(); }, [load]);
  const act: Act = useCallback(async (body) => {
    setBusy(true);
    try {
      const r = await fetch(API, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...body, scope: "overview" }) });
      const x = await r.json().catch(() => ({}));
      if (!r.ok) { showToast(x.error ?? "Nem sikerült.", "error"); return false; }
      setD(x as Overview); if (x.notice) showToast(x.notice, "success");
      return true;
    } finally { setBusy(false); }
  }, []);
  const list = useMemo(() => (d?.payments ?? []).filter((p) => (!company || p.companyId === company) && p.status === tab), [d, company, tab]);
  const sum = list.reduce((s, p) => s + p.amountNet, 0);
  if (!d) return <div className="twx-card h-[640px] animate-pulse" />;
  if (!d.migrated) return <div className="twx-card p-6 text-sm">{d.error}</div>;
  const counts = (s: string) => (d.payments ?? []).filter((p) => (!company || p.companyId === company) && p.status === s).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex border-b" style={{ borderColor: "var(--twx-line)" }}>
          {([["esedekes", "Esedékes"], ["kiszamlazva", "Kiszámlázva"], ["fizetve", "Fizetve"], ["lejaro", "Lejáró modulok"]] as const).map(([k, l]) => (
            <button key={k} type="button" onClick={() => setTab(k)} className="flex h-10 w-[150px] items-center justify-center gap-1.5 border-b-2 text-sm"
              style={tab === k ? { borderColor: "var(--twx-coral)", fontWeight: 600 } : { borderColor: "transparent", color: "var(--twx-ink-muted)" }}>
              {l}<span className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>{k === "lejaro" ? d.expiring.length : counts(k)}</span>
            </button>
          ))}
        </div>
        <div className="w-60"><SelectField size="sm" value={company} onChange={setCompany} options={[{ value: "", label: "Minden cég" }, ...d.companies.map((c) => ({ value: c.id, label: c.name }))]} ariaLabel="Cég" /></div>
        {tab !== "lejaro" && (
          <a className="twx-btn-outline ml-auto text-sm" href={`${API}?csv=${tab}${company ? `&company=${company}` : ""}`}>CSV letöltése</a>
        )}
      </div>
      <section className="twx-card h-[600px] overflow-y-auto">
        {tab === "lejaro" ? (
          d.expiring.length === 0 ? <p className="flex h-full items-center justify-center text-sm" style={{ color: "var(--twx-ink-muted)" }}>Nincs 14 napon belül lejáró aktív modul.</p> : (
            <ul>{d.expiring.map((m) => (
              <li key={m.id} className="flex h-12 items-center gap-3 border-b px-4 text-sm last:border-b-0" style={{ borderColor: "var(--twx-line)" }}>
                <span className="min-w-0 flex-1 truncate"><b>{m.companyName}</b> · {m.moduleName}</span>
                <span className="w-40 flex-none text-right text-xs" style={{ color: m.daysLeft <= 3 ? "#b5372f" : "var(--twx-ink-muted)", fontWeight: m.daysLeft <= 3 ? 700 : 400 }}>
                  {m.daysLeft < 0 ? "lejárt" : m.daysLeft === 0 ? "ma jár le" : `Lejár ${m.daysLeft} nap múlva`} · {fmtDate(m.validUntil)}
                </span>
                <span className="w-32 flex-none text-right text-xs" style={{ color: "var(--twx-ink-muted)" }}>havi díj: {m.lastPayment ?? "nincs tétel"}</span>
              </li>
            ))}</ul>
          )
        ) : list.length === 0 ? (
          <p className="flex h-full items-center justify-center text-sm" style={{ color: "var(--twx-ink-muted)" }}>Nincs tétel ebben az állapotban.</p>
        ) : (
          <ul>{list.map((p) => <PaymentRow key={p.id} p={p} act={act} busy={busy} showCompany />)}</ul>
        )}
      </section>
      {tab !== "lejaro" && <p className="text-right text-sm">Összesen (nettó): <b>{huf(sum)}</b></p>}
    </div>
  );
}
