// MenuDishBlock — a Kínálat kezelő MENÜS ételek blokkja (az étlapos ételek alatt).
// A menüs étel külön entitás: nagy szériában készül. A partner megadja, hogy egy KÖTEGHEZ
// mennyi alapanyag kell, és abból HÁNY adag jön ki (menu_yield). Egy adag önköltsége =
// köteg alapanyagköltsége ÷ adagszám → a szerver számolja és a menu_cost_price-ba írja.
// A beszerzési ár ugyanaz a közös árlista (nem külön menüs ár).
"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { showToast } from "@/components/Toast";
import SelectField from "@/components/SelectField";
import { DISH_CATEGORIES, categoryLabel, formatHuf, type Dish } from "@/lib/hospitality";
import {
  ENTRY_UNITS, DEFAULT_ENTRY_UNIT, INGREDIENT_UNITS, INGREDIENT_CATEGORIES,
  itemCost, recipeCost, unitLabel,
  type Ingredient, type IngredientUnit, type RecipeItem,
} from "@/lib/recipes";

type RecipeRow = {
  id: string; dish_id: string; ingredient_id: string | null; quantity: number; unit: string;
  custom_name?: string | null; custom_unit?: IngredientUnit | null;
  custom_unit_price?: number | null; custom_waste_pct?: number | null;
};

const EMPTY = { name: "", category: "foetel", cuisine_style: "", menu_yield: "" };

// A menübe kerülő kategóriák — az ital NEM megy menübe (az csak étlapos).
const MENU_CATEGORIES = DISH_CATEGORIES.filter((c) => c.value !== "ital");

// Menüs színvilág — meleg arany/borostyán, ami elkülöníti a korall étlapostól,
// de illik a TWINX meleg palettájához.
const MENU = {
  accent: "#b07d1e",
  soft: "rgba(176,125,30,0.10)",
  softer: "rgba(176,125,30,0.06)",
  line: "rgba(176,125,30,0.30)",
  ink: "#6b4a10",
};

