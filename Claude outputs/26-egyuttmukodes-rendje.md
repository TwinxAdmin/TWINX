# 26 – Az együttműködés rendje: tervező projekt, fejlesztés, ügynökség (D59)

Állapot: jóváhagyva (Kovács Márk, 2026-11-23). Cél: a három munkahely ne csússzon szét, és Márknak a lehető legkevesebb kézi teendője legyen.

## 1. Szerepek

| Hol | Mi a dolga | Mit nem csinál |
|---|---|---|
| **TWINX projekt (tervező, itt)** | Ötletelés, tervezés, döntések, a tervek és a döntési napló kezelése, CODE-promptok megírása. | Nem fejleszt. |
| **Fejlesztési beszélgetés (Cowork / Claude Code)** | A CODE-promptok megvalósítása a repóban, ellenőrzés, visszajelzés. | Nem dönt a termékről; nem módosítja a terveket. |
| **Ügynökség-beszélgetés** | Az ügynökség (MAX és az alügynökök) építése és üzemeltetése. | Ugyanez: nem dönt a termékről, a tervet nem módosítja. |

Márk a közvetítő: ő dönt, ő viszi át az exportot és a visszajelzést.

## 2. Három szabály (D59)

1. **Egy igazság-forrás tárgykörönként.** A döntések és tervek a tervező projektben élnek, és csak ott módosulnak. A kód tényei (mi él, milyen az adatbázis valójában) a repóban vannak. Ellentmondásnál a technikai tényekben a kód, a döntésekben a terv az irányadó. A repóban lévő `docs/terv/` másolat **csak olvasható**: ha ott valaki szerkeszti, az nem számít, a következő export felülírja.
2. **Lépés-lezárás rituálé.** Amikor egy CODE-lépés elkészül, a fejlesztési beszélgetés bejegyzést ír a `VISSZAJELZES.md`-be (3. szakasz). Márk visszamásolja ide; a tervező beszélgetés átvezeti a terveket, és új exportot készít. **Új lépést csak szinkron után indítunk.**
3. **Egy közös lista a nyitott és a parkolt dolgokról** (6. szakasz). Új ötlet nem vész el, és nem szakítja meg az aktuális témát.

## 3. A lépés-lezárás menete

1. A fejlesztési beszélgetés befejezi a lépést, lefuttatja az ellenőrzési lépéseket, és kitölti a `VISSZAJELZES.md` új bejegyzését (sablon az 5. szakaszban).
2. Márk bemásolja a bejegyzést ide, a tervező beszélgetésbe.
3. A tervező beszélgetés átvezeti: a `04` modulállapotát és buktatóit, a döntési naplót (ha új döntés kell), a nyitott listát; eltérésnél javaslatot tesz (a terv módosul, vagy a kódot javítjuk). Márk dönt.
4. A tervező beszélgetés új exportot készít (`terv-export.zip`), benne a frissített `VALTOZASOK.md`-vel.
5. Márk a `docs/terv/` mappát lecseréli az új exporttal. A fejlesztési beszélgetés a `VALTOZASOK.md`-ből látja, mit kell újraolvasnia.
6. Jöhet a következő lépés CODE-promptja.

Tervmódosításnál (nem csak lépés-lezáráskor) is készül új export; a `VALTOZASOK.md` első sora mindig a legfrissebb.

## 4. Az ügynökség-beszélgetés ugyanígy

> **Export-ellenőrzés:** ha egy export fájljai hiányosan érkeznek (pl. az `ai-ugynokseg/` almappa nem másolódik át), a fogadó beszélgetés a `VALTOZASOK.md` listája alapján ellenőrzi, és jelzi Márknak, mi hiányzik.


- Ugyanazt a `docs/terv/` másolatot olvassa (az ügynökségi dokumentumokkal, `ai-ugynokseg/02, 03, 06–10`, kérésre bekerülnek az exportba).
- A visszajelzése is `VISSZAJELZES.md` bejegyzés (a bejegyzés fejlécében a „Melyik beszélgetés” mező jelzi: Fejlesztés vagy Ügynökség).
- Az ügynökségi dokumentumok (`02`, `09`, `10`) szinkronja a D40–D58 döntésekkel még hátravan (lásd 6. szakasz).

