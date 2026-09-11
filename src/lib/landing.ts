// A főoldal (twinx.hu) tartalmi forrása — EGY helyen, hogy a szövegek és a számok
// ne szóródjanak szét a komponensekben.
//
// ELV: a főoldal iparág-SEMLEGES. Az ingatlan és a vendéglátás példa, nem ígéret.
// Minden felirat azt nevezi meg, amit a partner KAP (eredmény-nyelv), nem a
// szakmát vagy a technológiát. Tiltott szavak: AI-motor, platform, megoldás,
// alkalmazás-áruház, „saját fejlesztésű".
//
// A kredit-árak a modulok saját lib-jeiből jönnek — itt NEM írunk be számot kézzel,
// különben a főoldal és a valódi levonás szétcsúszna.

import { CATEGORIES, type Industry, type ModuleLink } from "@/lib/catalog";
import { FLYER_CREDITS } from "@/lib/flyer";
import { VIDEO_CREDITS_ALAP } from "@/lib/video";
import { FBADS_CREDITS } from "@/lib/fbads";
import { ADCHECK_CREDITS } from "@/lib/adcheck";
import { ENHANCE_CREDITS } from "@/lib/image-enhance";
import { VALUATION_CREDITS } from "@/lib/valuation";
import { MENU_CREDITS } from "@/lib/hospitality";
import { WELCOME_CREDITS } from "@/lib/onboarding";

export { WELCOME_CREDITS };

// ---------------------------------------------------------------------------
// HERO
// ---------------------------------------------------------------------------
export const HERO = {
  eyebrow: "Egyszerű lépések, profi eredmény",
  titleLine1: "Profi munka,",
  titleLine2: "egy kattintásra.",
  lead: "Hirdetés, riport, videó, válaszlevél, elemzés — feltöltöd, kattintasz, letöltöd. Havidíj nélkül, kreditalapon.",
  cta: "Kipróbálom ingyen",
  ctaNote: `${WELCOME_CREDITS} kredit ajándék, bankkártya nélkül`,
  secondary: "Nézd meg működés közben",
};

/** Bizalmi sáv a hero alján. A `number` mezőt az AnimatedNumber pörgeti fel. */
export const TRUST: Array<{ label: string; number?: number; suffix?: string }> = [
  { label: "egy anyag", number: 40, suffix: " mp" },
  { label: "Kredit soha nem jár le" },
  { label: "Magyar nyelven, magyar piacra" },
  { label: "Nincs telepítés" },
];

// ---------------------------------------------------------------------------
// MODUL-FORGÓ — valódi kimenetek. A média-fájlok a public/showcase mappába
// kerülnek; amíg nincsenek ott, a komponens helyőrzőt mutat (nem hamis képet).
// ---------------------------------------------------------------------------
export type ShowcaseSlide =
  | { kind: "before-after"; title: string; note: string; before: string; after: string; afterLabel?: string }
  | { kind: "document"; title: string; note: string; src: string }
  | { kind: "video"; title: string; note: string; poster: string; src?: string }
  | { kind: "image"; title: string; note: string; src: string }
  /** Kódból rajzolt jelenet: adatbevitel → számolás → egyoldalas riport. Hosszabb dia. */
  | { kind: "demo-valuation"; title: string; note: string; durationMs: number }
  /** Kódból rajzolt jelenet: fotók + 3 adat + zene → telefonon „lejátszott" videó. */
  | { kind: "demo-video"; title: string; note: string; durationMs: number; credits: number };

