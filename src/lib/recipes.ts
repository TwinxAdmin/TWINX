// Vendéglátás — Alapanyag-árlista és receptek (adagonkénti alapanyagköltség).
// FONTOS: itt KIZÁRÓLAG az alapanyag ára számít. Semmilyen más költség (rezsi, bér,
// csomagolás, amortizáció…) nem kerül bele — azokat a riport vetíti rá külön, így
// nem számolódnak el kétszer.

// --- Alap-egységek (az árlistában ebben adja meg az árat) -------------------
export const INGREDIENT_UNITS = [
  { value: "kg", label: "kg" },
  { value: "l", label: "liter" },
  { value: "db", label: "darab" },
] as const;
export type IngredientUnit = (typeof INGREDIENT_UNITS)[number]["value"];

// --- Bevitt egységek receptnél, alap-egységenként --------------------------
// A partner úgy írhatja, ahogy gondolkodik (10 dkg), mi átváltjuk alap-egységre.
export const ENTRY_UNITS: Record<IngredientUnit, { value: string; label: string; factor: number }[]> = {
  kg: [
    { value: "g", label: "g", factor: 1 / 1000 },
    { value: "dkg", label: "dkg", factor: 1 / 100 },
    { value: "kg", label: "kg", factor: 1 },
  ],
  l: [
    { value: "ml", label: "ml", factor: 1 / 1000 },
    { value: "dl", label: "dl", factor: 1 / 10 },
    { value: "l", label: "l", factor: 1 },
  ],
  db: [{ value: "db", label: "db", factor: 1 }],
};

// Alapértelmezett bevitt egység egy alap-egységhez (amit a legtöbben használnak).
export const DEFAULT_ENTRY_UNIT: Record<IngredientUnit, string> = { kg: "dkg", l: "dl", db: "db" };

// Egy mennyiség átváltása alap-egységre (kg / l / db).
export function toBaseAmount(quantity: number, entryUnit: string, base: IngredientUnit): number {
  const u = ENTRY_UNITS[base]?.find((x) => x.value === entryUnit);
  return (Number(quantity) || 0) * (u?.factor ?? 1);
}

export function unitLabel(u: string): string {
  return INGREDIENT_UNITS.find((x) => x.value === u)?.label ?? u;
}

// --- Alapanyag-kategóriák (a felületen kockákba rendezve) -------------------
export const INGREDIENT_CATEGORIES = [
  { value: "zoldseg", label: "Zöldség" },
  { value: "gyumolcs", label: "Gyümölcs" },
  { value: "hus", label: "Hús" },
  { value: "hal", label: "Hal & tenger gyümölcsei" },
  { value: "tejtermek", label: "Tejtermék & tojás" },
  { value: "pekaru", label: "Pékáru & liszt" },
  { value: "szaraz", label: "Száraz áru (rizs, tészta)" },
  { value: "fuszer", label: "Fűszer & alaplé" },
  { value: "olaj", label: "Olaj & zsiradék" },
  { value: "ital", label: "Ital & alkohol" },
  { value: "egyeb", label: "Egyéb" },
] as const;
export type IngredientCategory = (typeof INGREDIENT_CATEGORIES)[number]["value"];

export function ingredientCategoryLabel(v: string): string {
  return INGREDIENT_CATEGORIES.find((c) => c.value === v)?.label ?? v;
}

// --- Típusok ---------------------------------------------------------------
export type Ingredient = {
  id: string;
  name: string;
  unit: IngredientUnit;
  unit_price: number; // Ft / alap-egység
  waste_pct: number;  // tisztítási/hulladék veszteség (%)
  category: string;   // lásd INGREDIENT_CATEGORIES
};

export type RecipeItem = {
  ingredient_id: string;
  quantity: number;
  unit: string; // ahogy beírta (g/dkg/kg/ml/dl/l/db)
};

// --- Számítás --------------------------------------------------------------
// Egy recept-sor alapanyagköltsége EGY adagra, a hulladék-százalékkal növelve.
export function itemCost(item: RecipeItem, ing: Ingredient | undefined): number {
  if (!ing) return 0;
  const base = toBaseAmount(item.quantity, item.unit, ing.unit);
  const waste = 1 + (Number(ing.waste_pct) || 0) / 100;
  return base * (Number(ing.unit_price) || 0) * waste;
}

// A teljes recept adagonkénti alapanyagköltsége.
export function recipeCost(items: RecipeItem[], ingredients: Ingredient[]): number {
  const byId = new Map(ingredients.map((i) => [i.id, i]));
  return items.reduce((s, it) => s + itemCost(it, byId.get(it.ingredient_id)), 0);
}

// Validáció alapanyag felvitelekor.
export function validateIngredient(input: { name?: string; unit?: string; unit_price?: unknown }): string | null {
  if (!String(input.name ?? "").trim()) return "Add meg az alapanyag nevét.";
  if (!INGREDIENT_UNITS.some((u) => u.value === input.unit)) return "Válassz mértékegységet.";
  const p = Number(String(input.unit_price ?? "").replace(",", "."));
  if (isNaN(p) || p < 0) return "Az egységár nem negatív szám legyen.";
  return null;
}
