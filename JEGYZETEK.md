# JEGYZETEK — ötletek, nyitott kérdések, tisztázandók

Ez egy élő gyűjtő. Nem kód, csak feljegyzés. Ide kerül minden ötlet, kérdés és
bizonytalan pont, amit később fejlesztünk vagy tisztázunk. Bátran bővítsd.

---

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

## Státusz pillanatkép (hol tartunk)

- 1–3. fázis: kész és élesben tesztelt (auth, dashboard, Stripe fizetés + kredit).
- 4. fázis (Értékbecslő): kód kész, teszt/élesítés a partner promptjára vár.
- 5. fázis (Látványtervező): kész, élesben tesztelt, helységenkénti konfiggal.
- 6. fázis (B2B): kész, tesztelt.
- 7. fázis (dizájn) és 8. fázis (deploy): hátravan.
