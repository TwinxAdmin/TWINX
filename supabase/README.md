# Supabase — adatbázis-migrációk

Az adatbázist Márk futtatja kézzel a **Supabase SQL Editorban**. Supabase CLI-t
(`supabase db push`) jelenleg nem használunk.

## Mappaszerkezet

| Hely | Mi van benne |
|---|---|
| `migrations/` | Séma-migrációk időrendben, `ÉÉÉÉHHNNÓÓPPMM_nev.sql` formában |
| `seed.sql` | Kezdő adatok (a `20260703105450_schema.sql` után futtatandó) |
| `one-off/` | Egyszeri karbantartó / teszt szkriptek — NEM migrációk, nem kell sorban futtatni |

## Szabályok új SQL-hez

- Új fájl: `migrations/<időbélyeg>_<rovid-nev>.sql`, az időbélyeg a létrehozás ideje
  (pl. `date +%Y%m%d%H%M%S`). Mindig nagyobb legyen az eddigi legnagyobbnál.
- Legyen **újrafuttatható** (`if not exists`, `drop … if exists`, `create or replace`).
- A fejléc első kommentsora mondja meg egy mondatban, mit csinál; ha előfeltétele van,
  írd oda: „Futtasd … UTÁN".
- A kódban (hibaüzenet, komment) a fájlra **csak a rövid fájlnévvel** hivatkozunk,
  pl. „Futtasd le a `20261008104955_office-messages.sql` migrációt."
- Lefuttatás után vedd fel az alábbi táblázatba.

## Ha egyszer bekapcsoljuk a Supabase CLI-t

A fájlnevek CLI-kompatibilisek, de a meglévők már le vannak futtatva. `db push` előtt
lefutottnak kell jelölni őket, különben a CLI újra futtatná mindet:

```bash
supabase migration repair --status applied <időbélyeg> [<időbélyeg> …]
```

## Lefuttatott migrációk

Mind lefuttatva: **2026-10-12** (Márk ellenőrizte). Az időbélyeg a fájl első git-commitjának ideje.

