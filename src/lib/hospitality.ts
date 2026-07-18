// Vendéglátás modul — közös típusok, felsorolások, validáció.
// A menü-generátor a partner saját ételeiből (restaurant_dishes) dolgozik (RAG).

// --- Étel-kategóriák (a DB check-listával egyezően) ---
export const DISH_CATEGORIES = [
  { value: "eloetel", label: "Előétel" },
  { value: "leves", label: "Leves" },
  { value: "foetel", label: "Főétel" },
  { value: "koret", label: "Köret" },
  { value: "desszert", label: "Desszert" },
  { value: "ital", label: "Ital" },
] as const;
export type DishCategory = (typeof DISH_CATEGORIES)[number]["value"];

// --- Profitmarzs (étel szint) ---
export const PROFIT_MARGINS = [
  { value: "low", label: "Alacsony" },
  { value: "medium", label: "Közepes" },
  { value: "high", label: "Magas" },
] as const;
export type ProfitMargin = (typeof PROFIT_MARGINS)[number]["value"];

export function marginLabel(m: string | null | undefined): string {
  if (!m) return "";
  return PROFIT_MARGINS.find((x) => x.value === m)?.label ?? m;
}
export function categoryLabel(c: string): string {
  return DISH_CATEGORIES.find((x) => x.value === c)?.label ?? c;
}

// --- Egy étel (DB sor) ---
export type Dish = {
  id: string;
  name: string;
  description: string | null;
  category: DishCategory;
  cuisine_style: string | null;
  profit_margin: ProfitMargin | null;
  cost_price: number | null; // előkészítési / önköltségi ár
  sale_price: number | null; // eladási ár
  main_ingredients: string | null; // vesszővel elválasztott fő alapanyagok
  image_url: string | null;
  created_at: string;
};

// Darabonkénti profit (eladási − önköltség), ha mindkettő megvan.
export function dishProfit(d: { cost_price: number | null; sale_price: number | null }): number | null {
  if (d.cost_price == null || d.sale_price == null) return null;
  return d.sale_price - d.cost_price;
}

export function formatHuf(n: number): string {
  return `${Math.round(n).toLocaleString("hu-HU")} Ft`;
}

// --- Étel felvitele (input + validáció) ---
export type DishInput = {
  name: string;
  description: string;
  category: string;
  cuisine_style: string;
  profit_margin: string;
  cost_price: string;
  sale_price: string;
  main_ingredients: string;
};

export function validateDishInput(input: Partial<DishInput>): {
  valid: boolean;
  errors: Record<string, string>;
} {
  const errors: Record<string, string> = {};
  const name = String(input.name ?? "").trim();
  if (!name) errors.name = "Az étel neve kötelező.";
  if (name.length > 120) errors.name = "Túl hosszú név (max 120).";
  if (!DISH_CATEGORIES.some((c) => c.value === input.category)) errors.category = "Válassz kategóriát.";
  if (!String(input.cuisine_style ?? "").trim()) errors.cuisine_style = "A konyhatípus megadása kötelező.";
  // Profitmarzs opcionális: üres megengedett, de ha van, érvényes legyen.
  const pm = String(input.profit_margin ?? "").trim();
  if (pm && !PROFIT_MARGINS.some((m) => m.value === pm)) errors.profit_margin = "Érvénytelen profitmarzs.";
  for (const key of ["cost_price", "sale_price"] as const) {
    const raw = String(input[key] ?? "").trim();
    if (raw && (isNaN(Number(raw)) || Number(raw) < 0)) errors[key] = "Nem negatív szám legyen.";
  }
  return { valid: Object.keys(errors).length === 0, errors };
}

// Ár-string -> number|null (üres = null).
export function parsePrice(raw: unknown): number | null {
  const s = String(raw ?? "").trim().replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  return isNaN(n) || n < 0 ? null : n;
}

// --- Konyhatípusok (bővíthető alaplista; a partner sajátot is hozzáadhat) ---
// A felhasználói felület ezt egyesíti a partner által korábban felvitt stílusokkal,
// így a saját típusok is újra elérhetők lesznek.
export const CUISINE_STYLES = [
  "magyaros", "olasz", "francia", "spanyol", "görög", "mediterrán",
  "kínai", "japán", "thai", "vietnámi", "koreai", "indiai",
  "mexikói", "amerikai", "közel-keleti", "török",
  "fúziós", "nemzetközi", "házias", "street food",
  "tengeri / hal", "BBQ / grill", "fitness / könnyed", "vegetáriánus", "vegán",
] as const;

// A hét napjai a napokra bontott konyha-beosztáshoz (heti menü).
export const WEEK_DAYS = [
  { value: "hetfo", label: "Hétfő" },
  { value: "kedd", label: "Kedd" },
  { value: "szerda", label: "Szerda" },
  { value: "csutortok", label: "Csütörtök" },
  { value: "pentek", label: "Péntek" },
  { value: "szombat", label: "Szombat" },
  { value: "vasarnap", label: "Vasárnap" },
] as const;
export function dayLabel(v: string): string {
  const wd = WEEK_DAYS.find((d) => d.value === v);
  if (wd) return wd.label;
  const m = /^nap(\d+)$/.exec(v);
  return m ? `${m[1]}. nap` : v;
}
export type DayPlanEntry = { day: string; cuisine?: string; ingredient?: string };

