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
    ],
  },
  {
    slug: "data",
    label: "Adatelemzés",
    status: "soon",
    blurb: "Automatizált adatelemzés és riportok.",
    modules: [],
  },
  {
    slug: "media",
    label: "Tartalomgyártás",
    status: "soon",
    blurb: "AI-alapú tartalom- és médiagyártás.",
    modules: [],
  },
];
