// Publikus kategóriák és a hozzájuk tartozó modulok (App Store-szerű katalógus).
// A felső sáv ebből építi a legördülő menüt; új kategória ide vehető fel.
export type ModuleLink = { label: string; href: string };

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
      { label: "Ingatlan értékbecslő", href: "/dashboard/real-estate/valuation" },
      { label: "Telek értékbecslés", href: "/dashboard/real-estate/land" },
      { label: "Látványtervező", href: "/dashboard/real-estate/visualization" },
      { label: "Videó generálás", href: "/dashboard/real-estate/video" },
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
