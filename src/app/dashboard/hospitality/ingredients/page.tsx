// dashboard/hospitality/ingredients — Alapanyagok & receptek.
// (1) Alapanyagok kategória-kockákban (zöldség, hús, tejtermék…): a kockára kattintva
//     felugró ablakban lehet tételeket hozzáadni/szerkeszteni, nyilakkal lépkedve a
//     kategóriák között.
// (2) Ételek kategória-kockákban (előétel, leves…): a kockára kattintva felugró ablakban
//     látszanak a kategória ételei, és ott adható meg ételenként a RECEPT — melyik
//     alapanyagból mennyi kell egy adaghoz.
// FONTOS: itt csak az ALAPANYAG számít — rezsi, bér és minden más költség kimarad.
"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import ModuleIntro from "@/components/ModuleIntro";
import Skeleton from "@/components/motion/Skeleton";
import { showToast } from "@/components/Toast";
import DishRecipeModal from "@/components/hospitality/DishRecipeModal";
import { DISH_CATEGORIES, type Dish } from "@/lib/hospitality";
import {
  INGREDIENT_CATEGORIES, ingredientCategoryLabel, ingredientCategoryExample,
  ingredientCategoryUnit, ingredientCategoryUnits, recipeCost, unitLabel,
  type Ingredient, type IngredientUnit, type RecipeItem,
} from "@/lib/recipes";

type RecipeRow = { id: string; dish_id: string; ingredient_id: string; quantity: number; unit: string };

