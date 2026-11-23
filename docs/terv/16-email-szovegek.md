# TWINX rendszer-e-mailek és értesítések — végleges szövegek (D49)

> **Státusz:** jóváhagyva (Kovács Márk, 2026-11-23). Ezek a szövegek mennek a CODE-promptba; a `13` (5. szakasz) és a `15` (2. és 6. szakasz) tervezetei helyett ez az irányadó.
> **Küldés:** Resend, küldő neve „A TWINX csapata" (a twinx.hu domain hitelesítése kell). **Nyelv:** magyar, tegező.

> **Kiegészítés (D55):** a rendszer felületi szövegeit (modul nem elérhető, meghívó-oldal, Besorolatlan, cégvezetői megerősítések és hibák) és a **kinevezett cégvezető értesítő levelét** a `claude/22-felhasznaloi-szovegek.md` tartalmazza.

## Hangnem
- Tegező, rövid, aláírás: **A TWINX csapata**. Köszönés: **„Szia!"** (a névsorrendet nem ismerjük).
- Nincs bennük ár, „kredit", AI-említés, ígért határidő, a cég belső adata a megnevezetten túl.
- Minden levél alján egy sor: office@twinx.hu · adatkezelési tájékoztató linkje `[amint kész]`.
- A levél és az oldal ugyanazt mondja minden címnek (nem derülhet ki, hogy egy cím regisztrált-e).

## 1. Meghívó (a kollégának)
**Tárgy:** Meghívást kaptál a(z) [Modul neve] használatára — [Cég neve]

> Szia!
> [Meghívó neve] a(z) [Cég neve] nevében meghívott, hogy használd a(z) [Modul neve] modult a TWINX-en.
> **[Belépés]**
> Ha még nincs TWINX fiókod, ugyanezzel az e-mail címmel regisztrálj. Ha már van, egyből beléphetsz.
> A meghívó 7 napig érvényes. Ha nem számítottál rá, nyugodtan hagyd figyelmen kívül.
> A TWINX csapata

## 2. Foglalás visszaigazolása (időponttal)
**Tárgy:** Foglalásodat rögzítettük — [nap, idő]

> Szia!
> Rögzítettük az ingyenes felmérési időpontodat: **[nap, idő]**. [Gazda neve] telefonon hív erre a számra: [telefon].
> Ha nem jó, itt lemondhatod: **[Lemondás]**
> Kérdésed van? office@twinx.hu
> A TWINX csapata

## 3. Visszahívási kérés visszaigazolása (időpont nélkül)
**Tárgy:** Megkaptuk a kérésed

> Szia!
> Megkaptuk a megkeresésed, hamarosan keresünk ezen a számon: [telefon].
> Addig is: office@twinx.hu
> A TWINX csapata

## 4. Lemondás megerősítése
**Tárgy:** Foglalásodat lemondtuk

> Szia!
> A(z) [nap, idő] időpontot lemondtuk. Ha mégis szeretnél beszélni velünk, itt foglalhatsz újat: twinx.hu
> A TWINX csapata

## 5. Telegram-értesítés Márknak és Tibinek (egyszerű szöveg, formázás nélkül)
> Új foglalás: [nap, idő] · [gazda]
> [név], [cég]
> [telefon] · [e-mail]
> [a leírás első ~200 karaktere]

A látogató szabad szövege külső bemenet: kurtítva, egyszerű szövegként kerül bele, formázott (HTML/Markdown) mód nélkül.

## Megjegyzések a CODE-nak
- A gombok (Belépés, Lemondás) a 13 és a 15 terv szerinti, egyszer használatos, hash-elt tokenes linkek; a levélben a nyers token csak a linkben szerepel.
- A [Meghívó neve] a meghívó cégvezető megjelenített neve; ha nincs, „Egy kollégád".
- A [nap, idő] budapesti helyi idő, magyar formátumban (pl. „2026. november 30., hétfő 10:00").
- Minden levélnek legyen egyszerű szöveges változata is.
