// dashboard/hospitality/costing — Önköltség & profit modul.
// Három fül: (1) Étteremszintű fix költség-profil, (2) Étel-szintű kalkulátor + kredites
// riport, (3) Követés (heti eladás → tényleges profit). A bevitel/mentés ingyen; a
// teljes riport (AI-javaslattal) kerül kreditbe.
"use client";

import { useEffect, useMemo, useState } from "react";
import ModuleIntro from "@/components/ModuleIntro";
import Skeleton from "@/components/motion/Skeleton";
import { showToast } from "@/components/Toast";
import { categoryLabel, formatHuf, type Dish } from "@/lib/hospitality";
import {
  COST_FIELDS,
  EMPTY_COST_PROFILE,
  costProfileTotal,
  computeCosting,
  toAmount,
  type CostProfile,
  type CostingResult,
  type AllocationMethod,
} from "@/lib/costing";

type Tab = "profile" | "calc" | "track";

export default function CostingPage() {
  const [tab, setTab] = useState<Tab>("profile");
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [profile, setProfile] = useState<CostProfile>(EMPTY_COST_PROFILE);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [dRes, pRes] = await Promise.all([
          fetch("/api/hospitality/dishes"),
          fetch("/api/hospitality/cost-profile"),
        ]);
        const d = await dRes.json();
        const p = await pRes.json();
        if (dRes.ok) setDishes(d.dishes ?? []);
        if (pRes.ok && p.profile) setProfile(p.profile);
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
    { key: "calc", label: "Étel-szintű kalkulátor" },
    { key: "track", label: "Követés" },
  ];

  return (
    <main className="mx-auto max-w-4xl space-y-6">
      <ModuleIntro
        eyebrow="Vendéglátás · Önköltség"
        title="Önköltség & profit"
        subtitle="Kiszámolja egy étel valódi előállítási költségét: az alapanyag mellé rávetíti a havi fix költségeket (bérlet, bérek, rezsi…) a forgalom szerint. Így látod egy étel teljes önköltségét, valós profitját és megtérülését. A bevitel ingyenes, a teljes riport kredites."
        icon="cost"
        chips={["Teljes önköltség", "Rezsi-allokáció", "Megtérülés"]}
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
        <ProfileTab profile={profile} onSaved={setProfile} />
      ) : tab === "calc" ? (
        <CalcTab priced={priced} overhead={overhead} />
      ) : (
        <TrackTab priced={priced} overhead={overhead} />
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
function ProfileTab({ profile, onSaved }: { profile: CostProfile; onSaved: (p: CostProfile) => void }) {
  const [vals, setVals] = useState<Record<string, string>>(() => {
    const o: Record<string, string> = {};
    for (const f of COST_FIELDS) o[f.key] = profile[f.key] ? String(profile[f.key]) : "";
    return o;
  });
  const [extra, setExtra] = useState<{ label: string; amount: string }[]>(
    () => (profile.extra_items ?? []).map((e) => ({ label: e.label, amount: String(e.amount) }))
  );
  const [saving, setSaving] = useState(false);

  const total =
    COST_FIELDS.reduce((s, f) => s + toAmount(vals[f.key]), 0) +
    extra.reduce((s, e) => s + toAmount(e.amount), 0);

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
        ételre a forgalma szerint. Elég egyszer beállítani; bármikor frissíthető, és a mentés ingyenes.
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
    </div>
  );
}

