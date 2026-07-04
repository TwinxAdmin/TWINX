// Publikus kategóriák és a hozzájuk tartozó modulok (App Store-szerű katalógus).
// A felső sáv ebből építi a legördülő menüt; új kategória ide vehető fel.
export type ModuleLink = { label: string; href: string };

export type Category = {
  slug: string;
  label: string;
  status: "available" | "soon";
  modules: ModuleLink[];
};

export const CATEGORIES: Category[] = [
  {
    slug: "real-estate",
    label: "Ingatlan",
    status: "available",
    modules: [
      { label: "Értékbecslő", href: "/dashboard/real-estate/valuation" },
      { label: "Látványtervező", href: "/dashboard/real-estate/visualization" },
      { label: "Videó generálás", href: "/dashboard/real-estate/video" },
    ],
  },
  {
    slug: "data",
    label: "Adatelemzés",
    status: "soon",
    modules: [],
  },
  {
    slug: "media",
    label: "Tartalomgyártás",
    status: "soon",
    modules: [],
  },
];