## 5. Sablonok (a zip-ben fájlként is)

**`VALTOZASOK.md`** (a tervező beszélgetés vezeti, a repóban csak olvasható)
```
## [dátum] – [export sorszáma] (döntések: Dxx–Dyy)
- Új dokumentum: …
- Módosult: [fájl] – [mi változott, egy sorban]
- Új döntés: Dxx – [cím]
- Mit kell újraolvasnia a fejlesztésnek: [fájlok]
```

**`VISSZAJELZES.md`** (a fejlesztési / ügynökség-beszélgetés vezeti; új bejegyzés felülre). **Az élő fájl a repó gyökerében van** (nem a `docs/terv/` alatt, mert azt minden export felülírja); a `docs/terv/` alatt csak a sablon található.
```
## [dátum] – [lépés neve, pl. 1. Főoldal és referencia-landing]
Melyik beszélgetés: Fejlesztés | Ügynökség
Terv, amiből dolgoztunk: [fájlok, export dátuma]
Elkészült: [rövid lista]
Eltérés a tervtől: [mi és miért; vagy „nincs”]
Új buktató / tanulság: [vagy „nincs”]
Nem lett kész / Hamarosan: [vagy „nincs”]
Ellenőrzési lépések eredménye: [rendben | hiba: …]
Döntés kell tőled, Márk: [kérdések; vagy „nincs”]
Éles állapot: [mi látszik élesen; mi csak adminnak]
```

## 6. Nyitott és parkolt lista (karbantartott; a tervező beszélgetés frissíti)

**Parkolt (később, külön döntéssel):**
- Szerződés-, NDA- és ÁSZF-sablonok jogásszal (D58).
- A futó Meta-kampány és az /ingatlan landing átdolgozása az új vonalra (D31).
- Stripe-előfizetés automatizmus (2. fázis) és a Számla Agent bekötése.
- Az irodai fiók közös tere (3. fázis).
- A partner ág (aktiváló, gyártó) újratervezése (D31).
- A cégvezetői „Lemondás kérése” és „Átvettem” gomb, bizonyíték feltöltése (Hamarosan, D54, D56).
- Az ajánlat-ellenőrző lista és kalkuláció admin-funkcióvá alakítása (D57).

**Nyitott (eldöntendő vagy kitöltendő):**
- Ügynökségi dokumentumok szinkronja a D40–D58 döntésekkel (`02`, `09`, `10`; a `05` marketing D53-szintű).
- A D46 megerősítendő alapértelmezései: a külön meghívási jog megszűnik; egy felhasználó több cégben is lehet; a meghívó 7 napig érvényes; ha az előfizetés az elfogadás után lejár, a hozzáférés nem aktiválódik.
- A megőrzési határidő napjai az NDA-val; a számviteli megőrzési idő (könyvelő/jogász); a mentések kezelése törlésnél (D54).
- A belső óradíj és az óraszám-becslés módja (Márk); az első kitöltött kalkuláció az első valódi modulnál; a kitöltött kalkuláció tárolási helye (D57).
- Az első API-költséges modul havi plafonjának értékei (D44, D53).
- A felhasználói szövegek finomhangolása a próbafelületen (D55).
- Adatkezelési tájékoztató: jogász és cégadatok (kapu a foglalás és meghívás éles indítása előtt); cégalapítás; Számlázz.hu fiók; Resend domain-hitelesítés.
- Tibi hitelesíti a referencia-landing csoportjait és modulleírásait; a főoldal képi anyaga.
- Az ügynökség: alügynökök alapokmányai; a Modul tesztelő teszt-környezete és a Felmérő jegyzet-útja; havi API-plafon az ügynökségre (javaslat: 20 USD); indulási kapu (egyeztetés Tiborral).
