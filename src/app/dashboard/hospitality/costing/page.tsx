// dashboard/hospitality/costing — Önköltség & profit modul.
// Három fül: (1) Étteremszintű fix költség-profil; (2) Eladások — a partner időszakonként/
// naponta rögzíti az eladott adagokat (tárolódik, számot NEM mutat); (3) Riport — egy
// tetszőleges időszakra a TÁROLT eladásokból kér le kredites, PDF-es kimutatást.
"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ModuleIntro from "@/components/ModuleIntro";
import Skeleton from "@/components/motion/Skeleton";
import { showToast } from "@/components/Toast";
import { formatHuf, categoryLabel, DISH_CATEGORIES, type Dish } from "@/lib/hospitality";
import {
  COST_FIELDS,
  EMPTY_COST_PROFILE,
  costProfileTotal,
  toAmount,
  periodDays,
  proratedOverhead,
  oneTimeInRange,
  type CostProfile,
  type CostingResult,
  type OneTimeCost,
} from "@/lib/costing";

type Tab = "profile" | "sales" | "report";
type SaleRow = { dish_id: string; period_start: string; period_end: string; qty: number };

const todayISO = () => new Date().toISOString().slice(0, 10);

export default function CostingPage() {
  const [tab, setTab] = useState<Tab>("sales");
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [profile, setProfile] = useState<CostProfile>(EMPTY_COST_PROFILE);
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [oneTime, setOneTime] = useState<OneTimeCost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [dRes, pRes, sRes, oRes] = await Promise.all([
          fetch("/api/hospitality/dishes"),
          fetch("/api/hospitality/cost-profile"),
          fetch("/api/hospitality/sales"),
          fetch("/api/hospitality/onetime"),
        ]);
        const d = await dRes.json();
        const p = await pRes.json();
        const s = await sRes.json();
        const o = await oRes.json();
        if (dRes.ok) setDishes(d.dishes ?? []);
        if (pRes.ok && p.profile) setProfile(p.profile);
        if (sRes.ok) setSales(s.sales ?? []);
        if (oRes.ok) setOneTime(o.costs ?? []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const overhead = costProfileTotal(profile);
  const priced = useMemo(
    () => dishes.filter((d) => d.cost_price != null && d.sale_price != null),
    [dishes]
  );

  const tabs: { key: Tab; label: string }[] = [
    { key: "profile", label: "Étteremszintű költség" },
    { key: "sales", label: "Eladások" },
    { key: "report", label: "Riport" },
  ];

  return (
    <main className="mx-auto max-w-4xl space-y-6">
      <ModuleIntro
        eyebrow="Vendéglátás · Önköltség"
        title="Önköltség & profit"
        subtitle="Rögzítsd az eladott adagokat naponta vagy időszakonként — a rendszer eltárolja. Bármikor lekérhetsz egy tetszőleges időszakra szóló profit-kimutatást, ami az alapanyagok mellé a fix költségeket (bérlet, bérek, rezsi…) is rávetíti. A rögzítés ingyenes, a riport kredites és letölthető PDF."
        icon="cost"
        chips={["Eladások rögzítése", "Időszaki riport", "PDF"]}
      />

      {/* Fülek */}
      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="rounded-full px-4 py-2 text-sm font-medium transition"
            style={
              tab === t.key
                ? { background: "var(--twx-coral)", color: "#fff" }
                : { background: "var(--twx-cream-card)", color: "var(--twx-ink-muted)", border: "1px solid var(--twx-line)" }
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)}
        </div>
      ) : tab === "profile" ? (
        <ProfileTab profile={profile} onSaved={setProfile} oneTime={oneTime} onOneTimeChange={setOneTime} />
      ) : tab === "sales" ? (
        <SalesTab priced={priced} sales={sales} onSaved={setSales} />
      ) : (
        <ReportTab priced={priced} sales={sales} overhead={overhead} oneTime={oneTime} />
      )}
    </main>
  );
}

