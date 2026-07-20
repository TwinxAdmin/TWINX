// dashboard/hospitality/costing — Önköltség & profit modul.
// Három fül: (1) Étteremszintű fix költség-profil; (2) Eladások — a partner időszakonként/
// naponta rögzíti az eladott adagokat (tárolódik, számot NEM mutat); (3) Riport — egy
// tetszőleges időszakra a TÁROLT eladásokból kér le kredites, PDF-es kimutatást.
"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ModuleIntro from "@/components/ModuleIntro";
import Skeleton from "@/components/motion/Skeleton";
import DateField from "@/components/DateField";
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
  type OneTimeKind,
} from "@/lib/costing";
import type { SimResult } from "@/lib/simulation";

type Tab = "profile" | "sales" | "report" | "plan";
type SalesChannel = "etlap" | "menu";
type SaleRow = { dish_id: string; period_start: string; period_end: string; qty: number; channel: SalesChannel };
type MenuSaleRow = { period_start: string; period_end: string; qty_2: number; qty_3: number; price_2: number | null; price_3: number | null };
const MENUS_VIEW = "__menus__"; // a „Napi menük” nézet kulcsa a szerkesztő ablakban

const todayISO = () => new Date().toISOString().slice(0, 10);

// UTC-biztos dátumeltolás YYYY-MM-DD stringen.
function isoAdd(iso: string, opts: { months?: number; days?: number }): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (opts.months) dt.setUTCMonth(dt.getUTCMonth() + opts.months);
  if (opts.days) dt.setUTCDate(dt.getUTCDate() + opts.days);
  return dt.toISOString().slice(0, 10);
}

// Egyszeri kiadás időtartam-presetek (a kezdő dátumtól a záró dátumot számolják).
const OT_DURATIONS: { value: string; label: string; end: (start: string) => string | null }[] = [
  { value: "1d", label: "1 nap", end: (s) => s },
  { value: "1w", label: "1 hét", end: (s) => isoAdd(s, { days: 6 }) },
  { value: "1m", label: "1 hónap", end: (s) => isoAdd(s, { months: 1, days: -1 }) },
  { value: "3m", label: "3 hónap", end: (s) => isoAdd(s, { months: 3, days: -1 }) },
  { value: "6m", label: "6 hónap", end: (s) => isoAdd(s, { months: 6, days: -1 }) },
  { value: "12m", label: "12 hónap", end: (s) => isoAdd(s, { months: 12, days: -1 }) },
  { value: "custom", label: "Egyedi", end: () => null },
];

