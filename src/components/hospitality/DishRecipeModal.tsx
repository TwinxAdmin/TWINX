// DishRecipeModal — egy étel-kategória (pl. Főételek) ablaka.
// Két nézet: (1) a kategória ételei a recept szerinti önköltséggel, (2) egy kiválasztott
// étel RECEPTJE, ahol alapanyagonként megadható, mennyi kell EGY adaghoz.
//
// A hozzávalót NEM kötelező előre felvinni az árlistába: a partner beírhat bármit (pl.
// oregánó a pizzához). Ha a név nincs a közös listában, megkérdezzük, mi legyen vele:
//   - „Csak ehhez az ételhez"  → a megadott ár EGYEDI, csak ennél az ételnél él
//   - „Felveszem a listába"    → bekerül a közös árlistába, az Egyéb kategóriába
//
// A recept mentése után az önköltség egy gombbal beírható az étel étlap-árába vagy
// menü-költségébe (a szerver számolja újra).
"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { showToast } from "@/components/Toast";
import { formatHuf, type Dish } from "@/lib/hospitality";
import {
  ENTRY_UNITS, DEFAULT_ENTRY_UNIT, INGREDIENT_UNITS, itemCost, recipeCost, unitLabel,
  type Ingredient, type IngredientUnit, type RecipeItem,
} from "@/lib/recipes";

type Row = {
  ingredient_id: string | null;
  name: string;                 // amit a partner lát / beír
  quantity: string;
  unit: string;                 // bevitt egység (g/dkg/kg/ml/dl/l/db)
  custom_unit: IngredientUnit;  // egyedi hozzávaló alap-egysége
  custom_unit_price: string;    // egyedi ár (Ft / alap-egység)
  custom_waste_pct: string;
};

// A „nincs a listában" kérdés állapota.
type Pending = { idx: number; name: string; unit: IngredientUnit; price: string; waste: string };

const emptyRow = (): Row => ({
  ingredient_id: null, name: "", quantity: "", unit: "dkg",
  custom_unit: "kg", custom_unit_price: "", custom_waste_pct: "",
});