// --- Menü-generátor paraméterei ---
export const TIMEFRAMES = [
  { value: "1", label: "Napi (1 nap)", days: 1 },
  { value: "3", label: "3 napos", days: 3 },
  { value: "5", label: "5 napos (hétköznap)", days: 5 },
  { value: "7", label: "Heti (7 nap)", days: 7 },
] as const;
export type Timeframe = (typeof TIMEFRAMES)[number]["value"];
export function timeframeDays(v: string): number {
  return TIMEFRAMES.find((t) => t.value === v)?.days ?? 1;
}

export const MENU_THEMES = [
  { value: "valtozatos", label: "Változatos / Sokszínű" },
  { value: "magyaros", label: "Magyaros" },
  { value: "olasz_het", label: "Olasz hét" },
  { value: "azsiai_het", label: "Ázsiai hét" },
  { value: "vegetarianus", label: "Vegetáriánus" },
  { value: "vegan", label: "Vegán" },
  { value: "glutenmentes", label: "Gluténmentes" },
  { value: "lowcarb", label: "Low-carb / Keto" },
  { value: "fitness", label: "Fitness / Könnyed" },
  { value: "business", label: "Business lunch (gyors, kiszámítható)" },
  { value: "csaladi", label: "Családi / Gyerekbarát" },
  { value: "brunch", label: "Brunch" },
  { value: "premium", label: "Prémium / Ünnepi" },
  { value: "szezonalis", label: "Szezonális" },
  { value: "nyari_grill", label: "Nyári grill" },
  { value: "oszi", label: "Őszi / Tökös" },
] as const;
export type MenuTheme = (typeof MENU_THEMES)[number]["value"];

// Fogásszám a napi menühöz.
export const COURSE_OPTIONS = [
  { value: "", label: "Nincs megkötve" },
  { value: "2", label: "2 fogásos (leves/előétel + főétel)" },
  { value: "3", label: "3 fogásos (előétel + főétel + desszert)" },
] as const;

// Változatosság foka.
export const VARIETY_OPTIONS = [
  { value: "normal", label: "Kiegyensúlyozott" },
  { value: "high", label: "Erős — ne ismétlődjön a héten" },
] as const;

// Profit CÉL a menühöz (nem az egyes étel marzsa, hanem a menü egészének célja).
export const PROFIT_GOALS = [
  { value: "low", label: "Alacsony (vevőcsalogató / akciós)" },
  { value: "medium", label: "Közepes (kiegyensúlyozott)" },
  { value: "high", label: "Magas (prémium haszon)" },
] as const;
export type ProfitGoal = (typeof PROFIT_GOALS)[number]["value"];

// A profit-cél -> mely étel-marzsokat preferáljuk, MILYEN sorrendben (rangsor).
// Az első a legfontosabb; a menü ezek szerint épül, előre sorolva a preferáltat.
export const PREFERRED_MARGINS: Record<ProfitGoal, ProfitMargin[]> = {
  high: ["high", "medium"],
  medium: ["medium", "high", "low"],
  low: ["low", "medium"],
};

export function isTimeframe(v: unknown): v is Timeframe {
  return TIMEFRAMES.some((t) => t.value === v);
}
export function isMenuTheme(v: unknown): v is MenuTheme {
  return MENU_THEMES.some((t) => t.value === v);
}
export function isProfitGoal(v: unknown): v is ProfitGoal {
  return PROFIT_GOALS.some((g) => g.value === v);
}

export function timeframeLabel(v: string): string {
  return TIMEFRAMES.find((t) => t.value === v)?.label ?? v;
}
export function themeLabel(v: string): string {
  return MENU_THEMES.find((t) => t.value === v)?.label ?? v;
}

// Egy menü-generálás kredit-ára (0 = ingyenes). Admin/sales megkerüli (chargeCredit).
export const MENU_CREDITS = Number(process.env.MENU_CREDITS ?? 1);

// Minimum ennyi étel kell értelmes menühöz (különben visszatérítés + hibaüzenet).
export const MENU_MIN_DISHES = 5;

// --- AI prompt: admin által szerkeszthető szegmensek (intro + task) ---------
// A zárolt adat-blokk (paraméterek + szűrt étel-lista) kódból jön; a szegmensekben
// NEM lehet behelyettesítő változó.
export const MENU_DEFAULT_SEGMENTS = {
  intro: `Te egy profi éttermi séf és marketing szakértő vagy. A feladatod, hogy a megadott éttermi adatbázisból összeállíts egy vonzó, jól felépített menüsort a partner céljai szerint. Kizárólag a lentebb listázott ételeket használhatod fel — NE találj ki új fogást, és ne módosítsd az ételek nevét.`,
  task: `Írj először egy rövid, étvágygerjesztő, vendégcsalogató bevezetőt a menühöz, amely a megadott tematika hangulatát idézi. Ezután a fent megadott bontás szerint tálald a kiválasztott ételeket: 1 napos menünél fogásokra (előétel/leves → főétel → desszert), több napos menünél napokra bontva, minden naphoz a fogásokkal. Törekedj változatosságra és arányos kínálatra. A stílus legyen elegáns és eladás-ösztönző. Magyarul, jól tagoltan válaszolj.`,
};

