// A főoldal és a kezdőlap szövegei (terv 11; megjelenés: terv 29, B arculat). EGY helyen, könnyen cserélhetően.
// Tartalmi szabályok: tegező hangnem; nincs ár, nincs „kredit", nincs kitalált szám, idézet vagy ügyfélnév.
// A futó sáv és a modul-ablak példái ÖTLETEK, nem kész termékek (a felirataik ezt jelzik). Az ingatlanos
// modulok csak a Referenciák részben szerepelnek, működő példaként.

/** Futó sáv: „feladat · iparág" ötletek (terv 29 / 4.2). */
export const IDEA_CHIPS = [
  "Ajánlatkészítés · építőipar",
  "Időpontfoglalás · szépségipar",
  "Készletfigyelés · kereskedelem",
  "Számlafeldolgozás · könyvelés",
  "Műszakbeosztás · vendéglátás",
  "Ügyfélkérdések · webshop",
  "Hirdetésírás · ingatlan",
  "Szerződés-ellenőrzés · iroda",
];

/** „Mi az egyedi modul?" — a B minta szövege; Márk még átnézi (terv 29 / 4.4). */
export const WHAT_IS_MODULE = {
  eyebrow: "Mi az egyedi modul?",
  title: "Egy eszköz, ami pontosan a te munkafolyamatodra épül.",
  paragraphs: [
    "Az egyedi modul egy olyan program, amely a te cégednek egy konkrét, ismétlődő feladatát végzi el. Nem általános szoftver, amihez alkalmazkodnod kell: mi alkalmazkodunk hozzád.",
    "A kollégáid a saját fiókjukkal használják, ott, ahol neked a legjobb: a TWINX oldalán, saját appban vagy ahol már dolgoztok.",
  ],
};

/** Hogyan működik (terv 11 / 3.3). */
export const HOW_STEPS = [
  { title: "Felmérünk.", text: "Foglalsz egy ingyenes időpontot, és végigbeszéljük, hol megy el sok időd. Ha már van konkrét ötleted, azzal is jöhetsz." },
  { title: "Megépítjük.", text: "A te folyamatodra szabott modult készítjük el, nem sablont. Az ajánlatot a felmérés után kapod." },
  { title: "Használod.", text: "A modul ott fut, ahol neked a legjobb." },
];

/** Hol fut a modul (terv 11 / 3.4) — 4 fix méretű kártya, az első „Ajánlott kezdés". */
export const RUN_PLACES = [
  { title: "A TWINX oldalán", text: "A kollégáid a saját fiókjukkal belépnek, külön app vagy weblap nélkül.", featured: true },
  { title: "Saját app vagy oldal", text: "Megépítjük neked, a te arculatoddal." },
  { title: "A saját weboldaladba építve", text: "Ha hozzáférést adsz, beépítjük." },
  { title: "Ahol már dolgozol", text: "Telegramban, Slackben vagy Excelben." },
];

/**
 * Referenciák (terv 11 / 3.6): az ingatlanos modulok, működő példaként. `image`: valódi képernyőkép / eredmény a
 * meglévő modulból; ha nincs, a kártya jelölt helyőrzőt mutat. `concept`: „Koncepcióterv" jelölés a képen.
 */
/**
 * Gömbös 3D ábra (terv 30, D72) a „Mi az egyedi modul?" szekcióban: a gömbök szavai (a TWINX előnyei).
 * Az első a középső, nagy gömbé. Sorrend = a gömbök helye a mintában (középső, bal fent, jobb fent, bal lent,
 * jobb lent, fent, lent).
 */
export const ORB_WORDS = ["TWINX AI", "Biztonságos", "Időt spórol", "Cégre szabva", "Bővíthető", "Automatizál", "AI-ügynökség"];

/**
 * Belépett kezdőlap: „Miért érdemes?" blokk a magyarázó rész és a Legutóbbi munkáim között (Márk kérése 2026-11-24),
 * mellette a korábbi „Mi az egyedi modul?" animáció (MainGoalAnimation). Nincs benne szám vagy ígért mérték.
 */
export const WHY_CUSTOM_MODULE = {
  eyebrow: "Miért érdemes?",
  title: "A modern cégeknél az AI-modul lassan alapfelszereltség.",
  paragraphs: [
    "A napi gyors munkához már kevés egy általános program. Amit ma kézzel, táblázatokból és levelekből raktok össze, azt egy jól beállított modul magától elkészíti.",
    "Mivel a te cégedre szabva készül — a te folyamatoddal, sablonjaiddal és szabályaiddal —, nem nektek kell alkalmazkodnotok hozzá: úgy dolgozik, ahogy ti.",
  ],
  chips: ["Cégre szabva", "Gyorsabb napi munka", "Kevesebb kézi lépés"],
} as const;