export default function IngredientsPage() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [recipes, setRecipes] = useState<RecipeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [openCat, setOpenCat] = useState<string | null>(null);     // alapanyag-kategória (modal)
  const [openDishCat, setOpenDishCat] = useState<string | null>(null); // étel-kategória (lenyíló)
  const [applying, setApplying] = useState(false);

  // A recept szerinti önköltség beírása az étel tárolt árába (a szerver újraszámolja).
  // A tárolt ár CSAK így változik — az áremelés a partner döntése marad.
  const applyCost = async (dishIds: string[], target: "etlap" | "menu") => {
    if (!dishIds.length) return;
    setApplying(true);
    try {
      const res = await fetch("/api/hospitality/recipes/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dish_ids: dishIds, target }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error ?? "A frissítés nem sikerült.", "error"); return; }
      const map = new Map<string, number>((data.updated ?? []).map((u: { dish_id: string; cost: number }) => [u.dish_id, u.cost]));
      setDishes((prev) =>
        prev.map((d) =>
          map.has(d.id)
            ? { ...d, [target === "menu" ? "menu_cost_price" : "cost_price"]: map.get(d.id) as number }
            : d
        )
      );
      showToast(`${map.size} étel ${target === "menu" ? "menü-költsége" : "étlap-ára"} frissítve.`, "success");
    } catch {
      showToast("Hálózati hiba. Próbáld újra.", "error");
    } finally {
      setApplying(false);
    }
  };

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

  // Receptek ételenként (a felugró ablak ebből tölti be a szerkesztőt).
  const recipesByDish = useMemo(() => {
    const byDish = new Map<string, RecipeItem[]>();
    for (const r of recipes) {
      const arr = byDish.get(r.dish_id) ?? [];
      arr.push({ ingredient_id: r.ingredient_id, quantity: r.quantity, unit: r.unit });
      byDish.set(r.dish_id, arr);
    }
    return byDish;
  }, [recipes]);

  // Recept-költség ételenként.
  const costByDish = useMemo(() => {
    const out = new Map<string, { cost: number; items: number }>();
    for (const [dishId, items] of recipesByDish) {
      out.set(dishId, { cost: recipeCost(items, ingredients), items: items.length });
    }
    return out;
  }, [recipesByDish, ingredients]);

  // Az ablakban mentett recept azonnal frissüljön a lapon is (újratöltés nélkül).
  const onRecipeSaved = (dishId: string, items: RecipeItem[]) => {
    setRecipes((prev) => [
      ...prev.filter((r) => r.dish_id !== dishId),
      ...items.map((it, i) => ({ id: `${dishId}-${i}`, dish_id: dishId, ...it })),
    ]);
  };

  // Azok az ételek, ahol a tárolt étlap-ár eltér a recept szerinti önköltségtől.
  const staleEtlap = useMemo(
    () =>
      dishes.filter((d) => {
        const rc = costByDish.get(d.id);
        return rc && d.cost_price != null && Math.abs(rc.cost - d.cost_price) >= 1;
      }),
    [dishes, costByDish]
  );

  const dishGroups = useMemo(
    () =>
      DISH_CATEGORIES.map((c) => ({
        cat: c.value as string,
        label: c.label,
        items: dishes.filter((d) => d.category === c.value),
      })).filter((g) => g.items.length),
    [dishes]
  );

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
          {/* ================= ALAPANYAG-KATEGÓRIÁK ================= */}
          <section className="space-y-2">
            <div>
              <h2 className="font-display text-lg font-medium">Alapanyagok</h2>
              <p className="text-sm" style={{ color: "var(--twx-ink-muted)" }}>
                Kattints egy kategóriára, és vedd fel a beszerzési árakat. Az árat mindig az alap-egységre add meg
                (pl. <b>marhalábszár — 4 200 Ft/kg</b>); a hulladék% a tisztításkor elvesző részt pótolja.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {INGREDIENT_CATEGORIES.map((c) => {
                const count = ingredients.filter((i) => (i.category ?? "egyeb") === c.value).length;
                return (
                  <button
                    key={c.value}
                    onClick={() => setOpenCat(c.value)}
                    className="twx-card flex flex-col gap-1 p-4 text-left transition hover:shadow-md"
                  >
                    <span className="font-display text-base font-medium">{c.label}</span>
                    <span className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                      {count > 0 ? `${count} alapanyag` : "még üres"}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* ================= ÉTEL-KATEGÓRIÁK ================= */}
          <section className="space-y-2">
            <div>
              <h2 className="font-display text-lg font-medium">Ételek recept-önköltsége</h2>
              <p className="text-sm" style={{ color: "var(--twx-ink-muted)" }}>
                Kattints egy kategóriára: felugrik az ott mentett ételek listája, és ételenként megadhatod, melyik
                alapanyagból mennyi kell <b>egy adaghoz</b>. A rendszer azonnal számolja az adag-költséget. A tárolt ár
                csak akkor változik, ha te frissíted — az eladási ár emelése továbbra is a te döntésed.
              </p>
            </div>

            {staleEtlap.length > 0 && (
              <div className="twx-card flex flex-wrap items-center justify-between gap-3 p-4">
                <span className="text-sm">
                  <b>{staleEtlap.length}</b> ételnél eltér a recept szerinti önköltség a tárolt étlap-ártól.
                </span>
                <button
                  onClick={() => applyCost(staleEtlap.map((d) => d.id), "etlap")}
                  disabled={applying}
                  className="rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  style={{ background: "var(--twx-coral)" }}
                >
                  {applying ? "Frissítés…" : "Összes étlap-ár frissítése"}
                </button>
              </div>
            )}

            {dishGroups.length ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {dishGroups.map((g) => {
                    const withRecipe = g.items.filter((d) => costByDish.has(d.id)).length;
                    return (
                      <button
                        key={g.cat}
                        onClick={() => setOpenDishCat(g.cat)}
                        className="twx-card flex flex-col gap-1 p-4 text-left transition hover:shadow-md"
                      >
                        <span className="font-display text-base font-medium">{g.label}</span>
                        <span className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                          {g.items.length} étel{withRecipe > 0 ? ` · ${withRecipe} recepttel` : ""}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <p className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                  A zárójeles érték az eltérés a tárolt önköltséghez képest. Pirosan: a recept drágább, mint amivel az
                  étel el van mentve.
                </p>
              </div>
            ) : (
              <div className="twx-card p-4 text-sm" style={{ color: "var(--twx-ink-muted)" }}>
                Még nincs ételed. Vidd fel őket a Kínálat kezelőben — utána itt tudod megadni hozzájuk a receptet.
              </div>
            )}
          </section>
        </>
      )}

      {/* Étel-kategória ablak: receptek megadása ételenként */}
      <AnimatePresence>
        {openDishCat && (
          <DishRecipeModal
            key={openDishCat}
            label={dishGroups.find((g) => g.cat === openDishCat)?.label ?? "Ételek"}
            dishes={dishGroups.find((g) => g.cat === openDishCat)?.items ?? []}
            ingredients={ingredients}
            recipesByDish={recipesByDish}
            onRecipeSaved={onRecipeSaved}
            onApplyCost={applyCost}
            onClose={() => setOpenDishCat(null)}
          />
        )}
      </AnimatePresence>


      {/* Alapanyag-kategória szerkesztő ablak */}
      <AnimatePresence>
        {openCat && (
          <CategoryModal
            key={openCat}
            category={openCat}
            ingredients={ingredients}
            onChange={setIngredients}
            onNavigate={(cat) => setOpenCat(cat)}
            onClose={() => setOpenCat(null)}
          />
        )}
      </AnimatePresence>
    </main>
  );
}

// =============================================================================
// Felugró ablak: egy alapanyag-kategória tételeinek szerkesztése
// =============================================================================
type Row = { id?: string; name: string; unit: IngredientUnit; unit_price: string; waste_pct: string };

function CategoryModal({
  category, ingredients, onChange, onNavigate, onClose,
}: {
  category: string;
  ingredients: Ingredient[];
  onChange: (all: Ingredient[]) => void;
  onNavigate: (cat: string) => void;
  onClose: () => void;
}) {
  const idx = INGREDIENT_CATEGORIES.findIndex((c) => c.value === category);
  const prev = INGREDIENT_CATEGORIES[(idx - 1 + INGREDIENT_CATEGORIES.length) % INGREDIENT_CATEGORIES.length];
  const next = INGREDIENT_CATEGORIES[(idx + 1) % INGREDIENT_CATEGORIES.length];

  const [rows, setRows] = useState<Row[]>(() =>
    ingredients
      .filter((i) => (i.category ?? "egyeb") === category)
      .map((i) => ({ id: i.id, name: i.name, unit: i.unit, unit_price: String(i.unit_price ?? ""), waste_pct: String(i.waste_pct ?? 0) }))
  );
  const [saving, setSaving] = useState(false);

  const setRow = (i: number, patch: Partial<Row>) =>
    setRows((s) => s.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  // Új sor a kategóriában jellemző mértékegységgel (zöldség → kg, ital → liter, egyéb → db).
  const addRow = () =>
    setRows((s) => [...s, { name: "", unit: ingredientCategoryUnit(category), unit_price: "", waste_pct: "" }]);

  const removeRow = async (i: number) => {
    const row = rows[i];
    setRows((s) => s.filter((_, j) => j !== i));
    if (row.id) {
      const res = await fetch(`/api/hospitality/ingredients?id=${row.id}`, { method: "DELETE" });
      if (res.ok) onChange(ingredients.filter((x) => x.id !== row.id));
      else showToast("Törlés sikertelen.", "error");
    }
  };

  // Új sorok mentése (POST) + a módosultak frissítése (PATCH).
  const save = async (): Promise<boolean> => {
    setSaving(true);
    try {
      let all = [...ingredients];
      for (const r of rows) {
        if (!r.name.trim()) continue;
        const payload = {
          name: r.name.trim(), unit: r.unit,
          unit_price: r.unit_price, waste_pct: r.waste_pct || 0, category,
        };
        if (r.id) {
          const orig = ingredients.find((x) => x.id === r.id);
          const unchanged =
            orig && orig.name === payload.name && orig.unit === r.unit &&
            String(orig.unit_price) === String(Number(r.unit_price) || 0) &&
            String(orig.waste_pct) === String(Number(r.waste_pct) || 0);
          if (unchanged) continue;
          const res = await fetch("/api/hospitality/ingredients", {
            method: "PATCH", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: r.id, ...payload }),
          });
          const data = await res.json();
          if (!res.ok) { showToast(data.error ?? "Mentés sikertelen.", "error"); return false; }
          all = all.map((x) => (x.id === r.id ? data.ingredient : x));
        } else {
          const res = await fetch("/api/hospitality/ingredients", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          const data = await res.json();
          if (!res.ok) { showToast(data.error ?? "Mentés sikertelen.", "error"); return false; }
          all = [...all, data.ingredient];
        }
      }
      onChange(all.sort((a, b) => a.name.localeCompare(b.name, "hu")));
      return true;
    } catch {
      showToast("Hálózati hiba. Próbáld újra.", "error");
      return false;
    } finally {
      setSaving(false);
    }
  };

  // Kategóriaváltás előtt mentünk, hogy ne vesszen el a bevitt adat.
  const goTo = async (cat: string) => {
    const ok = await save();
    if (ok) onNavigate(cat);
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
        {/* Fejléc nyilakkal */}
        <div className="flex items-center justify-between gap-3 border-b p-4" style={{ borderColor: "var(--twx-line)" }}>
          <button onClick={() => goTo(prev.value)} className="rounded-lg px-2 py-1 text-lg" style={{ color: "var(--twx-coral)" }} title={prev.label}>‹</button>
          <div className="text-center">
            <div className="font-display text-lg font-semibold">{ingredientCategoryLabel(category)}</div>
            <div className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>{rows.length} tétel · nyilakkal válthatsz kategóriát</div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => goTo(next.value)} className="rounded-lg px-2 py-1 text-lg" style={{ color: "var(--twx-coral)" }} title={next.label}>›</button>
            <button onClick={onClose} className="rounded-lg px-2 py-1 text-xl" style={{ color: "var(--twx-ink-muted)" }} aria-label="Bezár">×</button>
          </div>
        </div>

        {/* Sorok */}
        <div className="flex-1 space-y-2 overflow-y-auto p-4">
          {rows.length === 0 && (
            <p className="text-sm" style={{ color: "var(--twx-ink-muted)" }}>
              Ebben a kategóriában még nincs alapanyag. Add hozzá az elsőt lentebb.
            </p>
          )}
          {rows.map((r, i) => (
            <div key={r.id ?? `new-${i}`} className="flex flex-wrap items-end gap-2">
              <div className="min-w-[150px] flex-1">
                <input
                  value={r.name} onChange={(e) => setRow(i, { name: e.target.value })}
                  placeholder={ingredientCategoryExample(category)}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  style={{ borderColor: "var(--twx-line)", background: "var(--twx-cream-card)" }}
                />
              </div>
              <select
                value={r.unit} onChange={(e) => setRow(i, { unit: e.target.value as IngredientUnit })}
                className="box-border h-[38px] rounded-lg border px-2 py-2 text-sm"
                style={{ borderColor: "var(--twx-line)", background: "var(--twx-cream-card)" }}
              >
                {/* Csak a kategóriában értelmes egységek — plusz a sor jelenlegi értéke,
                    hogy egy korábban máshogy rögzített tétel se essen ki a listából. */}
                {Array.from(new Set([...ingredientCategoryUnits(category), r.unit])).map((u) => (
                  <option key={u} value={u}>{unitLabel(u)}</option>
                ))}
              </select>
              <div className="w-28">
                <input
                  inputMode="numeric" value={r.unit_price} onChange={(e) => setRow(i, { unit_price: e.target.value })}
                  placeholder={`Ft/${unitLabel(r.unit)}`}
                  className="w-full rounded-lg border px-3 py-2 text-right text-sm"
                  style={{ borderColor: "var(--twx-line)", background: "var(--twx-cream-card)" }}
                />
              </div>
              <div className="w-20">
                <input
                  inputMode="numeric" value={r.waste_pct} onChange={(e) => setRow(i, { waste_pct: e.target.value })}
                  placeholder="hull.%"
                  className="w-full rounded-lg border px-3 py-2 text-right text-sm"
                  style={{ borderColor: "var(--twx-line)", background: "var(--twx-cream-card)" }}
                />
              </div>
              <button onClick={() => removeRow(i)} className="text-lg" style={{ color: "var(--twx-ink-muted)" }} aria-label="Törlés">×</button>
            </div>
          ))}
          <button onClick={addRow} className="text-sm font-medium" style={{ color: "var(--twx-coral)" }}>
            + Alapanyag hozzáadása
          </button>
        </div>

        {/* Lábléc */}
        <div className="flex items-center justify-between gap-3 border-t p-4" style={{ borderColor: "var(--twx-line)" }}>
          <span className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>Az ár az alap-egységre értendő (kg / liter / darab).</span>
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-xl px-4 py-2 text-sm font-medium" style={{ border: "1px solid var(--twx-line)", color: "var(--twx-ink-muted)" }}>Bezár</button>
            <button
              onClick={async () => { const ok = await save(); if (ok) { showToast("Alapanyagok mentve.", "success"); onClose(); } }}
              disabled={saving}
              className="rounded-xl px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
              style={{ background: "var(--twx-coral)" }}
            >
              {saving ? "Mentés…" : "Mentés és vissza"}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