// =============================================================================
// 2) Étel-szintű kalkulátor + kredites riport
// =============================================================================
function CalcTab({ priced, overhead }: { priced: Dish[]; overhead: number }) {
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [qty, setQty] = useState<Record<string, string>>({});
  const [method, setMethod] = useState<AllocationMethod>("revenue");
  const [report, setReport] = useState<CostingResult | null>(null);
  const [narrative, setNarrative] = useState("");
  const [running, setRunning] = useState(false);

  const toggle = (id: string) => {
    setSel((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  // Ingyenes, élő előnézet a kiválasztott ételekből (kliensoldali számítás).
  const preview = useMemo(() => {
    const inputs = priced
      .filter((d) => sel.has(d.id))
      .map((d) => ({
        dish_id: d.id, name: d.name, category: d.category,
        cost_price: d.cost_price as number, sale_price: d.sale_price as number,
        monthly_qty: Math.max(0, Math.floor(Number(qty[d.id]) || 0)),
      }));
    if (!inputs.length) return null;
    return computeCosting(inputs, overhead, method);
  }, [priced, sel, qty, overhead, method]);

  const runReport = async () => {
    const chosen = priced.filter((d) => sel.has(d.id));
    if (!chosen.length) { showToast("Válassz legalább egy ételt.", "error"); return; }
    setRunning(true);
    try {
      const res = await fetch("/api/hospitality/costing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method,
          dishes: chosen.map((d) => ({ dish_id: d.id, monthly_qty: Math.max(0, Math.floor(Number(qty[d.id]) || 0)) })),
        }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error ?? "A riport lekérése sikertelen.", "error"); return; }
      setReport(data.result);
      setNarrative(data.narrative ?? "");
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
        Nincs árazott ételed. Adj meg előkészítési + eladási árat a Kínálat kezelőben, majd itt kiszámoljuk a teljes önköltséget.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {overhead === 0 && (
        <div className="twx-card p-3 text-xs" style={{ color: "#b5372f" }}>
          Még nincs havi fix költség megadva az „Étteremszintű költség" fülön — a rezsi-allokáció addig 0. Add meg a fix költségeket a valós önköltséghez.
        </div>
      )}

      <div className="twx-card p-4 text-sm" style={{ color: "var(--twx-ink-muted)" }}>
        Válaszd ki az ételeket, és add meg mindegyikhez a <b>várható havi darabszámot</b>. Rögtön látod,
        hogy pl. 800 vagy 2000 eladott adag mellett mennyi profit jön. A számok itt ingyen frissülnek; a
        <b> „Riport lekérése"</b> ad teljes, AI-javaslatokkal ellátott elemzést.
      </div>

      {/* Allokáció */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span style={{ color: "var(--twx-ink-muted)" }}>Rezsi szétosztása:</span>
        {([["revenue", "Árbevétel-arányos"], ["unit", "Darab-arányos"]] as const).map(([v, l]) => (
          <button
            key={v}
            onClick={() => setMethod(v)}
            className="rounded-full px-3 py-1 text-xs font-medium"
            style={method === v ? { background: "var(--twx-coral)", color: "#fff" } : { border: "1px solid var(--twx-line)", color: "var(--twx-ink-muted)" }}
          >
            {l}
          </button>
        ))}
      </div>

      {/* Étel-választó + darabszám */}
      <div className="space-y-2">
        {priced.map((d) => {
          const on = sel.has(d.id);
          return (
            <div key={d.id} className="twx-card flex flex-wrap items-center justify-between gap-3 p-3">
              <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                <input type="checkbox" checked={on} onChange={() => toggle(d.id)} style={{ accentColor: "var(--twx-coral)" }} />
                <span className="min-w-0">
                  <span className="font-medium">{d.name}</span>{" "}
                  <span className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                    · {categoryLabel(d.category)} · ár {formatHuf(d.sale_price as number)} · alapanyag {formatHuf(d.cost_price as number)}
                  </span>
                </span>
              </label>
              {on && (
                <div className="flex items-center gap-2">
                  <span className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>db/hó</span>
                  <div className="w-28"><NumField value={qty[d.id] ?? ""} onChange={(v) => setQty((s) => ({ ...s, [d.id]: v }))} /></div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Élő előnézet */}
      {preview && <ResultView result={preview} />}

      <button
        onClick={runReport}
        disabled={running || sel.size === 0}
        className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        style={{ background: "var(--twx-coral)" }}
      >
        {running ? "Riport készül…" : "Riport lekérése (1 kredit)"}
      </button>

      {narrative && (
        <div className="twx-card p-5">
          <h3 className="mb-2 font-display text-lg font-medium">AI-elemzés és javaslatok</h3>
          <div className="whitespace-pre-wrap text-sm leading-relaxed" style={{ color: "var(--twx-ink)" }}>{narrative}</div>
        </div>
      )}
    </div>
  );
}

// Számított eredmény megjelenítése (előnézethez és riporthoz is).
function ResultView({ result }: { result: CostingResult }) {
  const t = result.totals;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Havi árbevétel" value={formatHuf(t.revenue)} />
        <Stat label="Alapanyagköltség" value={formatHuf(t.ingredientCost)} />
        <Stat label="Rávetített rezsi" value={formatHuf(t.coveredOverhead)} />
        <Stat label="Étterem havi profit" value={formatHuf(t.netProfit)} warn={t.netProfit < 0} />
      </div>

      <div className="twx-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ color: "var(--twx-ink-muted)" }} className="text-left">
              <th className="p-3 font-medium">Étel</th>
              <th className="p-3 text-right font-medium">db/hó</th>
              <th className="p-3 text-right font-medium">Teljes önktg/adag</th>
              <th className="p-3 text-right font-medium">Valós profit/adag</th>
              <th className="p-3 text-right font-medium">Árrés</th>
              <th className="p-3 text-right font-medium">Havi profit</th>
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
        A „teljes önköltség/adag" az alapanyag + a rá jutó havi rezsi egy adagra vetítve. A „fedezeti db" az a
        havi darabszám, ami az ételre eső rezsit fedezi.
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
// 3) Követés — heti eladás → tényleges profit
// =============================================================================
function mondayOf(d = new Date()): string {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // hétfő = 0
  x.setDate(x.getDate() - day);
  return x.toISOString().slice(0, 10);
}

type SaleRow = { dish_id: string; week_start: string; qty: number };

function TrackTab({ priced, overhead }: { priced: Dish[]; overhead: number }) {
  const [week, setWeek] = useState<string>(() => mondayOf());
  const [qty, setQty] = useState<Record<string, string>>({});
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [saving, setSaving] = useState(false);
  const weeklyOverhead = overhead * 12 / 52; // havi rezsi -> heti arányos

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/hospitality/sales");
      const data = await res.json();
      if (res.ok) setSales(data.sales ?? []);
    })();
  }, []);

  // A kiválasztott hét mentett darabszámai betöltése a mezőkbe.
  useEffect(() => {
    const forWeek = sales.filter((s) => s.week_start === week);
    const map: Record<string, string> = {};
    for (const s of forWeek) map[s.dish_id] = String(s.qty);
    setQty(map);
  }, [week, sales]);

  const priceById = useMemo(() => {
    const m = new Map<string, { sale: number; cost: number; name: string }>();
    for (const d of priced) m.set(d.id, { sale: d.sale_price as number, cost: d.cost_price as number, name: d.name });
    return m;
  }, [priced]);

  // Az aktuális hét élő számai a mezőkből.
  const live = useMemo(() => {
    let revenue = 0, contribution = 0;
    const rows: { name: string; qty: number; profit: number }[] = [];
    for (const d of priced) {
      const q = Math.max(0, Math.floor(Number(qty[d.id]) || 0));
      if (!q) continue;
      const c = (d.sale_price as number) - (d.cost_price as number);
      revenue += (d.sale_price as number) * q;
      contribution += c * q;
      rows.push({ name: d.name, qty: q, profit: c * q });
    }
    return { revenue, contribution, net: contribution - weeklyOverhead, rows: rows.sort((a, b) => b.profit - a.profit) };
  }, [priced, qty, weeklyOverhead]);

  const save = async () => {
    setSaving(true);
    try {
      const entries = priced
        .map((d) => ({ dish_id: d.id, qty: Math.max(0, Math.floor(Number(qty[d.id]) || 0)) }));
      const res = await fetch("/api/hospitality/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ week_start: week, entries }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error ?? "Mentés sikertelen.", "error"); return; }
      // Frissítjük a helyi listát.
      setSales((prev) => {
        const others = prev.filter((s) => s.week_start !== week);
        const now = entries.filter((e) => e.qty > 0).map((e) => ({ dish_id: e.dish_id, week_start: week, qty: e.qty }));
        return [...now, ...others];
      });
      showToast("Heti eladás mentve.", "success");
    } catch {
      showToast("Hálózati hiba. Próbáld újra.", "error");
    } finally {
      setSaving(false);
    }
  };

  // Korábbi hetek összegzése (profit hetente).
  const history = useMemo(() => {
    const byWeek = new Map<string, number>();
    for (const s of sales) {
      const p = priceById.get(s.dish_id);
      if (!p) continue;
      byWeek.set(s.week_start, (byWeek.get(s.week_start) ?? 0) + (p.sale - p.cost) * s.qty);
    }
    return [...byWeek.entries()]
      .map(([w, contribution]) => ({ week: w, net: contribution - weeklyOverhead }))
      .sort((a, b) => (a.week < b.week ? 1 : -1))
      .slice(0, 8);
  }, [sales, priceById, weeklyOverhead]);

  if (!priced.length) {
    return (
      <div className="twx-card p-5 text-sm" style={{ color: "var(--twx-ink-muted)" }}>
        Nincs árazott ételed. A követéshez előbb vigyél fel ételeket árakkal a Kínálat kezelőben.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="twx-card p-4 text-sm" style={{ color: "var(--twx-ink-muted)" }}>
        Írd be hetente az eladott darabszámokat. Ebből kiszámoljuk az <b>ételeken elért tényleges profitot</b> és
        — a heti arányos rezsivel — az <b>étterem heti profitját</b>. A követés ingyenes.
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm font-medium">Hét kezdete (hétfő):</label>
        <input
          type="date"
          value={week}
          onChange={(e) => setWeek(e.target.value || mondayOf())}
          className="rounded-lg border px-3 py-2 text-sm"
          style={{ borderColor: "var(--twx-line)", background: "var(--twx-cream-card)" }}
        />
      </div>

      <div className="space-y-2">
        {priced.map((d) => (
          <div key={d.id} className="twx-card flex flex-wrap items-center justify-between gap-3 p-3">
            <span className="min-w-0">
              <span className="font-medium">{d.name}</span>{" "}
              <span className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>· fedezet {formatHuf((d.sale_price as number) - (d.cost_price as number))}/adag</span>
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>eladott db</span>
              <div className="w-28"><NumField value={qty[d.id] ?? ""} onChange={(v) => setQty((s) => ({ ...s, [d.id]: v }))} /></div>
            </div>
          </div>
        ))}
      </div>

      {/* Heti összegzés */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Heti árbevétel" value={formatHuf(live.revenue)} />
        <Stat label="Ételprofit (fedezet)" value={formatHuf(live.contribution)} />
        <Stat label="Heti rezsi (arányos)" value={formatHuf(weeklyOverhead)} />
        <Stat label="Étterem heti profit" value={formatHuf(live.net)} warn={live.net < 0} />
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        style={{ background: "var(--twx-coral)" }}
      >
        {saving ? "Mentés…" : "Heti eladás mentése"}
      </button>

      {history.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Korábbi hetek (étterem-profit)</h3>
          <div className="twx-card divide-y" style={{ borderColor: "var(--twx-line)" }}>
            {history.map((h) => (
              <div key={h.week} className="flex items-center justify-between p-3 text-sm">
                <span>{h.week}</span>
                <span className="font-medium" style={{ color: h.net < 0 ? "#b5372f" : "var(--twx-ink)" }}>{formatHuf(h.net)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