// --- Közös input --------------------------------------------------------------
function NumField({
  value, onChange, placeholder,
}: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      inputMode="numeric"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder ?? "0"}
      className="w-full rounded-lg border px-3 py-2 text-sm text-right"
      style={{ borderColor: "var(--twx-line)", background: "var(--twx-cream-card)" }}
    />
  );
}

// =============================================================================
// 1) Étteremszintű költség-profil
// =============================================================================
function ProfileTab({
  profile, onSaved, oneTime, onOneTimeChange,
}: {
  profile: CostProfile; onSaved: (p: CostProfile) => void;
  oneTime: OneTimeCost[]; onOneTimeChange: (c: OneTimeCost[]) => void;
}) {
  const [vals, setVals] = useState<Record<string, string>>(() => {
    const o: Record<string, string> = {};
    for (const f of COST_FIELDS) o[f.key] = profile[f.key] ? String(profile[f.key]) : "";
    return o;
  });
  const [extra, setExtra] = useState<{ label: string; amount: string }[]>(
    () => (profile.extra_items ?? []).map((e) => ({ label: e.label, amount: String(e.amount) }))
  );
  const [saving, setSaving] = useState(false);

  // Egyszeri kiadás felvitele.
  const [otLabel, setOtLabel] = useState("");
  const [otAmount, setOtAmount] = useState("");
  const [otDate, setOtDate] = useState(todayISO());
  const [otBusy, setOtBusy] = useState(false);

  const total =
    COST_FIELDS.reduce((s, f) => s + toAmount(vals[f.key]), 0) +
    extra.reduce((s, e) => s + toAmount(e.amount), 0);

  const addOneTime = async () => {
    if (!otLabel.trim()) { showToast("Add meg a kiadás megnevezését.", "error"); return; }
    if (toAmount(otAmount) <= 0) { showToast("Az összeg legyen pozitív.", "error"); return; }
    setOtBusy(true);
    try {
      const res = await fetch("/api/hospitality/onetime", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: otLabel.trim(), amount: toAmount(otAmount), spent_on: otDate }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error ?? "Mentés sikertelen.", "error"); return; }
      onOneTimeChange([data.cost, ...oneTime]);
      setOtLabel(""); setOtAmount("");
      showToast("Egyszeri kiadás hozzáadva.", "success");
    } catch {
      showToast("Hálózati hiba. Próbáld újra.", "error");
    } finally {
      setOtBusy(false);
    }
  };

  const removeOneTime = async (id: string) => {
    const prev = oneTime;
    onOneTimeChange(oneTime.filter((c) => c.id !== id));
    const res = await fetch(`/api/hospitality/onetime?id=${id}`, { method: "DELETE" });
    if (!res.ok) { onOneTimeChange(prev); showToast("Törlés sikertelen.", "error"); }
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        extra_items: extra
          .map((e) => ({ label: e.label.trim(), amount: toAmount(e.amount) }))
          .filter((e) => e.label && e.amount > 0),
      };
      for (const f of COST_FIELDS) payload[f.key] = toAmount(vals[f.key]);
      const res = await fetch("/api/hospitality/cost-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error ?? "Mentés sikertelen.", "error"); return; }
      onSaved(data.profile);
      showToast("Költség-profil mentve.", "success");
    } catch {
      showToast("Hálózati hiba. Próbáld újra.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="twx-card p-4 text-sm" style={{ color: "var(--twx-ink-muted)" }}>
        Add meg az étterem <b>havi</b> fix költségeit. Ezekből számoljuk ki, mennyi rezsi jut egy-egy
        ételre a forgalma szerint (a riport a választott időszakra arányosítja). Elég egyszer beállítani;
        bármikor frissíthető, és a mentés ingyenes.
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {COST_FIELDS.map((f) => (
          <div key={f.key} className="twx-card flex items-center justify-between gap-3 p-3">
            <div className="min-w-0">
              <div className="text-sm font-medium">{f.label}</div>
              {f.hint && <div className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>{f.hint}</div>}
            </div>
            <div className="w-36 flex-none">
              <NumField value={vals[f.key] ?? ""} onChange={(v) => setVals((s) => ({ ...s, [f.key]: v }))} />
            </div>
          </div>
        ))}
      </div>

      {/* Egyedi tételek */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Egyedi tételek</h3>
          <button
            onClick={() => setExtra((s) => [...s, { label: "", amount: "" }])}
            className="text-sm font-medium"
            style={{ color: "var(--twx-coral)" }}
          >
            + Tétel hozzáadása
          </button>
        </div>
        {extra.map((e, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              value={e.label}
              onChange={(ev) => setExtra((s) => s.map((x, j) => (j === i ? { ...x, label: ev.target.value } : x)))}
              placeholder="Megnevezés (pl. szoftver-előfizetés)"
              className="flex-1 rounded-lg border px-3 py-2 text-sm"
              style={{ borderColor: "var(--twx-line)", background: "var(--twx-cream-card)" }}
            />
            <div className="w-32 flex-none">
              <NumField value={e.amount} onChange={(v) => setExtra((s) => s.map((x, j) => (j === i ? { ...x, amount: v } : x)))} />
            </div>
            <button
              onClick={() => setExtra((s) => s.filter((_, j) => j !== i))}
              className="flex-none rounded-lg px-2 py-2 text-sm"
              style={{ color: "var(--twx-ink-muted)" }}
              aria-label="Törlés"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4" style={{ background: "var(--twx-coral-soft)" }}>
        <span className="text-sm font-medium" style={{ color: "#7a2e17" }}>Havi összes fix költség</span>
        <span className="font-display text-2xl font-semibold" style={{ color: "#7a2e17" }}>{formatHuf(total)}</span>
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        style={{ background: "var(--twx-coral)" }}
      >
        {saving ? "Mentés…" : "Költség-profil mentése"}
      </button>

      {/* Egyszeri (nem havi) kiadások */}
      <div className="space-y-3 border-t pt-5" style={{ borderColor: "var(--twx-line)" }}>
        <div>
          <h3 className="font-display text-lg font-medium">Egyszeri kiadások</h3>
          <p className="text-sm" style={{ color: "var(--twx-ink-muted)" }}>
            Nem havi, alkalmi kiadások dátummal (pl. új sütő). A riport csak arra az időszakra számolja
            költségként, amelybe a <b>dátum</b> beleesik — így reálisabb az adott időszak profitja. Ingyenes.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[180px] flex-1">
            <label className="block text-xs font-medium" style={{ color: "var(--twx-ink-muted)" }}>Megnevezés</label>
            <input value={otLabel} onChange={(e) => setOtLabel(e.target.value)} placeholder="pl. új sütő"
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--twx-line)", background: "var(--twx-cream-card)" }} />
          </div>
          <div className="w-32">
            <label className="block text-xs font-medium" style={{ color: "var(--twx-ink-muted)" }}>Összeg (Ft)</label>
            <div className="mt-1"><NumField value={otAmount} onChange={setOtAmount} /></div>
          </div>
          <div>
            <label className="block text-xs font-medium" style={{ color: "var(--twx-ink-muted)" }}>Dátum</label>
            <input type="date" value={otDate} onChange={(e) => setOtDate(e.target.value)}
              className="mt-1 rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--twx-line)", background: "var(--twx-cream-card)" }} />
          </div>
          <button onClick={addOneTime} disabled={otBusy}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" style={{ background: "var(--twx-coral)" }}>
            {otBusy ? "…" : "Hozzáadás"}
          </button>
        </div>

        {oneTime.length > 0 && (
          <div className="twx-card divide-y" style={{ borderColor: "var(--twx-line)" }}>
            {oneTime.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                <span className="min-w-0">
                  <span className="font-medium">{c.label}</span>{" "}
                  <span className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>· {c.spent_on}</span>
                </span>
                <span className="flex items-center gap-3">
                  <b>{formatHuf(c.amount)}</b>
                  <button onClick={() => removeOneTime(c.id)} className="text-lg" style={{ color: "var(--twx-ink-muted)" }} aria-label="Törlés">×</button>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// 2) Eladások rögzítése — kategória-kockák + felugró ablak; előzmény-kockák
// =============================================================================
type DishGroup = { cat: string; label: string; items: Dish[] };
type ModalState = { start: string; end: string; view: string | null };

function SalesTab({ priced, sales, onSaved }: { priced: Dish[]; sales: SaleRow[]; onSaved: (s: SaleRow[]) => void }) {
  const [entryStart, setEntryStart] = useState<string>(todayISO());
  const [entryEnd, setEntryEnd] = useState<string>(todayISO());
  const [modal, setModal] = useState<ModalState | null>(null);

  const groups: DishGroup[] = useMemo(
    () =>
      DISH_CATEGORIES.map((c) => ({
        cat: c.value as string,
        label: c.label,
        items: priced.filter((d) => d.category === c.value),
      })).filter((g) => g.items.length),
    [priced]
  );

  // Egy (start,end)-hez mentett adagok kikeresése.
  const savedQtyFor = (s: string, e: string): Record<string, number> => {
    const m: Record<string, number> = {};
    for (const r of sales) if (r.period_start === s && r.period_end === e) m[r.dish_id] = r.qty;
    return m;
  };

  // Korábban rögzített időszakok (distinct start–end), legfrissebb elöl.
  const periods = useMemo(() => {
    const map = new Map<string, { start: string; end: string; qty: number; dishes: number }>();
    for (const r of sales) {
      const k = `${r.period_start}|${r.period_end}`;
      const e = map.get(k) ?? { start: r.period_start, end: r.period_end, qty: 0, dishes: 0 };
      e.qty += r.qty; e.dishes += 1;
      map.set(k, e);
    }
    return [...map.values()].sort((a, b) => (a.start < b.start ? 1 : -1));
  }, [sales]);

  // A modal mentése után frissítjük a helyi sales-listát.
  const applySaved = (s: string, e: string, entries: { dish_id: string; qty: number }[]) => {
    const others = sales.filter((r) => !(r.period_start === s && r.period_end === e));
    const now: SaleRow[] = entries.map((x) => ({ dish_id: x.dish_id, period_start: s, period_end: e, qty: x.qty }));
    onSaved([...now, ...others]);
  };

  if (!priced.length) {
    return (
      <div className="twx-card p-5 text-sm" style={{ color: "var(--twx-ink-muted)" }}>
        Nincs árazott ételed. Adj meg előkészítési + eladási árat a Kínálat kezelőben, majd itt rögzítheted az eladásokat.
      </div>
    );
  }

  const single = entryStart === entryEnd;
  const entrySaved = savedQtyFor(entryStart, entryEnd);
  const latest = periods[0];

  return (
    <div className="space-y-5">
      <div className="twx-card p-4 text-sm" style={{ color: "var(--twx-ink-muted)" }}>
        Válaszd ki a <b>napot</b> (vagy időszakot), majd egy kategória-kockára kattintva egy ablakban írd be, melyik
        ételből <b>hány adag</b> fogyott. Csak elmentjük — a profitot a <b>Riport</b> fülön kéred le. Rögzíthetsz nap
        végén vagy több nap után is; lentebb látod, mit vittél fel eddig.
      </div>

      {/* Dátum(ok) */}
      <div className="twx-card flex flex-wrap items-end gap-4 p-4">
        <div>
          <label className="block text-xs font-medium" style={{ color: "var(--twx-ink-muted)" }}>Nap / időszak kezdete</label>
          <input type="date" value={entryStart} max={entryEnd} onChange={(e) => setEntryStart(e.target.value)}
            className="mt-1 rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--twx-line)", background: "var(--twx-cream-card)" }} />
        </div>
        <div>
          <label className="block text-xs font-medium" style={{ color: "var(--twx-ink-muted)" }}>Időszak vége</label>
          <input type="date" value={entryEnd} min={entryStart} onChange={(e) => setEntryEnd(e.target.value)}
            className="mt-1 rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--twx-line)", background: "var(--twx-cream-card)" }} />
        </div>
        <div className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>
          {single ? "Egy napra rögzítesz." : `${periodDays(entryStart, entryEnd)} napos időszakra rögzítesz.`}
        </div>
      </div>

      {/* Kategória-kockák */}
      <div>
        <h3 className="mb-2 text-sm font-semibold">Kategóriák — kattints a rögzítéshez</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {groups.map((g) => {
            const filled = g.items.filter((d) => (entrySaved[d.id] ?? 0) > 0).length;
            return (
              <button
                key={g.cat}
                onClick={() => setModal({ start: entryStart, end: entryEnd, view: g.cat })}
                className="twx-card flex flex-col gap-1 p-4 text-left transition hover:shadow-md"
              >
                <span className="font-display text-base font-medium">{g.label}</span>
                <span className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>{g.items.length} étel</span>
                {filled > 0 && (
                  <span className="mt-1 w-fit rounded-full px-2 py-0.5 text-xs font-medium" style={{ background: "var(--twx-coral-soft)", color: "#7a2e17" }}>
                    {filled} rögzítve
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Előzmény-segítség: rögzített időszakok kockákban */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Eddigi rögzítéseid</h3>
          {latest && (
            <span className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>
              Legutóbb: {latest.start === latest.end ? latest.start : `${latest.start} – ${latest.end}`}
            </span>
          )}
        </div>
        {periods.length === 0 ? (
          <div className="twx-card p-4 text-sm" style={{ color: "var(--twx-ink-muted)" }}>
            Még nincs rögzített eladásod. A fenti kategória-kockákkal kezdheted.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {periods.map((p) => (
                <button
                  key={`${p.start}|${p.end}`}
                  onClick={() => setModal({ start: p.start, end: p.end, view: null })}
                  className="twx-card flex flex-col gap-1 p-4 text-left transition hover:shadow-md"
                >
                  <span className="font-display text-sm font-semibold">{p.start === p.end ? p.start : `${p.start} –`}</span>
                  {p.start !== p.end && <span className="font-display text-sm font-semibold">{p.end}</span>}
                  <span className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>{p.dishes} étel · {p.qty} adag</span>
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs" style={{ color: "var(--twx-ink-muted)" }}>
              Egy kockára kattintva felugrik az adott időszak, és módosíthatod (hozzáadhatsz vagy elvehetsz).
            </p>
          </>
        )}
      </div>

      {/* Felugró szerkesztő */}
      <AnimatePresence>
        {modal && (
          <EntryEditorModal
            key={`${modal.start}|${modal.end}`}
            start={modal.start}
            end={modal.end}
            initialView={modal.view}
            groups={groups}
            priced={priced}
            initialQty={savedQtyFor(modal.start, modal.end)}
            onSaved={(entries) => applySaved(modal.start, modal.end, entries)}
            onClose={() => setModal(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// Felugró ablak: egy (start,end) eladásainak szerkesztése kategóriánként.
function EntryEditorModal({
  start, end, initialView, groups, priced, initialQty, onSaved, onClose,
}: {
  start: string; end: string; initialView: string | null;
  groups: DishGroup[]; priced: Dish[];
  initialQty: Record<string, number>;
  onSaved: (entries: { dish_id: string; qty: number }[]) => void;
  onClose: () => void;
}) {
  const [qty, setQty] = useState<Record<string, string>>(() => {
    const o: Record<string, string> = {};
    for (const [id, q] of Object.entries(initialQty)) o[id] = String(q);
    return o;
  });
  const [view, setView] = useState<string | null>(initialView);
  const [saving, setSaving] = useState(false);

  const qNum = (id: string) => Math.max(0, Math.floor(Number(qty[id]) || 0));
  const totalDishes = priced.filter((d) => qNum(d.id) > 0).length;
  const totalQty = priced.reduce((s, d) => s + qNum(d.id), 0);
  const label = start === end ? start : `${start} – ${end}`;
  const activeGroup = groups.find((g) => g.cat === view);

  const save = async () => {
    setSaving(true);
    try {
      const entries = priced.map((d) => ({ dish_id: d.id, qty: qNum(d.id) })).filter((e) => e.qty > 0);
      const res = await fetch("/api/hospitality/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ start, end, entries }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error ?? "Mentés sikertelen.", "error"); return; }
      onSaved(entries);
      showToast("Eladások mentve.", "success");
      onClose();
    } catch {
      showToast("Hálózati hiba. Próbáld újra.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(20,12,8,0.45)" }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl"
        style={{ background: "var(--twx-cream-card)", border: "1px solid var(--twx-line)", boxShadow: "0 24px 60px rgba(0,0,0,0.25)" }}
        initial={{ scale: 0.95, opacity: 0, y: 12 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.96, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 26 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Fejléc */}
        <div className="flex items-center justify-between border-b p-4" style={{ borderColor: "var(--twx-line)" }}>
          <div>
            <div className="font-display text-lg font-semibold">Eladások rögzítése</div>
            <div className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>{label}</div>
          </div>
          <button onClick={onClose} className="rounded-lg px-2 py-1 text-xl" style={{ color: "var(--twx-ink-muted)" }} aria-label="Bezár">×</button>
        </div>

        {/* Törzs */}
        <div className="flex-1 overflow-y-auto p-4">
          {!activeGroup ? (
            <>
              <p className="mb-3 text-sm" style={{ color: "var(--twx-ink-muted)" }}>Válassz kategóriát, és írd be az eladott adagokat.</p>
              <div className="grid grid-cols-2 gap-3">
                {groups.map((g) => {
                  const filled = g.items.filter((d) => qNum(d.id) > 0).length;
                  return (
                    <button key={g.cat} onClick={() => setView(g.cat)}
                      className="flex flex-col gap-1 rounded-xl border p-3 text-left transition hover:shadow-sm"
                      style={{ borderColor: "var(--twx-line)" }}>
                      <span className="font-medium">{g.label}</span>
                      <span className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>{g.items.length} étel</span>
                      {filled > 0 && (
                        <span className="mt-1 w-fit rounded-full px-2 py-0.5 text-xs font-medium" style={{ background: "var(--twx-coral-soft)", color: "#7a2e17" }}>
                          {filled} rögzítve
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              <button onClick={() => setView(null)} className="mb-3 text-sm font-medium" style={{ color: "var(--twx-coral)" }}>‹ Kategóriák</button>
              <h4 className="mb-2 font-display text-base font-medium">{categoryLabel(activeGroup.cat)}</h4>
              <div className="space-y-2">
                {activeGroup.items.map((d) => (
                  <div key={d.id} className="flex flex-wrap items-center justify-between gap-3">
                    <span className="min-w-0 font-medium">{d.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>eladott adag</span>
                      <div className="w-24"><NumField value={qty[d.id] ?? ""} onChange={(v) => setQty((s) => ({ ...s, [d.id]: v }))} /></div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Lábléc */}
        <div className="flex items-center justify-between gap-3 border-t p-4" style={{ borderColor: "var(--twx-line)" }}>
          <span className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>{totalDishes} étel · {totalQty} adag</span>
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-xl px-4 py-2 text-sm font-medium" style={{ border: "1px solid var(--twx-line)", color: "var(--twx-ink-muted)" }}>Bezár</button>
            <button onClick={save} disabled={saving}
              className="rounded-xl px-5 py-2 text-sm font-semibold text-white disabled:opacity-60" style={{ background: "var(--twx-coral)" }}>
              {saving ? "Mentés…" : "Mentés és vissza"}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// =============================================================================
// 3) Riport — tetszőleges időszakra, a tárolt eladásokból (kredites + PDF)
// =============================================================================
function ReportTab({ priced, sales, overhead, oneTime }: { priced: Dish[]; sales: SaleRow[]; overhead: number; oneTime: OneTimeCost[] }) {
  const today = todayISO();
  const [start, setStart] = useState<string>(today.slice(0, 8) + "01");
  const [end, setEnd] = useState<string>(today);
  const [result, setResult] = useState<CostingResult | null>(null);
  const [narrative, setNarrative] = useState("");
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const days = periodDays(start, end);
  const oneTimeSum = oneTimeInRange(oneTime, start, end);
  const periodOverhead = proratedOverhead(overhead, days) + oneTimeSum;

  // A tárolt eladások az időszakon belül (ugyanaz a szabály, mint a backendben).
  const inRange = useMemo(
    () => sales.filter((r) => r.period_start >= start && r.period_end <= end && days > 0),
    [sales, start, end, days]
  );
  const totalQty = inRange.reduce((s, r) => s + r.qty, 0);
  const dishCount = new Set(inRange.map((r) => r.dish_id)).size;

  const runReport = async () => {
    if (days <= 0) { showToast("A záró dátum nem lehet korábbi az indulónál.", "error"); return; }
    if (!inRange.length) { showToast("Ebben az időszakban nincs rögzített eladás.", "error"); return; }
    setRunning(true);
    setResult(null); setNarrative(""); setPdfUrl(null);
    try {
      const res = await fetch("/api/hospitality/costing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ start, end }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error ?? "A riport lekérése sikertelen.", "error"); return; }
      setResult(data.result);
      setNarrative(data.narrative ?? "");
      setPdfUrl(data.pdf_url ?? null);
      showToast(data.charged ? `${data.credits} kredit levonva.` : "Riport kész (ingyenes hozzáférés).", "success");
    } catch {
      showToast("Hálózati hiba. Próbáld újra.", "error");
    } finally {
      setRunning(false);
    }
  };

  if (!priced.length) {
    return (
      <div className="twx-card p-5 text-sm" style={{ color: "var(--twx-ink-muted)" }}>
        Nincs árazott ételed. Előbb vigyél fel ételeket árakkal, és rögzíts eladásokat.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {overhead === 0 && (
        <div className="twx-card p-3 text-xs" style={{ color: "#b5372f" }}>
          Még nincs havi fix költség megadva az „Étteremszintű költség" fülön — a rezsi-allokáció addig 0.
        </div>
      )}

      <div className="twx-card p-4 text-sm" style={{ color: "var(--twx-ink-muted)" }}>
        Válaszd ki az <b>időszakot</b>, és lekérünk egy teljes kimutatást az abban rögzített eladásokból: ételenkénti
        valós profit, teljes önköltség (alapanyag + rávetített rezsi), és letölthető PDF.
      </div>

      {/* Időszak */}
      <div className="twx-card flex flex-wrap items-end gap-4 p-4">
        <div>
          <label className="block text-xs font-medium" style={{ color: "var(--twx-ink-muted)" }}>Induló dátum</label>
          <input type="date" value={start} max={end} onChange={(e) => setStart(e.target.value)}
            className="mt-1 rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--twx-line)", background: "var(--twx-cream-card)" }} />
        </div>
        <div>
          <label className="block text-xs font-medium" style={{ color: "var(--twx-ink-muted)" }}>Záró dátum</label>
          <input type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)}
            className="mt-1 rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--twx-line)", background: "var(--twx-cream-card)" }} />
        </div>
        <div className="text-sm" style={{ color: "var(--twx-ink-muted)" }}>
          {days > 0 ? (
            <>{days} nap · <b style={{ color: "var(--twx-ink)" }}>{dishCount}</b> étel, <b style={{ color: "var(--twx-ink)" }}>{totalQty}</b> adag rögzítve · időszaki költség {formatHuf(periodOverhead)}{oneTimeSum > 0 ? ` (ebből egyszeri ${formatHuf(oneTimeSum)})` : ""}</>
          ) : (
            <span style={{ color: "#b5372f" }}>A záró dátum nem lehet korábbi az indulónál.</span>
          )}
        </div>
      </div>

      <button
        onClick={runReport}
        disabled={running || days <= 0 || !inRange.length}
        className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        style={{ background: "var(--twx-coral)" }}
      >
        {running ? "Riport készül…" : "Riport lekérése (1 kredit)"}
      </button>
      {days > 0 && !inRange.length && (
        <p className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>Ebben az időszakban nincs rögzített eladás — előbb rögzíts az „Eladások" fülön.</p>
      )}

      {result && (
        <>
          <ResultView result={result} />
          <div className="flex flex-wrap items-center gap-3">
            {pdfUrl && (
              <a
                href={pdfUrl} target="_blank" rel="noopener noreferrer" download
                className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold"
                style={{ border: "1px solid var(--twx-coral)", color: "var(--twx-coral)" }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M12 3v12m0 0 4-4m-4 4-4-4" />
                  <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
                </svg>
                PDF letöltése
              </a>
            )}
          </div>
        </>
      )}

      {narrative && (
        <div className="twx-card p-5">
          <h3 className="mb-2 font-display text-lg font-medium">AI-elemzés és javaslatok</h3>
          <div className="whitespace-pre-wrap text-sm leading-relaxed" style={{ color: "var(--twx-ink)" }}>{narrative}</div>
        </div>
      )}
    </div>
  );
}

// Számított eredmény megjelenítése (a riporthoz).
function ResultView({ result }: { result: CostingResult }) {
  const t = result.totals;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Időszaki árbevétel" value={formatHuf(t.revenue)} />
        <Stat label="Alapanyagköltség" value={formatHuf(t.ingredientCost)} />
        <Stat label="Rávetített rezsi" value={formatHuf(t.coveredOverhead)} />
        <Stat label="Étterem időszaki profit" value={formatHuf(t.netProfit)} warn={t.netProfit < 0} />
      </div>

      <div className="twx-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ color: "var(--twx-ink-muted)" }} className="text-left">
              <th className="p-3 font-medium">Étel</th>
              <th className="p-3 text-right font-medium">eladott</th>
              <th className="p-3 text-right font-medium">Teljes önktg/adag</th>
              <th className="p-3 text-right font-medium">Valós profit/adag</th>
              <th className="p-3 text-right font-medium">Árrés</th>
              <th className="p-3 text-right font-medium">Időszaki profit</th>
              <th className="p-3 text-right font-medium">Fedezeti db</th>
            </tr>
          </thead>
          <tbody>
            {result.dishes.map((d) => (
              <tr key={d.dish_id} style={{ borderTop: "1px solid var(--twx-line)" }}>
                <td className="p-3 font-medium">{d.name}</td>
                <td className="p-3 text-right">{d.monthly_qty}</td>
                <td className="p-3 text-right">{formatHuf(d.fullUnitCost)}</td>
                <td className="p-3 text-right" style={{ color: d.unitProfit < 0 ? "#b5372f" : "var(--twx-ink)" }}>{formatHuf(d.unitProfit)}</td>
                <td className="p-3 text-right" style={{ color: d.unitMarginPct < 0 ? "#b5372f" : "var(--twx-ink)" }}>{Math.round(d.unitMarginPct)}%</td>
                <td className="p-3 text-right" style={{ color: d.monthlyProfit < 0 ? "#b5372f" : "var(--twx-ink)" }}>{formatHuf(d.monthlyProfit)}</td>
                <td className="p-3 text-right">{d.breakevenQty} db</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>
        A „teljes önköltség/adag" az alapanyag + a rá jutó időszaki rezsi egy adagra vetítve. A „fedezeti db" az a
        darabszám, ami az ételre eső időszaki rezsit fedezi.
      </p>
    </div>
  );
}

function Stat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="twx-card p-4">
      <p className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>{label}</p>
      <p className="font-display text-xl font-semibold" style={{ color: warn ? "#b5372f" : "var(--twx-ink)" }}>{value}</p>
    </div>
  );
}
