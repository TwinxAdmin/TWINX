# JEGYZETEK — ötletek, nyitott kérdések, tisztázandók

Ez egy élő gyűjtő. Nem kód, csak feljegyzés. Ide kerül minden ötlet, kérdés és
bizonytalan pont, amit később fejlesztünk vagy tisztázunk. Bátran bővítsd.

---

## 💰 Árazási alapszabály — KÖTELEZŐ 100% haszon

**Nem eltérhető:** minden kreditet fogyasztó funkciónál az eladási ár ≥ **2× a nyers
API-önköltség** (min. 100% haszon), a **legmélyebb kedvezményes szinten (349 Ft/kredit)
is**. Új funkció kredit-árát mindig ehhez igazítjuk (a hasznot nem csökkentjük).

**Csomagok:** Induló 10 kr = 4 990 Ft (499/kr) · Közepes 50 kr = 19 990 Ft (399/kr, −20%)
· Nagy 100 kr = 34 990 Ft (349/kr, −30%).

**Kredit-árak (100%-ra ellenőrizve 349 Ft/kredit-nél):**
- Értékbecslő (sonar-pro): 1 kredit (deep-research esetén 2).
- Látványtervező: 1 kredit / ingatlan (max 8 kép).
- Videó: **kép = kredit** (4 kép→4 … 8 kép→8 kredit).

## 📣 Marketing / pozicionálás (PARKOLVA — dizájn-fázishoz)

