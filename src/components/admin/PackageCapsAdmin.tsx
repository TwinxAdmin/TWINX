// Admin → Előfizetések: az Ingatlan csomag havi keretei cégenként (terv 27, D62).
// Egy sor = egy cég: keret-sáv (használat / keret, 80% és 100% jelzés), a „⋯" menüben „Keret módosítása" indoklással.
// Nincs pluszcsomag, fizetési tétel vagy ajánlat — a keret egyetlen szám (D62). A keretet hozzáférés-adáskor
// (Felhasználók → Ingatlan pipa) kötelező megadni; itt a meglévőt lehet módosítani.
"use client";

import { useCallback, useEffect, useState } from "react";
import { ActionMenu, MenuDots, useActionMenu } from "@/components/ui/ActionMenu";
import { showToast } from "@/components/Toast";

type Row = { capId: string | null; companyId: string; companyName: string; period: string; usedFt: number; capFt: number; pct: number | null };
const huf = (n: number) => `${n.toLocaleString("hu-HU")} Ft`;

function CapRow({ r, onEdit }: { r: Row; onEdit: (r: Row) => void }) {
  const menu = useActionMenu();
  const pct = r.pct ?? (r.capFt === 0 ? 100 : 0);
  const color = pct >= 100 ? "#b5372f" : pct >= 80 ? "#e08a2b" : "#3f8a5c";
  if (!r.capId) {
    // Van Ingatlan-hozzáféréses tag, de nincs keret → a költséges műveletek nem indulnak.
    return (
      <div className="flex h-12 items-center gap-3 border-t px-4 text-sm" style={{ borderColor: "#ece5da" }} onContextMenu={menu.openAtEvent}>
        <span className="min-w-0 flex-1 truncate font-medium">{r.companyName}</span>
        <span className="w-[22rem] flex-none text-right text-xs font-semibold" style={{ color: "#b5372f" }}>Nincs keret — a költséges műveletek nem indulnak</span>
        <MenuDots onClick={menu.openAtButton} />
        {menu.open && <ActionMenu at={menu.at} onClose={menu.close} items={[{ label: "Keret megadása", onClick: () => onEdit(r) }]} />}
      </div>
    );
  }
  return (
    <div className="flex h-12 items-center gap-3 border-t px-4 text-sm" style={{ borderColor: "var(--twx-line, #ece5da)" }}
      onContextMenu={menu.openAtEvent}>
      <span className="min-w-0 flex-1 truncate font-medium">{r.companyName}</span>
      <span className="hidden w-44 flex-none text-right text-xs tabular-nums sm:block" style={{ color: "var(--twx-ink-muted)" }}>
        {huf(r.usedFt)} / {huf(r.capFt)}
      </span>
      <span className="flex w-40 flex-none items-center gap-2">
        <span className="block h-2 flex-1 overflow-hidden rounded-full" style={{ background: "#ece5da" }}>
          <span className="block h-full" style={{ width: `${Math.min(100, pct)}%`, background: color }} />
        </span>
        <span className="w-9 text-right text-[11px] tabular-nums" style={{ color: pct >= 80 ? color : undefined, fontWeight: pct >= 80 ? 700 : 400 }}>{pct}%</span>
      </span>
      <MenuDots onClick={menu.openAtButton} />
      {menu.open && <ActionMenu at={menu.at} onClose={menu.close} items={[{ label: "Keret módosítása", onClick: () => onEdit(r) }]} />}
    </div>
  );
}

