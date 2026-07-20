// dashboard/hospitality/ingredients — Alapanyagok & receptek.
// (1) Alapanyag-árlista: mennyiért szerzi be a partner az alapanyagokat.
// (2) Ételek recept-önköltsége: amelyik ételhez van recept, ott kiszámoljuk az adagonkénti
//     alapanyagköltséget, és jelezzük, ha eltér az ételnél tárolt ártól.
// FONTOS: itt csak az ALAPANYAG számít — rezsi, bér és minden más költség kimarad.
"use client";

import { useEffect, useMemo, useState } from "react";
import ModuleIntro from "@/components/ModuleIntro";
import Skeleton from "@/components/motion/Skeleton";
import { showToast } from "@/components/Toast";
import { formatHuf, categoryLabel, type Dish } from "@/lib/hospitality";
import {
  INGREDIENT_UNITS, recipeCost, unitLabel,
  type Ingredient, type IngredientUnit,
} from "@/lib/recipes";

type RecipeRow = { id: string; dish_id: string; ingredient_id: string; quantity: number; unit: string };

export default function IngredientsPage() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [recipes, setRecipes] = useState<RecipeRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Új alapanyag űrlap
  const [name, setName] = useState("");
  const [unit, setUnit] = useState<IngredientUnit>("kg");
  const [price, setPrice] = useState("");
  const [waste, setWaste] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [iRes, dRes, rRes] = await Promise.all([
          fetch("/api/hospitality/ingredients"),
          fetch("/api/hospitality/dishes"),
          fetch("/api/hospitality/recipes"),
        ]);
        const i = await iRes.json();
        const d = await dRes.json();
        const r = await rRes.json();
        if (iRes.ok) setIngredients(i.ingredients ?? []);
        if (dRes.ok) setDishes(d.dishes ?? []);
        if (rRes.ok) setRecipes(r.items ?? []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const add = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/hospitality/ingredients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, unit, unit_price: price, waste_pct: waste }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error ?? "Mentés sikertelen.", "error"); return; }
      setIngredients((s) => [...s, data.ingredient].sort((a, b) => a.name.localeCompare(b.name, "hu")));
      setName(""); setPrice(""); setWaste("");
      showToast("Alapanyag hozzáadva.", "success");
    } catch {
      showToast("Hálózati hiba. Próbáld újra.", "error");
    } finally {
      setBusy(false);
    }
  };

  const update = async (ing: Ingredient) => {
    const res = await fetch("/api/hospitality/ingredients", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ing),
    });
    const data = await res.json();
    if (!res.ok) { showToast(data.error ?? "Mentés sikertelen.", "error"); return false; }
    setIngredients((s) => s.map((x) => (x.id === ing.id ? data.ingredient : x)));
    showToast("Módosítva.", "success");
    return true;
  };

  const remove = async (id: string) => {
    const prev = ingredients;
    setIngredients((s) => s.filter((x) => x.id !== id));
    const res = await fetch(`/api/hospitality/ingredients?id=${id}`, { method: "DELETE" });
    if (!res.ok) { setIngredients(prev); showToast("Törlés sikertelen.", "error"); }
  };

  // Ételek, amelyekhez van recept — a számított adagonkénti alapanyagköltséggel.
  const dishCosts = useMemo(() => {
    const byDish = new Map<string, RecipeRow[]>();
    for (const r of recipes) {
      const arr = byDish.get(r.dish_id) ?? [];
      arr.push(r);
      byDish.set(r.dish_id, arr);
    }
    return dishes
      .filter((d) => byDish.has(d.id))
      .map((d) => {
        const items = byDish.get(d.id) ?? [];
        const cost = recipeCost(items, ingredients);
        return { dish: d, items: items.length, cost };
      })
      .sort((a, b) => b.cost - a.cost);
  }, [dishes, recipes, ingredients]);

  return (
    <main className="mx-auto max-w-3xl space-y-6">
      <ModuleIntro
        eyebrow="Vendéglátás · Önköltség"
        title="Alapanyagok & receptek"
        subtitle="Vidd fel egyszer, mennyiért szerzed be az alapanyagokat, és az ételekhez add meg az adagonkénti mennyiséget — a rendszer kiszámolja, mennyibe kerül egy adag elkészítése. Csak az alapanyag számít: rezsi, bér és minden más költség kimarad, azt a riport vetíti rá."
        icon="recipe"
        chips={["Beszerzési árak", "Adagonkénti önköltség", "Ár-változás hatása"]}
      />

      {loading ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)}</div>
      ) : (
        <>
          {/* --- Új alapanyag --- */}
          <section className="space-y-3">
            <div>
              <h2 className="font-display text-lg font-medium">Alapanyag-árlista</h2>
              <p className="text-sm" style={{ color: "var(--twx-ink-muted)" }}>
                Az árat mindig az alap-egységre add meg (pl. <b>marhalábszár — 4 200 Ft/kg</b>). A hulladék% a
                tisztításkor elvesző részt pótolja, hogy ne becsüljük alá a költséget.
              </p>
            </div>

            <div className="twx-card flex flex-wrap items-end gap-2 p-4">
              <div className="min-w-[160px] flex-1">
                <label className="block text-xs font-medium" style={{ color: "var(--twx-ink-muted)" }}>Megnevezés</label>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="pl. marhalábszár"
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--twx-line)", background: "var(--twx-cream-card)" }} />
              </div>
              <div>
                <label className="block text-xs font-medium" style={{ color: "var(--twx-ink-muted)" }}>Egység</label>
                <select value={unit} onChange={(e) => setUnit(e.target.value as IngredientUnit)}
                  className="mt-1 box-border h-[38px] rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--twx-line)", background: "var(--twx-cream-card)" }}>
                  {INGREDIENT_UNITS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
                </select>
              </div>
              <div className="w-32">
                <label className="block text-xs font-medium" style={{ color: "var(--twx-ink-muted)" }}>Ár / {unitLabel(unit)}</label>
                <input inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="pl. 4200"
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-right text-sm" style={{ borderColor: "var(--twx-line)", background: "var(--twx-cream-card)" }} />
              </div>
              <div className="w-24">
                <label className="block text-xs font-medium" style={{ color: "var(--twx-ink-muted)" }}>Hulladék %</label>
                <input inputMode="numeric" value={waste} onChange={(e) => setWaste(e.target.value)} placeholder="0"
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-right text-sm" style={{ borderColor: "var(--twx-line)", background: "var(--twx-cream-card)" }} />
              </div>
              <button onClick={add} disabled={busy}
                className="rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" style={{ background: "var(--twx-coral)" }}>
                {busy ? "…" : "Hozzáadás"}
              </button>
            </div>

            {ingredients.length > 0 ? (
              <div className="twx-card divide-y" style={{ borderColor: "var(--twx-line)" }}>
                {ingredients.map((ing) => (
                  <IngredientRow key={ing.id} ing={ing} onSave={update} onRemove={remove} />
                ))}
              </div>
            ) : (
              <div className="twx-card p-4 text-sm" style={{ color: "var(--twx-ink-muted)" }}>
                Még nincs alapanyagod. Vidd fel azokat, amikből a leggyakrabban főzöl — utána az ételeknél két kattintással kiszámolható az önköltség.
              </div>
            )}
          </section>

          {/* --- Ételek recept-önköltsége --- */}
          <section className="space-y-2">
            <div>
              <h2 className="font-display text-lg font-medium">Ételek recept-önköltsége</h2>
              <p className="text-sm" style={{ color: "var(--twx-ink-muted)" }}>
                Azok az ételek, amelyekhez már felvittél receptet. Ha az alapanyag ára változik, itt azonnal látod,
                mely ételek önköltsége mozdult el a tárolt árhoz képest.
              </p>
            </div>

            {dishCosts.length ? (
              <div className="twx-card overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ color: "var(--twx-ink-muted)" }} className="text-left">
                      <th className="p-3 font-medium">Étel</th>
                      <th className="p-3 text-right font-medium">Recept szerint</th>
                      <th className="p-3 text-right font-medium">Étlapnál tárolt</th>
                      <th className="p-3 text-right font-medium">Menünél tárolt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dishCosts.map(({ dish, cost, items }) => {
                      const diffE = dish.cost_price != null ? cost - dish.cost_price : null;
                      const diffM = dish.menu_cost_price != null ? cost - dish.menu_cost_price : null;
                      return (
                        <tr key={dish.id} style={{ borderTop: "1px solid var(--twx-line)" }}>
                          <td className="p-3">
                            <span className="font-medium">{dish.name}</span>{" "}
                            <span className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>· {categoryLabel(dish.category)} · {items} alapanyag</span>
                          </td>
                          <td className="p-3 text-right font-medium">{formatHuf(cost)}</td>
                          <td className="p-3 text-right">
                            {dish.cost_price != null ? (
                              <>
                                {formatHuf(dish.cost_price)}
                                {diffE != null && Math.abs(diffE) >= 1 && (
                                  <span className="ml-1 text-xs" style={{ color: diffE > 0 ? "#b5372f" : "#2f7a4f" }}>
                                    ({diffE > 0 ? "+" : ""}{formatHuf(diffE)})
                                  </span>
                                )}
                              </>
                            ) : <span style={{ color: "var(--twx-ink-muted)" }}>—</span>}
                          </td>
                          <td className="p-3 text-right">
                            {dish.menu_cost_price != null ? (
                              <>
                                {formatHuf(dish.menu_cost_price)}
                                {diffM != null && Math.abs(diffM) >= 1 && (
                                  <span className="ml-1 text-xs" style={{ color: diffM > 0 ? "#b5372f" : "#2f7a4f" }}>
                                    ({diffM > 0 ? "+" : ""}{formatHuf(diffM)})
                                  </span>
                                )}
                              </>
                            ) : <span style={{ color: "var(--twx-ink-muted)" }}>—</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="twx-card p-4 text-sm" style={{ color: "var(--twx-ink-muted)" }}>
                Még egyik ételhez sincs recept. A Kínálat kezelőben az étel árazásánál kattints a
                „Nem tudod fejből? Számoljuk ki" linkre.
              </div>
            )}
            <p className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>
              A zárójeles érték azt mutatja, mennyivel tér el a recept szerinti önköltség a tárolt ártól. Pirosan: a
              recept drágább, mint amivel az étel el van mentve.
            </p>
          </section>
        </>
      )}
    </main>
  );
}

// Egy alapanyag sor — kattintásra szerkeszthető.
function IngredientRow({
  ing, onSave, onRemove,
}: { ing: Ingredient; onSave: (i: Ingredient) => Promise<boolean>; onRemove: (id: string) => void }) {
  const [edit, setEdit] = useState(false);
  const [name, setName] = useState(ing.name);
  const [unit, setUnit] = useState<IngredientUnit>(ing.unit);
  const [price, setPrice] = useState(String(ing.unit_price ?? ""));
  const [waste, setWaste] = useState(String(ing.waste_pct ?? 0));
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const ok = await onSave({ id: ing.id, name, unit, unit_price: Number(price) || 0, waste_pct: Number(waste) || 0 });
    setSaving(false);
    if (ok) setEdit(false);
  };

  if (!edit) {
    return (
      <div className="flex items-center justify-between gap-3 p-3 text-sm">
        <span className="min-w-0">
          <span className="font-medium">{ing.name}</span>{" "}
          <span className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>
            · {formatHuf(ing.unit_price)}/{unitLabel(ing.unit)}
            {ing.waste_pct > 0 ? ` · ${ing.waste_pct}% hulladék` : ""}
          </span>
        </span>
        <span className="flex flex-none items-center gap-2">
          <button onClick={() => setEdit(true)} className="text-xs font-medium" style={{ color: "var(--twx-coral)" }}>Szerkesztés</button>
          <button onClick={() => onRemove(ing.id)} className="text-lg" style={{ color: "var(--twx-ink-muted)" }} aria-label="Törlés">×</button>
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-end gap-2 p-3">
      <div className="min-w-[140px] flex-1">
        <input value={name} onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--twx-line)", background: "var(--twx-cream-card)" }} />
      </div>
      <select value={unit} onChange={(e) => setUnit(e.target.value as IngredientUnit)}
        className="box-border h-[38px] rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--twx-line)", background: "var(--twx-cream-card)" }}>
        {INGREDIENT_UNITS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
      </select>
      <input inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)}
        className="w-28 rounded-lg border px-3 py-2 text-right text-sm" style={{ borderColor: "var(--twx-line)", background: "var(--twx-cream-card)" }} />
      <input inputMode="numeric" value={waste} onChange={(e) => setWaste(e.target.value)}
        className="w-20 rounded-lg border px-3 py-2 text-right text-sm" style={{ borderColor: "var(--twx-line)", background: "var(--twx-cream-card)" }} />
      <button onClick={save} disabled={saving}
        className="rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" style={{ background: "var(--twx-coral)" }}>
        {saving ? "…" : "Mentés"}
      </button>
      <button onClick={() => setEdit(false)} className="rounded-xl px-3 py-2 text-sm" style={{ border: "1px solid var(--twx-line)", color: "var(--twx-ink-muted)" }}>Mégse</button>
    </div>
  );
}
