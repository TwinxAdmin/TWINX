// Modul-katalógus — FOLYAMAT szerint csoportosítva, nem iparág szerint.
//
// Miért: a TWINX nem marad meg az ingatlannál és a vendéglátásnál. Ha a menü
// iparágakra épül, minden új szakma új főmenüt jelentene, és a felhasználó
// olyan menüket látna, amiknek semmi köze hozzá. A folyamat viszont közös:
// mindenki tartalmat gyárt, illetve elemez és kutat.
//
// Az iparág nem tűnik el, csak CÍMKE lesz a modulon (`industry`), és a modulon
// BELÜL lehet majd választani (pl. a hirdetéskép készítőben: ingatlan- vagy
// vendéglátós hirdetés). A választót csak akkor mutatjuk, ha tényleg van több
// lehetőség — üres legördülőnek nincs értelme.
//
// A felső sáv és a mobil menü ebből épül; új modul ide vehető fel.

/** Iparág-címke a modulon. Az „általános" bármelyik szakmának jó. */
export type Industry = "altalanos" | "ingatlan" | "vendeglatas";

export const INDUSTRY_LABEL: Record<Industry, string> = {
  altalanos: "Általános",
  ingatlan: "Ingatlan",
  vendeglatas: "Vendéglátás",
};

export type ModuleLink = {
  label: string;
  href: string;
  desc?: string; // rövid, egysoros leírás a menüben
  icon?: string; // ikon-kulcs (lásd ModuleIcon)
  /** Melyik szakmának szól. Hiány = általános. */
  industry?: Industry;
  /**
   * Rejtett modul: a kódja és az útvonala él, de a menüben NEM listázzuk.
   * Így lehet félkész vagy még nem hirdetett modult a helyén tartani.
   */
  hidden?: boolean;
  /** Kis címke a név mellett (pl. „Új", „Hamarosan"). */
  badge?: string;
  /** „Hamarosan": a menüben halványan, NEM kattintható sor (a href ilyenkor nem használt) — más listákban nem jelenik meg. */
  soon?: boolean;
};

export type Category = {
  slug: string;
  label: string;
  status: "available" | "soon";
  blurb: string;
  modules: ModuleLink[];
  /** Kiemelt (prémium) felső menüpont: bronz–arany gomb, saját legördülő-stílus. */
  premium?: boolean;
};

/** A Prémium 3D állapota (adatbázis: app_settings.premium3d_status — lásd lib/premium3d.ts). */
export type Premium3dState = "hidden" | "coming_soon" | "available";
export type CatalogView = { isAdmin?: boolean; premium3d?: Premium3dState };

