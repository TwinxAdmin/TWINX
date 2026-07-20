// Vendéglátás — Alapanyag-árlista és receptek (adagonkénti alapanyagköltség).
// FONTOS: itt KIZÁRÓLAG az alapanyag ára számít. Semmilyen más költség (rezsi, bér,
// csomagolás, amortizáció…) nem kerül bele — azokat a riport vetíti rá külön, így
// nem számolódnak el kétszer.

// --- Alap-egységek (az árlistában ebben adja meg az árat) -------------------
export const INGREDIENT_UNITS = [
  { value: "kg", label: "kg" },
  { value: "dkg", label: "dkg" },
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
  // Ha az ár dekagrammra van megadva (jellemzően fűszereknél), ehhez viszonyítunk.
  dkg: [
    { value: "g", label: "g", factor: 1 / 10 },
    { value: "dkg", label: "dkg", factor: 1 },
    { value: "kg", label: "kg", factor: 100 },
  ],
  l: [
    { value: "ml", label: "ml", factor: 1 / 1000 },
    { value: "dl", label: "dl", factor: 1 / 10 },
    { value: "l", label: "l", factor: 1 },
  ],
  db: [{ value: "db", label: "db", factor: 1 }],
};

// Alapértelmezett bevitt egység egy alap-egységhez (amit a legtöbben használnak).
export const DEFAULT_ENTRY_UNIT: Record<IngredientUnit, string> = { kg: "dkg", dkg: "dkg", l: "dl", db: "db" };

// Egy mennyiség átváltása alap-egységre (kg / l / db).
export function toBaseAmount(quantity: number, entryUnit: string, base: IngredientUnit): number {
  const u = ENTRY_UNITS[base]?.find((x) => x.value === entryUnit);
  return (Number(quantity) || 0) * (u?.factor ?? 1);
}

export function unitLabel(u: string): string {
  return INGREDIENT_UNITS.find((x) => x.value === u)?.label ?? u;
}

// --- Alapanyag-kategóriák (a felületen kockákba rendezve) -------------------
// Minden kategóriához oda illő PÉLDA (a beviteli mező súgójához) és a jellemzően
// használt alap-egység, hogy ne kelljen mindig átállítani.
// A `units` listán CSAK az adott kategóriában értelmes egységek szerepelnek, és mindig
// a LEGGYAKORIBB áll az élen — az lesz az alapértelmezett. (Zöldségnél nincs liter;
// dkg csak a fűszereknél, mert krumplit senki nem dekagrammban vásárol.)
export const INGREDIENT_CATEGORIES = [
  { value: "zoldseg", label: "Zöldség", example: "pl. burgonya", units: ["kg", "db"] },
  { value: "gyumolcs", label: "Gyümölcs", example: "pl. alma", units: ["kg", "db"] },
  { value: "hus", label: "Hús", example: "pl. marhalábszár", units: ["kg", "db"] },
  { value: "hal", label: "Hal & tenger gyümölcsei", example: "pl. lazacfilé", units: ["kg", "db"] },
  { value: "tejtermek", label: "Tejtermék & tojás", example: "pl. tejföl", units: ["l", "kg", "db"] },
  { value: "pekaru", label: "Pékáru & liszt", example: "pl. finomliszt", units: ["kg", "db"] },
  { value: "szaraz", label: "Száraz áru (rizs, tészta)", example: "pl. rizs", units: ["kg", "db"] },
  { value: "fuszer", label: "Fűszer & alaplé", example: "pl. őrölt paprika", units: ["kg", "dkg", "l"] },
  { value: "olaj", label: "Olaj & zsiradék", example: "pl. napraforgó olaj", units: ["l", "kg"] },
  { value: "ital", label: "Ital & alkohol", example: "pl. ásványvíz", units: ["l", "db"] },
  { value: "egyeb", label: "Egyéb", example: "pl. szalvéta", units: ["db", "kg", "l"] },
] as const;
export type IngredientCategory = (typeof INGREDIENT_CATEGORIES)[number]["value"];

