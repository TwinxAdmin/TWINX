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

export function marginLabel(m: string): string {
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
  profit_margin: ProfitMargin;
  image_url: string | null;
  created_at: string;
};

// --- Étel felvitele (input + validáció) ---
export type DishInput = {
  name: string;
  description: string;
  category: string;
  cuisine_style: string;
  profit_margin: string;
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
  if (!PROFIT_MARGINS.some((m) => m.value === input.profit_margin)) errors.profit_margin = "Válassz profitmarzsot.";
  return { valid: Object.keys(errors).length === 0, errors };
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
  return WEEK_DAYS.find((d) => d.value === v)?.label ?? v;
}
export type DayPlanEntry = { day: string; cuisine: string };

// --- Menü-generátor paraméterei ---
export const TIMEFRAMES = [
  { value: "daily", label: "Napi menü" },
  { value: "weekly", label: "Heti menü" },
] as const;
export type Timeframe = (typeof TIMEFRAMES)[number]["value"];

export const MENU_THEMES = [
  { value: "valtozatos", label: "Változatos / Sokszínű" },
  { value: "magyaros", label: "Magyaros hetek" },
  { value: "fitness", label: "Fitness / Könnyed" },
  { value: "premium", label: "Prémium / Ünnepi" },
  { value: "szezonalis", label: "Szezonális" },
] as const;
export type MenuTheme = (typeof MENU_THEMES)[number]["value"];

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
  task: `Írj először egy rövid, étvágygerjesztő, vendégcsalogató bevezetőt a menühöz, amely a megadott tematika hangulatát idézi. Ezután logikusan felépítve tálald a kiválasztott ételeket: NAPI menünél fogásokra (előétel/leves → főétel → desszert), HETI menünél napokra bontva. Törekedj változatosságra és arányos kínálatra. A stílus legyen elegáns és eladás-ösztönző. Magyarul, jól tagoltan válaszolj.`,
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
  },
  segments: { intro?: string; task?: string }
): string {
  const intro = (segments.intro ?? MENU_DEFAULT_SEGMENTS.intro).trim();
  const task = (segments.task ?? MENU_DEFAULT_SEGMENTS.task).trim();
  const lines = [
    `Időtáv: ${timeframeLabel(opts.timeframe)}`,
    `Tematika: ${themeLabel(opts.theme)}`,
    `Profit-cél: ${PROFIT_GOALS.find((g) => g.value === opts.goal)?.label ?? opts.goal}`,
  ];
  const plan = (opts.dayPlan ?? []).filter((p) => p.cuisine && p.cuisine.trim());
  if (plan.length) {
    lines.push(``, `Napi konyha-beosztás (ezt a napok szerint tartsd be):`);
    for (const p of plan) lines.push(`- ${dayLabel(p.day)}: ${p.cuisine}`);
  }
  if (opts.instruction && opts.instruction.trim()) {
    lines.push(``, `Egyedi instrukció a partnertől: ${opts.instruction.trim()}`);
  }
  lines.push(``, `Feltétel: KIZÁRÓLAG az alábbi ételeket használhatod fel:`, opts.dishListText);
  return `${intro}\n\n${lines.join("\n")}\n\n${task}`;
}
