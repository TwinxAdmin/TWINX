# TWINX ügynökség – következő feladatok (rendezett lista)

> **Mire való:** egy helyen, sorrendben mutatja, mi a következő az ügynökség átalakításában. Nem új döntés: a `01` (döntési napló), a `02` 10. szakasza, a `10` 6. szakasza és a `26` 6. szakasza alapján készült.
> **Ki frissíti:** a tervező projekt. Ha ez és a `01` ellentmond, a `01` az irányadó.
> **Állapot:** 2026-11-23, döntések D23–D61.

---

## 0. Mi van már kész
- 0. és 1. fázis (alapok, csupasz hurok): megvan (D08). Supabase `twinx-agents` (D03), Telegram-bot, launchd.
- API-költség keret (D60): Console, külön Workspace `twinx-agents`, külön kulcs, 20 USD havi limit, nincs auto-reload. Márk a keretet beállította.
- Irány (D23) és a 6 alügynök (D29) eldöntve. A partner ág szünetel (D31).

## 1. Márk teendői az ügynökség indulása előtt
1. A terv mappát **egészben** másolni az ügynökség repójába `docs/terv/` néven (az `ai-ugynokseg` almappával).
2. Új beszélgetés az ügynökség repójában; az átadó üzenet teljes szövegét bemásolni.
3. Egyeztetés Tiborral (indulási kapu, `01` 3. szakasz) az API-bekötés és az éles indítás előtt.
4. A Console ellenőrzőlista (kulcs csak környezeti változóban / `.env`-ben, `.gitignore`, alacsony egyenleg figyelmeztetés, hónap eleji emlékeztető).

## 2. Az ügynökség-beszélgetés feladatai, sorrendben
A beszélgetés nem kódol, amíg Márk nem kéri. Minden lépés végén `VISSZAJELZES.md` bejegyzés; új lépés csak a szinkron után.

1. **Beolvasás és visszamondás.** Olvasási sorrend: `00` → `01` → `10` → `02`, `09` → `04`, `05`. A beszélgetés röviden visszamondja, mit értett, és mit nem. Az első `VISSZAJELZES.md` bejegyzés.
2. **A `02`, `09`, `10` szinkronja a D40–D61 döntésekkel.** A beszélgetés összeszedi, mi ütközik (admin, szerepkörök, plafon, lemondás, átadás, ajánlat-ellenőrzés, ügyféladat-kezelés), és javaslatot ír; a terv a tervező projektben módosul, nem a repóban.
3. **Költségvédelem kódja** (D60): napi alkalmazás-szintű plafon (a Workspace-limitnél kisebb; elérésekor a MAX leáll és Telegramon szól), hívásonkénti költség-napló, nincs végtelen újrapróbálkozás hibánál, heti költségjelentés. A napi plafon értékét Márk dönti el a beszélgetés javaslata alapján.
4. **Alapokmányok** (ügynökönként, háromrészes sablon, `02` 4.2). Először a **Hibakeresés** és a **Modulépítés**, mert a 2. és 3. fázis ezekre épül; a többi később.
5. **Nyitott döntések előkészítése** (mindegyiknél 2–3 opció ajánlással, Márk dönt):
   - a Modul tesztelő teszt-környezete (külön Supabase-ág vagy fejlesztői adatbázis) és mit futtathat;
   - a Felmérő jegyzet-útja (Telegram, doc, űrlap);
   - melyik LLM-modell melyik ügynököt hajtsa;
   - a regiszter külön tábla vagy a közös memória egy szelete;
   - a pulzuson belüli körök felső korlátja;
   - a Telegram-bot parancsai.
6. **2. fázis: intake + Hibakeresés** (csak olvas). Telegramon feladat → `nyitott` sor → a Hibakeresés felveszi → javaslat a `result`-ba → a MAX visszaküldi.
7. **3. fázis: az első kapu + Modulépítés** (`gate_required` / `gate_decision`); minden az ő munkájából kapuzott.
8. **4. fázis:** memória-tierek (hot/warm/cold) és a napi napló.
9. **5. fázis:** Tudásrendszerezés és a heti „dreaming”.
10. **6. fázis:** Webfejlesztő, Modul tesztelő, Felmérő; függőségek, párhuzam, guardrail-korlátok.

A weboldal újraépítése **nem erre vár**: az a fejlesztési beszélgetésben (Claude Code) készül, a `docs/terv/` tervei szerint.

## 3. Amit az adatmodellnél most, költség nélkül be kell tartani (D61)
A kért „Ügynökség” admin-oldal parkolt, de későbbi bekötését most semmi nem zárhatja el:
1. A feladat- és szál-táblákban **külön rövid, nyilvános mezőkészlet** (cím, állapot, ügynök, időbélyeg, költség) és **külön `privat` tartalom**. Egy későbbi nézet csak az előbbit olvashatja.
2. **Csak olvasható adatbázis-szerepkör** az állapot-adatokhoz (az ellenkező irány: a TWINX `service_role` kulcsa sosem megy ügynökhöz; ez a szerepkör sem kapja meg a `privat` tartalmat, és a böngészőbe sem kerül).
3. A jóváhagyás marad a Telegramon. Webes jóváhagyás csak később, külön döntéssel.

## 4. Parkolt (külön döntéssel, most nem)
- „Ügynökség” admin-oldal a twinx.hu adminban (D61): addig Telegram-összefoglalók és a Supabase felülete.
- A partner ág (aktiváló, gyártó) újratervezése (D31) és a hozzá tartozó 06–08 dokumentumok.
- Marketinges ügynök (egyelőre kézzel: Márk és Tibor).
- Termékbe kerülő ügynök (`02` 9. szakasz).
- Szerződés-, NDA-, ÁSZF-sablonok jogásszal (D58).

## 5. Félretett szerepek (csak az első valódi megrendelések tapasztalata után)
- **Ajánlat- és költségbecslő**: az első bővítés; a `24` ellenőrző listából és kalkulációs sablonból dolgozik. Az árat Márk adja meg, az ajánlatot Márk és Tibor hagyja jóvá.
- Dokumentáló/átadó, üzemeltető-figyelő, ügyfélkapcsolattartó, külön piackutató.
- Adatvédelmi őr: szabály, nem ügynök.

## 6. Állandó szabályok az egész munkán át
- Minden kimenő anyagot ember hagy jóvá; deploy, prod-írás, repó-módosítás, új skill, kimenő levél és ügyféladat kijuttatása kapun megy át.
- A TWINX `service_role` kulcsa egyetlen ügynökhöz sem kerül; az Anthropic-kulcs nem kerül repóba vagy gitbe.
- Ügyféladat csak `privat` hatókörben; névtelenített tanulság csak kapun át a közösbe.
- Nincs `git push`, csak ha Márk kéri.