export const MENU_DATA_BLOCK_PREVIEW = `Időtáv: {időtáv}
Tematika: {tematika}
Profit-cél: {profit-cél}

Feltétel: KIZÁRÓLAG az alábbi ételeket használhatod fel:
{profit alapján szűrt étel-lista}`;

// A zárolt adat-blokk összeállítása a tényleges paraméterekkel + szűrt étel-listával.
export function composeMenuPrompt(
  opts: {
    timeframe: Timeframe;
    theme: MenuTheme;
    goal: ProfitGoal;
    dishListText: string;
    instruction?: string;
    dayPlan?: DayPlanEntry[];
    courses?: string;
    targetPrice?: string;
    variety?: string;
    targetCount?: string; // tervezett eladott menü (db)
    targetProfit?: string; // cél össz-profit (Ft)
  },
  segments: { intro?: string; task?: string }
): string {
  const intro = (segments.intro ?? MENU_DEFAULT_SEGMENTS.intro).trim();
  const task = (segments.task ?? MENU_DEFAULT_SEGMENTS.task).trim();
  const days = timeframeDays(opts.timeframe);
  const lines = [
    `Időtáv: ${days} napra szóló menü.`,
    days === 1
      ? `Bontás: egyetlen napi menü, fogásokra bontva (előétel/leves → főétel → desszert).`
      : `Bontás: ${days} külön napra bontva (1. nap, 2. nap, …), minden naphoz a fogásokkal.`,
    `Tematika: ${themeLabel(opts.theme)}`,
    `Profit-cél: ${PROFIT_GOALS.find((g) => g.value === opts.goal)?.label ?? opts.goal}`,
  ];
  if (opts.courses === "2") lines.push(`Fogásszám: 2 fogásos (leves vagy előétel + főétel).`);
  if (opts.courses === "3") lines.push(`Fogásszám: 3 fogásos (előétel + főétel + desszert).`);
  if (opts.targetPrice && Number(opts.targetPrice) > 0) {
    lines.push(
      `Célár: a napi menü (fogások összege) lehetőleg maradjon ${Math.round(Number(opts.targetPrice)).toLocaleString("hu-HU")} Ft alatt az ételek eladási ára alapján.`
    );
  }
  if (opts.variety === "high") {
    lines.push(`Változatosság: KERÜLD, hogy ugyanaz a fogás vagy fő alapanyag kétszer szerepeljen a héten.`);
  }
  const tCount = Number(opts.targetCount);
  const tProfit = Number(opts.targetProfit);
  if (tCount > 0 && tProfit > 0) {
    const perMenu = Math.round(tProfit / tCount);
    lines.push(
      `Profit-terv: a partner ${tCount.toLocaleString("hu-HU")} menü eladásából összesen ${tProfit.toLocaleString("hu-HU")} Ft profitot céloz. ` +
        `Ezért állítsd össze úgy a napi menüket, hogy egy menü darab-profitja (az ételek eladási ára MÍNUSZ előkészítési ára összege) érje el a ~${perMenu.toLocaleString("hu-HU")} Ft-ot; ` +
        `részesítsd előnyben a magasabb darab-profitú ételeket, de a tematikát és a változatosságot is tartva.`
    );
  }
  const plan = (opts.dayPlan ?? []).filter(
    (p) => (p.cuisine && p.cuisine.trim()) || (p.ingredient && p.ingredient.trim())
  );
  if (plan.length) {
    lines.push(``, `Napi beosztás (ezt a napok szerint TARTSD BE):`);
    for (const p of plan) {
      const bits: string[] = [];
      if (p.cuisine && p.cuisine.trim()) bits.push(`konyha: ${p.cuisine.trim()}`);
      if (p.ingredient && p.ingredient.trim()) bits.push(`fő alapanyag: ${p.ingredient.trim()}`);
      lines.push(`- ${dayLabel(p.day)}: ${bits.join(", ")}`);
    }
    lines.push(`(A fő alapanyaghoz olyan ételt válassz, amelynek az alapanyagai közt szerepel az adott alapanyag.)`);
  }
  if (opts.instruction && opts.instruction.trim()) {
    lines.push(``, `Egyedi instrukció a partnertől: ${opts.instruction.trim()}`);
  }
  lines.push(``, `Feltétel: KIZÁRÓLAG az alábbi ételeket használhatod fel:`, opts.dishListText);
  return `${intro}\n\n${lines.join("\n")}\n\n${task}`;
}
