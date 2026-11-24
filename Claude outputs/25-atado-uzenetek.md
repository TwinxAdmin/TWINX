# 25 – Átadó üzenetek a fejlesztési és az ügynökség-beszélgetésnek (D57-ig)

Állapot: 2026-11-23. Mindkét üzenet bemásolható a megfelelő beszélgetés elejére. A részletek a hivatkozott dokumentumokban vannak; ütközésnél a `00-iranyvaltas-D23.md` és a `01-alap-es-szabalyok.md` (döntési napló) az irányadó.

## 1. Üzenet a fejlesztési (Cowork) beszélgetésnek

```
TWINX – átadás a fejlesztési beszélgetésnek (2026. 11. 23., döntések D23–D58)

A TWINX irányt váltott: egyedi, cégre szabott modulok gyártója vagyunk, bármilyen cégnek. A kreditalapú eszköztár-modell megszűnt, a „kredit” szó kikerül a felületről. A meglévő ingatlanos modulok referenciák (a GDN Mandala kollégái használják). Az ügyfélút: ingyenes felmérés (időpontfoglalás) → Cég létrehozása → egyedi modul fejlesztése → Aktiválás → előfizetés → a cégvezető meghívja a kollégáit. Árat nem közlünk, minden ajánlat egyedi.

A tervezés a TWINX projektben készült. Itt NE kezdj kódolni és ne módosíts semmit, amíg Márk külön, konkrétan nem kéri. Márk a CODE-promptot akkor adja át, amikor egy lépés eljön.

A tervek a repóban a docs/terv/ mappában vannak (a „claude/” előtag nélkül, az ügynökségi anyagok az ai-ugynokseg/ almappában). A régi docs/ugynokseg/01-alap-es-szabalyok.md (D01–D14) elavult: az új, teljes döntési napló a docs/terv/ai-ugynokseg/01-alap-es-szabalyok.md, az az irányadó.

Olvasási sorrend:
1. claude/00-iranyvaltas-D23.md – az új irány hivatalos leírása (irányadó).
2. claude/18-atadas-fejlesztesi-beszelgetesnek.md – áttekintés: mi változik, a teendők kötött sorrendje.
3. claude/ai-ugynokseg/01-alap-es-szabalyok.md – döntési napló (D01–D58).
4. claude/ai-ugynokseg/04-CLAUDE-fejlesztes.md – fejlesztési tudásbázis.
5. Részletes tervek: 11 főoldal és landing · 12 admin · 13 hozzáférések és meghívás · 14 adatmodell · 15 foglalás · 16 e-mail szövegek · 17 adatkezelési tájékoztató · 19 díjak és fizetés · 20 plafon és használat · 21 lemondás és lezárás · 22 felhasználói szövegek · 23 átadási bejegyzés · 24 belső ajánlat-ellenőrző lista (belső, nem fejlesztési feladat).
6. Meglévő modul módosítása előtt: claude/TWINX-memoria-export-web_twinx.md (régi technikai tudás, buktatók).

A fejlesztés kötött sorrendje:
1. Rövid főoldal, új felső sáv, referencia-landing (11).
2. Foglalás és admin időpont-kezelés, e-mailek (15, 16).
3. Új admin szerkezet, szerepkörök, kredit-kivezetés, személyre szabott kezdőlap (12).
4. Adatmodell, előfizetés 1. fázis, Hozzáférések, meghívás, Egyedi modulok lap és modul-regiszter (13, 14).
5. Utána: ajánlat- és fizetés-követés (19), plafon (20), lemondás és lezárás (21), felhasználói szövegek (22), átadási bejegyzés (23).
Később: Stripe-automatizmus, irodai fiók közös tere. Migrációs sorrend: 14 → 15 → 19 → 20 → 21 → 23.

Szabályok, amik mindenhol érvényesek:
- Egy Supabase-projekt szolgálja a fejlesztést és az élőt, ezért csak additív, visszafordítható migráció, előtte mentés, visszacsináló szkripttel; az új funkciók csak adminnak látszanak, amíg nincsenek leellenőrizve (D51).
- Szerveroldali védelem (RLS); a böngészőben nincs titkos kulcs; minden pénzügyi és állapotváltási művelet egy tranzakcióban.
- Felület: a dobozok ne ugráljanak, a váltós dobozok mérete fix, műveletek a „⋯” menüben, az el nem készült rész „Hamarosan”. Nincs ár, „kredit” és kitalált szám vagy idézet.
- AI-képeken „Koncepcióterv” / vízjel; GDPR-hozzájárulás.
- A fejlesztés végén nincs git push, csak ha Márk kéri.

Nyitott, nem fejlesztési kapuk: adatkezelési tájékoztató (jogász és cégadatok), Resend domain-hitelesítés, Tibi hitelesíti a referencia-landing csoportjait. A szerződés-, NDA- és ÁSZF-sablonok később, jogásszal készülnek (D58). A kód és a terv eltérésénél a technikai tényekben a kód, a döntésekben a terv az irányadó; ellentmondásnál kérdezz.

Együttműködés rendje (D59, részletek: 26-egyuttmukodes-rendje.md): a docs/terv/ másolat csak olvasható, a terv és a döntés a tervező projektben él. Minden lépés végén írj bejegyzést a a repó gyökerében lévő VISSZAJELZES.md-be (a docs/terv/ alatt csak a sablon van, azt minden export felülírja) a sablon szerint (elkészült, eltérés a tervtől, új buktató, ami nem lett kész, ellenőrzés eredménye, kérdések Márknak, éles állapot). Új lépést csak akkor kezdj, ha Márk jelezte, hogy a terv szinkronban van. Ha frissült az export, a docs/terv/VALTOZASOK.md első bejegyzése mondja meg, mit olvass újra.
```