export function ingredientCategoryLabel(v: string): string {
  return INGREDIENT_CATEGORIES.find((c) => c.value === v)?.label ?? v;
}

// A kategóriához illő példa a beviteli mező súgójában.
export function ingredientCategoryExample(v: string): string {
  return INGREDIENT_CATEGORIES.find((c) => c.value === v)?.example ?? "pl. alapanyag neve";
}

// Az adott kategóriában felkínált egységek (az első a legáltalánosabb).
export function ingredientCategoryUnits(v: string): IngredientUnit[] {
  const c = INGREDIENT_CATEGORIES.find((x) => x.value === v);
  return [...(c?.units ?? ["kg", "l", "db"])] as IngredientUnit[];
}

// A kategória alapértelmezett egysége = a lista első (leggyakoribb) eleme.
export function ingredientCategoryUnit(v: string): IngredientUnit {
  return ingredientCategoryUnits(v)[0];
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

// Egy recept-sor kétféle lehet:
//   a) árlistás  → ingredient_id ki van töltve, az árat a közös lista adja
//   b) EGYEDI    → nincs ingredient_id, a partner ehhez az ételhez adta meg a nevet és az
//                  árat (pl. oregánó a pizzához). Ez az ár csak ennél az ételnél él.
export type RecipeItem = {
  ingredient_id: string | null;
  quantity: number;
  unit: string; // ahogy beírta (g/dkg/kg/ml/dl/l/db)
  custom_name?: string | null;
  custom_unit?: IngredientUnit | null;
  custom_unit_price?: number | null;
  custom_waste_pct?: number | null;
};

// Egyedi (csak ehhez az ételhez felvitt) hozzávaló-e a sor.
export function isCustomItem(item: RecipeItem): boolean {
  return !item.ingredient_id && !!String(item.custom_name ?? "").trim();
}

// A sor „forrása": vagy az árlistás alapanyag, vagy a sorba írt egyedi adatok.
// Így minden számítás és felirat egy helyről dolgozik.
export function itemSource(
  item: RecipeItem,
  ing: Ingredient | undefined
): { name: string; unit: IngredientUnit; unit_price: number; waste_pct: number } | null {
  if (item.ingredient_id) {
    return ing
      ? { name: ing.name, unit: ing.unit, unit_price: Number(ing.unit_price) || 0, waste_pct: Number(ing.waste_pct) || 0 }
      : null;
  }
  if (!isCustomItem(item)) return null;
  return {
    name: String(item.custom_name),
    unit: (item.custom_unit ?? "kg") as IngredientUnit,
    unit_price: Number(item.custom_unit_price) || 0,
    waste_pct: Number(item.custom_waste_pct) || 0,
  };
}

// --- Számítás --------------------------------------------------------------
// Egy recept-sor alapanyagköltsége EGY adagra, a hulladék-százalékkal növelve.
export function itemCost(item: RecipeItem, ing: Ingredient | undefined): number {
  const src = itemSource(item, ing);
  if (!src) return 0;
  const base = toBaseAmount(item.quantity, item.unit, src.unit);
  return base * src.unit_price * (1 + src.waste_pct / 100);
}

// A teljes recept adagonkénti alapanyagköltsége.
export function recipeCost(items: RecipeItem[], ingredients: Ingredient[]): number {
  const byId = new Map(ingredients.map((i) => [i.id, i]));
  return items.reduce((s, it) => s + itemCost(it, it.ingredient_id ? byId.get(it.ingredient_id) : undefined), 0);
}

// Validáció alapanyag felvitelekor.
export function validateIngredient(input: { name?: string; unit?: string; unit_price?: unknown }): string | null {
  if (!String(input.name ?? "").trim()) return "Add meg az alapanyag nevét.";
  if (!INGREDIENT_UNITS.some((u) => u.value === input.unit)) return "Válassz mértékegységet.";
  const p = Number(String(input.unit_price ?? "").replace(",", "."));
  if (isNaN(p) || p < 0) return "Az egységár nem negatív szám legyen.";
  return null;
}
