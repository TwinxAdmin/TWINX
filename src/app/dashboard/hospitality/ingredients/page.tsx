// dashboard/hospitality/ingredients — Alapanyagok (beszerzési árlista).
// Alapanyagok kategória-kockákban (zöldség, hús, tejtermék…): a kockára kattintva
// felugró ablakban lehet tételeket hozzáadni/szerkeszteni (mennyiség + teljes ár →
// egységár), nyilakkal lépkedve a kategóriák között.
// FONTOS: itt csak az ALAPANYAG-árlista van. A recepteket (melyik ételhez melyik
// alapanyagból mennyi kell) a Kínálat kezelőben, az adott ételnél adod meg.
"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import ModuleIntro from "@/components/ModuleIntro";
import Skeleton from "@/components/motion/Skeleton";
import { showToast } from "@/components/Toast";
import SelectField from "@/components/SelectField";
import {
  INGREDIENT_CATEGORIES, ingredientCategoryLabel, ingredientCategoryExample,
  ingredientCategoryUnit, ingredientCategoryUnits, unitLabel,
  type Ingredient, type IngredientUnit,
} from "@/lib/recipes";

export default function IngredientsPage() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [openCat, setOpenCat] = useState<string | null>(null);     // alapanyag-kategória (modal)

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

  return (
    <main className="mx-auto max-w-3xl space-y-6">
      <ModuleIntro
        eyebrow="Vendéglátás · Önköltség"
        title="Alapanyagok"
        subtitle="Vidd fel egy helyen, mennyiért szerzed be az alapanyagokat — mennyiség és teljes ár alapján (pl. 100 kg burgonya / 15 000 Ft), a rendszer kiszámolja az egységárat. Ez az árlista lesz az ételek önköltségének alapja. A recepteket — melyik ételhez melyik alapanyagból mennyi kell — a Kínálat kezelőben, az adott ételnél adod meg."
        icon="recipe"
        chips={["Beszerzési árak", "Mennyiség + teljes ár", "Egységár automatikusan"]}
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
                Kattints egy kategóriára, és vedd fel a beszerzési árakat úgy, ahogy vásárolsz: add meg a
                <b> mennyiséget és a teljes árat</b> (pl. <b>100 kg burgonya — 15 000 Ft</b>), a rendszer kiszámolja
                az egységárat (150 Ft/kg). Ha az ár hetente ingadozik, megadhatsz egy <b>legolcsóbb–legdrágább
                tartományt</b> is — ilyenkor az átlaggal számolunk. A hulladék% a tisztításkor elvesző részt pótolja.
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
        </>
      )}

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
// A partner úgy viszi fel, ahogy vásárol: mennyiség (qty) + teljes ár (total).
// Az ár ingadozhat, ezért megadható egy legdrágább ár is (totalMax, opcionális) — a
// számítás ilyenkor a legolcsóbb és legdrágább egységár ÁTLAGÁVAL dolgozik.
type Row = { id?: string; name: string; unit: IngredientUnit; qty: string; total: string; totalMax: string; waste_pct: string };
const parseNum = (s: string) => { const n = Number(String(s ?? "").replace(",", ".")); return isNaN(n) ? 0 : n; };
// Egységár-tartomány a sorból: min/max/átlag + van-e valódi tartomány.
const rowUnitPrices = (r: Row) => {
  const q = parseNum(r.qty);
  if (q <= 0) return { min: 0, max: 0, avg: 0, hasRange: false };
  const p1 = parseNum(r.total) / q;
  const maxTotal = parseNum(r.totalMax);
  if (maxTotal > 0) {
    const p2 = maxTotal / q;
    const lo = Math.min(p1, p2), hi = Math.max(p1, p2);
    return { min: lo, max: hi, avg: (lo + hi) / 2, hasRange: lo !== hi };
  }
  return { min: p1, max: p1, avg: p1, hasRange: false };
};
const fmtFt = (n: number) => Math.round(n).toLocaleString("hu-HU");

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
      .map((i) => ({
        id: i.id,
        name: i.name,
        unit: i.unit,
        // Ha van tárolt "csomag" (mennyiség + ár), azt mutatjuk; különben a régi egységárat
        // 1 egységre vetítve (pl. 150 Ft/kg → 1 kg = 150 Ft).
        qty: i.pack_qty != null ? String(i.pack_qty) : (i.unit_price ? "1" : ""),
        total: i.pack_price != null ? String(i.pack_price) : (i.unit_price ? String(i.unit_price) : ""),
        totalMax: i.pack_price_max != null ? String(i.pack_price_max) : "",
        waste_pct: String(i.waste_pct ?? 0),
      }))
  );
  const [saving, setSaving] = useState(false);

  const setRow = (i: number, patch: Partial<Row>) =>
    setRows((s) => s.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  // Új sor a kategóriában jellemző mértékegységgel (zöldség → kg, ital → liter, egyéb → db).
  const addRow = () =>
    setRows((s) => [...s, { name: "", unit: ingredientCategoryUnit(category), qty: "", total: "", totalMax: "", waste_pct: "" }]);

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
        const qtyStr = r.qty.trim() === "" ? "" : String(parseNum(r.qty));
        const totalStr = r.total.trim() === "" ? "" : String(parseNum(r.total));
        const totalMaxStr = r.totalMax.trim() === "" ? "" : String(parseNum(r.totalMax));
        const avgUnit = rowUnitPrices(r).avg;
        const payload = {
          name: r.name.trim(), unit: r.unit,
          unit_price: avgUnit, pack_qty: r.qty, pack_price: r.total, pack_price_max: r.totalMax,
          waste_pct: r.waste_pct || 0, category,
        };
        if (r.id) {
          const orig = ingredients.find((x) => x.id === r.id);
          const unchanged =
            orig && orig.name === payload.name && orig.unit === r.unit &&
            String(orig.pack_qty ?? "") === qtyStr &&
            String(orig.pack_price ?? "") === totalStr &&
            String(orig.pack_price_max ?? "") === totalMaxStr &&
            Number(orig.unit_price) === avgUnit &&
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
              {/* Beszerzés: mennyiség → egység → ár (tól) → ár (ig, opc.) → hull.% */}
              <div className="w-16">
                <input
                  inputMode="decimal" value={r.qty} onChange={(e) => setRow(i, { qty: e.target.value })}
                  placeholder="menny."
                  className="w-full rounded-lg border px-3 py-2 text-right text-sm"
                  style={{ borderColor: "var(--twx-line)", background: "var(--twx-cream-card)" }}
                />
              </div>
              {/* Csak a kategóriában értelmes egységek — plusz a sor jelenlegi értéke,
                  hogy egy korábban máshogy rögzített tétel se essen ki a listából. */}
              <SelectField
                className="w-24"
                value={r.unit}
                onChange={(v) => setRow(i, { unit: v as IngredientUnit })}
                searchable={false}
                options={Array.from(new Set([...ingredientCategoryUnits(category), r.unit])).map((u) => ({ value: u, label: unitLabel(u) }))}
              />
              <div className="w-24">
                <input
                  inputMode="decimal" value={r.total} onChange={(e) => setRow(i, { total: e.target.value })}
                  placeholder="ár Ft (-tól)"
                  className="w-full rounded-lg border px-3 py-2 text-right text-sm"
                  style={{ borderColor: "var(--twx-line)", background: "var(--twx-cream-card)" }}
                />
              </div>
              <div className="w-24">
                <input
                  inputMode="decimal" value={r.totalMax} onChange={(e) => setRow(i, { totalMax: e.target.value })}
                  placeholder="-ig (opc.)"
                  className="w-full rounded-lg border px-3 py-2 text-right text-sm"
                  style={{ borderColor: "var(--twx-line)", background: "var(--twx-cream-card)" }}
                />
              </div>
              <div className="w-14">
                <input
                  inputMode="numeric" value={r.waste_pct} onChange={(e) => setRow(i, { waste_pct: e.target.value })}
                  placeholder="hull.%"
                  className="w-full rounded-lg border px-3 py-2 text-right text-sm"
                  style={{ borderColor: "var(--twx-line)", background: "var(--twx-cream-card)" }}
                />
              </div>
              <button onClick={() => removeRow(i)} className="pb-2 text-lg" style={{ color: "var(--twx-ink-muted)" }} aria-label="Törlés">×</button>
              {/* Élő egységár a beírt mennyiség és ár(ak) alapján */}
              <div className="w-full pl-1 text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                {parseNum(r.qty) > 0 && parseNum(r.total) > 0
                  ? (() => {
                      const u = rowUnitPrices(r);
                      return u.hasRange
                        ? <>= <b style={{ color: "var(--twx-ink)" }}>{fmtFt(u.min)}–{fmtFt(u.max)} Ft/{unitLabel(r.unit)}</b> · a rendszer az átlaggal ({fmtFt(u.avg)} Ft/{unitLabel(r.unit)}) számol</>
                        : <>= <b style={{ color: "var(--twx-ink)" }}>{fmtFt(u.avg)} Ft/{unitLabel(r.unit)}</b> egységár</>;
                    })()
                  : "Add meg a mennyiséget és a teljes árat (pl. 100 kg / 15 000 Ft). Ha ingadozik, a jobb mezőben egy legdrágább árat is megadhatsz."}
              </div>
            </div>
          ))}
          <button onClick={addRow} className="text-sm font-medium" style={{ color: "var(--twx-coral)" }}>
            + Alapanyag hozzáadása
          </button>
        </div>

        {/* Lábléc */}
        <div className="flex items-center justify-between gap-3 border-t p-4" style={{ borderColor: "var(--twx-line)" }}>
          <span className="hidden min-w-0 flex-1 text-xs sm:block" style={{ color: "var(--twx-ink-muted)" }}>Mennyit vettél és mennyiért — az egységárat a rendszer számolja. Ingadozó árnál adj meg egy legdrágább árat is; az átlaggal számolunk.</span>
          <div className="flex flex-none gap-2">
            <button onClick={onClose} className="whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium" style={{ border: "1px solid var(--twx-line)", color: "var(--twx-ink-muted)" }}>Bezár</button>
            <button
              onClick={async () => { const ok = await save(); if (ok) { showToast("Alapanyagok mentve.", "success"); onClose(); } }}
              disabled={saving}
              className="whitespace-nowrap rounded-xl px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
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