export default function DishRecipeModal({
  label, dishes, ingredients, recipesByDish,
  onRecipeSaved, onIngredientAdded, onApplyCost, onClose,
}: {
  label: string;
  dishes: Dish[];
  ingredients: Ingredient[];
  recipesByDish: Map<string, RecipeItem[]>;
  onRecipeSaved: (dishId: string, items: RecipeItem[]) => void;
  onIngredientAdded: (ing: Ingredient) => void;
  onApplyCost: (dishIds: string[], target: "etlap" | "menu") => Promise<void>;
  onClose: () => void;
}) {
  const [editDish, setEditDish] = useState<Dish | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [pending, setPending] = useState<Pending | null>(null);
  const [saving, setSaving] = useState(false);

  const byId = new Map(ingredients.map((i) => [i.id, i]));
  const findByName = (name: string) =>
    ingredients.find((i) => i.name.trim().toLowerCase() === name.trim().toLowerCase());

  const openDish = (d: Dish) => {
    const items = recipesByDish.get(d.id) ?? [];
    setRows(
      items.map((i) => ({
        ingredient_id: i.ingredient_id,
        name: i.ingredient_id ? (byId.get(i.ingredient_id)?.name ?? "") : String(i.custom_name ?? ""),
        quantity: String(i.quantity),
        unit: i.unit,
        custom_unit: (i.custom_unit ?? "kg") as IngredientUnit,
        custom_unit_price: i.custom_unit_price != null ? String(i.custom_unit_price) : "",
        custom_waste_pct: i.custom_waste_pct ? String(i.custom_waste_pct) : "",
      }))
    );
    setPending(null);
    setEditDish(d);
  };

  // A sorból számítható recept-tétel (árlistás vagy egyedi).
  const rowItem = (r: Row): RecipeItem => ({
    ingredient_id: r.ingredient_id,
    quantity: Number(r.quantity.replace(",", ".")) || 0,
    unit: r.unit,
    custom_name: r.ingredient_id ? null : r.name.trim() || null,
    custom_unit: r.custom_unit,
    custom_unit_price: Number(r.custom_unit_price.replace(",", ".")) || 0,
    custom_waste_pct: Number(r.custom_waste_pct.replace(",", ".")) || 0,
  });

  const toItems = (): RecipeItem[] =>
    rows.map(rowItem).filter((i) => (i.ingredient_id || i.custom_name) && i.quantity > 0);

  const rowCost = (r: Row) => itemCost(rowItem(r), r.ingredient_id ? byId.get(r.ingredient_id) : undefined);
  const liveCost = recipeCost(toItems(), ingredients);

  const patchRow = (idx: number, patch: Partial<Row>) =>
    setRows((s) => s.map((r, i) => (i === idx ? { ...r, ...patch } : r)));

  // Név beírása: ha egyezik egy árlistás alapanyaggal, azonnal ahhoz kötjük.
  const setName = (idx: number, name: string) => {
    const hit = findByName(name);
    patchRow(idx, hit
      ? { name: hit.name, ingredient_id: hit.id, unit: DEFAULT_ENTRY_UNIT[hit.unit] }
      : { name, ingredient_id: null });
  };

  // Kilépéskor kérdezünk rá az ismeretlen névre (ha még nincs egyedi ára).
  const askIfUnknown = (idx: number) => {
    const r = rows[idx];
    if (!r || r.ingredient_id || !r.name.trim() || r.custom_unit_price.trim()) return;
    setPending({ idx, name: r.name.trim(), unit: "kg", price: "", waste: "" });
  };

  // 1) Csak ehhez az ételhez — az ár a recept-soron marad.
  const keepCustom = () => {
    if (!pending) return;
    patchRow(pending.idx, {
      ingredient_id: null,
      name: pending.name,
      custom_unit: pending.unit,
      custom_unit_price: pending.price || "0",
      custom_waste_pct: pending.waste,
      unit: DEFAULT_ENTRY_UNIT[pending.unit],
    });
    setPending(null);
  };

  // 2) Felveszem a közös árlistába — az Egyéb kategóriába kerül.
  const addToList = async () => {
    if (!pending) return;
    try {
      const res = await fetch("/api/hospitality/ingredients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: pending.name, unit: pending.unit,
          unit_price: pending.price || 0, waste_pct: pending.waste || 0,
          category: "egyeb",
        }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error ?? "Nem sikerült felvenni.", "error"); return; }
      const ing = data.ingredient as Ingredient;
      onIngredientAdded(ing);
      patchRow(pending.idx, {
        ingredient_id: ing.id, name: ing.name,
        unit: DEFAULT_ENTRY_UNIT[ing.unit], custom_unit_price: "",
      });
      setPending(null);
      showToast(`„${ing.name}" bekerült az Egyéb kategóriába.`, "success");
    } catch {
      showToast("Hálózati hiba. Próbáld újra.", "error");
    }
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
        className="relative flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl"
        style={{ background: "var(--twx-cream-card)", border: "1px solid var(--twx-line)", boxShadow: "0 24px 60px rgba(0,0,0,0.25)" }}
        initial={{ scale: 0.95, opacity: 0, y: 12 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.96, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 26 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Fejléc */}
        <div className="flex items-center justify-between border-b p-4" style={{ borderColor: "var(--twx-line)" }}>
          <div className="min-w-0">
            <div className="font-display text-lg font-semibold">{editDish ? editDish.name : label}</div>
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
                        {items.length ? `· ${items.length} hozzávaló` : "· nincs recept"}
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

              {/* A már felvitt alapanyagok javaslatként jönnek, de bármi beírható. */}
              <datalist id="twx-ingredient-names">
                {ingredients.map((i) => <option key={i.id} value={i.name} />)}
              </datalist>

              <div className="space-y-2">
                {rows.map((r, idx) => {
                  const ing = r.ingredient_id ? byId.get(r.ingredient_id) : undefined;
                  const base: IngredientUnit = ing ? ing.unit : r.custom_unit;
                  const custom = !r.ingredient_id && !!r.name.trim();
                  return (
                    <div key={idx} className="flex flex-wrap items-center gap-2">
                      <div className="min-w-[150px] flex-1">
                        <input
                          value={r.name}
                          list="twx-ingredient-names"
                          placeholder="alapanyag neve (pl. oregánó)"
                          onChange={(e) => setName(idx, e.target.value)}
                          onBlur={() => askIfUnknown(idx)}
                          className="w-full rounded-lg border px-3 py-2 text-sm"
                          style={{ borderColor: custom ? "var(--twx-coral)" : "var(--twx-line)", background: "#fff" }}
                        />
                        {custom && (
                          <span className="text-[11px]" style={{ color: "var(--twx-coral)" }}>
                            egyedi ár: {formatHuf(Number(r.custom_unit_price.replace(",", ".")) || 0)}/{unitLabel(r.custom_unit)} · csak ennél az ételnél
                          </span>
                        )}
                        {ing && (
                          <span className="text-[11px]" style={{ color: "var(--twx-ink-muted)" }}>
                            árlistából: {formatHuf(ing.unit_price)}/{unitLabel(ing.unit)}
                          </span>
                        )}
                      </div>
                      <input
                        inputMode="decimal" value={r.quantity} placeholder="0"
                        onChange={(e) => patchRow(idx, { quantity: e.target.value })}
                        className="w-20 rounded-lg border px-3 py-2 text-right text-sm"
                        style={{ borderColor: "var(--twx-line)", background: "#fff" }}
                      />
                      <select
                        value={r.unit}
                        onChange={(e) => patchRow(idx, { unit: e.target.value })}
                        className="box-border h-[38px] rounded-lg border px-2 py-2 text-sm"
                        style={{ borderColor: "var(--twx-line)", background: "#fff" }}
                      >
                        {ENTRY_UNITS[base].map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
                      </select>
                      <span className="w-20 text-right text-sm" style={{ color: "var(--twx-ink-muted)" }}>{formatHuf(rowCost(r))}</span>
                      <button onClick={() => setRows((s) => s.filter((_, i) => i !== idx))}
                        className="text-lg" style={{ color: "var(--twx-ink-muted)" }} aria-label="Sor törlése">×</button>
                    </div>
                  );
                })}
                <button onClick={() => setRows((s) => [...s, emptyRow()])} className="text-sm font-medium" style={{ color: "var(--twx-coral)" }}>
                  + Hozzávaló hozzáadása
                </button>
                <p className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                  Nem kell előre felvinni mindent: írd be a nevét, és ha nincs az árlistában, megkérdezzük, mennyibe kerül.
                </p>
              </div>
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

        {/* „Nincs a listában" kérdés */}
        <AnimatePresence>
          {pending && (
            <motion.div
              className="absolute inset-0 z-10 flex items-center justify-center p-4"
              style={{ background: "rgba(20,12,8,0.35)" }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            >
              <motion.div
                className="w-full max-w-sm rounded-2xl p-4"
                style={{ background: "var(--twx-cream-card)", border: "1px solid var(--twx-line)", boxShadow: "0 16px 40px rgba(0,0,0,0.2)" }}
                initial={{ scale: 0.95, y: 8 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, opacity: 0 }}
              >
                <div className="font-display text-base font-semibold">„{pending.name}" még nincs az alapanyagok között</div>
                <p className="mt-1 text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                  Add meg, mennyiért szerzed be — enélkül nem tudjuk beszámolni az önköltségbe.
                </p>

                <div className="mt-3 flex flex-wrap items-end gap-2">
                  <select
                    value={pending.unit}
                    onChange={(e) => setPending({ ...pending, unit: e.target.value as IngredientUnit })}
                    className="box-border h-[38px] rounded-lg border px-2 py-2 text-sm"
                    style={{ borderColor: "var(--twx-line)", background: "#fff" }}
                  >
                    {INGREDIENT_UNITS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
                  </select>
                  <input
                    inputMode="numeric" value={pending.price} placeholder={`Ft/${unitLabel(pending.unit)}`}
                    onChange={(e) => setPending({ ...pending, price: e.target.value })}
                    className="w-28 rounded-lg border px-3 py-2 text-right text-sm"
                    style={{ borderColor: "var(--twx-line)", background: "#fff" }}
                  />
                  <input
                    inputMode="numeric" value={pending.waste} placeholder="hull.%"
                    onChange={(e) => setPending({ ...pending, waste: e.target.value })}
                    className="w-20 rounded-lg border px-3 py-2 text-right text-sm"
                    style={{ borderColor: "var(--twx-line)", background: "#fff" }}
                  />
                </div>

                <div className="mt-4 space-y-2">
                  <button onClick={addToList}
                    className="w-full rounded-xl px-4 py-2 text-sm font-semibold text-white" style={{ background: "var(--twx-coral)" }}>
                    Felveszem az alapanyagok közé
                  </button>
                  <p className="text-[11px]" style={{ color: "var(--twx-ink-muted)" }}>
                    Az <b>Egyéb</b> kategóriába kerül, és onnantól minden ételnél választható.
                  </p>
                  <button onClick={keepCustom}
                    className="w-full rounded-xl px-4 py-2 text-sm font-semibold"
                    style={{ border: "1px solid var(--twx-coral)", color: "var(--twx-coral)" }}>
                    Csak ehhez az ételhez
                  </button>
                  <p className="text-[11px]" style={{ color: "var(--twx-ink-muted)" }}>
                    A megadott ár csak ennél az ételnél él, a közös listába nem kerül be.
                  </p>
                  <button
                    onClick={() => { patchRow(pending.idx, { name: "", ingredient_id: null }); setPending(null); }}
                    className="w-full px-4 py-1 text-xs font-medium" style={{ color: "var(--twx-ink-muted)" }}>
                    Mégse
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