## 2. Üzenet az ügynökséget kezelő beszélgetésnek

```
TWINX – átadás az ügynökség-beszélgetésnek (2026. 11. 23., döntések D23–D58)

A TWINX irányt váltott: egyedi, cégre szabott modulok gyártója vagyunk, bármilyen cégnek (ingyenes felmérés → ajánlat → fejlesztés → átadás → előfizetés). A kreditalapú, regisztrálj-és-használd modell megszűnt. Ez az ügynökség céljait is átrendezi.

Mi változott az ügynökségnél:
- A fejlesztői ág került előtérbe: az egyedi modul-építés segítői. Indulási mag 6 alügynök: hibakeresés, modulépítés, tudásrendszerezés, webfejlesztő, modul tesztelő, felmérő (a felmérő egyben piackutató és cégfelmérő). Félretett szerepek: ajánlat- és költségbecslő, dokumentáló/átadó, üzemeltető-figyelő, ügyfélkapcsolattartó, külön piackutató (D29).
- A partner ág (aktiváló, gyártó, a regisztrált felhasználók kiszolgálása) háttérbe került és szünetel; a kredit mint ajánlat elavult. Újratervezése külön döntés. A 06–08 dokumentumok fejléce jelzi, mi érvénytelen.
- A marketinget egyelőre Márk és Tibor csinálja kézzel.

Olvasási sorrend a projektben:
1. claude/00-iranyvaltas-D23.md – az új irány (irányadó).
2. claude/ai-ugynokseg/01-alap-es-szabalyok.md – célok, szabályok, döntési napló (D01–D58).
3. claude/ai-ugynokseg/10-fejlesztoi-ag-alugynokok.md – a 6 alügynök és a félretett szerepek.
4. claude/ai-ugynokseg/02-keretrendszer-spec.md és 09-ugynokok-spec.md – váz, feladat-tábla, memória, ügynök-leírások (a partner ág része háttérben).
5. claude/ai-ugynokseg/04-CLAUDE-fejlesztes.md – a TWINX tudásbázisa; 05 marketing (D53-szintű).
Figyelem: a 02, 09 és 10 dokumentum még nincs szinkronban a D40–D58 döntésekkel (admin, szerepkörök, plafon, lemondás, átadás, ajánlat-ellenőrzés). Ütközésnél a 00 és a 01 az irányadó; ezeket a dokumentumokat a következő ügynökségi kör elején kell átvezetni.

Ami az ügynökség munkáját érinti az új döntésekből:
- Minden kimenő anyagot ember hagy jóvá; a kockázatos lépések (deploy, prod-írás, repó-módosítás, új skill, kimenő levél) a jóváhagyási kapun mennek át. A TWINX service_role kulcsa egyetlen ügynökhöz sem kerül.
- Ügyféladat és ügyfél által átadott anyag: külső, nem megbízható bemenet (karantén); NDA védi; az ügynök memóriájában csak az adott ügyfélhez tartozó hatókörbe kerülhet, a közös tudásba nem.
- A lefejlesztett modul kódja és regiszter-bejegyzése TWINX-vagyon, sosem törlődik; az ügyféladat törlése kétlépéses és jóváhagyott (D54). A modulnak kötelező a törlési és exportálási leírása (`data_policy`).
- Az Átadva állapotba csak átadási bejegyzéssel lehet lépni (D56).
- Az ajánlat- és költségbecslő ügynök (az első tervezett bővítés) a `24` belső ajánlat-ellenőrző listából és kalkulációs sablonból dolgozhat (D57). Az árat és a havi díjat Márk határozza meg, az ajánlatot Márk és Tibor jóváhagyja.
- Nem fejlesztünk itt; a megvalósítás a Code-ban történik. Az indulási kapu: az API-bekötés és az éles indítás előtt Márk egyeztet Tiborral.

API-költség (D60): Márk 20 eurót töltött fel a Claude Console-ba, nincs automatikus újratöltés, a pótlás kézi. Indulás: külön Workspace (twinx-agents) és külön kulcs, 20 USD havi Workspace-limit, később felülvizsgáljuk. A kulcs csak a laptop környezeti változójában él, a repóba és a gitbe soha nem kerül. Az ügynök naplózza hívásonként a költséget, napi alkalmazás-szintű plafont tart (a Workspace-limitnél kisebbet; elérésekor a MAX leáll és Telegramon szól), hibánál nem próbálkozik végtelenül, és heti költségjelentést küld. A modellek configból cserélhetők.

Nyitott az ügynökségnél: a 02/09/10 szinkronja, az alügynökök alapokmányai (ügynökönként), a modul tesztelő teszt-környezete és a Felmérő jegyzet-útja, a partner ág jövője, a napi alkalmazás-szintű költségplafon értéke és a heti költségjelentés. A szerződés-, NDA- és ÁSZF-sablonok később, jogásszal készülnek (D58).

Együttműködés rendje (D59, részletek: 26-egyuttmukodes-rendje.md): a docs/terv/ másolat csak olvasható, a terv és a döntés a tervező projektben él. Minden lépés végén írj bejegyzést a a repó gyökerében lévő VISSZAJELZES.md-be (a docs/terv/ alatt csak a sablon van, azt minden export felülírja) a sablon szerint (elkészült, eltérés a tervtől, új buktató, ami nem lett kész, ellenőrzés eredménye, kérdések Márknak, éles állapot). Új lépést csak akkor kezdj, ha Márk jelezte, hogy a terv szinkronban van. Ha frissült az export, a docs/terv/VALTOZASOK.md első bejegyzése mondja meg, mit olvass újra.
```