/**
 * GDN-referencia bemutató a főoldalon (Márk döntése 2026-11-24): a GDN Mandala Ingatlanirodának fejlesztett modulok
 * fülekkel, „Előtte / Most" összevetéssel. A terv 11 szerint a GDN néven szerepelhet, de SZÁM VAGY IDÉZET NEM kerülhet
 * mellé, amíg nincs valódi, a GDN által jóváhagyott adat — ezért az összevetés szöveges, mért szám nélkül.
 */
export const GDN_SHOWCASE = {
  eyebrow: "Működő példa · GDN Mandala Ingatlaniroda",
  title: "Amit egy ingatlaniroda kapott tőlünk.",
  lead: "A GDN Mandala kollégái naponta használják ezeket a modulokat. Ingatlanra készültek, de bármilyen területre építünk egyedi modult.",
  modules: [
    {
      key: "3d", label: "Alaprajzból 3D", short: "Bejárható 3D lakás",
      before: "A vevő egy lapos alaprajzot kapott, és magának kellett elképzelnie a teret.",
      now: "Az alaprajzból méretarányos, bejárható 3D lakás lesz — körbeforgatható, és linkkel küldöd az érdeklődőnek.",
    },
    {
      key: "latvanyterv", label: "Látványtervező", short: "Felújítási koncepcióterv fotóból",
      before: "A vevő csak a régi vagy üres lakást látta; azt, hogy mi lehetne belőle, szóban kellett elmagyarázni.",
      now: "Egy lakásfotóból felújítási koncepcióterv készül, 9 stílusban — a bemutatón már a lehetőséget mutatod.",
    },
    {
      key: "kepjavito", label: "Képjavító", short: "Fotók feljavítása, rendrakás",
      before: "Sötét, rendetlen telefonos fotók kerültek a hirdetésbe, vagy fotóst kellett hívni.",
      now: "A fotókat a modul feljavítja és rendet tesz rajtuk, pár kattintással, a hirdetés előtt.",
    },
    {
      key: "ellenorzo", label: "Hirdetés-ellenőrző", short: "Meglévő hirdetés elemzése",
      before: "A hirdetés minősége azon múlt, ki írta és mennyi ideje volt rá — hiányzó adatok csak későn derültek ki.",
      now: "Bemásolod a linket: a modul értékeli, megmondja, mi hiányzik, és újraírja a szöveget.",
    },
    {
      key: "szoveg", label: "Hirdetésszöveg", short: "Facebook- és Google-szöveg",
      before: "Minden felületre külön, kézzel kellett megírni a hirdetést.",
      now: "Az ingatlan adataiból kész Facebook- és Google-hirdetésszöveg készül, egységes hangon.",
    },
    {
      key: "ertekbecsles", label: "Értékbecslés", short: "Ársáv friss piaci adatokból",
      before: "Az ármegbeszéléshez kézzel kellett összeszedni a hasonló hirdetéseket.",
      now: "Az ingatlan adataiból tájékoztató ársáv készül friss piaci adatokból, egyoldalas, átadható PDF-ben.",
    },
  ],
} as const;

export const REFERENCE_CARDS: { title: string; text: string; image?: string; concept?: boolean }[] = [
  { title: "Látványterv", text: "Lakásfotóból felújítási koncepcióterv, 9 stílusban.", image: "/showcase/visual-after.jpg", concept: true },
  { title: "Hirdetés-ellenőrző", text: "Bemásolod egy hirdetés linkjét: pontozza, megmondja, mi hiányzik, és újraírja a szöveget." },
  { title: "Értékbecslés", text: "Ingatlanadatokból tájékoztató ársáv, egyoldalas PDF-ben." },
];

/** Hero: „TWINX AI" gomb (korábban „AI-Appstore") és a felugró magyarázó ablak szövege (Márk kérése 2026-11-28). EGY helyen, cserélhető. */
export const APPSTORE_INFO = {
  button: "TWINX AI",
  title: "Mi az AI-Appstore?",
  text: "A TWINX AI-Appstore nem egy kész alkalmazásokkal teli bolt: itt a te cégednek készülő AI-modulok kapnak helyet. Egy ingyenes felmérésen megnézzük, hol megy el a legtöbb idő a napi munkádban. Erre építünk egy modult, amely egy konkrét, ismétlődő feladatot végez el helyetted, például ajánlatot ír, hirdetést ellenőriz vagy dokumentumot dolgoz fel. A modult a saját folyamatodhoz és kéréseidhez igazítjuk, nem neked kell alkalmazkodnod hozzá. Ha elkészült, a kollégáid a saját fiókjukkal érik el a TWINX oldalán, külön telepítés nélkül. Ha neked úgy kényelmesebb, saját appba, a weboldaladba vagy oda építjük, ahol már dolgoztok. Az adataidat biztonságosan kezeljük, és csak az láthatja őket, akinek hozzáférést adsz. A modul később bővíthető, ahogy a céged igényei nőnek. Az ajánlatot a felmérés után kapod, kötelezettség nélkül.",
  cta: "Ingyenes felmérés",
  close: "Bezárás",
};