| Fájl | Mit csinál |
|---|---|
| `20260703105450_schema.sql` | Alap adatbázis-séma (1. fázis) |
| `20260703123347_stripe.sql` | Stripe / kredit kiegészítések (3. fázis) |
| `20260703142923_b2b.sql` | B2B leadek (6. fázis) |
| `20260704081614_metrics.sql` | Admin költségfigyelő (metrics) |
| `20260704092435_video.sql` | Videó pipeline (`video_jobs`) |
| `20260704130625_ideas.sql` | Ötletláda (moderált, publikus) |
| `20260704161035_wallet.sql` | Közös (globális) kredit-pénztárca |
| `20260710084313_land.sql` | Telek értékbecslés (`land_jobs`) |
| `20260710104731_branding.sql` | Arculat-profilok a Hirdetéskészítőhöz |
| `20260711094633_usage-credits.sql` | Modul-szintű kredit-fogyasztás követése |
| `20260711102744_prompts.sql` | Verziózott AI-promptok |
| `20260714152351_branding-agent-photo.sql` | Az ügynök saját fotója az arculat-profilhoz |
| `20260718094718_hospitality.sql` | Vendéglátás: saját étel-adatbázis |
| `20260718104928_hospitality-prices.sql` | Vendéglátás: ételárak |
| `20260718110145_hospitality-optional-margin.sql` | Vendéglátás: opcionális profitmarzs |
| `20260718122048_hospitality-ingredients.sql` | Vendéglátás: fő alapanyagok az ételekhez |
| `20260718142609_hospitality-costing.sql` | Vendéglátás: önköltség & profit |
| `20260718151404_hospitality-sales.sql` | Vendéglátás: eladás-napló |
| `20260718153555_hospitality-onetime.sql` | Vendéglátás: egyszeri kiadások saját időszakkal |
| `20260720130101_hospitality-menu-pricing.sql` | Vendéglátás: étlap / menü kettébontott árazás |
| `20260720134544_hospitality-recipes.sql` | Vendéglátás: alapanyag-árlista + receptek |
| `20260720151122_hospitality-suppliers.sql` | Vendéglátás: beszállító-kereső mentett keresései |
| `20260720162417_hospitality-recipe-custom.sql` | Vendéglátás: egyedi hozzávalók a receptben |
| `20260720171254_hospitality-menu-dishes.sql` | Vendéglátás: menüs ételek külön kezelése |
| `20260720222908_hospitality-supplier-favorites.sql` | Vendéglátás: kedvenc beszállítók |
| `20260720232822_professionals.sql` | Szakember-kereső: előzmény + kedvencek |
| `20260721135740_hospitality-ingredient-pack.sql` | Vendéglátás: csomagos beszerzési ár |
| `20260725100515_hospitality-supplier-jobs.sql` | Vendéglátás: beszállító-kereső PRO (aszinkron) |
| `20260726112658_hospitality-image-enhance.sql` | Ingatlan képjavító: előzmény + kedvencek |
| `20260726145108_asset-folders.sql` | Ingatlan-mappák a „Korábbi munkák” tálcához |
| `20260727092457_enhance-rejections.sql` | Nem elfogadott képjavító-eredmények naplója |
| `20260727100132_asset-hidden-dates.sql` | Elrejtett dátum-mappák a tálcán |
| `20260727114211_branding-assets.sql` | Arculati képtár: több logó és fotó profilonként |
| `20260728222004_video-v2.sql` | Videó 2.0 (Shotstack + fal.ai AI-klip) |
| `20260729080955_profile-company.sql` | Profil: teljes név + cég |
| `20260729082603_video-library.sql` | Videó-könyvtár: cím, poszter, mappák |
| `20260729143250_video-pro-clips.sql` | PRO videó: több AI-klip kezelése |
| `20260729154238_flyer-library.sql` | Hirdetés-könyvtár: mappák, áthelyezés, törlés |
| `20260729161524_ad-check.sql` | Hirdetés-ellenőrző: elemzések tárolása |
| `20260729165723_stripe-hardening.sql` | Stripe webhook megerősítése |
| `20260729174738_credit-grants.sql` | Kredit-napló (ki, kinek, mennyit adott) |
| `20260729181134_credit-requests.sql` | Kredit-kérés (sales) |
| `20260803185837_valuation-editor.sql` | Szerkeszthető értékbecslés |
| `20260804090436_valuation-library.sql` | Értékbecslés-könyvtár: mappák, áthelyezés, törlés |
| `20260804160440_valuation-gdn.sql` | GDN értékbecslés-prompt (stabilizálás, korrekciók) |
| `20260805081224_google-ads-connection.sql` | Google Ads OAuth-összekötés tárolása |
| `20260810153431_valuation-engine.sql` | Értékbecslő motor számszerű configja (verziózott) |
| `20260819113321_credit-billing.sql` | Számlázási adatok + számla-alapú kredit-kérés |
| `20260819121201_credit-billing-company.sql` | Céges számlázás: vásárló és cég adatai külön |
| `20260819123912_welcome-credits.sql` | 3 ingyenes próbakredit regisztrációkor |
| `20260826225403_valuation-jobs.sql` | Aszinkron értékbecslés job (`valuation_jobs`) |
| `20260828114903_asset-item-names.sql` | Képek saját elnevezése a tálcán |
| `20260908193217_ingatlan-invites.sql` | Ingatlanos ajándékkredit-kampány (/ingatlan) |
| `20260909103310_leads-handled.sql` | Beérkező megkeresések lezárása (admin) |
| `20260909105318_invite-code-sent.sql` | Ajándékkód kiküldésének naplózása |
| `20260909140658_branding-own-only.sql` | Az admin nem látja a partnerek arculatát |
| `20260909143057_valuation-jobs-history.sql` | Értékbecslés job ↔ előzmény-sor kapcsolat |
| `20260912003908_landing-signup-credits.sql` | Ingatlan landing: 10 kredit regisztrációkor |
| `20260928085945_profile-phone.sql` | Opcionális telefonszám a profilban |
| `20261005172806_app-settings.sql` | Rendszer-beállítások (kulcs → érték) |
| `20261006122751_video-favorites.sql` | Kedvenc videósablonok |
| `20261007093627_custom-module-request.sql` | Egyedi modul igénylése: telefon + visszahívás |
| `20261007123743_office.sql` | Irodai fiók alap táblák + kredit-függvények (IR1) |
| `20261007130334_office-topup.sql` | Irodai egyenleg feltöltése (IR6b) |
| `20261007130712_office-mode.sql` | Irodai munkamód + kreditlevonás (IR5) |
| `20261008080622_office-credit-requests.sql` | Kredit kérése a vezetőtől (IR6c) |
| `20261008081024_office-folders.sql` | Irodai mappák + megosztás (IR7) |
| `20261008081511_office-work-edit.sql` | Szerkesztés a közös mappákban (IR8) |
| `20261008083230_office-multi.sql` | Több irodai fiók + váltás köztük (IR9) |
| `20261008104953_office-reserve.sql` | Foglalásos keret-modell (IF1.1) |
| `20261008104954_module-favorites.sql` | Kedvenc modulok (IF4) |
| `20261008104955_office-messages.sql` | Irodai üzenetek és feladatok (IF3) |
| `20261008104956_office-credit-max.sql` | Irodai kreditkérés felső határa 9999 |
| `20261008121636_video-history-address.sql` | Régi videók megkapják az ingatlan címét |
| `20261008121637_work-folders.sql` | Saját munka-mappák (Korábbi munkák) |
| `20261008121638_usage-history-hidden.sql` | Törlés = elrejtés a Korábbi munkákban |
| `20261008121639_library-hidden.sql` | Törlés = elrejtés a videó- és hirdetés-ellenőrző könyvtárban |
| `20261012105023_team-workspace.sql` | Közös munkatér (KM1): `offices.kind`, kredit-átadás társnak, kilépés + munka-átadás |
| `20261012180016_team-owner-handover.sql` | Közös munkatér: gazdaváltás kilépéskor (legrégebbi társ) + meglévők javítása |
| `20261012183311_module-views.sql` | Modul-megnyitások naplója (admin Modul-használat, fejenként naponta egy sor) |

## Egyszeri szkriptek (`one-off/`)

| Fájl | Mire való |
|---|---|
| `test-invite-cleanup.sql` | Ajándékkód-teszt takarítása (teszt e-mail-cím törlése előtte/utána) |