export const CATEGORIES: Category[] = [
  {
    slug: "content",
    label: "Tartalomgyártás",
    status: "available",
    blurb:
      "Minden, amit ki lehet adni a kezedből: hirdetéskép, videó, hirdetésszöveg, feljavított fotó és látványterv — posztolásra kész formában, percek alatt.",
    // A sorrend a MUNKAMENETET követi: előbb a képes anyagok egy blokkban
    // (hirdetéskép → képjavítás → látványterv), utána a videó, végül a szövegek.
    modules: [
      { label: "Hirdetéskép készítő", href: "/dashboard/flyer", icon: "flyer", desc: "Posztolásra kész hirdetéskép", industry: "ingatlan" },
      { label: "Képjavító", href: "/dashboard/real-estate/image-enhance", icon: "visualization", desc: "Fotók feljavítása, rendrakás", industry: "altalanos" },
      { label: "Látványtervező", href: "/dashboard/real-estate/visualization", icon: "visualization", desc: "Belsőépítészeti látványterv", industry: "ingatlan" },
      { label: "Videó generálás", href: "/dashboard/real-estate/video", icon: "video", desc: "Bemutató videó a fotókból", industry: "ingatlan" },
      { label: "Hirdetésszöveg generátor", href: "/dashboard/real-estate/fb-ads", icon: "flyer", desc: "Facebook és Google Ads szöveg", industry: "ingatlan" },
      { label: "Szöveg ellenőrzés", href: "/dashboard/real-estate/ad-check", icon: "history", desc: "Meglévő hirdetés elemzése", industry: "ingatlan" },
      // Vendéglátás — a kód él, de amíg nem kész termék, nem listázzuk.
      { label: "Menü generátor", href: "/dashboard/hospitality/menu", icon: "menu", desc: "Napi/heti menü a kínálatodból", industry: "vendeglatas", hidden: true },
    ],
  },
  {
    slug: "insight",
    label: "Elemzés & kutatás",
    status: "available",
    blurb:
      "Amiből szám és döntés lesz: piaci értékbecslés friss adatokból, és célzott kutatás, ha kívülről kell információ vagy szakember.",
    modules: [
      { label: "Ingatlan értékbecslés", href: "/dashboard/real-estate/valuation", icon: "valuation", desc: "Piaci ár friss adatokból", industry: "ingatlan" },
      { label: "Szakember-kereső (béta)", href: "/dashboard/real-estate/professionals", icon: "pro", desc: "Ügyvéd, energetikus, kivitelező", industry: "ingatlan" },
      // Telek ellenőrzés — elrejtve, amíg nem hibátlan (a land/layout.tsx átirányít).
      { label: "Telek ellenőrzés", href: "/dashboard/real-estate/land", icon: "land", desc: "Beépíthetőség és övezet", industry: "ingatlan", hidden: true },
      // Vendéglátás — kód él, listázás nélkül.
      { label: "Önköltség & profit", href: "/dashboard/hospitality/costing", icon: "cost", desc: "Önköltség és megtérülés", industry: "vendeglatas", hidden: true },
      { label: "Árazás elemző", href: "/dashboard/hospitality/pricing", icon: "pricing", desc: "Haszonkulcs és ár-javaslat", industry: "vendeglatas", hidden: true },
      { label: "Beszállító-kereső", href: "/dashboard/hospitality/suppliers", icon: "supplier", desc: "Termelők és nagykerek", industry: "vendeglatas", hidden: true },
      { label: "Szakember-kereső (béta)", href: "/dashboard/hospitality/professionals", icon: "pro", desc: "Séf, felszolgáló, cukrász", industry: "vendeglatas", hidden: true },
    ],
  },
  {
    // Prémium 3D — saját, kiemelt felső menüpont (design/3d-bemutato-latvanyterv.html); a későbbi 3D modulok is ide kerülnek.
    // Láthatóság az ADATBÁZISBAN (Admin → Prémium 3D): Rejtett → csak admin; Hamarosan → mindenki, „Hamarosan" jelvénnyel —
    // megnyitva a felhasználó a bemutatót + „Értesíts, ha elérhető" sávot látja, az admin a teljes modult (fejlesztés, teszt).
    slug: "premium3d",
    label: "✦ Prémium 3D",
    status: "available",
    premium: true,
    blurb: "Méretarányos, bejárható 3D lakás egyetlen alaprajzból — linken küldheted el a vevőnek.",
    modules: [
      { label: "Alaprajzból 3D", href: "/dashboard/real-estate/floorplan-3d", icon: "cube", desc: "Bejárható 3D lakás az alaprajzból", industry: "ingatlan" },
    ],
  },
  {
    slug: "data",
    label: "Adataim",
    status: "available",
    blurb: "A törzsadatok, amikre a többi modul épül.",
    modules: [
      { label: "Alapanyagok", href: "/dashboard/hospitality/ingredients", icon: "recipe", desc: "Beszerzési árak egy helyen", industry: "vendeglatas", hidden: true },
      { label: "Kínálat kezelő", href: "/dashboard/hospitality/inventory", icon: "inventory", desc: "Ételeid és receptjeik", industry: "vendeglatas", hidden: true },
    ],
  },
];

/** Csak a ténylegesen listázandó modulok (a rejtettek nélkül; a „Hamarosan" sorok csak a felső legördülőben — withSoon).
 *  A Prémium 3D „Alaprajzból 3D" sora a menüben jelvény NÉLKÜL áll (Márk, 2026-10-20): a „Hamarosan érkezik" csak
 *  megnyitva látszik; ha majd elérhető, „Új" címkét kap. */
export function visibleModules(category: Category, withSoon = false, view: CatalogView = {}): ModuleLink[] {
  const list = category.modules.filter((m) => !m.hidden && (withSoon || !m.soon));
  if (category.slug !== "premium3d" || view.premium3d !== "available") return list;
  return list.map((m) => (m.soon ? m : { ...m, badge: "Új" }));
}

/** Azok a kategóriák, amikben van legalább egy látható modul. A Prémium 3D: adminnak mindig, másnak ha nem „Rejtett". */
export function visibleCategories(view: CatalogView = {}): Category[] {
  return CATEGORIES.filter((c) => c.status === "available" && visibleModules(c).length > 0
    && (c.slug !== "premium3d" || view.isAdmin || (!!view.premium3d && view.premium3d !== "hidden")));
}
