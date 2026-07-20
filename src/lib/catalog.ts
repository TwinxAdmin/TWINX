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
      { label: "Ingatlan értékbecslés", href: "/dashboard/real-estate/valuation", icon: "valuation", desc: "Adatalapú piaci ár percek alatt" },
      { label: "Telek ellenőrzés", href: "/dashboard/real-estate/land", icon: "land", desc: "Beépíthetőség és övezet ellenőrzése" },
      { label: "Látványtervező", href: "/dashboard/real-estate/visualization", icon: "visualization", desc: "Fotórealisztikus belsőépítészet" },
      { label: "Videó generálás", href: "/dashboard/real-estate/video", icon: "video", desc: "Profi bemutató videó a fotókból" },
      { label: "Hirdetéskészítő", href: "/dashboard/flyer", icon: "flyer", desc: "Kész, márkázott ingatlanhirdetés" },
      { label: "Szakember-kereső", href: "/dashboard/real-estate/professionals", icon: "pro", desc: "Közvetítő, ügyvéd, energetikus, kivitelező…" },
    ],
  },
  {
    slug: "hospitality",
    label: "Vendéglátás",
    status: "available",
    blurb:
      "Okos eszközök éttermeknek és kávézóknak: a saját kínálatodból AI-alapú napi/heti menü, a profitcélod és a tematikád szerint — hogy gyorsabban, jövedelmezőbben állíts össze étlapot.",
    modules: [
      { label: "Kínálat kezelő", href: "/dashboard/hospitality/inventory", icon: "inventory", desc: "A saját étlap-adatbázisod" },
      { label: "Alapanyagok & receptek", href: "/dashboard/hospitality/ingredients", icon: "recipe", desc: "Beszerzési árak és adagonkénti önköltség" },
      { label: "Beszállító-kereső", href: "/dashboard/hospitality/suppliers", icon: "supplier", desc: "Termelők és nagykerek felkutatása a környékeden" },
      { label: "Szakember-kereső", href: "/dashboard/hospitality/professionals", icon: "pro", desc: "Séf, felszolgáló, cukrász, HACCP, szerviz…" },
      { label: "Önköltség & profit", href: "/dashboard/hospitality/costing", icon: "cost", desc: "Teljes önköltség, rezsi-allokáció, megtérülés" },
      { label: "Menü generátor", href: "/dashboard/hospitality/menu", icon: "menu", desc: "AI napi/heti menü a kínálatodból" },
      { label: "Árazás elemző", href: "/dashboard/hospitality/pricing", icon: "pricing", desc: "Haszonkulcs-elemzés és ár-javaslatok" },
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
