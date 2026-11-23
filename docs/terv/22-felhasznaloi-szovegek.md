# 22 – Felhasználói szövegek: modul-elérés, meghívó-oldal, fiók-állapotok, cégvezetői üzenetek (D55)

Állapot: **jóváhagyva** (Kovács Márk, 2026-11-23). Kódolás nincs, a CODE-prompt csak átadáskor készül.
Kapcsolódó: `16-email-szovegek.md` (a rendszer-e-mailek; ez a dokumentum kiegészíti), `13-hozzaferesek-terv.md`, `21-lezaras-es-lemondas-terv.md` (8. szakasz), `20-plafon-es-hasznalat-terv.md` (leállás), `12-admin-terv.md`.

## 1. Döntések (Márk, 2026-11-23)

- **A felhasználó mindig ugyanazt a szöveget kapja, ha a modul nem érhető el** (lejárt előfizetés, lemondott modul, nem aktív modul). A szöveg nem árulja el az okot, a pénzügyi vagy belső részletet, a lemondás indokát. A részleteket a cégvezető tőlünk tudja meg.
- **Kinevezésről levél megy, eltávolításról nem.** A kinevezett cégvezető e-mailt kap (6. szakasz); az eltávolított kolléga a következő belépésnél látja, hogy a modul eltűnt, külön levelet nem kap.

## 2. Hangnem és szabályok (a `16` szerint)

- Tegező, rövid. Nincs bennük ár, „kredit", AI-említés, ígért határidő.
- A meghívó-oldal és a levél minden címnek ugyanazt mondja (nem derülhet ki, hogy egy cím regisztrált-e).
- A hibákat az adatbázis-függvények **kód + magyar üzenet** formában adják (`14`, 3. szakasz); a felület ezt a szöveget mutatja, a kódot nem.
- A szövegek egy helyen élnek a kódban (egy szövegfájl), nem szétszórva a komponensekben.
- Hosszú nevek, hosszú szöveg: a doboz mérete nem változhat (fix méretű dobozok).

## 3. A. Modul nem elérhető

| Hol | Szöveg |
|---|---|
| **Felhasználónak** (lejárt, lemondott vagy nem aktív modul; mindig ugyanaz) | „Ez a modul most nem érhető el. Kérdezd a cégvezetőt, vagy írj nekünk: office@twinx.hu." |
| **Cégvezetőnek**, a Hozzáférések ablakban | „A(z) [Modul] hozzáférése [dátum] óta nem aktív. Az újraindításhoz keress minket: office@twinx.hu." |
| **Plafon-leállás** (felhasználónak, a költséges művelet helyén) | „A havi keret erre a funkcióra elfogyott, ezért most nem indítható. Az elkészült anyagaidat továbbra is eléred. Szóltunk a csapatnak." |

- A cégvezetői szövegben a dátum a hozzáférés megszűnésének napja; a lemondás indokát és a pénzügyi adatot a cégvezető sem látja.
- A plafon-leállásnál számot, Ft-értéket vagy a keret nevét nem írunk ki.

## 4. B. Meghívó-oldal

| Állapot | Szöveg |
|---|---|
| Érvényes meghívó, még nem belépett | „Meghívást kaptál a(z) [Modul] használatára a(z) [Cég] nevében. Lépj be, vagy regisztrálj ugyanazzal az e-mail címmel, amelyre a meghívó érkezett." |
| Hibás, lejárt, visszavont vagy már elfogadott (**mind egyforma**) | „Ez a meghívó már nem érvényes. Kérd meg a cégvezetőt, hogy küldjön újat." |
| Más e-mail című fiókkal belépve | „Ezt a meghívót másik e-mail címre küldték. Lépj be azzal a címmel, amelyre érkezett." |
| Nincs megerősített e-mail cím | „Előbb erősítsd meg az e-mail címedet, utána elfogadhatod a meghívót." |
| Sikeres elfogadás | „Kész! A(z) [Modul] elérhető a Moduljaim menüben." |
| Elfogadás után a modul nem aktív | „A meghívót elfogadtad, de a modul most nem aktív, ezért még nem használhatod. Szólj a cégvezetőnek." |

- Az „érvényes, még nem belépett" oldalon a gombok: **Belépés** és **Regisztráció**; a Regisztráció az e-mail címet előre kitöltve, szerkeszthetetlenül kéri (a `13` szerint).
- A „más e-mail című fiók" üzenet nem árulja el a meghívott címét.

## 5. C. Fiók-állapotok

| Hol | Szöveg |
|---|---|
| **Besorolatlan** kezdőlap (nincs cége; lezárt cég volt tagja is ide kerül) | „A fiókod létrejött, de még egyik céghez sincs hozzárendelve. Ha meghívót kaptál, a levélben kattints a Belépés gombra. Ha velünk dolgozol, írj: office@twinx.hu." |
| **Regisztráció**, az űrlap fölött | „Ha meghívót kaptál, ugyanazzal az e-mail címmel regisztrálj, amelyre a meghívó érkezett." |
| Üres **Moduljaim** menü | „Itt jelennek meg az egyedi moduljaid." (változatlan, `11`) |

- A Regisztráció hozzájárulási és tudomásul vételi szövege a `17`, 10. szakasza szerint marad.

## 6. D. Cégvezetői megerősítések és hibák (Hozzáférések ablak)

