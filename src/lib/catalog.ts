// Publikus kategóriák és a hozzájuk tartozó modulok (App Store-szerű katalógus).
// A felső sáv ebből építi a legördülő menüt; új kategória ide vehető fel.
export type ModuleLink = {
  label: string;
  href: string;
  desc?: string; // rövid, egysoros leírás a menüben
  icon?: string; // ikon-kulcs (lásd ModuleIcon)
};

export type Category = {
  slug: string;
  label: string;
  status: "available" | "soon";
  blurb: string;
  modules: ModuleLink[];
};

export const CATEGORIES: Category[] = [
  {
    slug: "real-estate",
    label: "Ingatlan",
    status: "available",
    blurb:
      "Percek alatt kész értékbecslés, belsőépítészeti látványtervek üres vagy elavult szobákból, és profi bemutató videó a feltöltött fotókból — hogy az ingatlan gyorsabban, jobb áron keljen el.",
    modules: [
      { label: "Ingatlan értékbecslés", href: "/dashboard/real-estate/valuation", icon: "valuation", desc: "Piaci ár friss adatokból" },
      { label: "Telek ellenőrzés", href: "/dashboard/real-estate/land", icon: "land", desc: "Beépíthetőség és övezet" },
      { label: "Képjavító", href: "/dashboard/real-estate/image-enhance", icon: "visualization", desc: "Ingatlanfotók feljavítása" },
      { label: "Hirdetéskép készítő", href: "/dashboard/flyer", icon: "flyer", desc: "Posztolásra kész hirdetéskép" },
      { label: "Látványtervező", href: "/dashboard/real-estate/visualization", icon: "visualization", desc: "Belsőépítészeti látványterv" },
      { label: "Videó generálás", href: "/dashboard/real-estate/video", icon: "video", desc: "Bemutató videó a fotókból" },
      { label: "Szöveg ellenőrzés", href: "/dashboard/real-estate/ad-check", icon: "history", desc: "Meglévő hirdetés elemzése" },
      { label: "Hirdetésszöveg generátor", href: "/dashboard/real-estate/fb-ads", icon: "flyer", desc: "Facebook és Google Ads szöveg" },
      { label: "Szakember-kereső (béta)", href: "/dashboard/real-estate/professionals", icon: "pro", desc: "Ügyvéd, energetikus, kivitelező" },
    ],
  },
  {
    slug: "hospitality",
    label: "Vendéglátás",
    status: "available",
    blurb:
      "Okos eszközök éttermeknek és kávézóknak: a saját kínálatodból AI-alapú napi/heti menü, a profitcélod és a tematikád szerint — hogy gyorsabban, jövedelmezőbben állíts össze étlapot.",
    modules: [
      { label: "Alapanyagok", href: "/dashboard/hospitality/ingredients", icon: "recipe", desc: "Beszerzési árak egy helyen" },
      { label: "Kínálat kezelő", href: "/dashboard/hospitality/inventory", icon: "inventory", desc: "Ételeid és receptjeik" },
      { label: "Beszállító-kereső", href: "/dashboard/hospitality/suppliers", icon: "supplier", desc: "Termelők és nagykerek" },
      { label: "Szakember-kereső (béta)", href: "/dashboard/hospitality/professionals", icon: "pro", desc: "Séf, felszolgáló, cukrász" },
      { label: "Önköltség & profit", href: "/dashboard/hospitality/costing", icon: "cost", desc: "Önköltség és megtérülés" },
      { label: "Menü generátor", href: "/dashboard/hospitality/menu", icon: "menu", desc: "Napi/heti menü a kínálatodból" },
      { label: "Árazás elemző", href: "/dashboard/hospitality/pricing", icon: "pricing", desc: "Haszonkulcs és ár-javaslat" },
    ],
  },
  {
    slug: "media",
    label: "Tartalomgyártás",
    status: "soon",
    blurb: "AI-alapú tartalom- és médiagyártás.",
    modules: [],
  },
];