export default function MenuDishBlock({
  menuDishes, etlapDishes, onChange,
}: {
  menuDishes: Dish[];
  etlapDishes: Dish[];
  onChange: (updater: (prev: Dish[]) => Dish[]) => void;
}) {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [recipes, setRecipes] = useState<RecipeRow[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ ...EMPTY });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [editDish, setEditDish] = useState<Dish | null>(null);
  const [openCat, setOpenCat] = useState<string | null>(null); // felugró: egy kategória menüs ételei
  // Új menüs étel indítható étlapos ételből: csak a nevet/kategóriát vesszük át, a receptet NEM
  // (a menüs elkészítés más — nagy széria, saját kötegrecept).
  const [sourceId, setSourceId] = useState("");

  useEffect(() => {
    (async () => {
      const [iRes, rRes] = await Promise.all([
        fetch("/api/hospitality/ingredients"),
        fetch("/api/hospitality/recipes"),
      ]);
      const i = await iRes.json();
      const r = await rRes.json();
      if (iRes.ok) setIngredients(i.ingredients ?? []);
      if (rRes.ok) setRecipes(r.items ?? []);
    })();
  }, []);

  const recipesByDish = useMemo(() => {
    const m = new Map<string, RecipeItem[]>();
    for (const r of recipes) {
      const arr = m.get(r.dish_id) ?? [];
      arr.push({
        ingredient_id: r.ingredient_id, quantity: r.quantity, unit: r.unit,
        custom_name: r.custom_name ?? null, custom_unit: r.custom_unit ?? null,
        custom_unit_price: r.custom_unit_price ?? null, custom_waste_pct: r.custom_waste_pct ?? 0,
      });
      m.set(r.dish_id, arr);
    }
    return m;
  }, [recipes]);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  // Étlapos étel kiválasztása magvetőnek: átvesszük a nevét, kategóriáját, konyhatípusát.
  const pickSource = (id: string) => {
    setSourceId(id);
    const src = etlapDishes.find((d) => d.id === id);
    if (src) {
      setForm((f) => ({
        ...f,
        name: f.name || src.name,
        category: src.category,
        cuisine_style: src.cuisine_style ?? "",
      }));
    }
  };

  const addMenuDish = async () => {
    setErrors({});
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("is_menu", "1");
      fd.append("name", form.name);
      fd.append("category", form.category);
      fd.append("cuisine_style", form.cuisine_style);
      fd.append("menu_yield", form.menu_yield);
      const res = await fetch("/api/hospitality/dishes", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        if (data.errors) setErrors(data.errors);
        showToast(data.error ?? "Nem sikerült menteni.", "error");
        return;
      }
      onChange((prev) => [data.dish, ...prev]);
      showToast("Menüs étel hozzáadva. Most add meg a kötegreceptjét.", "success");
      // A menüs recept MÁS, mint az étlapos — csak a nevet/kategóriát vesszük át, a receptet NEM.
      setForm({ ...EMPTY });
      setSourceId("");
      setEditDish(data.dish); // rögtön nyíljon a recept-szerkesztő
    } catch {
      showToast("Hálózati hiba. Próbáld újra.", "error");
    } finally {
      setSaving(false);
    }
  };

  const removeDish = async (id: string) => {
    onChange((prev) => prev.filter((d) => d.id !== id));
    const res = await fetch(`/api/hospitality/dishes?id=${id}`, { method: "DELETE" });
    if (!res.ok) showToast("Nem sikerült törölni.", "error");
  };

  const onRecipeSaved = (dishId: string, items: RecipeItem[], perUnit: number) => {
    setRecipes((prev) => [
      ...prev.filter((r) => r.dish_id !== dishId),
      ...items.map((it, i) => ({ id: `${dishId}-${i}`, dish_id: dishId, ...it })),
    ]);
    onChange((prev) => prev.map((d) => (d.id === dishId ? { ...d, menu_cost_price: perUnit } : d)));
  };

  const catCount = (cat: string) => menuDishes.filter((d) => d.category === cat).length;

  return (
    <section className="space-y-3 rounded-2xl p-4 sm:p-5" style={{ background: MENU.softer, border: `1px solid ${MENU.line}` }}>
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
          style={{ background: MENU.soft, color: MENU.ink }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 4h16v4H4zM4 12h16M4 12v8M20 12v8M4 20h16" />
          </svg>
          Menüs ételek
        </span>
      </div>
      <p className="text-sm" style={{ color: "var(--twx-ink-muted)" }}>
        Nagy szériás fogások — ezek a napi menübe kerülnek, külön az étlapos ételeidtől. Add meg, egy köteghez
        mennyi alapanyag kell és abból hány adag jön ki, a rendszer kiszámolja egy adag önköltségét. Ezekből dolgozik
        a menü generátor.
      </p>

      {/* Új menüs étel */}
      <div className="overflow-hidden rounded-xl" style={{ background: "#fff", border: `1px solid ${MENU.line}` }}>
        <button type="button" onClick={() => setAddOpen((o) => !o)} className="flex w-full items-center justify-between p-5 text-left">
          <span className="font-display text-base font-medium">Új menüs étel felvitele</span>
          <span className="flex h-8 w-8 items-center justify-center rounded-full text-xl transition-transform duration-200"
            style={{ background: MENU.soft, color: MENU.accent, transform: addOpen ? "rotate(45deg)" : "none" }}>+</span>
        </button>
        <AnimatePresence initial={false}>
          {addOpen && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }} style={{ overflow: "hidden" }}>
              <div className="space-y-3 px-5 pb-5">
                {etlapDishes.length > 0 && (
                  <div className="rounded-lg p-3" style={{ background: MENU.softer, border: `1px solid ${MENU.line}` }}>
                    <label className="block text-sm font-medium">Étlapos ételből indulsz? (opcionális)</label>
                    <SelectField
                      className="mt-1 w-full"
                      value={sourceId}
                      onChange={pickSource}
                      placeholder="— nem, új ételt viszek fel —"
                      options={[
                        { value: "", label: "— nem, új ételt viszek fel —" },
                        ...etlapDishes.map((d) => ({ value: d.id, label: `${d.name} (${categoryLabel(d.category)})` })),
                      ]}
                    />
                    <p className="mt-1 text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                      Átvesszük a nevét és kategóriáját. A <b>receptet nem</b> — a menüs elkészítés más (nagy széria),
                      azt itt külön adod meg.
                    </p>
                  </div>
                )}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="block text-sm">Étel neve *</label>
                    <input value={form.name} onChange={(e) => set("name", e.target.value)} className="twx-input mt-1" placeholder="pl. Menüs gulyásleves" />
                    {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
                  </div>
                  <div>
                    <label className="block text-sm">Kategória *</label>
                    <SelectField
                      className="mt-1 w-full"
                      value={form.category}
                      onChange={(v) => set("category", v)}
                      options={MENU_CATEGORIES.map((c) => ({ value: c.value, label: c.label }))}
                    />
                    {errors.category && <p className="mt-1 text-xs text-red-600">{errors.category}</p>}
                  </div>
                  <div>
                    <label className="block text-sm">Hány adag jön ki egy kötegből? *</label>
                    <input type="number" min={1} value={form.menu_yield} onChange={(e) => set("menu_yield", e.target.value)} className="twx-input mt-1" placeholder="pl. 50" />
                    {errors.menu_yield && <p className="mt-1 text-xs text-red-600">{errors.menu_yield}</p>}
                  </div>
                </div>
                <p className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                  Az alapanyagokat a következő lépésben, a kötegrecepthez adod meg — a felvitt alapanyagaidból választva,
                  hogy 50 adaghoz melyikből mennyi kell.
                </p>
                <button onClick={addMenuDish} disabled={saving}
                  className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                  style={{ background: MENU.accent }}>
                  {saving ? "Mentés…" : "Hozzáadás + kötegrecept"}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Menüs ételeim — kategória-mappák (menüs, arany színvilággal) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-base font-medium" style={{ color: MENU.ink }}>Menüs ételeim</h3>
          <span className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>{menuDishes.length} db</span>
        </div>
        {/* A mappák ALAPBÓL látszanak (üresen is), hogy a partner lássa, hova mi kerül. */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {MENU_CATEGORIES.map((c) => {
            const n = catCount(c.value);
            return (
              <button key={c.value} onClick={() => setOpenCat(c.value)}
                className="flex flex-col items-start gap-2 rounded-2xl p-4 text-left transition-all hover:-translate-y-0.5"
                style={{ background: n ? MENU.soft : MENU.softer, border: `1px solid ${MENU.line}`, opacity: n ? 1 : 0.85 }}>
                <span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: "#fff", color: MENU.accent, border: `1px solid ${MENU.line}` }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
                  </svg>
                </span>
                <span className="font-medium" style={{ color: MENU.ink }}>{c.label}</span>
                <span className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                  {n ? `${n} menüs étel` : "még üres"}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Felugró: egy kategória menüs ételei */}
      <AnimatePresence>
        {openCat && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "rgba(30,20,6,0.45)" }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpenCat(null)}>
            <motion.div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl"
              style={{ background: "var(--twx-cream-card)", border: `1px solid ${MENU.line}`, boxShadow: "0 24px 60px rgba(30,20,6,0.28)" }}
              initial={{ scale: 0.95, opacity: 0, y: 12 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.96, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 26 }} onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between border-b p-4" style={{ borderColor: MENU.line, background: MENU.softer }}>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold" style={{ background: MENU.soft, color: MENU.ink }}>Menüs</span>
                  <div>
                    <div className="font-display text-lg font-semibold">{categoryLabel(openCat)}</div>
                    <div className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>{catCount(openCat)} menüs étel</div>
                  </div>
                </div>
                <button onClick={() => setOpenCat(null)} className="rounded-lg px-2 py-1 text-xl" style={{ color: "var(--twx-ink-muted)" }} aria-label="Bezár">×</button>
              </div>

              <div className="flex-1 space-y-2 overflow-y-auto p-4">
                {catCount(openCat) === 0 && (
                  <p className="text-sm" style={{ color: "var(--twx-ink-muted)" }}>
                    Ebbe a kategóriába még nincs menüs ételed. Vidd fel az elsőt az „Új menüs étel felvitele" résznél,
                    és állítsd be a kategóriáját erre.
                  </p>
                )}
                {menuDishes.filter((d) => d.category === openCat).map((d) => {
                  const items = recipesByDish.get(d.id) ?? [];
                  return (
                    <div key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3"
                      style={{ borderColor: MENU.line, background: "#fff" }}>
                      <button onClick={() => setEditDish(d)} className="min-w-0 flex-1 text-left">
                        <span className="font-medium">{d.name}</span>{" "}
                        <span className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                          · {d.menu_yield ?? "?"} adag/köteg{items.length ? ` · ${items.length} alapanyag` : " · nincs recept"}
                        </span>
                      </button>
                      <span className="flex flex-none items-center gap-3 text-sm">
                        {d.menu_cost_price != null
                          ? <b>{formatHuf(d.menu_cost_price)}<span className="text-xs font-normal" style={{ color: "var(--twx-ink-muted)" }}>/adag</span></b>
                          : <span className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>nincs önköltség</span>}
                        <button onClick={() => setEditDish(d)} className="text-xs font-medium underline" style={{ color: MENU.accent }}>
                          {items.length ? "Recept" : "Recept megadása"}
                        </button>
                        <button onClick={() => removeDish(d.id)} className="text-lg" style={{ color: "var(--twx-ink-muted)" }} aria-label="Törlés">×</button>
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-end border-t p-4" style={{ borderColor: MENU.line }}>
                <button onClick={() => setOpenCat(null)} className="rounded-xl px-5 py-2 text-sm font-semibold text-white" style={{ background: MENU.accent }}>
                  Bezár
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editDish && (
          <MenuBatchModal
            key={editDish.id}
            dish={editDish}
            ingredients={ingredients}
            initialItems={recipesByDish.get(editDish.id) ?? []}
            onIngredientAdded={(ing) => setIngredients((prev) => [...prev, ing].sort((a, b) => a.name.localeCompare(b.name, "hu")))}
            onSaved={onRecipeSaved}
            onClose={() => setEditDish(null)}
          />
        )}
      </AnimatePresence>
    </section>
  );
}

// =============================================================================
// Kötegrecept-szerkesztő: mennyiségek a KÖTEGRE; egy adag önköltsége = köteg ÷ adagszám.
// =============================================================================
type Row = {
  ingredient_id: string | null; name: string; quantity: string; unit: string;
  custom_unit: IngredientUnit; custom_unit_price: string; custom_waste_pct: string;
};
type Picker = { cat: string | null; q: string };
type Pending = { name: string; unit: IngredientUnit; price: string; waste: string };

function MenuBatchModal({
  dish, ingredients, initialItems, onIngredientAdded, onSaved, onClose,
}: {
  dish: Dish;
  ingredients: Ingredient[];
  initialItems: RecipeItem[];
  onIngredientAdded: (ing: Ingredient) => void;
  onSaved: (dishId: string, items: RecipeItem[], perUnit: number) => void;
  onClose: () => void;
}) {
  const byId = useMemo(() => new Map(ingredients.map((i) => [i.id, i])), [ingredients]);
  const [rows, setRows] = useState<Row[]>(() =>
    initialItems.map((i) => ({
      ingredient_id: i.ingredient_id,
      name: i.ingredient_id ? (byId.get(i.ingredient_id)?.name ?? "") : String(i.custom_name ?? ""),
      quantity: String(i.quantity), unit: i.unit,
      custom_unit: (i.custom_unit ?? "kg") as IngredientUnit,
      custom_unit_price: i.custom_unit_price != null ? String(i.custom_unit_price) : "",
      custom_waste_pct: i.custom_waste_pct ? String(i.custom_waste_pct) : "",
    }))
  );
  const [yieldStr, setYieldStr] = useState(String(dish.menu_yield ?? ""));
  const [picker, setPicker] = useState<Picker | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [saving, setSaving] = useState(false);

  const catGroups = useMemo(
    () => INGREDIENT_CATEGORIES.map((c) => ({
      value: c.value as string, label: c.label,
      items: ingredients.filter((i) => (i.category ?? "egyeb") === c.value),
    })).filter((g) => g.items.length),
    [ingredients]
  );

  const rowItem = (r: Row): RecipeItem => ({
    ingredient_id: r.ingredient_id,
    quantity: Number(r.quantity.replace(",", ".")) || 0,
    unit: r.unit,
    custom_name: r.ingredient_id ? null : r.name.trim() || null,
    custom_unit: r.custom_unit,
    custom_unit_price: Number(r.custom_unit_price.replace(",", ".")) || 0,
    custom_waste_pct: Number(r.custom_waste_pct.replace(",", ".")) || 0,
  });
  const toItems = () => rows.map(rowItem).filter((i) => (i.ingredient_id || i.custom_name) && i.quantity > 0);
  const rowCost = (r: Row) => itemCost(rowItem(r), r.ingredient_id ? byId.get(r.ingredient_id) : undefined);
  const batchCost = recipeCost(toItems(), ingredients);
  const yieldNum = Math.max(0, Math.floor(Number(yieldStr.replace(",", ".")) || 0));
  const perUnit = yieldNum > 0 ? batchCost / yieldNum : 0;

  const patchRow = (idx: number, patch: Partial<Row>) => setRows((s) => s.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  const usedIds = new Set(rows.map((r) => r.ingredient_id).filter(Boolean) as string[]);

  const pickIngredient = (ing: Ingredient) => {
    setRows((s) => [...s, {
      ingredient_id: ing.id, name: ing.name, quantity: "", unit: DEFAULT_ENTRY_UNIT[ing.unit],
      custom_unit: ing.unit, custom_unit_price: "", custom_waste_pct: "",
    }]);
    setPicker(null);
  };
  const keepCustom = () => {
    if (!pending) return;
    setRows((s) => [...s, {
      ingredient_id: null, name: pending.name, quantity: "", unit: DEFAULT_ENTRY_UNIT[pending.unit],
      custom_unit: pending.unit, custom_unit_price: pending.price || "0", custom_waste_pct: pending.waste,
    }]);
    setPending(null); setPicker(null);
  };
  const addToList = async () => {
    if (!pending) return;
    try {
      const res = await fetch("/api/hospitality/ingredients", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: pending.name, unit: pending.unit, unit_price: pending.price || 0, waste_pct: pending.waste || 0, category: "egyeb" }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error ?? "Nem sikerült felvenni.", "error"); return; }
      onIngredientAdded(data.ingredient as Ingredient);
      pickIngredient(data.ingredient as Ingredient);
      setPending(null);
      showToast(`„${data.ingredient.name}" bekerült az Egyéb kategóriába.`, "success");
    } catch { showToast("Hálózati hiba. Próbáld újra.", "error"); }
  };

  const pickerResults = (() => {
    if (!picker) return [];
    const q = picker.q.trim().toLowerCase();
    if (q) return ingredients.filter((i) => i.name.toLowerCase().includes(q)).slice(0, 60);
    if (picker.cat) return ingredients.filter((i) => (i.category ?? "egyeb") === picker.cat);
    return [];
  })();

  const save = async () => {
    if (yieldNum <= 0) { showToast("Add meg, hány adag jön ki egy kötegből.", "error"); return; }
    setSaving(true);
    try {
      const items = toItems();
      // A menü generátor „fő alapanyagai" a kötegrecept konkrét hozzávalóiból állnak össze —
      // nem szabadszövegből, hanem a ténylegesen kiválasztott alapanyagok neveiből.
      const mainIngredients = Array.from(
        new Set(
          rows
            .map((r) => (r.ingredient_id ? byId.get(r.ingredient_id)?.name : r.name) ?? "")
            .map((s) => s.trim())
            .filter(Boolean)
        )
      ).slice(0, 12).join(", ");

      // 1) adaghozam + fő alapanyagok mentése az ételre
      const fd = new FormData();
      fd.append("is_menu", "1");
      fd.append("id", dish.id);
      fd.append("name", dish.name);
      fd.append("category", dish.category);
      fd.append("cuisine_style", dish.cuisine_style ?? "");
      fd.append("main_ingredients", mainIngredients);
      fd.append("menu_yield", String(yieldNum));
      const dRes = await fetch("/api/hospitality/dishes", { method: "PATCH", body: fd });
      if (!dRes.ok) { const e = await dRes.json(); showToast(e.error ?? "Az adaghozam mentése nem sikerült.", "error"); return; }

      // 2) kötegrecept mentése
      const rRes = await fetch("/api/hospitality/recipes", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dish_id: dish.id, items }),
      });
      if (!rRes.ok) { const e = await rRes.json(); showToast(e.error ?? "A recept mentése nem sikerült.", "error"); return; }

      // 3) önköltség újraszámolása szerveroldalon (köteg ÷ adagszám)
      const aRes = await fetch("/api/hospitality/recipes/apply", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dish_ids: [dish.id], target: "menu_batch" }),
      });
      const aData = await aRes.json();
      const cost = aData.updated?.[0]?.cost ?? Math.round(perUnit);
      onSaved(dish.id, items, cost);
      showToast(`Kötegrecept mentve. Egy adag önköltsége: ${formatHuf(cost)}.`, "success");
      onClose();
    } catch {
      showToast("Hálózati hiba. Próbáld újra.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(20,12,8,0.45)" }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className="relative flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl"
        style={{ background: "var(--twx-cream-card)", border: "1px solid var(--twx-line)", boxShadow: "0 24px 60px rgba(0,0,0,0.25)" }}
        initial={{ scale: 0.95, opacity: 0, y: 12 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.96, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 26 }} onClick={(e) => e.stopPropagation()}>

        <div className="flex items-center justify-between border-b p-4" style={{ borderColor: "var(--twx-line)" }}>
          <div className="min-w-0">
            <div className="font-display text-lg font-semibold">{dish.name}</div>
            <div className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>{categoryLabel(dish.category)} · menüs (nagy széria)</div>
          </div>
          <button onClick={onClose} className="rounded-lg px-2 py-1 text-xl" style={{ color: "var(--twx-ink-muted)" }} aria-label="Bezár">×</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {/* Adaghozam */}
          <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl p-3" style={{ background: "var(--twx-coral-soft)" }}>
            <span className="text-sm font-medium" style={{ color: "#7a2e17" }}>Egy kötegből ennyi adag jön ki:</span>
            <input type="number" min={1} value={yieldStr} onChange={(e) => setYieldStr(e.target.value)}
              className="w-24 rounded-lg border px-3 py-1.5 text-right text-sm" style={{ borderColor: "var(--twx-line)", background: "#fff" }} placeholder="pl. 50" />
            <span className="text-sm" style={{ color: "#7a2e17" }}>adag</span>
          </div>

          <p className="mb-2 text-sm" style={{ color: "var(--twx-ink-muted)" }}>
            Alább az <b>egész kötegre</b> add meg az alapanyagokat (pl. 50 adaghoz 8 kg csirkemell).
          </p>

          <div className="space-y-2">
            {!rows.length && <p className="text-sm" style={{ color: "var(--twx-ink-muted)" }}>Még nincs hozzávaló. Add hozzá az elsőt lentebb.</p>}
            {rows.map((r, idx) => {
              const ing = r.ingredient_id ? byId.get(r.ingredient_id) : undefined;
              const base: IngredientUnit = ing ? ing.unit : r.custom_unit;
              const custom = !r.ingredient_id;
              return (
                <div key={idx} className="flex flex-wrap items-center gap-2 rounded-xl border p-2" style={{ borderColor: "var(--twx-line)", background: "#fff" }}>
                  <div className="min-w-[140px] flex-1">
                    <div className="text-sm font-medium">{r.name}</div>
                    <div className="text-[11px]" style={{ color: custom ? "var(--twx-coral)" : "var(--twx-ink-muted)" }}>
                      {custom ? `egyedi ár: ${formatHuf(Number(r.custom_unit_price.replace(",", ".")) || 0)}/${unitLabel(r.custom_unit)}` : ing ? `${formatHuf(ing.unit_price)}/${unitLabel(ing.unit)}` : ""}
                    </div>
                  </div>
                  <input inputMode="decimal" value={r.quantity} placeholder="0" onChange={(e) => patchRow(idx, { quantity: e.target.value })}
                    className="w-24 rounded-lg border px-3 py-2 text-right text-sm" style={{ borderColor: "var(--twx-line)", background: "#fff" }} />
                  <select value={r.unit} onChange={(e) => patchRow(idx, { unit: e.target.value })}
                    className="box-border h-[38px] rounded-lg border px-2 py-2 text-sm" style={{ borderColor: "var(--twx-line)", background: "#fff" }}>
                    {ENTRY_UNITS[base].map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
                  </select>
                  <span className="w-24 text-right text-sm" style={{ color: "var(--twx-ink-muted)" }}>{formatHuf(rowCost(r))}</span>
                  <button onClick={() => setRows((s) => s.filter((_, i) => i !== idx))} className="text-lg" style={{ color: "var(--twx-ink-muted)" }} aria-label="Sor törlése">×</button>
                </div>
              );
            })}
            <button onClick={() => setPicker({ cat: null, q: "" })} className="w-full rounded-xl border border-dashed px-4 py-2 text-sm font-medium"
              style={{ borderColor: "var(--twx-coral)", color: "var(--twx-coral)" }}>+ Hozzávaló</button>
          </div>
        </div>

        {/* Lábléc: köteg + egy adag */}
        <div className="space-y-3 border-t p-4" style={{ borderColor: "var(--twx-line)" }}>
          <div className="flex items-center justify-between rounded-xl p-3" style={{ background: "var(--twx-coral-soft)" }}>
            <div className="text-sm" style={{ color: "#7a2e17" }}>
              Köteg: <b>{formatHuf(batchCost)}</b>{yieldNum > 0 && <> · {yieldNum} adag</>}
            </div>
            <div className="text-right">
              <div className="text-xs" style={{ color: "#7a2e17" }}>Egy adag önköltsége</div>
              <div className="font-display text-2xl font-semibold" style={{ color: "#7a2e17" }}>{formatHuf(perUnit)}</div>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="rounded-xl px-4 py-2 text-sm font-medium" style={{ border: "1px solid var(--twx-line)", color: "var(--twx-ink-muted)" }}>Mégse</button>
            <button onClick={save} disabled={saving} className="rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" style={{ background: "var(--twx-coral)" }}>
              {saving ? "Mentés…" : "Mentés + önköltség"}
            </button>
          </div>
        </div>

        {/* Választó */}
        <AnimatePresence>
          {picker && !pending && (
            <motion.div className="absolute inset-0 z-10 flex items-end justify-center sm:items-center" style={{ background: "rgba(20,12,8,0.35)" }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setPicker(null)}>
              <motion.div className="m-4 flex max-h-[80%] w-full max-w-lg flex-col overflow-hidden rounded-2xl"
                style={{ background: "var(--twx-cream-card)", border: "1px solid var(--twx-line)", boxShadow: "0 16px 40px rgba(0,0,0,0.2)" }}
                initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 12, opacity: 0 }} onClick={(e) => e.stopPropagation()}>
                <div className="border-b p-3" style={{ borderColor: "var(--twx-line)" }}>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-display text-base font-semibold">
                      {picker.q.trim() ? "Találatok" : picker.cat ? INGREDIENT_CATEGORIES.find((c) => c.value === picker.cat)?.label : "Miből válasszunk?"}
                    </span>
                    <button onClick={() => setPicker(null)} className="text-xl" style={{ color: "var(--twx-ink-muted)" }} aria-label="Bezár">×</button>
                  </div>
                  <input autoFocus value={picker.q} placeholder="Keresés az alapanyagok között…" onChange={(e) => setPicker({ ...picker, q: e.target.value })}
                    className="w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--twx-line)", background: "#fff" }} />
                  {picker.cat && !picker.q.trim() && (
                    <button onClick={() => setPicker({ ...picker, cat: null })} className="mt-2 text-xs font-medium" style={{ color: "var(--twx-coral)" }}>‹ Vissza a kategóriákhoz</button>
                  )}
                </div>
                <div className="flex-1 overflow-y-auto p-3">
                  {!picker.q.trim() && !picker.cat && (
                    catGroups.length ? (
                      <div className="grid grid-cols-2 gap-2">
                        {catGroups.map((g) => (
                          <button key={g.value} onClick={() => setPicker({ cat: g.value, q: "" })} className="rounded-xl border p-3 text-left transition hover:shadow-sm"
                            style={{ borderColor: "var(--twx-line)", background: "#fff" }}>
                            <div className="text-sm font-medium">{g.label}</div>
                            <div className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>{g.items.length} alapanyag</div>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm" style={{ color: "var(--twx-ink-muted)" }}>Még nincs felvitt alapanyagod. Írd be a keresőbe a nevét, és itt helyben felveheted.</p>
                    )
                  )}
                  {(picker.q.trim() || picker.cat) && (
                    <div className="space-y-1">
                      {pickerResults.map((i) => {
                        const used = usedIds.has(i.id);
                        return (
                          <button key={i.id} disabled={used} onClick={() => pickIngredient(i)}
                            className="flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm transition hover:shadow-sm disabled:opacity-40"
                            style={{ borderColor: "var(--twx-line)", background: "#fff" }}>
                            <span>{i.name}{used && <span className="ml-1 text-xs" style={{ color: "var(--twx-ink-muted)" }}>· már a receptben</span>}</span>
                            <span className="flex-none text-xs" style={{ color: "var(--twx-ink-muted)" }}>{formatHuf(i.unit_price)}/{unitLabel(i.unit)}</span>
                          </button>
                        );
                      })}
                      {!pickerResults.length && <p className="text-sm" style={{ color: "var(--twx-ink-muted)" }}>Nincs találat.</p>}
                    </div>
                  )}
                </div>
                {picker.q.trim() && (
                  <div className="border-t p-3" style={{ borderColor: "var(--twx-line)" }}>
                    <button onClick={() => setPending({ name: picker.q.trim(), unit: "kg", price: "", waste: "" })}
                      className="w-full rounded-xl px-4 py-2 text-sm font-semibold" style={{ border: "1px solid var(--twx-coral)", color: "var(--twx-coral)" }}>
                      „{picker.q.trim()}" nincs a listában — felveszem
                    </button>
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Nincs a listában */}
        <AnimatePresence>
          {pending && (
            <motion.div className="absolute inset-0 z-20 flex items-center justify-center p-4" style={{ background: "rgba(20,12,8,0.45)" }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <motion.div className="w-full max-w-sm rounded-2xl p-4" style={{ background: "var(--twx-cream-card)", border: "1px solid var(--twx-line)", boxShadow: "0 16px 40px rgba(0,0,0,0.2)" }}
                initial={{ scale: 0.95, y: 8 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, opacity: 0 }}>
                <div className="font-display text-base font-semibold">„{pending.name}" felvitele</div>
                <p className="mt-1 text-xs" style={{ color: "var(--twx-ink-muted)" }}>Add meg, mennyiért szerzed be — enélkül nem tudjuk beszámolni.</p>
                <div className="mt-3 flex flex-wrap items-end gap-2">
                  <select value={pending.unit} onChange={(e) => setPending({ ...pending, unit: e.target.value as IngredientUnit })}
                    className="box-border h-[38px] rounded-lg border px-2 py-2 text-sm" style={{ borderColor: "var(--twx-line)", background: "#fff" }}>
                    {INGREDIENT_UNITS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
                  </select>
                  <input inputMode="numeric" value={pending.price} placeholder={`Ft/${unitLabel(pending.unit)}`} onChange={(e) => setPending({ ...pending, price: e.target.value })}
                    className="w-28 rounded-lg border px-3 py-2 text-right text-sm" style={{ borderColor: "var(--twx-line)", background: "#fff" }} />
                  <input inputMode="numeric" value={pending.waste} placeholder="hull.%" onChange={(e) => setPending({ ...pending, waste: e.target.value })}
                    className="w-20 rounded-lg border px-3 py-2 text-right text-sm" style={{ borderColor: "var(--twx-line)", background: "#fff" }} />
                </div>
                <div className="mt-4 space-y-2">
                  <button onClick={addToList} className="w-full rounded-xl px-4 py-2 text-sm font-semibold text-white" style={{ background: "var(--twx-coral)" }}>Felveszem az alapanyagok közé</button>
                  <button onClick={keepCustom} className="w-full rounded-xl px-4 py-2 text-sm font-semibold" style={{ border: "1px solid var(--twx-coral)", color: "var(--twx-coral)" }}>Csak ehhez az ételhez</button>
                  <button onClick={() => setPending(null)} className="w-full px-4 py-1 text-xs font-medium" style={{ color: "var(--twx-ink-muted)" }}>Mégse</button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