| Helyzet | Szöveg | Gombok |
|---|---|---|
| Kolléga eltávolítása | „Eltávolítod [Név]-t a(z) [Modul] használói közül? A hozzáférése azonnal megszűnik, a munkái nála maradnak." | Eltávolítás · Mégse |
| Kinevezés cégvezetővé | „[Név] cégvezető lesz a(z) [Cég] cégnél. Meghívhat, eltávolíthat, kinevezhet másokat, és fizethet is. Biztosan?" | Kinevezés · Mégse |
| Lemondás a saját státuszról | „Lemondasz a cégvezetői státuszról? Utána nem tudsz meghívni és eltávolítani. Új státuszt csak másik cégvezető vagy mi adhatunk." | Lemondok · Mégse |
| Utolsó cégvezető (`utolso_cegvezeto`) | „Nem mondhatsz le, mert a cégnek mindig kell legalább egy cégvezetője. Előbb nevezz ki másikat." | – |
| Nincs szabad hely (`nincs_szabad_hely`) | „Nincs szabad hely. Vonj vissza egy meghívót vagy távolíts el egy kollégát, vagy kérj több helyet: office@twinx.hu." | – |
| A levél nem ment ki | „A meghívó létrejött és foglalja a helyet, de a levelet nem sikerült elküldeni. Próbáld újra." | Újraküldés |
| Lejárt meghívó (`meghivo_lejart`), a cégvezető felületén | „Ez a meghívó lejárt. Küldj újat." | Újraküldés |
| Nem aktív modul (`modul_nem_aktiv`), új meghívásnál | „Ez a modul most nem aktív, ezért nem tudsz meghívni. Keress minket: office@twinx.hu." | – |

## 7. E. Kinevezett cégvezető értesítő levele (új, a `16` kiegészítése)

**Tárgy:** Cégvezető lettél — [Cég neve]

> Szia!
> [Kinevező neve] kinevezett cégvezetőnek a(z) [Cég neve] cégnél a TWINX-en.
> Mostantól meghívhatsz és eltávolíthatsz kollégákat, kinevezhetsz másik cégvezetőt, és te is fizethetsz.
> **[Hozzáférések megnyitása]**
> Ha nem számítottál erre, írj nekünk: office@twinx.hu
> A TWINX csapata

- A [Kinevező neve] a kinevező cégvezető megjelenített neve; ha az admin nevezte ki, vagy nincs név: „A TWINX csapata".
- Küldés: Resend, a `16` szabályai szerint (egyszerű szöveges változat is, aláírás, lábléc-sor az adatkezelési tájékoztató linkjével).
- A gomb a belépett felhasználót a Hozzáférések ablakra viszi (nincs benne token, mert a kinevezett már aktív tag és belépett fiókkal dolgozik).
- Eltávolításról és a hozzáférés megszűnéséről **nem megy levél** (1. szakasz).

## 8. Megjegyzések a CODE-nak

- A szövegek egy központi szövegfájlban éljenek, kulcsokkal; a hibakódok (`utolso_cegvezeto`, `nincs_szabad_hely`, `meghivo_lejart`, `modul_nem_aktiv`) erre képeződnek le.
- A „modul nem elérhető" felhasználói szöveg **egyetlen kulcs**, amelyet a lejárat, a lemondás és a nem aktív állapot egyaránt használ; a felület semmilyen módon nem különböztetheti meg őket (nincs eltérő szöveg, ikon vagy szín).
- A meghívó-oldal hibás, lejárt, visszavont és elfogadott meghívóra **ugyanazt a választ és ugyanazt a szöveget** adja.
- A kinevezési levél az `appoint_head` függvény sikere után megy ki az API-ból; küldési hiba nem akasztja meg a kinevezést (a felületen jelzés, újraküldés a „⋯" menüből `[Hamarosan]`).
- A szövegek nem tartalmazhatnak árat, kreditet, belső azonosítót vagy más cég adatát.

## 9. Ellenőrzési lista (a fejlesztés végére)

1. Lejárt, lemondott és nem aktív modulnál a felhasználó **szóról szóra ugyanazt** a szöveget látja.
2. A cégvezetői szöveg a dátumot mutatja, de lemondási indokot és pénzügyi adatot nem.
3. Plafon-leállásnál nincs szám a szövegben; az elkészült anyagok továbbra is elérhetők.
4. A meghívó-oldal hibás, lejárt, visszavont és elfogadott meghívóra ugyanazt mondja; regisztrált és nem regisztrált címre ugyanazt.
5. Más e-mail című fiókkal belépve a szöveg nem árulja el a meghívott címét.
6. Megerősítetlen e-mail címmel az elfogadás nem megy át, a szöveg megjelenik.
7. Az utolsó cégvezető lemondása a megadott szöveggel elutasított.
8. A kinevezett levelet kap; az eltávolított kolléga nem kap levelet.
9. A dobozok mérete nem változik hosszú név vagy hosszú szöveg esetén.
10. A Besorolatlan kezdőlap lezárt cég egykori tagjánál is megjelenik, üres doboz nélkül.

## 10. Nyitott pontok

- A szövegek véglegesítése a próbafelületen (hosszúság, tördelés).
- A kinevezési levél újraküldése és a küldési hiba kezelése `[Hamarosan]`.
- A lezárt cég egykori tagjának külön szövege (jelenleg a Besorolatlan szöveg), ha később kell.
