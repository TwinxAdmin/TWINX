// DishRecipeModal — egy étel-kategória (pl. Főételek) ablaka.
// Két nézet: (1) a kategória ételei a recept szerinti önköltséggel, (2) egy kiválasztott
// étel RECEPTJE, ahol alapanyagonként megadható, mennyi kell EGY adaghoz.
// A recept mentése után az önköltség egy gombbal beírható az étel étlap-árába vagy
// menü-költségébe (a szerver számolja újra).
"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { showToast } from "@/components/Toast";
import { formatHuf, type Dish } from "@/lib/hospitality";
import {
  ENTRY_UNITS, DEFAULT_ENTRY_UNIT, INGREDIENT_CATEGORIES, itemCost, recipeCost, unitLabel,
  type Ingredient, type RecipeItem,
} from "@/lib/recipes";

type Row = { ingredient_id: string; quantity: string; unit: string };

export default function DishRecipeModal({
  label, dishes, ingredients, recipesByDish, onRecipeSaved, onApplyCost, onClose,
}: {
  label: string;
  dishes: Dish[];
  ingredients: Ingredient[];
  recipesByDish: Map<string, RecipeItem[]>;
  onRecipeSaved: (dishId: string, items: RecipeItem[]) => void;
  onApplyCost: (dishIds: string[], target: "etlap" | "menu") => Promise<void>;
  onClose: () => void;
}) {
  const [editDish, setEditDish] = useState<Dish | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [saving, setSaving] = useState(false);

  const byId = new Map(ingredients.map((i) => [i.id, i]));

  const openDish = (d: Dish) => {
    const items = recipesByDish.get(d.id) ?? [];
    setRows(items.map((i) => ({ ingredient_id: i.ingredient_id, quantity: String(i.quantity), unit: i.unit })));
    setEditDish(d);
  };

  const toItems = (): RecipeItem[] =>
    rows
      .map((r) => ({
        ingredient_id: r.ingredient_id,
        quantity: Number(r.quantity.replace(",", ".")) || 0,
        unit: r.unit,
      }))
      .filter((r) => r.ingredient_id && r.quantity > 0);

  const liveCost = recipeCost(toItems(), ingredients);

  const addRow = () => {
    const first = ingredients[0];
    if (!first) return;
    setRows((s) => [...s, { ingredient_id: first.id, quantity: "", unit: DEFAULT_ENTRY_UNIT[first.unit] }]);
  };

  const setIngredient = (idx: number, id: string) => {
    const ing = byId.get(id);
    setRows((s) => s.map((r, i) => (i === idx ? { ...r, ingredient_id: id, unit: ing ? DEFAULT_ENTRY_UNIT[ing.unit] : r.unit } : r)));
  };

  // Recept mentése az ételhez.
  const saveRecipe = async (): Promise<boolean> => {
    if (!editDish) return false;
    setSaving(true);
    try {
      const items = toItems();
      const res = await fetch("/api/hospitality/recipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dish_id: editDish.id, items }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error ?? "A recept mentése nem sikerült.", "error"); return false; }
      onRecipeSaved(editDish.id, items);
      return true;
    } catch {
      showToast("Hálózati hiba. Próbáld újra.", "error");
      return false;
    } finally {
      setSaving(false);
    }
  };

  // Mentés + az önköltség beírása a kiválasztott ár-mezőbe.
  const saveAndApply = async (target: "etlap" | "menu") => {
    if (!editDish) return;
    const ok = await saveRecipe();
    if (!ok) return;
    await onApplyCost([editDish.id], target);
    showToast("Recept mentve, önköltség beírva.", "success");
    setEditDish(null);
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(20,12,8,0.45)" }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl"
        style={{ background: "var(--twx-cream-card)", border: "1px solid var(--twx-line)", boxShadow: "0 24px 60px rgba(0,0,0,0.25)" }}
        initial={{ scale: 0.95, opacity: 0, y: 12 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.96, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 26 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Fejléc */}
        <div className="flex items-center justify-between border-b p-4" style={{ borderColor: "var(--twx-line)" }}>
          <div className="min-w-0">
            <div className="font-display text-lg font-semibold">
              {editDish ? editDish.name : label}
            </div>
            <div className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>
              {editDish ? "Miből mennyi kell EGY adaghoz?" : `${dishes.length} étel ebben a kategóriában`}
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg px-2 py-1 text-xl" style={{ color: "var(--twx-ink-muted)" }} aria-label="Bezár">×</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {!editDish ? (
            /* ---------- Étel-lista ---------- */
            <div className="space-y-2">
              {dishes.map((d) => {
                const items = recipesByDish.get(d.id) ?? [];
                const cost = items.length ? recipeCost(items, ingredients) : null;
                // Eltérés a tárolt étlap-önköltségtől — a tárolt ár csak kézi frissítésre változik.
                const diff = cost != null && d.cost_price != null ? cost - d.cost_price : null;
                return (
                  <div
                    key={d.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3"
                    style={{ borderColor: "var(--twx-line)", background: "#fff" }}
                  >
                    <button onClick={() => openDish(d)} className="min-w-0 flex-1 text-left">
                      <span className="font-medium">{d.name}</span>{" "}
                      <span className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                        {items.length ? `· ${items.length} alapanyag` : "· nincs recept"}
                      </span>
                    </button>
                    <span className="flex flex-none items-center gap-3 text-sm">
                      {cost != null && (
                        <span className="text-right">
                          <b>{formatHuf(cost)}</b>
                          <span className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>/adag</span>
                          {diff != null && Math.abs(diff) >= 1 && (
                            <span className="ml-1 text-xs" style={{ color: diff > 0 ? "#b5372f" : "#2f7a4f" }}>
                              ({diff > 0 ? "+" : ""}{formatHuf(diff)})
                            </span>
                          )}
                        </span>
                      )}
                      {diff != null && Math.abs(diff) >= 1 && (
                        <button onClick={() => onApplyCost([d.id], "etlap")}
                          className="text-xs font-medium underline" style={{ color: "var(--twx-coral)" }}>
                          frissít
                        </button>
                      )}
                      <button onClick={() => openDish(d)}
                        className="text-xs font-medium underline" style={{ color: "var(--twx-coral)" }}>
                        {items.length ? "Recept szerkesztése" : "Recept megadása"}
                      </button>
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            /* ---------- Recept-szerkesztő ---------- */
            <>
              <button onClick={() => setEditDish(null)} className="mb-3 text-sm font-medium" style={{ color: "var(--twx-coral)" }}>
                ‹ Vissza az ételekhez
              </button>

              {!ingredients.length ? (
                <p className="text-sm" style={{ color: "var(--twx-ink-muted)" }}>
                  Még nincs alapanyagod. Vidd fel a beszerzési árakat fentebb, a kategória-kockákban — utána itt már
                  csak a mennyiséget kell megadnod.
                </p>
              ) : (
                <div className="space-y-2">
                  {rows.map((r, idx) => {
                    const ing = byId.get(r.ingredient_id);
                    const units = ing ? ENTRY_UNITS[ing.unit] : [];
                    const cost = ing
                      ? itemCost({ ingredient_id: r.ingredient_id, quantity: Number(r.quantity.replace(",", ".")) || 0, unit: r.unit }, ing)
                      : 0;
                    return (
                      <div key={idx} className="flex flex-wrap items-center gap-2">
                        <select
                          value={r.ingredient_id}
                          onChange={(e) => setIngredient(idx, e.target.value)}
                          className="box-border h-[38px] min-w-[150px] flex-1 rounded-lg border px-3 py-2 text-sm"
                          style={{ borderColor: "var(--twx-line)", background: "#fff" }}
                        >
                          {INGREDIENT_CATEGORIES.filter((c) => ingredients.some((i) => (i.category ?? "egyeb") === c.value)).map((c) => (
                            <optgroup key={c.value} label={c.label}>
                              {ingredients.filter((i) => (i.category ?? "egyeb") === c.value).map((i) => (
                                <option key={i.id} value={i.id}>{i.name} ({formatHuf(i.unit_price)}/{unitLabel(i.unit)})</option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                        <input
                          inputMode="decimal" value={r.quantity} placeholder="0"
                          onChange={(e) => setRows((s) => s.map((x, i) => (i === idx ? { ...x, quantity: e.target.value } : x)))}
                          className="w-20 rounded-lg border px-3 py-2 text-right text-sm"
                          style={{ borderColor: "var(--twx-line)", background: "#fff" }}
                        />
                        <select
                          value={r.unit}
                          onChange={(e) => setRows((s) => s.map((x, i) => (i === idx ? { ...x, unit: e.target.value } : x)))}
                          className="box-border h-[38px] rounded-lg border px-2 py-2 text-sm"
                          style={{ borderColor: "var(--twx-line)", background: "#fff" }}
                        >
                          {units.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
                        </select>
                        <span className="w-20 text-right text-sm" style={{ color: "var(--twx-ink-muted)" }}>{formatHuf(cost)}</span>
                        <button onClick={() => setRows((s) => s.filter((_, i) => i !== idx))}
                          className="text-lg" style={{ color: "var(--twx-ink-muted)" }} aria-label="Sor törlése">×</button>
                      </div>
                    );
                  })}
                  <button onClick={addRow} className="text-sm font-medium" style={{ color: "var(--twx-coral)" }}>
                    + Alapanyag hozzáadása
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Lábléc */}
        {editDish ? (
          <div className="space-y-3 border-t p-4" style={{ borderColor: "var(--twx-line)" }}>
            <div className="flex items-center justify-between rounded-xl p-3" style={{ background: "var(--twx-coral-soft)" }}>
              <span className="text-sm font-medium" style={{ color: "#7a2e17" }}>Egy adag alapanyagköltsége</span>
              <span className="font-display text-2xl font-semibold" style={{ color: "#7a2e17" }}>{formatHuf(liveCost)}</span>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <button onClick={() => setEditDish(null)} className="rounded-xl px-4 py-2 text-sm font-medium"
                style={{ border: "1px solid var(--twx-line)", color: "var(--twx-ink-muted)" }}>
                Mégse
              </button>
              <button
                onClick={async () => { const ok = await saveRecipe(); if (ok) { showToast("Recept mentve.", "success"); setEditDish(null); } }}
                disabled={saving}
                className="rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-60"
                style={{ border: "1px solid var(--twx-coral)", color: "var(--twx-coral)" }}>
                {saving ? "Mentés…" : "Csak a recept mentése"}
              </button>
              <button onClick={() => saveAndApply("etlap")} disabled={saving}
                className="rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" style={{ background: "var(--twx-coral)" }}>
                Mentés + étlap-ár
              </button>
              <button onClick={() => saveAndApply("menu")} disabled={saving}
                className="rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-60"
                style={{ border: "1px solid var(--twx-coral)", color: "var(--twx-coral)" }}>
                Mentés + menü-költség
              </button>
            </div>
          </div>
        ) : (
          <div className="flex justify-end border-t p-4" style={{ borderColor: "var(--twx-line)" }}>
            <button onClick={onClose} className="rounded-xl px-5 py-2 text-sm font-semibold text-white" style={{ background: "var(--twx-coral)" }}>
              Bezár
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
