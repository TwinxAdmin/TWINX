// dashboard/hospitality/pricing — Árazás elemző.
// Két nézet: ÉTLAP (saját eladási ár → haszonkulcs, ár-javaslat) és MENÜ (az étel csak
// költség; azt nézzük, a fix menü-ár mekkora hányadát viszi el). Determinisztikus, ingyenes.
"use client";

import { useEffect, useMemo, useState } from "react";
import ModuleIntro from "@/components/ModuleIntro";
import Skeleton from "@/components/motion/Skeleton";
import { categoryLabel, formatHuf, type Dish } from "@/lib/hospitality";

type Channel = "etlap" | "menu";

export default function PricingPage() {
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [loading, setLoading] = useState(true);
  const [channel, setChannel] = useState<Channel>("etlap");
  const [target, setTarget] = useState(65);       // étlap: cél árrés (%)
  const [maxShare, setMaxShare] = useState(30);   // menü: egy fogás max hányada (%)
  const [courses, setCourses] = useState<2 | 3>(2);
  const [menuPrices, setMenuPrices] = useState({ p2: 0, p3: 0 });

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
        if (pRes.ok && p.profile) {
          setMenuPrices({ p2: Number(p.profile.menu_price_2) || 0, p3: Number(p.profile.menu_price_3) || 0 });
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const priced = useMemo(
    () => dishes.filter((d) => d.cost_price != null && d.sale_price != null),
    [dishes]
  );
  const menuPriced = useMemo(() => dishes.filter((d) => d.menu_cost_price != null), [dishes]);
  const menuPrice = courses === 3 ? menuPrices.p3 : menuPrices.p2;

  return (
    <main className="mx-auto max-w-3xl space-y-6">
      <ModuleIntro
        eyebrow="Vendéglátás · Elemzés"
        title="Árazás elemző"
        subtitle="Étlapon: haszonkulcsok, veszteséges tételek és konkrét ár-javaslat. Menüben: az étel csak költség, ezért azt nézzük, a fix menü-ár mekkora részét viszi el egy-egy fogás. Ingyenes, azonnali — kredit nélkül."
        icon="pricing"
        chips={["Étlap: haszonkulcs", "Menü: költséghányad", "Ár-javaslat"]}
      />

      {/* Csatorna-kapcsoló */}
      <div className="flex flex-wrap gap-2">
        {([["etlap", "Étlap"], ["menu", "Menü"]] as const).map(([v, l]) => (
          <button
            key={v}
            onClick={() => setChannel(v)}
            className="rounded-full px-4 py-2 text-sm font-medium transition"
            style={
              channel === v
                ? { background: "var(--twx-coral)", color: "#fff" }
                : { background: "var(--twx-cream-card)", color: "var(--twx-ink-muted)", border: "1px solid var(--twx-line)" }
            }
          >
            {l}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)}
        </div>
      ) : channel === "etlap" ? (
        <EtlapView priced={priced} target={target} setTarget={setTarget} unpriced={dishes.length - priced.length} />
      ) : (
        <MenuView
          items={menuPriced} menuPrice={menuPrice} courses={courses} setCourses={setCourses}
          maxShare={maxShare} setMaxShare={setMaxShare}
        />
      )}
    </main>
  );
}

