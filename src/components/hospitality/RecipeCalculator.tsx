// RecipeCalculator — felugró ablak az étel adagonkénti ALAPANYAGKÖLTSÉGÉNEK kiszámolásához.
// A partner összeállítja, miből mennyi kell egy adaghoz (pl. 10 dkg burgonya), és a
// kiszámolt összeget egy kattintással beírhatja az étlap-árnak vagy a menü-költségnek.
// Csak az alapanyag számít — rezsi, bér és minden más költség kimarad.
"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { formatHuf } from "@/lib/hospitality";
import {
  ENTRY_UNITS, DEFAULT_ENTRY_UNIT, itemCost, recipeCost, unitLabel,
  type Ingredient, type RecipeItem,
} from "@/lib/recipes";

type Row = { ingredient_id: string; quantity: string; unit: string };

export default function RecipeCalculator({
  initialItems, onApply, onClose,
}: {
  initialItems: RecipeItem[];
  onApply: (cost: number, target: "etlap" | "menu", items: RecipeItem[]) => void;
  onClose: () => void;
}) {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>(
    () => initialItems.map((i) => ({ ingredient_id: i.ingredient_id, quantity: String(i.quantity), unit: i.unit }))
  );

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/hospitality/ingredients");
        const data = await res.json();
        if (res.ok) setIngredients(data.ingredients ?? []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const byId = useMemo(() => new Map(ingredients.map((i) => [i.id, i])), [ingredients]);

  const items: RecipeItem[] = rows
    .map((r) => ({ ingredient_id: r.ingredient_id, quantity: Number(r.quantity.replace(",", ".")) || 0, unit: r.unit }))
    .filter((r) => r.ingredient_id && r.quantity > 0);
  const total = recipeCost(items, ingredients);

  const addRow = () => {
    const first = ingredients[0];
    if (!first) return;
    setRows((s) => [...s, { ingredient_id: first.id, quantity: "", unit: DEFAULT_ENTRY_UNIT[first.unit] }]);
  };

  const setIngredient = (idx: number, id: string) => {
    const ing = byId.get(id);
    setRows((s) => s.map((r, i) => (i === idx ? { ...r, ingredient_id: id, unit: ing ? DEFAULT_ENTRY_UNIT[ing.unit] : r.unit } : r)));
  };

  const apply = (target: "etlap" | "menu") => {
    if (!items.length) return;
    onApply(Math.round(total), target, items);
  };

  return (
    <motion.div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: "rgba(20,12,8,0.45)" }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl"
        style={{ background: "var(--twx-cream-card)", border: "1px solid var(--twx-line)", boxShadow: "0 24px 60px rgba(0,0,0,0.25)" }}
        initial={{ scale: 0.95, opacity: 0, y: 12 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.96, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 26 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b p-4" style={{ borderColor: "var(--twx-line)" }}>
          <div>
            <div className="font-display text-lg font-semibold">Önköltség kiszámolása</div>
            <div className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>Miből mennyi kell EGY adaghoz?</div>
          </div>
          <button onClick={onClose} className="rounded-lg px-2 py-1 text-xl" style={{ color: "var(--twx-ink-muted)" }} aria-label="Bezár">×</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <p className="text-sm" style={{ color: "var(--twx-ink-muted)" }}>Alapanyagok betöltése…</p>
          ) : !ingredients.length ? (
            <p className="text-sm" style={{ color: "var(--twx-ink-muted)" }}>
              Még nincs alapanyagod. Vidd fel a beszerzési árakat az{" "}
              <a href="/dashboard/hospitality/ingredients" className="underline" style={{ color: "var(--twx-coral)" }}>
                Alapanyagok &amp; receptek
              </a>{" "}
              menüpontban, utána itt már csak a mennyiséget kell megadnod.
            </p>
          ) : (
            <div className="space-y-2">
              {rows.map((r, idx) => {
                const ing = byId.get(r.ingredient_id);
                const units = ing ? ENTRY_UNITS[ing.unit] : [];
                const cost = ing ? itemCost({ ingredient_id: r.ingredient_id, quantity: Number(r.quantity.replace(",", ".")) || 0, unit: r.unit }, ing) : 0;
                return (
                  <div key={idx} className="flex flex-wrap items-center gap-2">
                    <select
                      value={r.ingredient_id}
                      onChange={(e) => setIngredient(idx, e.target.value)}
                      className="box-border h-[38px] min-w-[150px] flex-1 rounded-lg border px-3 py-2 text-sm"
                      style={{ borderColor: "var(--twx-line)", background: "var(--twx-cream-card)" }}
                    >
                      {ingredients.map((i) => (
                        <option key={i.id} value={i.id}>{i.name} ({formatHuf(i.unit_price)}/{unitLabel(i.unit)})</option>
                      ))}
                    </select>
                    <input
                      inputMode="decimal"
                      value={r.quantity}
                      onChange={(e) => setRows((s) => s.map((x, i) => (i === idx ? { ...x, quantity: e.target.value } : x)))}
                      placeholder="0"
                      className="w-20 rounded-lg border px-3 py-2 text-right text-sm"
                      style={{ borderColor: "var(--twx-line)", background: "var(--twx-cream-card)" }}
                    />
                    <select
                      value={r.unit}
                      onChange={(e) => setRows((s) => s.map((x, i) => (i === idx ? { ...x, unit: e.target.value } : x)))}
                      className="box-border h-[38px] rounded-lg border px-2 py-2 text-sm"
                      style={{ borderColor: "var(--twx-line)", background: "var(--twx-cream-card)" }}
                    >
                      {units.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
                    </select>
                    <span className="w-20 text-right text-sm" style={{ color: "var(--twx-ink-muted)" }}>{formatHuf(cost)}</span>
                    <button
                      onClick={() => setRows((s) => s.filter((_, i) => i !== idx))}
                      className="text-lg" style={{ color: "var(--twx-ink-muted)" }} aria-label="Sor törlése"
                    >
                      ×
                    </button>
                  </div>
                );
              })}
              <button onClick={addRow} className="text-sm font-medium" style={{ color: "var(--twx-coral)" }}>
                + Alapanyag hozzáadása
              </button>
            </div>
          )}
        </div>

        <div className="border-t p-4" style={{ borderColor: "var(--twx-line)" }}>
          <div className="mb-3 flex items-center justify-between rounded-xl p-3" style={{ background: "var(--twx-coral-soft)" }}>
            <span className="text-sm font-medium" style={{ color: "#7a2e17" }}>Egy adag alapanyagköltsége</span>
            <span className="font-display text-2xl font-semibold" style={{ color: "#7a2e17" }}>{formatHuf(total)}</span>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <button onClick={onClose} className="rounded-xl px-4 py-2 text-sm font-medium" style={{ border: "1px solid var(--twx-line)", color: "var(--twx-ink-muted)" }}>Bezár</button>
            <button onClick={() => apply("etlap")} disabled={!items.length}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" style={{ background: "var(--twx-coral)" }}>
              Beírom étlap-árnak
            </button>
            <button onClick={() => apply("menu")} disabled={!items.length}
              className="rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50"
              style={{ border: "1px solid var(--twx-coral)", color: "var(--twx-coral)" }}>
              Beírom menü-költségnek
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
