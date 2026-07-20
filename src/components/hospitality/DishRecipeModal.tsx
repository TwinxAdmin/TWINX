// DishRecipeModal — egy étel-kategória (pl. Főételek) ablaka.
// Két nézet: (1) a kategória ételei a recept szerinti önköltséggel, (2) egy kiválasztott
// étel RECEPTJE, ahol hozzávalónként megadható, mennyi kell EGY adaghoz.
//
// A hozzávalót NEM egy nagy legördülőből kell kikeresni: a „+ Hozzávaló" gomb egy
// VÁLASZTÓT nyit — kereső + kategória-kockák (Zöldség, Hús…) —, és csak a megnyitott
// kategória tételei látszanak. Ha a keresett név nincs a listában, ott helyben felvehető:
//   - „Csak ehhez az ételhez"  → a megadott ár EGYEDI, csak ennél az ételnél él
//   - „Felveszem a listába"    → bekerül a közös árlistába, az Egyéb kategóriába
"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { showToast } from "@/components/Toast";
import { formatHuf, type Dish } from "@/lib/hospitality";
import {
  ENTRY_UNITS, DEFAULT_ENTRY_UNIT, INGREDIENT_UNITS, INGREDIENT_CATEGORIES,
  itemCost, recipeCost, unitLabel,
  type Ingredient, type IngredientUnit, type RecipeItem,
} from "@/lib/recipes";

type Row = {
  ingredient_id: string | null;
  name: string;                 // a hozzávaló neve (választás után fix)
  quantity: string;
  unit: string;                 // bevitt egység (g/dkg/kg/ml/dl/l/db)
  custom_unit: IngredientUnit;  // egyedi hozzávaló alap-egysége
  custom_unit_price: string;    // egyedi ár (Ft / alap-egység)
  custom_waste_pct: string;
};