// =============================================================================
// ÉTLAP nézet — saját eladási ár → árrés, ár-javaslat
// =============================================================================
function EtlapView({
  priced, target, setTarget, unpriced,
}: { priced: Dish[]; target: number; setTarget: (n: number) => void; unpriced: number }) {
  const rows = useMemo(() => {
    return priced.map((d) => {
      const cost = d.cost_price as number;
      const sale = d.sale_price as number;
      const profit = sale - cost;
      const margin = sale > 0 ? (profit / sale) * 100 : 0;
      const suggested = target < 100 ? Math.ceil(cost / (1 - target / 100)) : sale;
      return { d, cost, sale, profit, margin, suggested, loss: profit <= 0, below: margin < target };
    });
  }, [priced, target]);

  const stats = useMemo(() => {
    if (!rows.length) return null;
    return {
      avgMargin: rows.reduce((s, r) => s + r.margin, 0) / rows.length,
      avgProfit: rows.reduce((s, r) => s + r.profit, 0) / rows.length,
      loss: rows.filter((r) => r.loss).length,
      below: rows.filter((r) => r.below && !r.loss).length,
    };
  }, [rows]);

  const flagged = rows.filter((r) => r.loss || r.below).sort((a, b) => a.margin - b.margin);
  const topProfit = [...rows].sort((a, b) => b.profit - a.profit).slice(0, 5);
  const topMargin = [...rows].sort((a, b) => b.margin - a.margin).slice(0, 5);

  const byCategory = useMemo(() => {
    const map = new Map<string, { count: number; sumMargin: number }>();
    for (const r of rows) {
      const e = map.get(r.d.category) ?? { count: 0, sumMargin: 0 };
      e.count += 1; e.sumMargin += r.margin;
      map.set(r.d.category, e);
    }
    return Array.from(map.entries())
      .map(([cat, e]) => ({ cat, count: e.count, avg: e.sumMargin / e.count }))
      .sort((a, b) => a.avg - b.avg);
  }, [rows]);

  if (!priced.length) {
    return (
      <div className="twx-card p-5 text-sm" style={{ color: "var(--twx-ink-muted)" }}>
        Nincs étlapos árazású ételed. Adj meg előkészítési + eladási árat a{" "}
        <a href="/dashboard/hospitality/inventory" className="underline" style={{ color: "var(--twx-coral)" }}>Kínálat kezelőben</a>.
      </div>
    );
  }

  return (
    <>
      <div className="twx-card flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <label className="block text-sm font-medium">Cél árrés</label>
          <p className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>
            A vendéglátásban tipikusan 60–70% egészséges. Ez alá eső ételeket megjelöljük.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input type="range" min={30} max={90} value={target} onChange={(e) => setTarget(Number(e.target.value))} style={{ accentColor: "var(--twx-coral)" }} />
          <span className="w-12 text-right font-display text-lg font-semibold" style={{ color: "var(--twx-coral)" }}>{target}%</span>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Átlag árrés" value={`${Math.round(stats.avgMargin)}%`} />
          <StatCard label="Átlag darab-profit" value={formatHuf(stats.avgProfit)} />
          <StatCard label="Veszteséges" value={String(stats.loss)} warn={stats.loss > 0} />
          <StatCard label="Cél alatti" value={String(stats.below)} warn={stats.below > 0} />
        </div>
      )}
      {unpriced > 0 && (
        <p className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>
          {unpriced} ételnél nincs étlapos ár megadva — azok kimaradnak ebből a nézetből.
        </p>
      )}

      {flagged.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-display text-lg font-medium">Figyelmet igényel ({flagged.length})</h2>
          <div className="space-y-2">
            {flagged.map((r) => (
              <div key={r.d.id} className="twx-card flex flex-wrap items-center justify-between gap-2 p-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{r.d.name}</span>
                    <span className="rounded-full px-2 py-0.5 text-xs" style={{ background: "var(--twx-line)", color: "var(--twx-ink-muted)" }}>
                      {categoryLabel(r.d.category)}
                    </span>
                    <span
                      className="rounded-full px-2 py-0.5 text-xs font-medium"
                      style={r.loss ? { background: "#fde2e0", color: "#b5372f" } : { background: "var(--twx-coral-soft)", color: "#7a2e17" }}
                    >
                      {r.loss ? "Veszteséges" : `${Math.round(r.margin)}% árrés`}
                    </span>
                  </div>
                  <p className="mt-1 text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                    Jelenleg: {formatHuf(r.sale)} ár · {formatHuf(r.profit)} profit
                  </p>
                </div>
                <div className="text-right text-sm">
                  <span style={{ color: "var(--twx-ink-muted)" }}>Javasolt ár ({target}%):</span>{" "}
                  <b style={{ color: "var(--twx-coral)" }}>{formatHuf(r.suggested)}</b>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TopList title="Legjövedelmezőbb (darab-profit)" rows={topProfit} metric={(r) => formatHuf(r.profit)} />
        <TopList title="Legmagasabb árrés" rows={topMargin} metric={(r) => `${Math.round(r.margin)}%`} />
      </div>

      <section className="space-y-2">
        <h2 className="font-display text-lg font-medium">Átlag árrés kategóriánként</h2>
        <div className="twx-card divide-y" style={{ borderColor: "var(--twx-line)" }}>
          {byCategory.map((c) => (
            <div key={c.cat} className="flex items-center justify-between p-3 text-sm">
              <span>{categoryLabel(c.cat)} <span style={{ color: "var(--twx-ink-muted)" }}>({c.count})</span></span>
              <span className="font-medium" style={{ color: c.avg < target ? "#b5372f" : "var(--twx-ink)" }}>{Math.round(c.avg)}%</span>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

// =============================================================================
// MENÜ nézet — az étel csak költség; a fix menü-ár hányadát nézzük
// =============================================================================
function MenuView({
  items, menuPrice, courses, setCourses, maxShare, setMaxShare,
}: {
  items: Dish[]; menuPrice: number; courses: 2 | 3; setCourses: (c: 2 | 3) => void;
  maxShare: number; setMaxShare: (n: number) => void;
}) {
  const rows = useMemo(() => {
    return items
      .map((d) => {
        const cost = d.menu_cost_price as number;
        const share = menuPrice > 0 ? (cost / menuPrice) * 100 : 0;
        const saving = d.cost_price != null ? d.cost_price - cost : null;
        return { d, cost, share, saving, high: menuPrice > 0 && share > maxShare };
      })
      .sort((a, b) => b.cost - a.cost);
  }, [items, menuPrice, maxShare]);

  const avgCost = rows.length ? rows.reduce((s, r) => s + r.cost, 0) / rows.length : 0;
  const highCount = rows.filter((r) => r.high).length;
  // Tipikus menü-költség: a legolcsóbb fogásokból álló összeállítás durva becslése.
  const typicalMenuCost = avgCost * courses;

  if (!items.length) {
    return (
      <div className="twx-card p-5 text-sm" style={{ color: "var(--twx-ink-muted)" }}>
        Egyetlen ételnél sincs megadva a <b>menüben az előállítási költség</b>. Add meg a{" "}
        <a href="/dashboard/hospitality/inventory" className="underline" style={{ color: "var(--twx-coral)" }}>Kínálat kezelőben</a>,
        és itt azonnal elemezzük.
      </div>
    );
  }

  return (
    <>
      <div className="twx-card space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <label className="block text-sm font-medium">Melyik menühöz viszonyítsunk?</label>
            <p className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>
              A menü ára az Önköltség &amp; profit modulban van beállítva.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {([2, 3] as const).map((c) => (
              <button
                key={c}
                onClick={() => setCourses(c)}
                className="rounded-full px-3 py-1 text-xs font-medium"
                style={courses === c ? { background: "var(--twx-coral)", color: "#fff" } : { border: "1px solid var(--twx-line)", color: "var(--twx-ink-muted)" }}
              >
                {c} fogásos
              </button>
            ))}
          </div>
        </div>

        {menuPrice > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <label className="block text-sm font-medium">Egy fogás max. a menü árának…</label>
              <p className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                {courses} fogásnál {maxShare}% × {courses} = {maxShare * courses}% menne el előállításra, {100 - maxShare * courses}% maradna.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input type="range" min={10} max={50} value={maxShare} onChange={(e) => setMaxShare(Number(e.target.value))} style={{ accentColor: "var(--twx-coral)" }} />
              <span className="w-12 text-right font-display text-lg font-semibold" style={{ color: "var(--twx-coral)" }}>{maxShare}%</span>
            </div>
          </div>
        ) : (
          <p className="text-sm" style={{ color: "#b5372f" }}>
            Nincs {courses} fogásos menü-ár beállítva — add meg az Önköltség &amp; profit modul „Költségek &amp; bevételek" fülén.
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label={`${courses} fogásos menü ára`} value={menuPrice > 0 ? formatHuf(menuPrice) : "—"} />
        <StatCard label="Átlag menü-költség / fogás" value={formatHuf(avgCost)} />
        <StatCard label={`Tipikus ${courses} fogásos előállítás`} value={formatHuf(typicalMenuCost)} />
        <StatCard
          label="Marad átlagosan"
          value={menuPrice > 0 ? formatHuf(menuPrice - typicalMenuCost) : "—"}
          warn={menuPrice > 0 && menuPrice - typicalMenuCost < 0}
        />
      </div>

      {menuPrice > 0 && highCount > 0 && (
        <div className="twx-card p-4 text-sm" style={{ color: "var(--twx-ink)" }}>
          <b>{highCount}</b> étel drágább, mint a menü árának {maxShare}%-a. Ha ezek kerülnek egy menübe, kevés profit marad —
          érdemes olcsóbb párral kombinálni őket, vagy csökkenteni az előállítási költségüket.
        </div>
      )}

      <section className="space-y-2">
        <h2 className="font-display text-lg font-medium">Ételek menü-költsége</h2>
        <div className="twx-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ color: "var(--twx-ink-muted)" }} className="text-left">
                <th className="p-3 font-medium">Étel</th>
                <th className="p-3 font-medium">Kategória</th>
                <th className="p-3 text-right font-medium">Menü-költség</th>
                <th className="p-3 text-right font-medium">A menü árának</th>
                <th className="p-3 text-right font-medium">Megtakarítás*</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.d.id} style={{ borderTop: "1px solid var(--twx-line)" }}>
                  <td className="p-3 font-medium">{r.d.name}</td>
                  <td className="p-3" style={{ color: "var(--twx-ink-muted)" }}>{categoryLabel(r.d.category)}</td>
                  <td className="p-3 text-right">{formatHuf(r.cost)}</td>
                  <td className="p-3 text-right" style={{ color: r.high ? "#b5372f" : "var(--twx-ink)" }}>
                    {menuPrice > 0 ? `${Math.round(r.share)}%` : "—"}
                  </td>
                  <td className="p-3 text-right" style={{ color: "var(--twx-ink-muted)" }}>
                    {r.saving != null ? formatHuf(r.saving) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>
          *Mennyivel olcsóbb az étel menüben, mint étlapról (nagy széria). Üres, ha nincs étlapos ára.
        </p>
      </section>
    </>
  );
}

function StatCard({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="twx-card p-4">
      <p className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>{label}</p>
      <p className="font-display text-2xl font-semibold" style={{ color: warn ? "#b5372f" : "var(--twx-ink)" }}>{value}</p>
    </div>
  );
}

function TopList({
  title, rows, metric,
}: {
  title: string;
  rows: { d: Dish; profit: number; margin: number }[];
  metric: (r: { profit: number; margin: number }) => string;
}) {
  return (
    <div className="twx-card p-4">
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      <ul className="space-y-1">
        {rows.map((r, i) => (
          <li key={r.d.id} className="flex items-center justify-between gap-2 text-sm">
            <span className="min-w-0 truncate">
              <span style={{ color: "var(--twx-ink-muted)" }}>{i + 1}.</span> {r.d.name}
            </span>
            <b className="flex-none" style={{ color: "var(--twx-coral)" }}>{metric(r)}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}