export const SHOWCASE: ShowcaseSlide[] = [
  {
    kind: "before-after",
    title: "Rendetlen szoba → hirdetési fotó",
    note: "Képjavító · rendrakás és profi fény, a szoba marad",
    // IDE JÖN: egy valódi partner-fotó előtte/utána párja (1600px széles, JPG).
    before: "/showcase/enhance-before.jpg",
    after: "/showcase/enhance-after.jpg",
  },
  {
    kind: "before-after",
    title: "Ugyanaz a szoba, új stílusban",
    note: "Látványtervező · üres vagy berendezett szobából, a falak és ablakok maradnak",
    // Valódi partner-munka: ugyanaz a nappali, előtte és a látványterv után.
    before: "/showcase/visual-before.jpg",
    after: "/showcase/visual-after.jpg",
    afterLabel: "Látványterv",
  },
  {
    // Nem kép, hanem jelenet: a partner LÁTJA, mennyi adatot kell beírnia, és mit
    // kap vissza. Egy PDF-kép csak a végeredményt mutatná, a munka mennyiségét nem.
    kind: "demo-valuation",
    title: "Értékbecslés percek alatt",
    note: "Értékbecslés · részletes adatlapból profi, arculatos riport",
    durationMs: 15000,
  },
  {
    // Nem MP4, hanem jelenet: pár fotó + három adat + egy zene → a telefonon
    // „lejátszódik" a kész videó (nyitókártya, feliratos fotók, zárókártya).
    kind: "demo-video",
    title: "Fotókból zenés videó",
    note: "Videó · pár fotó, három adat, egy zene — kész a hirdetési videó",
    durationMs: 17000,
    credits: VIDEO_CREDITS_ALAP,
  },
  {
    kind: "image",
    title: "Pár adatból kész hirdetéskép",
    note: "Hirdetéskép · posztolásra kész, három méretben",
    // Ez már valódi kimenet — a hirdetéskép-készítő mintája.
    src: "/flyer-samples/premium-4x3.png",
  },
];

/** A forgó kerete köré lebegő „idő-chipek": bemenet → kimenet · mennyi idő.
 *  Három darab, asztalon látszik (ShowcaseFrame). Kerek, óvatos időértékek. */
export const SHOWCASE_CHIPS: Array<{ from: string; to: string; time: string }> = [
  { from: "Telefonfotó", to: "hirdetési fotó", time: "1 perc" },
  { from: "Adatlap", to: "értékbecslés", time: "2 perc" },
  { from: "Fotók", to: "zenés videó", time: "3 perc" },
];

// ---------------------------------------------------------------------------
// ÍGY MŰKÖDIK
// ---------------------------------------------------------------------------
export const STEPS = [
  { title: "Feltöltöd", text: "Egy fotót, egy szöveget vagy egy linket." },
  { title: "Kattintasz", text: "Nincs beállítás, nincs prompt-írás." },
  { title: "Letöltöd", text: "PDF, kép, videó vagy másolható szöveg — a saját arculatoddal." },
];

// ---------------------------------------------------------------------------
// KINEK? — fülek. A modulok a katalógusból jönnek; a főoldalon EREDMÉNY-nyelvű
// címet kapnak (nem a menübeli nevüket).
// ---------------------------------------------------------------------------
export type AudienceKey = Industry | "soon";

export type LandingModule = {
  /** Eredmény-nyelvű cím: mit kap a partner. */
  title: string;
  /** Egy mondat, mit tesz be. */
  input: string;
  credits?: number;
  /** Még nem elérhető. */
  soon?: boolean;
  /** Előnézeti kép — public/ alól. Ha hiányzik, ikonos helyőrző. */
  image?: string;
};