export default function CostingPage() {
  const [tab, setTab] = useState<Tab>("sales");
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [profile, setProfile] = useState<CostProfile>(EMPTY_COST_PROFILE);
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [menuSales, setMenuSales] = useState<MenuSaleRow[]>([]);
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
        if (sRes.ok) { setSales(s.sales ?? []); setMenuSales(s.menuSales ?? []); }
        if (oRes.ok) setOneTime(o.costs ?? []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const overhead = costProfileTotal(profile);
  // Étlaposan árazott ételek (van eladási áruk) — a Riport/Profit-terv ezekkel dolgozik.
  const priced = useMemo(
    () => dishes.filter((d) => d.cost_price != null && d.sale_price != null),
    [dishes]
  );
  // Rögzíthető ételek: étlapos áruk VAGY menü-költségük van. Az Eladások fül ezt használja,
  // különben egy csak-menüs étel (pl. menübe főzött leves) sehol nem lenne rögzíthető.
  const sellable = useMemo(
    () => dishes.filter((d) => (d.cost_price != null && d.sale_price != null) || d.menu_cost_price != null),
    [dishes]
  );

  const tabs: { key: Tab; label: string }[] = [
    { key: "profile", label: "Költségek & bevételek" },
    { key: "sales", label: "Eladások" },
    { key: "report", label: "Riport" },
    { key: "plan", label: "Profit-terv" },
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
        <SalesTab
          priced={sellable} sales={sales} menuSales={menuSales} profile={profile}
          onSaved={(s, m) => { setSales(s); setMenuSales(m); }}
        />
      ) : tab === "report" ? (
        <ReportTab priced={sellable} sales={sales} menuSales={menuSales} overhead={overhead} oneTime={oneTime} />
      ) : (
        <PlanTab priced={priced} dishes={dishes} profile={profile} overhead={overhead} oneTime={oneTime} />
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
  const [menu2, setMenu2] = useState(profile.menu_price_2 ? String(profile.menu_price_2) : "");
  const [menu3, setMenu3] = useState(profile.menu_price_3 ? String(profile.menu_price_3) : "");
  const [saving, setSaving] = useState(false);

  const total =
    COST_FIELDS.reduce((s, f) => s + toAmount(vals[f.key]), 0) +
    extra.reduce((s, e) => s + toAmount(e.amount), 0);

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
        menu_price_2: toAmount(menu2),
        menu_price_3: toAmount(menu3),
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

      {/* Napi menü árak — beállítás, NEM költség */}
      <div className="twx-card space-y-3 p-4">
        <div>
          <h3 className="font-display text-base font-medium">Napi menü árai</h3>
          <p className="text-sm" style={{ color: "var(--twx-ink-muted)" }}>
            Mennyiért adod a napi menüt? Ez a <b>bevételi</b> oldal a menüknél — nem költség, ezért a fenti összegbe
            nem számít bele. A menü <b>költsége</b> az ételek menü-előállítási költségéből jön, így naponta változhat.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium">2 fogásos menü ára</span>
            <div className="w-36 flex-none"><NumField value={menu2} onChange={setMenu2} placeholder="pl. 2500" /></div>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium">3 fogásos menü ára</span>
            <div className="w-36 flex-none"><NumField value={menu3} onChange={setMenu3} placeholder="pl. 3200" /></div>
          </div>
        </div>
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
      <OneTimeSection
        kind="expense"
        title="Egyszeri kiadások"
        description="Nem havi, alkalmi kiadások (pl. új sütő). Add meg, mikortól és mennyi időre vonatkozzon — a rendszer az időszakra egyenletesen elosztja, és a riport csak az átfedő napok arányát számolja."
        placeholder="pl. új sütő"
        items={oneTime.filter((c) => (c.kind ?? "expense") === "expense")}
        onAdd={(c) => onOneTimeChange([c, ...oneTime])}
        onRemove={removeOneTime}
      />

      {/* Egyszeri bevételek */}
      <OneTimeSection
        kind="income"
        title="Egyszeri bevételek"
        description="Nem az értékesítésből származó, alkalmi bevétel (pl. támogatás, a régi sütő eladása). Ugyanaz a logika: megadod, mikortól és mennyi időre vonatkozzon, és a riport az átfedő napok arányában számolja hozzá a profithoz."
        placeholder="pl. régi sütő eladása"
        items={oneTime.filter((c) => c.kind === "income")}
        onAdd={(c) => onOneTimeChange([c, ...oneTime])}
        onRemove={removeOneTime}
      />
    </div>
  );
}

// Egyszeri tétel blokk (kiadás VAGY bevétel) — azonos logika, arányos elosztással.
function OneTimeSection({
  kind, title, description, placeholder, items, onAdd, onRemove,
}: {
  kind: OneTimeKind; title: string; description: string; placeholder: string;
  items: OneTimeCost[];
  onAdd: (c: OneTimeCost) => void;
  onRemove: (id: string) => void;
}) {
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [start, setStart] = useState(todayISO());
  const [duration, setDuration] = useState("3m");
  const [end, setEnd] = useState(todayISO()); // csak "custom" esetén
  const [busy, setBusy] = useState(false);

  const computedEnd = () => {
    const preset = OT_DURATIONS.find((d) => d.value === duration);
    if (!preset) return start;
    return preset.value === "custom" ? end : (preset.end(start) ?? start);
  };

  const add = async () => {
    if (!label.trim()) { showToast("Add meg a megnevezést.", "error"); return; }
    if (toAmount(amount) <= 0) { showToast("Az összeg legyen pozitív.", "error"); return; }
    const period_end = computedEnd();
    if (new Date(period_end).getTime() < new Date(start).getTime()) { showToast("A záró dátum nem lehet korábbi a kezdőnél.", "error"); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/hospitality/onetime", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: label.trim(), amount: toAmount(amount), period_start: start, period_end, kind }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error ?? "Mentés sikertelen.", "error"); return; }
      onAdd(data.cost);
      setLabel(""); setAmount("");
      showToast(kind === "income" ? "Egyszeri bevétel hozzáadva." : "Egyszeri kiadás hozzáadva.", "success");
    } catch {
      showToast("Hálózati hiba. Próbáld újra.", "error");
    } finally {
      setBusy(false);
    }
  };

  const accent = kind === "income" ? "#2f7a4f" : "var(--twx-coral)";

  return (
    <div className="space-y-3 border-t pt-5" style={{ borderColor: "var(--twx-line)" }}>
      <div>
        <h3 className="font-display text-lg font-medium">{title}</h3>
        <p className="text-sm" style={{ color: "var(--twx-ink-muted)" }}>{description} Ingyenes.</p>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[160px] flex-1">
          <label className="block text-xs font-medium" style={{ color: "var(--twx-ink-muted)" }}>Megnevezés</label>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={placeholder}
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--twx-line)", background: "var(--twx-cream-card)" }} />
        </div>
        <div className="w-28">
          <label className="block text-xs font-medium" style={{ color: "var(--twx-ink-muted)" }}>Összeg (Ft)</label>
          <div className="mt-1"><NumField value={amount} onChange={setAmount} /></div>
        </div>
        <div>
          <label className="block text-xs font-medium" style={{ color: "var(--twx-ink-muted)" }}>Mikortól</label>
          <DateField className="mt-1 w-[156px]" value={start} onChange={setStart} />
        </div>
        <div>
          <label className="block text-xs font-medium" style={{ color: "var(--twx-ink-muted)" }}>Mennyi időre</label>
          <select value={duration} onChange={(e) => setDuration(e.target.value)}
            className="mt-1 box-border h-[38px] rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--twx-line)", background: "var(--twx-cream-card)" }}>
            {OT_DURATIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
        </div>
        {duration === "custom" && (
          <div>
            <label className="block text-xs font-medium" style={{ color: "var(--twx-ink-muted)" }}>Meddig</label>
            <DateField className="mt-1 w-[156px]" value={end} min={start} onChange={setEnd} />
          </div>
        )}
        <button onClick={add} disabled={busy}
          className="rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" style={{ background: accent }}>
          {busy ? "…" : "Hozzáadás"}
        </button>
      </div>
      <p className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>
        Vonatkozó időszak: <b style={{ color: "var(--twx-ink)" }}>{start} – {computedEnd()}</b>
      </p>

      {items.length > 0 && (
        <div className="twx-card divide-y" style={{ borderColor: "var(--twx-line)" }}>
          {items.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-3 p-3 text-sm">
              <span className="min-w-0">
                <span className="font-medium">{c.label}</span>{" "}
                <span className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                  · {c.period_start === c.period_end ? c.period_start : `${c.period_start} – ${c.period_end}`}
                </span>
              </span>
              <span className="flex items-center gap-3">
                <b style={{ color: accent }}>{kind === "income" ? "+" : "−"}{formatHuf(c.amount)}</b>
                <button onClick={() => onRemove(c.id)} className="text-lg" style={{ color: "var(--twx-ink-muted)" }} aria-label="Törlés">×</button>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// 2) Eladások rögzítése — kategória-kockák + felugró ablak; előzmény-kockák
// =============================================================================
type DishGroup = { cat: string; label: string; items: Dish[] };
type ModalState = { start: string; end: string; view: string | null };

function SalesTab({
  priced, sales, menuSales, profile, onSaved,
}: {
  priced: Dish[]; sales: SaleRow[]; menuSales: MenuSaleRow[]; profile: CostProfile;
  onSaved: (s: SaleRow[], m: MenuSaleRow[]) => void;
}) {
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

  // Egy (start,end)-hez mentett adagok csatornánként.
  const savedQtyFor = (s: string, e: string): { etlap: Record<string, number>; menu: Record<string, number> } => {
    const out = { etlap: {} as Record<string, number>, menu: {} as Record<string, number> };
    for (const r of sales) {
      if (r.period_start === s && r.period_end === e) out[r.channel === "menu" ? "menu" : "etlap"][r.dish_id] = r.qty;
    }
    return out;
  };
  const savedMenuFor = (s: string, e: string) =>
    menuSales.find((m) => m.period_start === s && m.period_end === e);

  // Korábban rögzített időszakok (distinct start–end), legfrissebb elöl.
  const periods = useMemo(() => {
    const map = new Map<string, { start: string; end: string; qty: number; dishes: number; menus: number }>();
    const ensure = (s: string, e: string) => {
      const k = `${s}|${e}`;
      const v = map.get(k) ?? { start: s, end: e, qty: 0, dishes: 0, menus: 0 };
      map.set(k, v);
      return v;
    };
    for (const r of sales) {
      const v = ensure(r.period_start, r.period_end);
      v.qty += r.qty; v.dishes += 1;
    }
    for (const m of menuSales) {
      const v = ensure(m.period_start, m.period_end);
      v.menus += (m.qty_2 ?? 0) + (m.qty_3 ?? 0);
    }
    return [...map.values()].sort((a, b) => (a.start < b.start ? 1 : -1));
  }, [sales, menuSales]);

  // A modal mentése után frissítjük a helyi listákat.
  const applySaved = (
    s: string, e: string,
    entries: { dish_id: string; qty: number; channel: SalesChannel }[],
    menu: { qty_2: number; qty_3: number; price_2: number | null; price_3: number | null }
  ) => {
    const others = sales.filter((r) => !(r.period_start === s && r.period_end === e));
    const now: SaleRow[] = entries.map((x) => ({
      dish_id: x.dish_id, period_start: s, period_end: e, qty: x.qty, channel: x.channel,
    }));
    const otherMenus = menuSales.filter((m) => !(m.period_start === s && m.period_end === e));
    const hasMenu = menu.qty_2 > 0 || menu.qty_3 > 0 || menu.price_2 != null || menu.price_3 != null;
    const nowMenus: MenuSaleRow[] = hasMenu ? [{ period_start: s, period_end: e, ...menu }] : [];
    onSaved([...now, ...others], [...nowMenus, ...otherMenus]);
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
  const entryMenu = savedMenuFor(entryStart, entryEnd);
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
          <DateField className="mt-1 w-[156px]" value={entryStart} max={entryEnd} onChange={setEntryStart} />
        </div>
        <div>
          <label className="block text-xs font-medium" style={{ color: "var(--twx-ink-muted)" }}>Időszak vége</label>
          <DateField className="mt-1 w-[156px]" value={entryEnd} min={entryStart} onChange={setEntryEnd} />
        </div>
        <div className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>
          {single ? "Egy napra rögzítesz." : `${periodDays(entryStart, entryEnd)} napos időszakra rögzítesz.`}
        </div>
      </div>

      {/* Kategória-kockák + napi menük */}
      <div>
        <h3 className="mb-2 text-sm font-semibold">Kattints a rögzítéshez</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {groups.map((g) => {
            const filled = g.items.filter((d) => (entrySaved.etlap[d.id] ?? 0) > 0 || (entrySaved.menu[d.id] ?? 0) > 0).length;
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

          {/* Eladott napi menük — külön kocka */}
          <button
            onClick={() => setModal({ start: entryStart, end: entryEnd, view: MENUS_VIEW })}
            className="twx-card flex flex-col gap-1 p-4 text-left transition hover:shadow-md"
            style={{ borderColor: "var(--twx-coral)" }}
          >
            <span className="font-display text-base font-medium">Napi menük</span>
            <span className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>eladott menük száma</span>
            {entryMenu && (entryMenu.qty_2 > 0 || entryMenu.qty_3 > 0) && (
              <span className="mt-1 w-fit rounded-full px-2 py-0.5 text-xs font-medium" style={{ background: "var(--twx-coral-soft)", color: "#7a2e17" }}>
                {entryMenu.qty_2} × 2 fog. · {entryMenu.qty_3} × 3 fog.
              </span>
            )}
          </button>
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
                  <span className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                    {p.dishes} étel · {p.qty} adag{p.menus > 0 ? ` · ${p.menus} menü` : ""}
                  </span>
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
            profile={profile}
            initialQty={savedQtyFor(modal.start, modal.end)}
            initialMenu={savedMenuFor(modal.start, modal.end)}
            onSaved={(entries, menu) => applySaved(modal.start, modal.end, entries, menu)}
            onClose={() => setModal(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// Felugró ablak: egy (start,end) eladásainak szerkesztése kategóriánként.
function EntryEditorModal({
  start, end, initialView, groups, priced, profile, initialQty, initialMenu, onSaved, onClose,
}: {
  start: string; end: string; initialView: string | null;
  groups: DishGroup[]; priced: Dish[]; profile: CostProfile;
  initialQty: { etlap: Record<string, number>; menu: Record<string, number> };
  initialMenu?: MenuSaleRow;
  onSaved: (
    entries: { dish_id: string; qty: number; channel: SalesChannel }[],
    menu: { qty_2: number; qty_3: number; price_2: number | null; price_3: number | null }
  ) => void;
  onClose: () => void;
}) {
  const toStr = (m: Record<string, number>) => {
    const o: Record<string, string> = {};
    for (const [id, q] of Object.entries(m)) o[id] = String(q);
    return o;
  };
  const [qtyE, setQtyE] = useState<Record<string, string>>(() => toStr(initialQty.etlap));
  const [qtyM, setQtyM] = useState<Record<string, string>>(() => toStr(initialQty.menu));
  const [menu2, setMenu2] = useState(initialMenu?.qty_2 ? String(initialMenu.qty_2) : "");
  const [menu3, setMenu3] = useState(initialMenu?.qty_3 ? String(initialMenu.qty_3) : "");
  const [price2, setPrice2] = useState(initialMenu?.price_2 != null ? String(initialMenu.price_2) : "");
  const [price3, setPrice3] = useState(initialMenu?.price_3 != null ? String(initialMenu.price_3) : "");
  const [view, setView] = useState<string | null>(initialView);
  const [saving, setSaving] = useState(false);

  const n = (v: string | undefined) => Math.max(0, Math.floor(Number(v) || 0));
  const qE = (id: string) => n(qtyE[id]);
  const qM = (id: string) => n(qtyM[id]);
  const totalDishes = priced.filter((d) => qE(d.id) > 0 || qM(d.id) > 0).length;
  const totalQty = priced.reduce((s, d) => s + qE(d.id) + qM(d.id), 0);
  const label = start === end ? start : `${start} – ${end}`;
  const activeGroup = groups.find((g) => g.cat === view);
  const menusView = view === MENUS_VIEW;

  // Halk ellenőrzés: a menübe felhasznált adagoknak nagyjából 2×(2 fogásos) + 3×(3 fogásos) darabnak kell lennie.
  const menuPortions = priced.reduce((s, d) => s + qM(d.id), 0);
  const expectedPortions = n(menu2) * 2 + n(menu3) * 3;
  const mismatch = menuPortions > 0 && expectedPortions > 0 && menuPortions !== expectedPortions;

  const save = async () => {
    setSaving(true);
    try {
      const entries = [
        ...priced.map((d) => ({ dish_id: d.id, qty: qE(d.id), channel: "etlap" as SalesChannel })),
        ...priced.map((d) => ({ dish_id: d.id, qty: qM(d.id), channel: "menu" as SalesChannel })),
      ].filter((e) => e.qty > 0);
      const menu = {
        qty_2: n(menu2), qty_3: n(menu3),
        price_2: price2.trim() ? toAmount(price2) : null,
        price_3: price3.trim() ? toAmount(price3) : null,
      };
      const res = await fetch("/api/hospitality/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ start, end, entries, menu }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error ?? "Mentés sikertelen.", "error"); return; }
      onSaved(entries, menu);
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
          {!activeGroup && !menusView ? (
            <>
              <p className="mb-3 text-sm" style={{ color: "var(--twx-ink-muted)" }}>Válassz kategóriát, és írd be az eladott adagokat.</p>
              <div className="grid grid-cols-2 gap-3">
                {groups.map((g) => {
                  const filled = g.items.filter((d) => qE(d.id) > 0 || qM(d.id) > 0).length;
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
                <button onClick={() => setView(MENUS_VIEW)}
                  className="flex flex-col gap-1 rounded-xl border p-3 text-left transition hover:shadow-sm"
                  style={{ borderColor: "var(--twx-coral)" }}>
                  <span className="font-medium">Napi menük</span>
                  <span className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>eladott menük száma</span>
                  {(n(menu2) > 0 || n(menu3) > 0) && (
                    <span className="mt-1 w-fit rounded-full px-2 py-0.5 text-xs font-medium" style={{ background: "var(--twx-coral-soft)", color: "#7a2e17" }}>
                      {n(menu2)} + {n(menu3)} db
                    </span>
                  )}
                </button>
              </div>
            </>
          ) : menusView ? (
            <>
              <button onClick={() => setView(null)} className="mb-3 text-sm font-medium" style={{ color: "var(--twx-coral)" }}>‹ Vissza</button>
              <h4 className="mb-1 font-display text-base font-medium">Eladott napi menük</h4>
              <p className="mb-3 text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                Hány napi menü fogyott ebben az időszakban? Ebből jön a menük <b>bevétele</b> (a beállított menü-árral),
                a költség pedig a menübe felhasznált ételekből.
              </p>
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm">
                    2 fogásos menü{" "}
                    <span className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                      ({profile.menu_price_2 > 0 ? formatHuf(profile.menu_price_2) : "nincs ár beállítva"})
                    </span>
                  </span>
                  <div className="w-24"><NumField value={menu2} onChange={setMenu2} /></div>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm">
                    3 fogásos menü{" "}
                    <span className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                      ({profile.menu_price_3 > 0 ? formatHuf(profile.menu_price_3) : "nincs ár beállítva"})
                    </span>
                  </span>
                  <div className="w-24"><NumField value={menu3} onChange={setMenu3} /></div>
                </div>

                <div className="rounded-lg border p-3" style={{ borderColor: "var(--twx-line)" }}>
                  <p className="mb-2 text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                    Eltérő ár ebben az időszakban? (opcionális — üresen a beállított árral számolunk)
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs" style={{ color: "var(--twx-ink-muted)" }}>2 fogásos ára</label>
                      <div className="mt-1"><NumField value={price2} onChange={setPrice2} /></div>
                    </div>
                    <div>
                      <label className="block text-xs" style={{ color: "var(--twx-ink-muted)" }}>3 fogásos ára</label>
                      <div className="mt-1"><NumField value={price3} onChange={setPrice3} /></div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : activeGroup ? (
            <>
              <button onClick={() => setView(null)} className="mb-3 text-sm font-medium" style={{ color: "var(--twx-coral)" }}>‹ Vissza</button>
              <h4 className="mb-1 font-display text-base font-medium">{categoryLabel(activeGroup.cat)}</h4>
              <p className="mb-3 text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                <b>Étlapról</b>: külön rendelt adagok. <b>Menüben</b>: a napi menükbe felhasznált adagok.
              </p>
              <div className="space-y-3">
                {activeGroup.items.map((d) => {
                  // Csak ott kérünk darabszámot, ahol az adott csatornán árazva van az étel.
                  const hasEtlap = d.cost_price != null && d.sale_price != null;
                  const hasMenu = d.menu_cost_price != null;
                  return (
                    <div key={d.id} className="rounded-lg border p-3" style={{ borderColor: "var(--twx-line)" }}>
                      <div className="mb-2 font-medium">
                        {d.name}
                        {!hasEtlap && hasMenu && (
                          <span className="ml-2 rounded-full px-2 py-0.5 text-xs" style={{ background: "var(--twx-coral-soft)", color: "#7a2e17" }}>
                            csak menüben
                          </span>
                        )}
                        {hasEtlap && !hasMenu && (
                          <span className="ml-2 rounded-full px-2 py-0.5 text-xs" style={{ background: "var(--twx-line)", color: "var(--twx-ink-muted)" }}>
                            csak étlapon
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        {hasEtlap && (
                          <div>
                            <label className="block text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                              Étlapról ({formatHuf(d.sale_price as number)})
                            </label>
                            <div className="mt-1"><NumField value={qtyE[d.id] ?? ""} onChange={(v) => setQtyE((s) => ({ ...s, [d.id]: v }))} /></div>
                          </div>
                        )}
                        {hasMenu && (
                          <div>
                            <label className="block text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                              Menüben (önktg {formatHuf(d.menu_cost_price as number)})
                            </label>
                            <div className="mt-1"><NumField value={qtyM[d.id] ?? ""} onChange={(v) => setQtyM((s) => ({ ...s, [d.id]: v }))} /></div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : null}
        </div>

        {/* Lábléc */}
        <div className="flex items-center justify-between gap-3 border-t p-4" style={{ borderColor: "var(--twx-line)" }}>
          <span className="text-xs" style={{ color: mismatch ? "#b5372f" : "var(--twx-ink-muted)" }}>
            {totalDishes} étel · {totalQty} adag
            {mismatch && ` · figyelem: ${menuPortions} menü-adag, de a menük alapján ~${expectedPortions} várható`}
          </span>
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
function ReportTab({ priced, sales, menuSales, overhead, oneTime }: { priced: Dish[]; sales: SaleRow[]; menuSales: MenuSaleRow[]; overhead: number; oneTime: OneTimeCost[] }) {
  const today = todayISO();
  const [start, setStart] = useState<string>(today.slice(0, 8) + "01");
  const [end, setEnd] = useState<string>(today);
  const [result, setResult] = useState<CostingResult | null>(null);
  const [narrative, setNarrative] = useState("");
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const days = periodDays(start, end);
  const oneTimeSum = oneTimeInRange(oneTime, start, end, "expense");
  const oneTimeIncomeSum = oneTimeInRange(oneTime, start, end, "income");
  const periodOverhead = proratedOverhead(overhead, days) + oneTimeSum;

  // A tárolt eladások az időszakon belül (ugyanaz a szabály, mint a backendben).
  const inRange = useMemo(
    () => sales.filter((r) => r.period_start >= start && r.period_end <= end && days > 0),
    [sales, start, end, days]
  );
  const totalQty = inRange.reduce((s, r) => s + r.qty, 0);
  const dishCount = new Set(inRange.map((r) => r.dish_id)).size;
  const menusInRange = useMemo(
    () => menuSales.filter((m) => m.period_start >= start && m.period_end <= end && days > 0),
    [menuSales, start, end, days]
  );
  const menuCount = menusInRange.reduce((s, m) => s + (m.qty_2 ?? 0) + (m.qty_3 ?? 0), 0);

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
          Még nincs havi fix költség megadva a „Költségek &amp; bevételek" fülön — a rezsi-allokáció addig 0.
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
          <DateField className="mt-1 w-[156px]" value={start} max={end} onChange={setStart} />
        </div>
        <div>
          <label className="block text-xs font-medium" style={{ color: "var(--twx-ink-muted)" }}>Záró dátum</label>
          <DateField className="mt-1 w-[156px]" value={end} min={start} onChange={setEnd} />
        </div>
        <div className="text-sm" style={{ color: "var(--twx-ink-muted)" }}>
          {days > 0 ? (
            <>{days} nap · <b style={{ color: "var(--twx-ink)" }}>{dishCount}</b> étel, <b style={{ color: "var(--twx-ink)" }}>{totalQty}</b> adag{menuCount > 0 ? <>, <b style={{ color: "var(--twx-ink)" }}>{menuCount}</b> menü</> : null} rögzítve · időszaki költség {formatHuf(periodOverhead)}{oneTimeSum > 0 ? ` (ebből egyszeri ${formatHuf(oneTimeSum)})` : ""}{oneTimeIncomeSum > 0 ? ` · egyszeri bevétel ${formatHuf(oneTimeIncomeSum)}` : ""}</>
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

// Számított eredmény megjelenítése (a riporthoz) — étlap és menü csatorna külön.
function ResultView({ result }: { result: CostingResult }) {
  const t = result.totals;
  const e = result.etlap;
  const m = result.menu;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Időszaki árbevétel" value={formatHuf(t.revenue)} />
        <Stat label="Alapanyagköltség" value={formatHuf(t.ingredientCost)} />
        <Stat label={t.oneTimeIncome > 0 ? "Egyszeri bevétel" : "Időszaki költség"} value={formatHuf(t.oneTimeIncome > 0 ? t.oneTimeIncome : t.overhead)} />
        <Stat label="Étterem időszaki profit" value={formatHuf(t.netProfit)} warn={t.netProfit < 0} />
      </div>
      {t.oneTimeIncome > 0 && (
        <p className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>
          Időszaki költség: {formatHuf(t.overhead)} · az egyszeri bevétel ({formatHuf(t.oneTimeIncome)}) a profithoz adódik, a rezsi-allokációt nem befolyásolja.
        </p>
      )}

      {/* ÉTLAP */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-display text-lg font-medium">Étlap</h3>
          <span className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>
            bevétel {formatHuf(e.revenue)} · alapanyag {formatHuf(e.ingredientCost)} · rezsi {formatHuf(e.overhead)} ·{" "}
            <b style={{ color: e.profit < 0 ? "#b5372f" : "var(--twx-ink)" }}>profit {formatHuf(e.profit)}</b>
          </span>
        </div>
        {e.dishes.length ? (
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
                {e.dishes.map((d) => (
                  <tr key={d.dish_id} style={{ borderTop: "1px solid var(--twx-line)" }}>
                    <td className="p-3 font-medium">{d.name}</td>
                    <td className="p-3 text-right">{d.qty}</td>
                    <td className="p-3 text-right">{formatHuf(d.fullUnitCost)}</td>
                    <td className="p-3 text-right" style={{ color: d.unitProfit < 0 ? "#b5372f" : "var(--twx-ink)" }}>{formatHuf(d.unitProfit)}</td>
                    <td className="p-3 text-right" style={{ color: d.unitMarginPct < 0 ? "#b5372f" : "var(--twx-ink)" }}>{Math.round(d.unitMarginPct)}%</td>
                    <td className="p-3 text-right" style={{ color: d.periodProfit < 0 ? "#b5372f" : "var(--twx-ink)" }}>{formatHuf(d.periodProfit)}</td>
                    <td className="p-3 text-right">{d.breakevenQty} db</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="twx-card p-4 text-sm" style={{ color: "var(--twx-ink-muted)" }}>Nincs étlapos eladás ebben az időszakban.</div>
        )}
      </div>

      {/* NAPI MENÜK */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-display text-lg font-medium">Napi menük</h3>
          {m.count > 0 && (
            <span className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>
              {m.count} menü ({m.qty2} × 2 fog., {m.qty3} × 3 fog.) · bevétel {formatHuf(m.revenue)} ·{" "}
              <b style={{ color: m.profit < 0 ? "#b5372f" : "var(--twx-ink)" }}>profit {formatHuf(m.profit)}</b>
            </span>
          )}
        </div>

        {m.count > 0 ? (
          <>
            {/* Egy menüre vetítve — a lényeg */}
            <div className="rounded-2xl p-4" style={{ background: "var(--twx-coral-soft)" }}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: "#7a2e17" }}>Egy menüre vetítve</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div><p className="text-xs" style={{ color: "#7a2e17" }}>Menü ára</p><p className="font-display text-lg font-semibold" style={{ color: "#7a2e17" }}>{formatHuf(m.perMenuRevenue)}</p></div>
                <div><p className="text-xs" style={{ color: "#7a2e17" }}>Előállítás</p><p className="font-display text-lg font-semibold" style={{ color: "#7a2e17" }}>{formatHuf(m.perMenuCost)}</p></div>
                <div><p className="text-xs" style={{ color: "#7a2e17" }}>Rá jutó rezsi</p><p className="font-display text-lg font-semibold" style={{ color: "#7a2e17" }}>{formatHuf(m.perMenuOverhead)}</p></div>
                <div><p className="text-xs" style={{ color: "#7a2e17" }}>Marad</p><p className="font-display text-lg font-semibold" style={{ color: m.perMenuProfit < 0 ? "#b5372f" : "#7a2e17" }}>{formatHuf(m.perMenuProfit)}</p></div>
              </div>
            </div>

            <div className="twx-card overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ color: "var(--twx-ink-muted)" }} className="text-left">
                    <th className="p-3 font-medium">Menübe felhasznált étel</th>
                    <th className="p-3 text-right font-medium">adag</th>
                    <th className="p-3 text-right font-medium">Önktg/adag</th>
                    <th className="p-3 text-right font-medium">Összesen</th>
                  </tr>
                </thead>
                <tbody>
                  {m.dishes.map((d) => (
                    <tr key={d.dish_id} style={{ borderTop: "1px solid var(--twx-line)" }}>
                      <td className="p-3 font-medium">{d.name}</td>
                      <td className="p-3 text-right">{d.qty}</td>
                      <td className="p-3 text-right">{formatHuf(d.unitCost)}</td>
                      <td className="p-3 text-right">{formatHuf(d.totalCost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="twx-card p-4 text-sm" style={{ color: "var(--twx-ink-muted)" }}>Nincs rögzített menü-eladás ebben az időszakban.</div>
        )}
      </div>

      <p className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>
        A rezsit árbevétel-arányosan osztjuk el az étlap és a menü között. A „teljes önköltség/adag" az alapanyag + a rá
        jutó rezsi; a „fedezeti db" az a darabszám, ami az ételre eső rezsit fedezi.
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

// =============================================================================
// 4) Profit-terv — előretekintő szimuláció (kredit: PDF + AI-értékelés)
// =============================================================================
function nextWeek(): { start: string; end: string } {
  const d = new Date();
  const day = (d.getDay() + 6) % 7;          // hétfő = 0
  d.setDate(d.getDate() + (7 - day));        // következő hétfő
  const start = d.toISOString().slice(0, 10);
  d.setDate(d.getDate() + 6);
  return { start, end: d.toISOString().slice(0, 10) };
}

function PlanTab({
  priced, dishes, profile, overhead, oneTime,
}: {
  priced: Dish[]; dishes: Dish[]; profile: CostProfile; overhead: number; oneTime: OneTimeCost[];
}) {
  const def = nextWeek();
  const [start, setStart] = useState(def.start);
  const [end, setEnd] = useState(def.end);
  const [target, setTarget] = useState("");
  const [mode, setMode] = useState<"dish" | "full">("dish");
  const [qty, setQty] = useState<Record<string, string>>({});
  const [menuQty2, setMenuQty2] = useState("");
  const [menuQty3, setMenuQty3] = useState("");
  const [modal, setModal] = useState<string | null>(null);
  const [result, setResult] = useState<SimResult | null>(null);
  const [narrative, setNarrative] = useState("");
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const days = periodDays(start, end);
  const otherCosts =
    proratedOverhead(overhead, days) + oneTimeInRange(oneTime, start, end, "expense");
  const oneTimeIncomeSum = oneTimeInRange(oneTime, start, end, "income");

  // Menünkénti előállítási költség becslése az ételek menü-költségeiből.
  const menuCostAvg = useMemo(() => {
    const vals = dishes.map((d) => d.menu_cost_price).filter((v): v is number => v != null);
    return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
  }, [dishes]);
  const [cost2, setCost2] = useState("");
  const [cost3, setCost3] = useState("");
  const suggested2 = Math.round(menuCostAvg * 2);
  const suggested3 = Math.round(menuCostAvg * 3);
  const effCost2 = cost2.trim() ? toAmount(cost2) : suggested2;
  const effCost3 = cost3.trim() ? toAmount(cost3) : suggested3;

  const groups = useMemo(
    () =>
      DISH_CATEGORIES.map((c) => ({
        cat: c.value as string,
        label: c.label,
        items: priced.filter((d) => d.category === c.value),
      })).filter((g) => g.items.length),
    [priced]
  );

  const qNum = (id: string) => Math.max(0, Math.floor(Number(qty[id]) || 0));
  const chosen = priced.filter((d) => qNum(d.id) > 0);
  const menuTotal = Math.max(0, Math.floor(Number(menuQty2) || 0)) + Math.max(0, Math.floor(Number(menuQty3) || 0));

  const run = async () => {
    if (days <= 0) { showToast("A záró dátum nem lehet korábbi az indulónál.", "error"); return; }
    if (!chosen.length && menuTotal === 0) { showToast("Adj meg legalább egy ételt vagy menüt darabszámmal.", "error"); return; }
    setRunning(true);
    setResult(null); setNarrative(""); setPdfUrl(null);
    try {
      const res = await fetch("/api/hospitality/simulation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          start, end, mode, target: toAmount(target),
          dishes: chosen.map((d) => ({ dish_id: d.id, qty: qNum(d.id) })),
          menu: {
            qty2: Number(menuQty2) || 0, qty3: Number(menuQty3) || 0,
            price2: profile.menu_price_2, price3: profile.menu_price_3,
            cost2: effCost2, cost3: effCost3,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error ?? "A terv lekérése sikertelen.", "error"); return; }
      setResult(data.result);
      setNarrative(data.narrative ?? "");
      setPdfUrl(data.pdf_url ?? null);
      showToast(data.charged ? `${data.credits} kredit levonva.` : "Profit-terv kész (ingyenes hozzáférés).", "success");
    } catch {
      showToast("Hálózati hiba. Próbáld újra.", "error");
    } finally {
      setRunning(false);
    }
  };

  const exportPng = async () => {
    const el = document.getElementById("plan-result");
    if (!el) return;
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(el, { backgroundColor: "#faf7f2", scale: 2 });
      const link = document.createElement("a");
      link.download = `profit-terv-${start}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch {
      showToast("A kép mentése nem sikerült.", "error");
    }
  };

  if (!priced.length && !dishes.length) {
    return (
      <div className="twx-card p-5 text-sm" style={{ color: "var(--twx-ink-muted)" }}>
        Nincs árazott ételed. Előbb vigyél fel ételeket árakkal a Kínálat kezelőben.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="twx-card p-4 text-sm" style={{ color: "var(--twx-ink-muted)" }}>
        <b>Tervezés, nem riport.</b> Itt te állítod be, miből mennyit szeretnél eladni egy jövőbeli időszakban, és
        megnézheted, mennyi profit jönne ki belőle — illetve mi kell a célod eléréséhez. A tényleges eladásokból az
        előző fül <b>Riportja</b> számol.
      </div>

      {/* Időszak + cél + mód */}
      <div className="twx-card space-y-4 p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-medium" style={{ color: "var(--twx-ink-muted)" }}>Időszak kezdete</label>
            <DateField className="mt-1 w-[156px]" value={start} max={end} onChange={setStart} />
          </div>
          <div>
            <label className="block text-xs font-medium" style={{ color: "var(--twx-ink-muted)" }}>Időszak vége</label>
            <DateField className="mt-1 w-[156px]" value={end} min={start} onChange={setEnd} />
          </div>
          <div className="w-40">
            <label className="block text-xs font-medium" style={{ color: "var(--twx-ink-muted)" }}>Cél-profit (Ft)</label>
            <div className="mt-1"><NumField value={target} onChange={setTarget} placeholder="pl. 1000000" /></div>
          </div>
          <div className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>
            {days > 0 ? `${days} napos időszak` : <span style={{ color: "#b5372f" }}>Hibás időszak</span>}
          </div>
        </div>

        <div>
          <span className="mr-2 text-sm" style={{ color: "var(--twx-ink-muted)" }}>Mit vegyünk figyelembe?</span>
          <div className="mt-1 flex flex-wrap gap-2">
            {([["dish", "Csak az ételek profitja"], ["full", "Minden költséggel"]] as const).map(([v, l]) => (
              <button key={v} onClick={() => setMode(v)}
                className="rounded-full px-3 py-1 text-xs font-medium"
                style={mode === v ? { background: "var(--twx-coral)", color: "#fff" } : { border: "1px solid var(--twx-line)", color: "var(--twx-ink-muted)" }}>
                {l}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs" style={{ color: "var(--twx-ink-muted)" }}>
            {mode === "full" ? (
              <>Az időszakra jutó egyéb költség: <b style={{ color: "var(--twx-ink)" }}>{formatHuf(otherCosts)}</b>
                {oneTimeIncomeSum > 0 && <> · egyszeri bevétel: <b style={{ color: "var(--twx-ink)" }}>{formatHuf(oneTimeIncomeSum)}</b></>}
                {" "}(rezsi arányosítva + egyszeri tételek).</>
            ) : (
              <>Csak az eladott ételek és menük árrése számít; rezsi és egyéb költség nélkül.</>
            )}
          </p>
        </div>
      </div>

      {/* Tervezett mennyiségek — kategória-kockák */}
      <div>
        <h3 className="mb-2 text-sm font-semibold">Tervezett mennyiségek</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {groups.map((g) => {
            const filled = g.items.filter((d) => qNum(d.id) > 0).length;
            return (
              <button key={g.cat} onClick={() => setModal(g.cat)}
                className="twx-card flex flex-col gap-1 p-4 text-left transition hover:shadow-md">
                <span className="font-display text-base font-medium">{g.label}</span>
                <span className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>{g.items.length} étel</span>
                {filled > 0 && (
                  <span className="mt-1 w-fit rounded-full px-2 py-0.5 text-xs font-medium" style={{ background: "var(--twx-coral-soft)", color: "#7a2e17" }}>
                    {filled} tervezve
                  </span>
                )}
              </button>
            );
          })}
          <button onClick={() => setModal(MENUS_VIEW)}
            className="twx-card flex flex-col gap-1 p-4 text-left transition hover:shadow-md"
            style={{ borderColor: "var(--twx-coral)" }}>
            <span className="font-display text-base font-medium">Napi menük</span>
            <span className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>tervezett menü-darabszám</span>
            {menuTotal > 0 && (
              <span className="mt-1 w-fit rounded-full px-2 py-0.5 text-xs font-medium" style={{ background: "var(--twx-coral-soft)", color: "#7a2e17" }}>
                {menuTotal} menü
              </span>
            )}
          </button>
        </div>
      </div>

      <button onClick={run} disabled={running || days <= 0 || (!chosen.length && menuTotal === 0)}
        className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        style={{ background: "var(--twx-coral)" }}>
        {running ? "Terv készül…" : "Profit-terv lekérése (1 kredit)"}
      </button>

      {/* Eredmény */}
      {result && (
        <>
          <div id="plan-result" className="space-y-3 rounded-2xl p-4" style={{ background: "var(--twx-cream-card)" }}>
            <PlanResultView result={result} period={`${start} – ${end}`} />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {pdfUrl && (
              <a href={pdfUrl} target="_blank" rel="noopener noreferrer" download
                className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold"
                style={{ border: "1px solid var(--twx-coral)", color: "var(--twx-coral)" }}>
                PDF letöltése
              </a>
            )}
            <button onClick={exportPng}
              className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold"
              style={{ border: "1px solid var(--twx-line)", color: "var(--twx-ink-muted)" }}>
              PNG letöltése
            </button>
          </div>
        </>
      )}

      {narrative && (
        <div className="twx-card p-5">
          <h3 className="mb-2 font-display text-lg font-medium">Értékelés és javaslatok</h3>
          <div className="whitespace-pre-wrap text-sm leading-relaxed" style={{ color: "var(--twx-ink)" }}>{narrative}</div>
        </div>
      )}

      {/* Tervező ablak */}
      <AnimatePresence>
        {modal && (
          <PlanEditorModal
            view={modal}
            groups={groups}
            qty={qty} setQty={setQty}
            menuQty2={menuQty2} setMenuQty2={setMenuQty2}
            menuQty3={menuQty3} setMenuQty3={setMenuQty3}
            cost2={cost2} setCost2={setCost2}
            cost3={cost3} setCost3={setCost3}
            suggested2={suggested2} suggested3={suggested3}
            profile={profile}
            onClose={() => setModal(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// Az eredmény megjelenítése (ez megy PNG-be is).
function PlanResultView({ result: r, period }: { result: SimResult; period: string }) {
  return (
    <>
      <div>
        <h3 className="font-display text-lg font-semibold">Profit-terv</h3>
        <p className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>
          {period} · {r.mode === "full" ? "minden költséggel" : "csak az ételek profitja"}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Tervezett árbevétel" value={formatHuf(r.revenue)} />
        <Stat label="Tervezett költség" value={formatHuf(r.cost)} />
        <Stat label={r.target > 0 ? "Cél-profit" : "Tételek"} value={r.target > 0 ? formatHuf(r.target) : String(r.dishes.length)} />
        <Stat label="Várható profit" value={formatHuf(r.profit)} warn={r.profit < 0} />
      </div>

      {r.target > 0 && (
        <div className="rounded-2xl p-4" style={{ background: r.gap <= 0 ? "var(--twx-cream-card)" : "var(--twx-coral-soft)", border: `1px solid ${r.gap <= 0 ? "var(--twx-line)" : "var(--twx-coral)"}` }}>
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: r.gap <= 0 ? "var(--twx-ink-muted)" : "#7a2e17" }}>
            {r.gap <= 0 ? "A cél teljesül" : "A célhoz még hiányzik"}
          </p>
          <p className="mt-1 text-sm" style={{ color: "var(--twx-ink)" }}>
            {r.gap <= 0
              ? <>A terv <b>{formatHuf(-r.gap)}</b>-tal meghaladja a {formatHuf(r.target)} célt.</>
              : <>
                  <b>{formatHuf(r.gap)}</b> hiányzik a {formatHuf(r.target)} célhoz.
                  {r.scaleFactor && <> A jelenlegi mix <b>~{Math.round(r.scaleFactor * 100)}%</b>-ára skálázva jönne ki.</>}
                </>}
          </p>
          {r.bestLever && r.gap > 0 && (
            <p className="mt-1 text-sm" style={{ color: "var(--twx-ink)" }}>
              Leggyorsabb emelőkar: <b>{r.bestLever.name}</b> ({formatHuf(r.bestLever.unitProfit)}/adag) — ebből{" "}
              <b>{r.bestLever.extraQty} adaggal</b> több fedezné a hiányt.
            </p>
          )}
        </div>
      )}

      {r.dishes.length > 0 && (
        <div className="overflow-x-auto rounded-xl" style={{ border: "1px solid var(--twx-line)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ color: "var(--twx-ink-muted)" }} className="text-left">
                <th className="p-3 font-medium">Étel</th>
                <th className="p-3 text-right font-medium">adag</th>
                <th className="p-3 text-right font-medium">Profit/adag</th>
                <th className="p-3 text-right font-medium">Árbevétel</th>
                <th className="p-3 text-right font-medium">Profit</th>
              </tr>
            </thead>
            <tbody>
              {r.dishes.map((d) => (
                <tr key={d.dish_id} style={{ borderTop: "1px solid var(--twx-line)" }}>
                  <td className="p-3 font-medium">{d.name}</td>
                  <td className="p-3 text-right">{d.qty}</td>
                  <td className="p-3 text-right" style={{ color: d.unitProfit < 0 ? "#b5372f" : "var(--twx-ink)" }}>{formatHuf(d.unitProfit)}</td>
                  <td className="p-3 text-right">{formatHuf(d.revenue)}</td>
                  <td className="p-3 text-right" style={{ color: d.profit < 0 ? "#b5372f" : "var(--twx-ink)" }}>{formatHuf(d.profit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {r.menu.count > 0 && (
        <p className="text-sm" style={{ color: "var(--twx-ink-muted)" }}>
          <b style={{ color: "var(--twx-ink)" }}>Napi menük:</b> {r.menu.count} db ({r.menu.qty2} × 2 fogásos, {r.menu.qty3} × 3 fogásos) ·
          bevétel {formatHuf(r.menu.revenue)} · előállítás {formatHuf(r.menu.cost)} · profit {formatHuf(r.menu.profit)}
        </p>
      )}
      <p className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>Tervezési célú becslés · TWINX</p>
    </>
  );
}

// Felugró ablak a tervezett mennyiségek megadásához.
function PlanEditorModal({
  view, groups, qty, setQty, menuQty2, setMenuQty2, menuQty3, setMenuQty3,
  cost2, setCost2, cost3, setCost3, suggested2, suggested3, profile, onClose,
}: {
  view: string; groups: DishGroup[];
  qty: Record<string, string>; setQty: (f: (s: Record<string, string>) => Record<string, string>) => void;
  menuQty2: string; setMenuQty2: (v: string) => void;
  menuQty3: string; setMenuQty3: (v: string) => void;
  cost2: string; setCost2: (v: string) => void;
  cost3: string; setCost3: (v: string) => void;
  suggested2: number; suggested3: number;
  profile: CostProfile; onClose: () => void;
}) {
  const group = groups.find((g) => g.cat === view);
  const isMenus = view === MENUS_VIEW;

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
        <div className="flex items-center justify-between border-b p-4" style={{ borderColor: "var(--twx-line)" }}>
          <div className="font-display text-lg font-semibold">
            {isMenus ? "Tervezett napi menük" : categoryLabel(group?.cat ?? "")}
          </div>
          <button onClick={onClose} className="rounded-lg px-2 py-1 text-xl" style={{ color: "var(--twx-ink-muted)" }} aria-label="Bezár">×</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {isMenus ? (
            <div className="space-y-3">
              <p className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                Hány napi menüt terveztek eladni? A bevétel a beállított menü-árakból jön; az előállítási költséget
                az ételeid menü-költségeiből becsültük, de felülírhatod.
              </p>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm">2 fogásos menü <span className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>({profile.menu_price_2 > 0 ? formatHuf(profile.menu_price_2) : "nincs ár"})</span></span>
                <div className="w-24"><NumField value={menuQty2} onChange={setMenuQty2} /></div>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm">3 fogásos menü <span className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>({profile.menu_price_3 > 0 ? formatHuf(profile.menu_price_3) : "nincs ár"})</span></span>
                <div className="w-24"><NumField value={menuQty3} onChange={setMenuQty3} /></div>
              </div>
              <div className="rounded-lg border p-3" style={{ borderColor: "var(--twx-line)" }}>
                <p className="mb-2 text-xs" style={{ color: "var(--twx-ink-muted)" }}>Egy menü előállítási költsége (becsült)</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs" style={{ color: "var(--twx-ink-muted)" }}>2 fogásos</label>
                    <div className="mt-1"><NumField value={cost2} onChange={setCost2} placeholder={String(suggested2)} /></div>
                  </div>
                  <div>
                    <label className="block text-xs" style={{ color: "var(--twx-ink-muted)" }}>3 fogásos</label>
                    <div className="mt-1"><NumField value={cost3} onChange={setCost3} placeholder={String(suggested3)} /></div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {(group?.items ?? []).map((d) => (
                <div key={d.id} className="flex flex-wrap items-center justify-between gap-3">
                  <span className="min-w-0">
                    <span className="font-medium">{d.name}</span>{" "}
                    <span className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                      · profit {formatHuf((d.sale_price as number) - (d.cost_price as number))}/adag
                    </span>
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>tervezett adag</span>
                    <div className="w-24"><NumField value={qty[d.id] ?? ""} onChange={(v) => setQty((s) => ({ ...s, [d.id]: v }))} /></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t p-4" style={{ borderColor: "var(--twx-line)" }}>
          <button onClick={onClose}
            className="rounded-xl px-5 py-2 text-sm font-semibold text-white" style={{ background: "var(--twx-coral)" }}>
            Kész
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