export default function PackageCapsAdmin() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [missing, setMissing] = useState(false);
  const [edit, setEdit] = useState<Row | null>(null);
  const [form, setForm] = useState({ capFt: "", reason: "" });
  const [busy, setBusy] = useState(false);

  const apply = (d: { rows?: Row[]; migrationMissing?: boolean }) => { setRows(d.rows ?? []); setMissing(!!d.migrationMissing); };
  const load = useCallback(async () => {
    const r = await fetch("/api/admin/package-caps");
    const d = await r.json().catch(() => ({}));
    if (r.ok) apply(d); else setRows([]);
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function save() {
    if (!edit) return;
    setBusy(true);
    try {
      const r = await fetch("/api/admin/package-caps", { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ companyId: edit.companyId, capFt: Number(form.capFt), reason: form.reason }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { showToast(d.error ?? "Nem sikerült.", "error"); return; }
      apply(d); setEdit(null); showToast(`${edit.companyName}: Ingatlan-keret mentve`, "success");
    } finally { setBusy(false); }
  }

  const capOk = form.capFt !== "" && Number.isInteger(Number(form.capFt)) && Number(form.capFt) >= 0;
  return (
    <section className="twx-card overflow-hidden">
      <div className="flex items-baseline justify-between gap-3 px-4 py-3">
        <div>
          <h2 className="font-display text-base font-semibold">Ingatlan csomag — havi keretek</h2>
          <p className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>Cégenként, nettó önköltség, e havi (budapesti) időszak. 80%-nál jelzés, 100%-nál a költséges műveletek leállnak.</p>
        </div>
        {rows && rows.find((r) => r.period) && <span className="text-xs tabular-nums" style={{ color: "var(--twx-ink-muted)" }}>{rows.find((r) => r.period)!.period}</span>}
      </div>
      {/* Fix magasságú lista: sok cégnél a dobozon belül görget. */}
      <div className="max-h-72 min-h-[6rem] overflow-y-auto">
        {rows === null && <p className="border-t px-4 py-6 text-sm" style={{ color: "var(--twx-ink-muted)", borderColor: "#ece5da" }}>Betöltés…</p>}
        {rows && missing && (
          <p className="border-t px-4 py-6 text-sm" style={{ color: "#b5372f", borderColor: "#ece5da" }}>
            A keretek még nem érhetők el — futtasd a 20261124200000_package-caps.sql migrációt.
          </p>
        )}
        {rows && !missing && rows.length === 0 && (
          <p className="border-t px-4 py-6 text-sm" style={{ color: "var(--twx-ink-muted)", borderColor: "#ece5da" }}>
            Még egy cégnek sincs Ingatlan-kerete. A keretet a Felhasználók lapon, az Ingatlan-hozzáférés megadásakor kell megadni.
          </p>
        )}
        {rows && rows.map((r) => <CapRow key={r.capId ?? `nincs-${r.companyId}`} r={r} onEdit={(x) => { setForm({ capFt: x.capId ? String(x.capFt) : "", reason: "" }); setEdit(x); }} />)}
      </div>

      {edit && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" style={{ background: "rgba(18,16,14,0.55)" }} onMouseDown={() => setEdit(null)}>
          <div className="twx-card w-full max-w-md p-6" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal>
            <h3 className="font-display text-lg font-semibold">{edit.capId ? "Ingatlan-keret módosítása" : "Ingatlan-keret megadása"}</h3>
            <p className="mt-2 text-sm" style={{ color: "var(--twx-ink-muted)" }}>{edit.companyName}{edit.capId ? ` · e hónap: ${huf(edit.usedFt)} / ${huf(edit.capFt)}` : " · még nincs kerete"}</p>
            <label className="mt-4 block text-xs font-semibold" style={{ color: "var(--twx-ink-muted)" }}>Új havi keret (Ft)</label>
            <input type="number" min={0} step={1} inputMode="numeric" className="twx-input mt-1 w-full" value={form.capFt}
              onChange={(e) => setForm((f) => ({ ...f, capFt: e.target.value }))} />
            <label className="mt-3 block text-xs font-semibold" style={{ color: "var(--twx-ink-muted)" }}>Indoklás (kötelező, naplózva)</label>
            <textarea className="twx-input mt-1 h-20 w-full resize-none" maxLength={500} value={form.reason}
              onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} />
            <p className="mt-2 text-xs" style={{ color: "var(--twx-ink-muted)" }}>Azonnal érvényes. A fel nem használt keret nem vihető át a következő hónapra.</p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className="twx-btn-outline" onClick={() => setEdit(null)}>Mégse</button>
              <button type="button" className="twx-btn" disabled={busy || !capOk || !form.reason.trim()} onClick={() => void save()}>Mentés</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