/** Menübeli href → eredmény-nyelv. Ami nincs itt, az a menü nevével jelenik meg. */
const RESULT_TITLES: Record<string, { title: string; input: string; credits: number; image?: string }> = {
  "/dashboard/flyer": { title: "Pár adatból kész hirdetéskép", input: "Fotók + ár + cím", credits: FLYER_CREDITS, image: "/flyer-samples/unit-1x1.png" },
  "/dashboard/real-estate/image-enhance": { title: "Telefonfotóból profi fotó", input: "Egy vagy három fotó", credits: ENHANCE_CREDITS },
  "/dashboard/real-estate/visualization": { title: "Ugyanaz a szoba, új stílusban", input: "Egy fotó + stílus", credits: 1 },
  "/dashboard/real-estate/video": { title: "Fotókból zenés videó", input: "5–8 fotó + adatok", credits: VIDEO_CREDITS_ALAP, image: "/video-samples/aurora-hero.jpg" },
  "/dashboard/real-estate/fb-ads": { title: "Hirdetésszöveg három stílusban", input: "Az ingatlan adatai", credits: FBADS_CREDITS },
  "/dashboard/real-estate/ad-check": { title: "Meglévő hirdetés pontozva, átírva", input: "Egy link", credits: ADCHECK_CREDITS },
  "/dashboard/real-estate/valuation": { title: "Értékbecslés egy oldalon, arculattal", input: "Részletes adatlap az ingatlanról", credits: VALUATION_CREDITS },
  "/dashboard/real-estate/professionals": { title: "Szakember a környékről", input: "Mit keresel, hol", credits: 1 },
  "/dashboard/hospitality/menu": { title: "Alapanyagból heti menü", input: "A kínálatod", credits: MENU_CREDITS },
  "/dashboard/hospitality/costing": { title: "Önköltség és haszon egy táblában", input: "Alapanyag-árak", credits: 1 },
  "/dashboard/hospitality/pricing": { title: "Ár-javaslat haszonkulccsal", input: "Az étlapod", credits: 1 },
  "/dashboard/hospitality/suppliers": { title: "Beszállító-lista összehasonlítva", input: "Mit, mennyit, hova", credits: 1 },
};

function toLanding(m: ModuleLink): LandingModule {
  const r = RESULT_TITLES[m.href];
  return r
    ? { title: r.title, input: r.input, credits: r.credits, image: r.image, soon: m.hidden }
    : { title: m.label, input: m.desc ?? "", soon: m.hidden };
}

const ALL_MODULES = CATEGORIES.flatMap((c) => c.modules);

/** A „Minden vállalkozás" fülre tervezett, még nem elérhető modulok. */
const GENERAL_SOON: LandingModule[] = [
  { title: "Kapott e-mailre három válasz", input: "Beilleszted a levelet", soon: true },
  { title: "Számla-fotóból táblázat", input: "Lefotózod a számlát", soon: true },
  { title: "Vélemény-válasz egy kattintásra", input: "Beilleszted az értékelést", soon: true },
];

export const AUDIENCES: Array<{ key: AudienceKey; label: string; blurb: string; modules: LandingModule[]; muted?: boolean }> = [
  {
    key: "ingatlan",
    label: "Ingatlan",
    blurb: "Hirdetéstől értékbecslésig — minden, amit egy ingatlanos naponta kiad a kezéből.",
    modules: ALL_MODULES.filter((m) => m.industry === "ingatlan" && !m.hidden).map(toLanding),
  },
  {
    key: "vendeglatas",
    label: "Vendéglátás",
    blurb: "Menü, önköltség, árazás és beszállítók — a konyha és a kassza közti számolás.",
    modules: ALL_MODULES.filter((m) => m.industry === "vendeglatas").map(toLanding),
  },
  {
    key: "altalanos",
    label: "Minden vállalkozás",
    blurb: "Fotó, levél, számla, vélemény — a mindennapi apró munkák, amik összeadva órákat visznek el.",
    modules: [...ALL_MODULES.filter((m) => m.industry === "altalanos" && !m.hidden).map(toLanding), ...GENERAL_SOON],
  },
  {
    key: "soon",
    label: "Hamarosan: további iparágak",
    blurb: "Szolgáltatók, kereskedők, kézművesek — ugyanazzal a három lépéssel.",
    modules: [],
    muted: true,
  },
];

// ---------------------------------------------------------------------------
// ÁRAZÁS — „mi mennyi kreditbe kerül"
// ---------------------------------------------------------------------------
export const PRICING_SENTENCE = "Nincs havidíj. Kreditet veszel, és csak azért fizetsz, amit elkészítesz.";

export const CREDIT_COSTS: Array<{ label: string; credits: number }> = [
  { label: "Képjavítás (max. 3 fotó)", credits: ENHANCE_CREDITS },
  { label: "Hirdetéskép", credits: FLYER_CREDITS },
  { label: "Hirdetésszöveg", credits: FBADS_CREDITS },
  { label: "Értékbecslés", credits: VALUATION_CREDITS },
  { label: "Heti menü", credits: MENU_CREDITS },
  { label: "Videó", credits: VIDEO_CREDITS_ALAP },
];
