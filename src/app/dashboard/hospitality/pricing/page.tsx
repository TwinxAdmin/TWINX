// dashboard/hospitality/pricing — Árazás elemző.
// A partner ételeinek ár/haszon-elemzése (determinisztikus, kredit nélkül):
// átlag árrés, veszteséges/alacsony árrésű tételek, ár-javaslatok, kategória-bontás.
"use client";

import { useEffect, useMemo, useState } from "react";
import ModuleIntro from "@/components/ModuleIntro";
import Skeleton from "@/components/motion/Skeleton";
import { categoryLabel, formatHuf, type Dish } from "@/lib/hospitality";

export default function PricingPage() {
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState(65); // cél árrés (%)

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/hospitality/dishes");
        const data = await res.json();
        if (res.ok) setDishes(data.dishes ?? []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const priced = useMemo(
    () => dishes.filter((d) => d.cost_price != null && d.sale_price != null),
    [dishes]
  );

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
    const avgMargin = rows.reduce((s, r) => s + r.margin, 0) / rows.length;
    const avgProfit = rows.reduce((s, r) => s + r.profit, 0) / rows.length;
    const loss = rows.filter((r) => r.loss).length;
    const below = rows.filter((r) => r.below && !r.loss).length;
    return { avgMargin, avgProfit, loss, below };
  }, [rows]);

  const flagged = rows.filter((r) => r.loss || r.below).sort((a, b) => a.margin - b.margin);
  const topProfit = [...rows].sort((a, b) => b.profit - a.profit).slice(0, 5);
  const topMargin = [...rows].sort((a, b) => b.margin - a.margin).slice(0, 5);

  const byCategory = useMemo(() => {
    const map = new Map<string, { count: number; sumMargin: number }>();
    for (const r of rows) {
      const e = map.get(r.d.category) ?? { count: 0, sumMargin: 0 };
      e.count += 1;
      e.sumMargin += r.margin;
      map.set(r.d.category, e);
    }
    return Array.from(map.entries())
      .map(([cat, e]) => ({ cat, count: e.count, avg: e.sumMargin / e.count }))
      .sort((a, b) => a.avg - b.avg);
  }, [rows]);

  const unpriced = dishes.length - priced.length;

  return (
    <main className="mx-auto max-w-3xl space-y-6">
      <ModuleIntro
        eyebrow="Vendéglátás · Elemzés"
        title="Árazás elemző"
        subtitle="A kínálatod áraiból megmutatja a haszonkulcsokat: mely ételek a legjövedelmezőbbek, melyek veszteségesek vagy alacsony árrésűek, és mennyire emeld az árat a célod eléréséhez. Ingyenes, azonnali — kredit nélkül."
        icon="pricing"
        chips={["Haszonkulcs", "Veszteséges tételek", "Ár-javaslat"]}
      />

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)}
        </div>
      ) : priced.length === 0 ? (
        <div className="twx-card p-5 text-sm" style={{ color: "var(--twx-ink-muted)" }}>
          Még nincs árazott ételed. Adj meg előkészítési + eladási árat az ételeknél a{" "}
          <a href="/dashboard/hospitality/inventory" className="underline" style={{ color: "var(--twx-coral)" }}>
            Kínálat kezelőben
          </a>
          , és itt azonnal elemezzük.
        </div>
      ) : (
        <>
          {/* Cél árrés */}
          <div className="twx-card flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <label className="block text-sm font-medium">Cél árrés</label>
              <p className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                A vendéglátásban tipikusan 60–70% egészséges. Ez alá eső ételeket megjelöljük.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={30}
                max={90}
                value={target}
                onChange={(e) => setTarget(Number(e.target.value))}
                style={{ accentColor: "var(--twx-coral)" }}
              />
              <span className="w-12 text-right font-display text-lg font-semibold" style={{ color: "var(--twx-coral)" }}>
                {target}%
              </span>
            </div>
          </div>

          {/* Összefoglaló */}
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
              {unpriced} ételnél nincs ár megadva — azok kimaradnak az elemzésből.
            </p>
          )}

          {/* Figyelmet igénylő */}
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

          {/* Top listák */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TopList title="Legjövedelmezőbb (darab-profit)" rows={topProfit} metric={(r) => formatHuf(r.profit)} />
            <TopList title="Legmagasabb árrés" rows={topMargin} metric={(r) => `${Math.round(r.margin)}%`} />
          </div>

          {/* Kategória-bontás */}
          <section className="space-y-2">
            <h2 className="font-display text-lg font-medium">Átlag árrés kategóriánként</h2>
            <div className="twx-card divide-y" style={{ borderColor: "var(--twx-line)" }}>
              {byCategory.map((c) => (
                <div key={c.cat} className="flex items-center justify-between p-3 text-sm" style={{ borderColor: "var(--twx-line)" }}>
                  <span>{categoryLabel(c.cat)} <span style={{ color: "var(--twx-ink-muted)" }}>({c.count})</span></span>
                  <span className="font-medium" style={{ color: c.avg < target ? "#b5372f" : "var(--twx-ink)" }}>
                    {Math.round(c.avg)}%
                  </span>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </main>
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
  title,
  rows,
  metric,
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