- **Vízió:** kredit-alapú AI-marketplace („app store" iparági modulokkal). Az ingatlan
  csak az első modul. Go-to-market: vertikális-először (ingatlan a zászlóshajó), majd
  iparáganként ismételni.
- **Cégnév:** TWINX.
- **Szlogen-jelöltek (kreatív-techy, leíró):**
  - *„Plug & play AI-modulok minden iparágnak, kreditre hangolva."* (favorit)
  - *„Kredit be, eredmény ki. Moduláris AI-eszköztár iparágaknak."*
  - *„A mindennapjaid AI-motorja: válassz modult, tankolj kreditet, indíts."*
- A landing hero: konkrét zászlóshajó vertikális + „növekvő marketplace" keret.

## 💡 Ötletek (későbbi fejlesztések)

- **Stílus-galéria a Látványtervezőhöz** — egy stílushoz az összes referenciakép
  kis ablakokban, egérrel fölé húzva nagyítás (hover-zoom). Az animáció-finomítás a
  7. dizájn-fázisé, a funkcionális galéria bármikor mehet.
- **„Újragenerálás" gomb** egy adott képre, ha a partnernek nem tetszik a találat
  (olcsó re-roll, hogy ne kelljen az egész ingatlant újra).
- **Helység-specifikus extra változók** — a közös változók mellé helységenként egyedi
  opciók (pl. Konyha → konyhabútor színe; Fürdő → szaniter stílus).
- **Egyéni szín (color picker)** a kurált paletta mellé a haladóknak.
- **Feliratok / branding átnézése** a dizájn-fázisban (pl. „Twinx AI Portal" csere).
- **Videó feliratok / intro** — a marketing videóhoz szöveges rétegek: intro-cím az elején
  (pl. cím, ár, cím-sor), esetleg outro/logó a végén. Shotstack text/title asset. Bővítés a
  videó pipeline-hoz később.
- **Értékbecslés szint-választás (tiered)** — a partner választhasson a generálás előtt:
  *Standard* elemzés (most: `sonar-pro`, 1 kredit) vagy *Mély / Prémium* elemzés
  (`sonar-deep-research`, több száz forrás, lassabb) magasabb kreditért (pl. 2-3 kredit).
  A modell már env/config-vezérelt; kell hozzá: UI-választó a formon + kredit-differenciálás
  (a `chargeCredit` már paraméteres `amount`-tal). Illik a prémium PDF-hez is.
- **Prémium Értékbecslő PDF** — a mostani nyers szöveg helyett szépen tördelt sablon:
  fejléc logóval, kiemelt ár-dobozok, az 5 összehasonlító ingatlan táblázatban, SWOT
  négyzetrácsban, esetleg borító. Kell hozzá a branding (logó, színek); külön menet
  vagy a 7. fázis. (Valószínűleg HTML-sablon → PDF renderelés.)

## ❓ Nyitott kérdések

- *(ide jönnek a te kérdéseid)*

## ✅ Tisztázott kérdések

- **A `/` már a landing page?** Igen, technikailag ez a publikus főoldal, de most
  wireframe szinten (csomagok, belépés, regisztráció, B2B űrlap). A **profi landing
  page a 7. dizájn-fázisban** készül el — NEM új oldal, hanem ennek a `/` oldalnak a
  prémium feldíszítése (hero, modul-bemutató, árkiemelés, CTA-k), single-domain elven.
  A mögöttes logika (auth, kredit, modulok) már kész.

## 🔧 Tisztázandó / még bizonytalan

- **Értékbecslő (4. fázis):** a partnerek kész Perplexity-promptjára várunk, azt
  építjük be (a lánc kódja kész). Élesítéshez: Perplexity kulcs + Noto font.
- **Gemini látható logó:** ellenőrizni, hogy a használt kulcs projektjén aktív-e a
  fizetős tier (a látható vízjel jellemzően csak ingyenes tieren jelenik meg; a
  láthatatlan SynthID mindig ott van és nem távolítható el).
- **Resend e-mail:** éles működéshez a `twinx.hu` domain hitelesítése (különben spam-be
  megy, és csak a saját címre küldhet).
- **Stripe:** végleges ár beállítása (most 4990 Ft teszt); ár kezelése kódban vagy
  Stripe-oldalon.
- **8. fázis (élesítés):** Hostinger deploy + `.env` beállítása éles környezetben.

---

## 🎨 Dizájn-fázis (7.) — előkészítés és források

Döntés még nyitott: **kész template** vagy **saját ihlet-galéria alapján egyedi build**.
A mi stackünk Tailwind CSS → a Tailwind-alapú források illeszkednek (Bootstrap kerülendő).

**Ihlet / irány (böngészni, hogy meglegyen a „vibe"):**
- land-book.com — landing galéria
- landingfolio.com — landing ihlet + Tailwind komponensek
- saaslandingpage.com — SaaS landingek
- dribbble.com — keresés: „real estate app", „SaaS landing", „proptech"
- godly.website, lapa.ninja — kurált inspiráció

**Tailwind komponensek/blokkok (ezekből közvetlenül lehet építeni):**
- hyperui.dev, flowbite.com, preline.co, daisyui.com
- tailwindui.com (Tailwind Plus) — pár ingyenes, többi fizetős

**Kész Next.js sablonok:**
- vercel.com/templates — ingyenes landing/starter (szűrő: landing page)

**Munkamódszer:** elég 2-3 tetsző oldal iránynak, azt Tailwinddel megépítjük — a
template-et nem kötelező letölteni. Legerősebb aduász: valódi előtte/utána
látványterv-párok a hero-ba + minta értékbecslő PDF.

**Amit érdemes hozni a dizájnhoz:** logó (SVG/PNG), márkaszínek, betűtípus-preferencia,
2-3 ihlet-oldal, néhány szép példakép (látványterv előtte/utána), végleges szövegek.

---

## Státusz pillanatkép (hol tartunk)

- 1–3. fázis: kész és élesben tesztelt (auth, dashboard, Stripe fizetés + kredit).
- 4. fázis (Értékbecslő): kód kész, teszt/élesítés a partner promptjára vár.
- 5. fázis (Látványtervező): kész, élesben tesztelt, helységenkénti konfiggal.
- 6. fázis (B2B): kész, tesztelt.
- 7. fázis (dizájn) és 8. fázis (deploy): hátravan.