// A választó állapota: melyik kategória van nyitva, és mire keres.
type Picker = { cat: string | null; q: string };
// A „nincs a listában" felvitel állapota.
type Pending = { name: string; unit: IngredientUnit; price: string; waste: string };

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
  const [picker, setPicker] = useState<Picker | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [saving, setSaving] = useState(false);

  const byId = useMemo(() => new Map(ingredients.map((i) => [i.id, i])), [ingredients]);

  // Csak azok a kategóriák jelennek meg, ahol van felvitt alapanyag.
  const catGroups = useMemo(
    () =>
      INGREDIENT_CATEGORIES.map((c) => ({
        value: c.value as string,
        label: c.label,
        items: ingredients.filter((i) => (i.category ?? "egyeb") === c.value),
      })).filter((g) => g.items.length),
    [ingredients]
  );

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
    setPicker(null);
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

  // --- Hozzávaló hozzáadása ------------------------------------------------
  const usedIds = new Set(rows.map((r) => r.ingredient_id).filter(Boolean) as string[]);

  const pickIngredient = (ing: Ingredient) => {
    setRows((s) => [
      ...s,
      {
        ingredient_id: ing.id, name: ing.name, quantity: "", unit: DEFAULT_ENTRY_UNIT[ing.unit],
        custom_unit: ing.unit, custom_unit_price: "", custom_waste_pct: "",
      },
    ]);
    setPicker(null);
  };

  // 1) Csak ehhez az ételhez — az ár a recept-soron marad.
  const keepCustom = () => {
    if (!pending) return;
    setRows((s) => [
      ...s,
      {
        ingredient_id: null, name: pending.name, quantity: "", unit: DEFAULT_ENTRY_UNIT[pending.unit],
        custom_unit: pending.unit, custom_unit_price: pending.price || "0", custom_waste_pct: pending.waste,
      },
    ]);
    setPending(null);
    setPicker(null);
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
      pickIngredient(ing);
      setPending(null);
      showToast(`„${ing.name}" bekerült az Egyéb kategóriába.`, "success");
    } catch {
      showToast("Hálózati hiba. Próbáld újra.", "error");
    }
  };

  // --- Mentés ---------------------------------------------------------------
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

  const saveAndApply = async (target: "etlap" | "menu") => {
    if (!editDish) return;
    const ok = await saveRecipe();
    if (!ok) return;
    await onApplyCost([editDish.id], target);
    showToast("Recept mentve, önköltség beírva.", "success");
    setEditDish(null);
  };

  // A választóban megjelenő tételek: keresésnél mindenhonnan, egyébként a nyitott kategóriából.
  const pickerResults = (() => {
    if (!picker) return [];
    const q = picker.q.trim().toLowerCase();
    if (q) return ingredients.filter((i) => i.name.toLowerCase().includes(q)).slice(0, 60);
    if (picker.cat) return ingredients.filter((i) => (i.category ?? "egyeb") === picker.cat);
    return [];
  })();

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

              <div className="space-y-2">
                {!rows.length && (
                  <p className="text-sm" style={{ color: "var(--twx-ink-muted)" }}>
                    Még nincs hozzávaló. Add hozzá az elsőt lentebb.
                  </p>
                )}

                {rows.map((r, idx) => {
                  const ing = r.ingredient_id ? byId.get(r.ingredient_id) : undefined;
                  const base: IngredientUnit = ing ? ing.unit : r.custom_unit;
                  const custom = !r.ingredient_id;
                  return (
                    <div key={idx} className="flex flex-wrap items-center gap-2 rounded-xl border p-2"
                      style={{ borderColor: "var(--twx-line)", background: "#fff" }}>
                      <div className="min-w-[140px] flex-1">
                        <div className="text-sm font-medium">{r.name}</div>
                        <div className="text-[11px]" style={{ color: custom ? "var(--twx-coral)" : "var(--twx-ink-muted)" }}>
                          {custom
                            ? `egyedi ár: ${formatHuf(Number(r.custom_unit_price.replace(",", ".")) || 0)}/${unitLabel(r.custom_unit)} · csak ennél az ételnél`
                            : ing ? `${formatHuf(ing.unit_price)}/${unitLabel(ing.unit)}` : ""}
                        </div>
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

                <button
                  onClick={() => setPicker({ cat: null, q: "" })}
                  className="w-full rounded-xl border border-dashed px-4 py-2 text-sm font-medium"
                  style={{ borderColor: "var(--twx-coral)", color: "var(--twx-coral)" }}
                >
                  + Hozzávaló
                </button>
              </div>
            </>
          )}
        </div>

        {/* Lábléc */}
        {editDish ? (
          <div className="space-y-3 border-t p-4" style={{ borderColor: "var(--twx-line)" }}>
            <div className="flex items-center justify-between rounded-xl p-3" style={{ background: "var(--twx-coral-soft)" }}>
              <span className="text-sm font-medium" style={{ color: "#7a2e17" }}>Egy étlapos adag előállítási költsége</span>
              <span className="font-display text-2xl font-semibold" style={{ color: "#7a2e17" }}>{formatHuf(liveCost)}</span>
            </div>
            {/* Egy sorban, hogy átlátható maradjon: balra a kilépés, jobbra a három mentés. */}
            <div className="flex flex-nowrap items-center justify-end gap-2 whitespace-nowrap">
              <button onClick={() => setEditDish(null)} className="mr-auto rounded-xl px-3 py-2 text-xs font-medium"
                style={{ border: "1px solid var(--twx-line)", color: "var(--twx-ink-muted)" }}>
                Mégse
              </button>
              <button
                onClick={async () => { const ok = await saveRecipe(); if (ok) { showToast("Recept mentve.", "success"); setEditDish(null); } }}
                disabled={saving}
                className="rounded-xl px-3 py-2 text-xs font-semibold disabled:opacity-60"
                style={{ border: "1px solid var(--twx-coral)", color: "var(--twx-coral)" }}>
                {saving ? "Mentés…" : "Csak mentés"}
              </button>
              {/* A recept EGY előállítási költséget ad, és az az ÉTLAPOS önköltség.
                  A menüs költséget külön logika kezeli majd — ide nem keverjük bele. */}
              <button onClick={() => saveAndApply("etlap")} disabled={saving}
                className="rounded-xl px-3 py-2 text-xs font-semibold text-white disabled:opacity-60" style={{ background: "var(--twx-coral)" }}>
                Mentés + önköltség frissítése
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

        {/* ================= HOZZÁVALÓ-VÁLASZTÓ ================= */}
        <AnimatePresence>
          {picker && !pending && (
            <motion.div
              className="absolute inset-0 z-10 flex items-end justify-center sm:items-center"
              style={{ background: "rgba(20,12,8,0.35)" }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setPicker(null)}
            >
              <motion.div
                className="flex max-h-[80%] w-full max-w-lg flex-col overflow-hidden rounded-2xl m-4"
                style={{ background: "var(--twx-cream-card)", border: "1px solid var(--twx-line)", boxShadow: "0 16px 40px rgba(0,0,0,0.2)" }}
                initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 12, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="border-b p-3" style={{ borderColor: "var(--twx-line)" }}>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-display text-base font-semibold">
                      {picker.q.trim()
                        ? "Találatok"
                        : picker.cat
                          ? INGREDIENT_CATEGORIES.find((c) => c.value === picker.cat)?.label
                          : "Miből válasszunk?"}
                    </span>
                    <button onClick={() => setPicker(null)} className="text-xl" style={{ color: "var(--twx-ink-muted)" }} aria-label="Bezár">×</button>
                  </div>
                  <input
                    autoFocus value={picker.q} placeholder="Keresés az alapanyagok között…"
                    onChange={(e) => setPicker({ ...picker, q: e.target.value })}
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                    style={{ borderColor: "var(--twx-line)", background: "#fff" }}
                  />
                  {picker.cat && !picker.q.trim() && (
                    <button onClick={() => setPicker({ ...picker, cat: null })}
                      className="mt-2 text-xs font-medium" style={{ color: "var(--twx-coral)" }}>
                      ‹ Vissza a kategóriákhoz
                    </button>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto p-3">
                  {/* Kategória-kockák */}
                  {!picker.q.trim() && !picker.cat && (
                    catGroups.length ? (
                      <div className="grid grid-cols-2 gap-2">
                        {catGroups.map((g) => (
                          <button key={g.value} onClick={() => setPicker({ cat: g.value, q: "" })}
                            className="rounded-xl border p-3 text-left transition hover:shadow-sm"
                            style={{ borderColor: "var(--twx-line)", background: "#fff" }}>
                            <div className="text-sm font-medium">{g.label}</div>
                            <div className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>{g.items.length} alapanyag</div>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm" style={{ color: "var(--twx-ink-muted)" }}>
                        Még nincs felvitt alapanyagod. Írd be a keresőbe a hozzávaló nevét, és itt helyben felveheted.
                      </p>
                    )
                  )}

                  {/* Tételek (kategórián belül vagy keresésre) */}
                  {(picker.q.trim() || picker.cat) && (
                    <div className="space-y-1">
                      {pickerResults.map((i) => {
                        const used = usedIds.has(i.id);
                        return (
                          <button key={i.id} disabled={used} onClick={() => pickIngredient(i)}
                            className="flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm transition hover:shadow-sm disabled:opacity-40"
                            style={{ borderColor: "var(--twx-line)", background: "#fff" }}>
                            <span>
                              {i.name}
                              {used && <span className="ml-1 text-xs" style={{ color: "var(--twx-ink-muted)" }}>· már a receptben</span>}
                            </span>
                            <span className="flex-none text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                              {formatHuf(i.unit_price)}/{unitLabel(i.unit)}
                            </span>
                          </button>
                        );
                      })}
                      {!pickerResults.length && (
                        <p className="text-sm" style={{ color: "var(--twx-ink-muted)" }}>Nincs találat.</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Nincs a listában → felvitel */}
                {picker.q.trim() && (
                  <div className="border-t p-3" style={{ borderColor: "var(--twx-line)" }}>
                    <button
                      onClick={() => setPending({ name: picker.q.trim(), unit: "kg", price: "", waste: "" })}
                      className="w-full rounded-xl px-4 py-2 text-sm font-semibold"
                      style={{ border: "1px solid var(--twx-coral)", color: "var(--twx-coral)" }}
                    >
                      „{picker.q.trim()}" nincs a listában — felveszem
                    </button>
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ================= „NINCS A LISTÁBAN" KÉRDÉS ================= */}
        <AnimatePresence>
          {pending && (
            <motion.div
              className="absolute inset-0 z-20 flex items-center justify-center p-4"
              style={{ background: "rgba(20,12,8,0.45)" }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            >
              <motion.div
                className="w-full max-w-sm rounded-2xl p-4"
                style={{ background: "var(--twx-cream-card)", border: "1px solid var(--twx-line)", boxShadow: "0 16px 40px rgba(0,0,0,0.2)" }}
                initial={{ scale: 0.95, y: 8 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, opacity: 0 }}
              >
                <div className="font-display text-base font-semibold">„{pending.name}" felvitele</div>
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
                  <button onClick={() => setPending(null)}
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
