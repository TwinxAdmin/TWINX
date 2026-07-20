// dashboard/hospitality/inventory — Kínálat Kezelő: a partner saját étel-adatbázisa.
// Étel felvitele (név, leírás, kategória, konyha-stílus, profitmarzs) + lista + törlés.
"use client";

import { useEffect, useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import ModuleIntro from "@/components/ModuleIntro";
import Skeleton from "@/components/motion/Skeleton";
import DishEditDrawer from "@/components/hospitality/DishEditDrawer";
import RecipeCalculator from "@/components/hospitality/RecipeCalculator";
import { showToast } from "@/components/Toast";
import { compressImage } from "@/lib/image-compress";
import type { RecipeItem } from "@/lib/recipes";
import {
  DISH_CATEGORIES,
  PROFIT_MARGINS,
  CUISINE_STYLES,
  categoryLabel,
  marginLabel,
  dishProfit,
  formatHuf,
  type Dish,
} from "@/lib/hospitality";

const EMPTY = { name: "", description: "", category: "foetel", cuisine_style: "", profit_margin: "", cost_price: "", sale_price: "", menu_cost_price: "", main_ingredients: "" };

export default function InventoryPage() {
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);
  // Recept-kalkulátor (opcionális segítség az önköltség kiszámolásához)
  const [calcOpen, setCalcOpen] = useState(false);
  const [recipeItems, setRecipeItems] = useState<RecipeItem[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [cuisineMode, setCuisineMode] = useState<"list" | "custom">("list");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [openCategory, setOpenCategory] = useState<string | null>(null);
  const [editDish, setEditDish] = useState<Dish | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  function pickImage(f: File | null) {
    if (f && !f.type.startsWith("image/")) {
      showToast("Csak képfájlt tölthetsz fel.", "error");
      return;
    }
    setImageFile(f);
    setImagePreview(f ? URL.createObjectURL(f) : null);
  }

  function resetForm() {
    setForm({ ...EMPTY });
    setImageFile(null);
    setImagePreview(null);
    setCuisineMode("list");
    setErrors({});
  }

  // Konyhatípusok: alaplista + a partner által korábban felvitt saját típusok.
  const cuisineOptions = Array.from(
    new Set<string>([...CUISINE_STYLES, ...dishes.map((d) => d.cuisine_style ?? "").filter(Boolean)])
  ).sort((a, b) => a.localeCompare(b, "hu"));

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

  function set(key: string, val: string) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  async function addDish(e: FormEvent) {
    e.preventDefault();
    setErrors({});
    setSaving(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      if (imageFile) fd.append("image", await compressImage(imageFile, 1400, 0.82));

      const res = await fetch("/api/hospitality/dishes", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        if (data.errors) setErrors(data.errors);
        showToast(data.error ?? "Nem sikerült menteni.", "error");
        return;
      }
      // Ha a kalkulátorban recept is készült, azt az étel létrejötte után mentjük.
      if (recipeItems.length) {
        await fetch("/api/hospitality/recipes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dish_id: data.dish.id, items: recipeItems }),
        }).catch(() => null);
      }
      setDishes((prev) => [data.dish, ...prev]);
      showToast("Étel hozzáadva.", "success");
      setRecipeItems([]);
      resetForm();
    } catch {
      showToast("Hálózati hiba. Próbáld újra.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function removeDish(id: string) {
    const prev = dishes;
    setDishes((d) => d.filter((x) => x.id !== id));
    const res = await fetch(`/api/hospitality/dishes?id=${id}`, { method: "DELETE" });
    if (!res.ok) {
      setDishes(prev);
      showToast("Nem sikerült törölni.", "error");
    } else {
      showToast("Étel törölve.", "info");
    }
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6">
      <ModuleIntro
        eyebrow="Vendéglátás · Kínálat"
        title="Kínálat kezelő"
        subtitle="Vidd fel az ételeidet a profitmarzzsal együtt — ez a saját, privát étlap-adatbázisod. A menü generátor kizárólag ezekből dolgozik, így az AI sosem talál ki nem létező fogást."
        icon="inventory"
        chips={["Privát adatbázis", "Profitmarzs", "RAG-forrás"]}
      />

      {/* Új étel */}
      <div className="twx-card overflow-hidden">
        <button
          type="button"
          onClick={() => setAddOpen((o) => !o)}
          className="flex w-full items-center justify-between p-5 text-left"
        >
          <span className="font-display text-lg font-medium">Új étel felvitele</span>
          <span
            className="flex h-8 w-8 items-center justify-center rounded-full text-xl transition-transform duration-200"
            style={{ background: "rgba(239,122,90,0.12)", color: "var(--twx-coral)", transform: addOpen ? "rotate(45deg)" : "none" }}
          >
            +
          </span>
        </button>
        <AnimatePresence initial={false}>
          {addOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              style={{ overflow: "hidden" }}
            >
              <form onSubmit={addDish} className="space-y-3 px-5 pb-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="block text-sm">Étel neve *</label>
            <input value={form.name} onChange={(e) => set("name", e.target.value)} className="twx-input mt-1" placeholder="pl. Gulyásleves" />
            {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm">Leírás (rövid, étlap-szerű)</label>
            <textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={2} className="twx-input mt-1" placeholder="pl. Tartalmas marhagulyás hagyományos recept szerint, friss csipetkével" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm">Fő alapanyagok (opcionális)</label>
            <input value={form.main_ingredients} onChange={(e) => set("main_ingredients", e.target.value)} className="twx-input mt-1" placeholder="pl. burgonya, marhahús, paprika (vesszővel)" />
            <p className="mt-1 text-xs" style={{ color: "var(--twx-ink-muted)" }}>
              Ezekből tud a rendszer alapanyag szerint menüt összeállítani (pl. „2 nap krumpli, 3 nap tészta").
            </p>
          </div>
          <div>
            <label className="block text-sm">Kategória *</label>
            <select value={form.category} onChange={(e) => set("category", e.target.value)} className="twx-input mt-1">
              {DISH_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
            {errors.category && <p className="mt-1 text-xs text-red-600">{errors.category}</p>}
          </div>
          <div>
            <label className="block text-sm">Konyha típusa *</label>
            {cuisineMode === "list" ? (
              <select
                value={form.cuisine_style}
                onChange={(e) => {
                  if (e.target.value === "__add__") { setCuisineMode("custom"); set("cuisine_style", ""); }
                  else set("cuisine_style", e.target.value);
                }}
                className="twx-input mt-1"
              >
                <option value="">— válassz —</option>
                {cuisineOptions.map((c) => (<option key={c} value={c}>{c}</option>))}
                <option value="__add__">+ Saját típus hozzáadása…</option>
              </select>
            ) : (
              <div className="mt-1 flex gap-2">
                <input value={form.cuisine_style} onChange={(e) => set("cuisine_style", e.target.value)} className="twx-input" placeholder="pl. libanoni, perui…" autoFocus />
                <button type="button" onClick={() => { setCuisineMode("list"); set("cuisine_style", ""); }} className="flex-none rounded-full px-3 text-sm" style={{ border: "1px solid var(--twx-line)", color: "var(--twx-ink-muted)" }}>
                  Lista
                </button>
              </div>
            )}
            {errors.cuisine_style && <p className="mt-1 text-xs text-red-600">{errors.cuisine_style}</p>}
          </div>

          <fieldset className="rounded-xl p-4 sm:col-span-2" style={{ border: "1px solid var(--twx-line)" }}>
            <legend className="px-2 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--twx-ink-muted)" }}>
              Árazás és profit
            </legend>
            <div
              className="mb-3 rounded-lg p-3 text-xs"
              style={{ background: "rgba(239,122,90,0.08)", border: "1px solid rgba(239,122,90,0.25)", color: "var(--twx-ink)" }}
            >
              <b>Miért két árazás?</b> Étlapról az étel kis szériában készül — ennek az önköltségét ki tudod számoltatni
              az Alapanyagok &amp; receptek fülön. Menübe viszont nagy mennyiségben, más adaggal megy, így az előállítása
              is más: ezt <b>te add meg</b> ide, mert te tudod, mennyibe kerül nagy szériában — a rendszer ezt nem
              találja ki helyetted. A napi menü árát az Önköltség moduljában állítod be. Elég az egyik oldalt kitölteni:
              ha nincs menü-költség, az étel nem megy menübe.
            </div>

            <button
              type="button"
              onClick={() => setCalcOpen(true)}
              className="mb-3 text-sm font-medium underline"
              style={{ color: "var(--twx-coral)" }}
            >
              Nem tudod fejből? Számoljuk ki az alapanyagokból
              {recipeItems.length > 0 && ` (${recipeItems.length} alapanyag felvive)`}
            </button>

            {/* ÉTLAP */}
            <div className="mb-3 rounded-lg p-3" style={{ border: "1px solid var(--twx-line)" }}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--twx-coral)" }}>Étlap (à la carte)</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-sm">Előkészítési ár (Ft)</label>
                  <input type="number" min={0} value={form.cost_price} onChange={(e) => set("cost_price", e.target.value)} className="twx-input mt-1" placeholder="pl. 800" />
                  {errors.cost_price && <p className="mt-1 text-xs text-red-600">{errors.cost_price}</p>}
                </div>
                <div>
                  <label className="block text-sm">Eladási ár (Ft)</label>
                  <input type="number" min={0} value={form.sale_price} onChange={(e) => set("sale_price", e.target.value)} className="twx-input mt-1" placeholder="pl. 2500" />
                  {errors.sale_price && <p className="mt-1 text-xs text-red-600">{errors.sale_price}</p>}
                </div>
                {form.cost_price && form.sale_price && !isNaN(Number(form.cost_price)) && !isNaN(Number(form.sale_price)) && (
                  <p className="text-sm sm:col-span-2" style={{ color: "var(--twx-coral)" }}>
                    Étlapos darab-profit: <b>{formatHuf(Number(form.sale_price) - Number(form.cost_price))}</b>
                  </p>
                )}
              </div>
            </div>

            {/* MENÜ */}
            <div className="mb-3 rounded-lg p-3" style={{ border: "1px solid var(--twx-line)" }}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--twx-coral)" }}>Menü (napi menü)</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-sm">Előállítási költség menüben (Ft)</label>
                  <input type="number" min={0} value={form.menu_cost_price} onChange={(e) => set("menu_cost_price", e.target.value)} className="twx-input mt-1" placeholder="pl. 550" />
                  <p className="mt-1 text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                    Te add meg: mennyibe kerül ez a fogás, ha nagy szériában, menübe készül. Ebből dolgozik a menü generátor.
                  </p>
                  {errors.menu_cost_price && <p className="mt-1 text-xs text-red-600">{errors.menu_cost_price}</p>}
                </div>
                {form.cost_price && form.menu_cost_price && !isNaN(Number(form.cost_price)) && !isNaN(Number(form.menu_cost_price)) && (
                  <p className="self-end text-sm" style={{ color: "var(--twx-ink-muted)" }}>
                    Megtakarítás az étlaposhoz képest: <b>{formatHuf(Number(form.cost_price) - Number(form.menu_cost_price))}</b>/adag
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="block text-sm">Profitmarzs (opcionális)</label>
                <select value={form.profit_margin} onChange={(e) => set("profit_margin", e.target.value)} className="twx-input mt-1">
                  <option value="">— nincs megadva —</option>
                  {PROFIT_MARGINS.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
                {errors.profit_margin && <p className="mt-1 text-xs text-red-600">{errors.profit_margin}</p>}
              </div>
            </div>
          </fieldset>
        </div>
        <div>
          <label className="block text-sm">Ételfotó (opcionális)</label>
          <p className="mb-2 text-xs" style={{ color: "var(--twx-ink-muted)" }}>
            A feltöltött kép ehhez az ételhez tartozik — később ebből dolgozik a menü dizájn.
          </p>
          <label
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); pickImage(e.dataTransfer.files?.[0] ?? null); }}
            className="flex cursor-pointer items-center gap-4 rounded-xl p-4 transition-colors"
            style={{
              border: `1.5px dashed ${dragOver ? "var(--twx-coral)" : "var(--twx-line)"}`,
              background: dragOver ? "rgba(239,122,90,0.06)" : "transparent",
            }}
          >
            {imagePreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imagePreview} alt="" className="h-16 w-16 flex-none rounded-lg object-cover" style={{ border: "1px solid var(--twx-line)" }} />
            ) : (
              <span className="flex h-16 w-16 flex-none items-center justify-center rounded-lg" style={{ background: "rgba(239,122,90,0.10)", color: "var(--twx-coral)" }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="16" rx="2" /><path d="m3 15 4-4 4 4 3-3 7 6" /><circle cx="8.5" cy="9" r="1.5" />
                </svg>
              </span>
            )}
            <div className="min-w-0">
              <span className="block text-sm font-medium" style={{ color: "var(--twx-ink)" }}>
                {imagePreview ? "Kép kiválasztva — kattints másikért" : "Húzd ide a képet, vagy kattints a tallózáshoz"}
              </span>
              <span className="block text-xs" style={{ color: "var(--twx-ink-muted)" }}>PNG, JPG vagy WEBP</span>
            </div>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => pickImage(e.target.files?.[0] ?? null)}
            />
          </label>
          {imagePreview && (
            <button
              type="button"
              onClick={() => pickImage(null)}
              className="mt-2 text-sm"
              style={{ color: "var(--twx-ink-muted)" }}
            >
              Kép eltávolítása
            </button>
          )}
        </div>

        <button type="submit" disabled={saving} className="twx-btn">
          {saving ? "Mentés…" : "Étel hozzáadása"}
        </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Ételeim — kategória-mappák */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-medium">Ételeim</h2>
          {!loading && <span className="text-sm" style={{ color: "var(--twx-ink-muted)" }}>{dishes.length} db</span>}
        </div>

        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {DISH_CATEGORIES.map((c) => {
              const count = dishes.filter((d) => d.category === c.value).length;
              return (
                <button
                  key={c.value}
                  onClick={() => { setOpenCategory(c.value); setEditDish(null); }}
                  className="twx-card flex flex-col items-start gap-2 p-4 text-left transition-all hover:-translate-y-0.5"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: "rgba(239,122,90,0.12)", color: "var(--twx-coral)" }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
                    </svg>
                  </span>
                  <span className="font-medium">{c.label}</span>
                  <span className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>{count} étel</span>
                </button>
              );
            })}
          </div>
        )}
        {!loading && dishes.length === 0 && (
          <p className="text-sm" style={{ color: "var(--twx-ink-muted)" }}>
            Még nincs ételed. Vidd fel az elsőt fentebb — a rendszer a kategóriájának megfelelő mappába rendezi.
          </p>
        )}
      </div>

      {/* Kategória felugró ablak — a lista végig látszik, egy ételre kattintva
          a jobboldali panel nyílik (nem tűnik el a többi étel). */}
      {openCategory && (
        <div
          onClick={() => { setOpenCategory(null); setEditDish(null); }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(12,11,10,0.6)" }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="twx-card max-h-[85vh] w-full max-w-md overflow-y-auto p-5"
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="font-display text-lg font-medium">{categoryLabel(openCategory)}</h3>
              <button
                onClick={() => { setOpenCategory(null); setEditDish(null); }}
                aria-label="Bezárás"
                className="flex h-8 w-8 items-center justify-center rounded-full text-lg"
                style={{ border: "1px solid var(--twx-line)", color: "var(--twx-ink-muted)" }}
              >
                ×
              </button>
            </div>

            {(() => {
              const inCat = dishes.filter((d) => d.category === openCategory);
              return inCat.length === 0 ? (
                <p className="text-sm" style={{ color: "var(--twx-ink-muted)" }}>Nincs étel ebben a kategóriában.</p>
              ) : (
                <ul className="space-y-1">
                  {inCat.map((d) => {
                    const active = editDish?.id === d.id;
                    const profit = dishProfit(d);
                    const meta = [
                      d.profit_margin ? `${marginLabel(d.profit_margin)} haszon` : null,
                      d.cuisine_style || null,
                      profit != null ? `+${formatHuf(profit)}/db` : null,
                    ].filter(Boolean).join(" · ");
                    return (
                      <li key={d.id}>
                        <button
                          onClick={() => setEditDish(d)}
                          className="flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors hover:bg-black/[0.03]"
                          style={active ? { background: "rgba(239,122,90,0.10)", boxShadow: "inset 0 0 0 1px var(--twx-coral)" } : undefined}
                        >
                          {d.image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={d.image_url} alt="" className="h-11 w-11 flex-none rounded-lg object-cover" style={{ border: "1px solid var(--twx-line)" }} />
                          ) : (
                            <span className="h-11 w-11 flex-none rounded-lg" style={{ background: "var(--twx-line)" }} />
                          )}
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium">{d.name}</span>
                            <span className="block truncate text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                              {meta || "—"}
                            </span>
                          </span>
                          <span style={{ color: active ? "var(--twx-coral)" : "var(--twx-ink-muted)" }}>›</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              );
            })()}
          </div>
        </div>
      )}

      {/* Szerkesztő panel (oldalt beúszó) — a mentés után nyitva marad, mehetsz másik ételre */}
      <AnimatePresence>
        {editDish && (
          <DishEditDrawer
            key={editDish.id}
            dish={editDish}
            cuisineOptions={cuisineOptions}
            onClose={() => setEditDish(null)}
            onSaved={(updated) => {
              setDishes((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
              setEditDish(updated); // nyitva marad a frissített adatokkal
            }}
            onDeleted={(id) => {
              removeDish(id);
              setEditDish(null);
            }}
          />
        )}
      </AnimatePresence>

      {/* Recept-kalkulátor (új étel felvitelekor) */}
      <AnimatePresence>
        {calcOpen && (
          <RecipeCalculator
            initialItems={recipeItems}
            onClose={() => setCalcOpen(false)}
            onApply={(cost, target, items) => {
              setRecipeItems(items);
              set(target === "etlap" ? "cost_price" : "menu_cost_price", String(cost));
              setCalcOpen(false);
              showToast(
                target === "etlap"
                  ? `Étlap-ár beírva: ${formatHuf(cost)}`
                  : `Menü-költség beírva: ${formatHuf(cost)}`,
                "success"
              );
            }}
          />
        )}
      </AnimatePresence>
    </main>
  );
}
