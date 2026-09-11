// Modul-vitrin a Portál Központhoz.
//
// Cél: az újonnan regisztrált partner ne egy üres felülettel találkozzon, hanem
// lássa, MIT fog kapni, MENNYIBE kerül és MENNYI IDŐ. Egy forrásból, hogy a
// dashboard, a menü és a későbbi árlista ne csússzon szét.

// A regisztrációkor járó próbakredit. Az adatbázisban a `welcome-credits.sql`
// `handle_new_user` függvénye adja — ha ott változik, itt is írd át.
export const WELCOME_CREDITS = 3;

// --- Ingatlan landing: azonnali kezdőkredit ---------------------------------
// Aki a twinx.hu/ingatlan landingről regisztrál, a szokásos 3 helyett ennyivel
// indul (kód és jóváhagyás nélkül). A DB-oldali logika: `landing-signup-credits.sql`
// `handle_new_user` függvénye — ha ott módosítasz, itt is írd át.
//
// A regisztráció a Supabase signUp metaadatában küldi a forrás-jelölést; a
// register API CSAK ezt az egy ismert értéket fogadja el.
export const LANDING_SIGNUP_SOURCE = "ingatlan-landing";
export const LANDING_WELCOME_CREDITS = 10;
// Ennyi landing-partner kap 10 kreditet; utána a szokásos 3 (csendes plafon —
// nem a partnert szigorítja, csak a teljes kitettséget zárja be).
export const LANDING_CREDITS_CAP = 50;

/** Admin nézethez: forrás-kód → emberi címke. */
export const SIGNUP_SOURCE_LABEL: Record<string, string> = {
  [LANDING_SIGNUP_SOURCE]: "Ingatlan landing",
};

// A vitrinben megjelenő modulok. A `poster` a ModulePoster rajzolt előnézetére
// hivatkozik, a `sample` pedig egy VALÓDI, a saját motorunkkal készült minta.
export type ShowcaseItem = {
  id: string;
  title: string;
  desc: string;
  href: string;
  credits: number;
  duration: string;
  poster: "enhance" | "flyer" | "valuation" | "video";
  sample?: string;
};

export const SHOWCASE: ShowcaseItem[] = [
  {
    id: "enhance",
    title: "Képjavító",
    desc: "Sötét, ferde fotóból világos, egyenes kép",
    href: "/dashboard/real-estate/image-enhance",
    credits: 1,
    duration: "~40 mp",
    poster: "enhance",
  },
  {
    id: "flyer",
    title: "Hirdetéskép készítő",
    desc: "Három sablon, a saját arculatoddal",
    href: "/dashboard/flyer",
    credits: 1,
    duration: "~2 perc",
    poster: "flyer",
    sample: "/flyer-samples/openhouse-1x1.png",
  },
  {
    id: "valuation",
    title: "Ingatlan értékbecslés",
    desc: "Piaci ár friss eladási adatokból",
    href: "/dashboard/real-estate/valuation",
    credits: 1,
    duration: "~1 perc",
    poster: "valuation",
  },
  {
    id: "video",
    title: "Videó generálás",
    desc: "A fotókból mozgó bemutató, zenével",
    href: "/dashboard/real-estate/video",
    credits: 3,
    duration: "~5 perc",
    poster: "video",
  },
];
