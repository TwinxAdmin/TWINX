// Modul-vitrin a Portál Központhoz.
//
// Cél: az újonnan regisztrált partner ne egy üres felülettel találkozzon, hanem
// lássa, MIT fog kapni, MENNYIBE kerül és MENNYI IDŐ. Egy forrásból, hogy a
// dashboard, a menü és a későbbi árlista ne csússzon szét.

// A regisztrációkor járó próbakredit. Az adatbázisban a `20260819123912_welcome-credits.sql`
// `handle_new_user` függvénye adja — ha ott változik, itt is írd át.
export const WELCOME_CREDITS = 3;

// --- Ingatlan landing: azonnali kezdőkredit ---------------------------------
// Aki a twinx.hu/ingatlan landingről regisztrál, a szokásos 3 helyett ennyivel
// indul (kód és jóváhagyás nélkül). A DB-oldali logika: `20260912003908_landing-signup-credits.sql`
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

// „Ezzel kezdd" — a Portálközpont 3 kiemelt modulja az új felhasználónak (StarterCards.tsx,
// design/portal-vegleges.html). A kredit-ár és a várható idő a kártyán látszik: a habozás oka
// általában az, hogy nem tudja, mit kap és mibe kerül.
export type StarterItem = {
  id: "enhance" | "flyer" | "valuation";
  title: string;
  desc: string;
  href: string;
  credits: number;
  duration: string;
  cta: string;
};

export const STARTERS: StarterItem[] = [
  {
    id: "enhance",
    title: "Képjavító",
    desc: "A sötét, ferde telefonos fotóból világos, egyenes hirdetésfotó.",
    href: "/dashboard/real-estate/image-enhance",
    credits: 1,
    duration: "~40 mp",
    cta: "Kipróbálom a saját fotómmal",
  },
  {
    id: "flyer",
    title: "Hirdetéskép",
    desc: "Posztolásra kész hirdetés a fotóidból, a saját neveddel és telefonszámoddal.",
    href: "/dashboard/flyer",
    credits: 1,
    duration: "~2 perc",
    cta: "Elkészítem az elsőt",
  },
  {
    id: "valuation",
    title: "Értékbecslés",
    desc: "Piaci ár friss eladási adatokból — ügyfélnek átadható PDF-riporttal.",
    href: "/dashboard/real-estate/valuation",
    credits: 1,
    duration: "~1 perc",
    cta: "Megbecsülök egy ingatlant",
  },
];
