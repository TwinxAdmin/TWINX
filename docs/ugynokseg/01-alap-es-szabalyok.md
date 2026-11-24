# TWINX AI ügynökség — alap és szabályok

> **Mi ez:** a tervezés közös alapja. Itt rögzítjük a célokat, a szabályokat és a döntéseket,
> hogy minden ötieltelés erre épüljön, és a végén tisztán átadható legyen a Code-nak.
> **Ez a beszélgetés = tervező ablak.** Itt tervezünk és döntünk; **kódot nem írunk** — minden
> fejlesztés a Code-ban történik, az itt lefektetett alap és döntési napló alapján.
> **Nyelv:** magyar. **Jelölés:** `[KITÖLTENDŐ]` / `[DÖNTÉSRE VÁR]` a nyitott részek.

---

## 1. Küldetés

- **Elsődleges cél:** egy AI ügynökség, ami **első körben a TWINX fejlesztését** gyorsítja — Márk irányításával viszi az ismétlődő, jól körülírt munkát, miközben a döntés és a minőség emberi kézben marad.
- **Hosszú távú cél:** a rendszer ne csak fejlesztésre szóljon — **egy-egy szakosodott ügynök később más munkára is alkalmazható** legyen (pl. e-mail, marketing posztok, képek, videók). Ugyanaz a váz, új szakosodott ágak.
- **Nevesített kreatív cél:** a **TWINX népszerűsítése** — saját marketing/kreatív tartalom (hirdetések, social posztok, reels) gyártása a bevált sablonokból, hogy a promóció ne akadjon el. Ez a TWINX *saját* marketingje; a termék ügyfél-kimenete (a modulok kreatív outputja) ettől külön, termék-oldali sáv.
- **Vezérgondolat:** nem „minden automata", hanem **az ismétlődő, sablonozható rész gépre kerül, hogy Márk a koncepcióra, a minőségellenőrzésre és a döntésekre koncentrálhasson.**

## 2. Hatókör és fázisolás

- **Most:** fejlesztői keretrendszer, Márk otthoni gépén. Ez az első, bizonyított sáv (a TWINX-fejlesztés).
- **Később (bővítés):** szakosodott ügynökök más feladattípusokra. Fontos realitás, hogy ezek természete eltér:
  - A **fejlesztői** ágak valódi ügynökök (kódot írnak, javasolnak, tesztelnek).
  - A **kreatív** ágak (marketing poszt, kép, videó) **sablon-kitöltő pipeline-ok emberi minőségellenőrzéssel** — a koncepció és a végső döntés Márké, a gép a bejáratott sablonból sokszoroz és nyersanyagot ad.
  - Az **e-mail / szöveges** ágak a kettő között: draftot ír a bejáratott hangnemben, az ember hagyja jóvá.
- **Külön sávok, amiket most NEM keverünk ide** (amíg nem döntünk külön róluk): a termékbe/weblapra épített ügyfél-ügynök (hibrid TWINX-modell), és bármely éles, ügyfelet kiszolgáló telepítés.
- **Bővítés szabálya:** új szakosodott ügynök mindig a háromrészes sablonnal (alapokmány / képességek / memória-hatókör) regisztrál be — a főügynök kódját nem kell módosítani.

## 3. Indulási kapu (üzleti)

- Az **API-bekötés és az ügynökség éles indítása előtt Márk egyeztet az üzlettársával.**
- Ha az üzlettárs is egyetért → kezdődik a tesztelés és fejlesztés úgy, hogy a rendszer relevánsan segítsen (e-mail, marketing posztok, képek, videók, TWINX-fejlesztések stb.).
- Addig a tervezés (ez az ablak) és a költségmentes részek mehetnek; az LLM-hajtotta, fizetős rész a döntésig szünetel.

## 4. Hogyan ötletelünk itt (a mi munkamódszerünk)

- **Döntés előbb, kód soha itt.** Ez tiszta gondolkodó tér; a megvalósítás a Code-é.
- **Opció + ajánlás + Márk döntése.** Minden érdemi kérdésnél 2-3 út, ajánlással és indoklással, majd várunk a döntésre.
- **Őszinteség a kedvesség előtt.** Ha egy ötlet gyenge, korai vagy drágább, mint amennyit ad — ez elhangzik, nem bólogatunk.
- **Egy döntés = egy rögzített sor** a döntési naplóban (7. szakasz), hogy a Code ne ötleteljen újra.
- **Nincs scope-kúszás.** Egyszerre egy témát viszünk végig; az új ötletet elraktározzuk és visszatérünk rá.

## 5. A rendszer vezérelvei (a termék szabályai)

- **MAX (főügynök) vékony, delegál — nem dolgozik.** Irányít és oszt; a munkát a szakosodott al-ügynökök végzik.
- **Javasol → Márk jóváhagyja.** Minden kockázatos/visszafordíthatatlan lépés (deploy, prod-írás, TWINX-repó módosítás, új skill, önmódosítás) a kapun megy át.
- **Állapotmentes pulzus.** Minden állapot a Supabase-ben, nem „a fejben" — kikapcsolt gép után is folytatható.
- **Ami kívülről jön, karanténba kerül.** Külső input (webhook, netes skill) sosem kap automatikusan bizalmat vagy jogot.
- **Determinista, ahol lehet; LLM csak a valódi döntési pontokon.** Ez tartja olcsón és kiszámíthatóan a rendszert.
- **Vendor-függetlenség.** Modell és külső API configból cserélhető, nem szóródik szét a kódban.
- **Naptár-alapú ütemezés.** A napi/heti folyamatok naptár szerint futnak, nem futásidő-óra alapján.
- **Megbízhatóság a sebesség előtt.** Inkább lassabb és biztos (kapuzott), mint gyors és elszálló.

## 6. A rendszer váza, röviden (a teljes leírás a külön specben)

- **MAX (főügynök):** intake Telegramon → feladatbontás → útválasztás → kiosztás a feladat-táblán → felügyelet → kapu → összegzés. Plusz „dreaming" mód (napi napló + top 3, heti konszolidáció + külső felderítés), mindig javaslati jogkörrel.
- **Al-ügynökök:** három jogosultsági osztály (olvasó / író / meta), háromrészes sablon. Induló mag: kutató-diagnoszta (olvasó), modul-építő (író), skill-építő (meta); web- és Supabase-ügynök később.
- **Feladat-tábla (gerinc):** `nyitott → kiosztva → fut → kapura_vár → kész/elakadt`, függőségekkel. Minden koordináció ezen és a közös memórián át megy — nincs közvetlen ügynök-ügynök hívás.
- **Memória:** hot/warm/cold ügynökönként + közös memória; az alapokmány külön a tierektől; minden soron scope + owner_id a megoszthatósághoz.
- **Stack:** Supabase (memória + feladat-tábla), Telegram (felület), Node.js/TypeScript, launchd (óránkénti pulzus), Claude API (modellek).

## 7. Döntési napló (ezt viszi tovább a Code)

> Amit eddig eldöntöttünk, egy helyen. Új döntés mindig ide, egy sorban.

- **D01 — Stack:** a TWINX weblap Vercel + Supabase + Rackforest (csak DNS) + GitHub; a szerveroldali logika natív Next.js API route-okban fut, külső automatizáció (Make/Zapier) tilos.
- **D02 — Keretrendszer nyelve:** Node.js / TypeScript (egy világ a weblappal).
- **D03 — Memória + feladat-tábla:** külön Supabase-projektben (`twinx-agents`), NEM a termék-DB-ben — hibahatár és jogosultság miatt.
- **D04 — Felület:** Telegram (elsőre csak Márknak; egy-egy ügynök később megosztható).
- **D05 — Ütemezés:** launchd, óránkénti pulzus; csak a gép bekapcsolt állapotában fut (személyes dev-eszköznél elfogadható).
- **D06 — Modellek:** Claude — Haiku 4.5 a rutinra, Sonnet 5 a valós munkára, Opus 5 csak kivételként; configból cserélhető.
- **D07 — Weblap-ügynök:** egyelőre nincs; a termék-modulok pipeline-ok maradnak. Parkolva.
- **D08 — Készültség:** 0. és 1. fázis kész és fut (táblák, bot, pulzus, heartbeat). A 2. fázis (első valódi ügynök) LLM-költséggel jár.
- **D09 — Költség-sáv:** az API a MAX-előfizetésen FELÜL van, külön számla; az éles indulás az üzlettárssal való egyeztetés után (3. szakasz).
- **D10 — Kreatív/marketing ág:** nevesített cél a TWINX saját népszerűsítése (hirdetés, social, reels). Formája: sablon-kitöltő pipeline + emberi minőségellenőrzés (a koncepció és a döntés Márké), a bevált eszközökkel (Higgsfield, Nano Banana, Kling, DaVinci). Ugyanaz a kapu (üzlettárs + API) és saját számla (API + eszköz-kredit, pl. Higgsfield). Külön a termék kreatív kimenetétől.
- **D11 — Első éles ág (2026-11-05): aktiváló ügynök.** A TWINX-fejlesztést Márk egyelőre nem adja ki a kezéből. Az ügynökség első feladata a regisztrált, de nem aktív felhasználók motiválása (első generálás → második használat → vásárlás). Kiinduló adat (2026-11-05): a landingről jött 21 felhasználóból 14 nem generált semmit, 7 egyszer próbált, vásárlás 0. Első kör: lásd D14.
- **D12 — Hangnem és aláírás (2026-11-05):** a kimenő üzeneteket „A TWINX csapata" írja alá; a felhasználó felé egy iroda áll a TWINX mögött, az ügynököt nem említjük. Kitalált munkatárs nincs. Minden kimenő anyagot ember hagy jóvá; felhasználói válaszra az ügynök csak tervezetet ír, a küldés emberi döntés (EU AI Act 50. cikk). Részletek: `06-aktivalo-ugynok-hangnem.md`.
- **D13 — Gyártó ág, „Készítsük el neked" (2026-11-05):** ha az ügynökség felajánlja, hogy a felhasználó anyagából elkészíti az anyagot, azt az ügynökség saját gyártó ága végzi (beérkeztető, gyártó, minőségellenőr, kézbesítő ügynök), nem Márk. Beküldés: személyes linkes **feltöltő oldal**. Költség: **első körben a TWINX állja**, a felhasználó kreditjei érintetlenek maradnak (kreditszám nélkül kommunikálva) — barátságosan, de hangsúlyosan. Felhasználónként **1 ingyenes gyártás**, utána visszajelzés-kérés (elégedettség, érdeklődés egy későbbi fizetős „Készítsük el neked" szolgáltatás iránt, vélemény a TWINX-ről). **Minden ingatlanos modul** igénybe vehető (a Prémium 3D csak élesedése után); a tényadat csak a felhasználótól vagy a saját hirdetéséből jöhet. Kézbesítés: **a felhasználó fiókjába**, értesítő levéllel. Keret: **napi max. 10 gyártás**; e fölött MAX Telegramon jelez, és Márk adhat engedélyt többre. Jóváhagyás: Márk Telegramon, **kivéve az értékbecslést**, amely emberi jóváhagyás nélkül megy (a saját motorban bízunk; formai minőségellenőrzés marad). **Gyenge fotóknál** is gyártunk, és a minőségellenőr képre szabott, konkrét tippet ad. Részletek: `07-gyarto-ag-spec.md`.
- **D14 — Aktiváló ügynök, első kör (2026-11-05):** napi állapot-besorolás (nem erősített / nem kezdte el / egyszer próbálta / visszatérő / fogyó kredit / vásárló / alvó) és állapotonkénti levélsorozatok. **Küldés:** az ügynök a saját rendszerből (Resend) küld, a Brevo ötrészes üdvözlő sorozata megmarad, és összehangoljuk vele (a Brevo-levelek is beleszámítanak a gyakorisági korlátba). **Hívás egyelőre nincs**, csak levelek mennek. **Jóváhagyás:** reggel egyben Telegramon, „Mehet mind" gombbal, egyenkénti belenézési lehetőséggel. **Meglévő felhasználók:** egyszeri felzárkóztatással, 3 napra elosztva. **Visszajelzések:** a TWINX admin „Visszajelzések" listájába, Telegramra és a heti jelentésbe. Részletek: `08-aktivalo-ugynok-elso-kor.md`.
- `[KITÖLTENDŐ — új döntések, ahogy jönnek]`

## 8. Nyitott döntések / kapuk

- `[DÖNTÉSRE VÁR]` Üzlettárssal való egyeztetés → megy-e az éles indulás (API + tesztelés).
- `[DÖNTÉSRE VÁR]` Modellek havi költségkerete (spend limit) a Console-ban.
- `[DÖNTÉSRE VÁR]` A bővítési sorrend: az aktiváló ügynök (D11) után melyik szakosodott ág jön (marketing poszt? kép/videó? TWINX-dev?).
- `[KITÖLTENDŐ]` Fizetős „Készítsük el neked" szolgáltatás: ár és csomag, a gyártó ág visszajelzései alapján.
- `[KITÖLTENDŐ]` A kreatív ágak sablonkészlete (ez a munka 80%-a — előre, nem élesben).
- `[KITÖLTENDŐ]` Adatkezelési tájékoztató: egy mondat az aktivitás alapú automatikus csoportosításról (az /adatkezeles oldal a cégalapításra vár).

## 9. Átadás a Code-nak

Amikor a tervezés egy szakasza kész, a Code három dolgot kap:
1. **Ez az alap-dokumentum** (célok + szabályok + döntési napló).
2. Az **ügynök-keretrendszer specifikációja** (teljes felépítés + fázisokra bontott építési sorrend).
3. A **`CLAUDE.md`** (a TWINX tudásbázisa).
Plusz a már megépített projekt (`twinx-agents`), amit a Code-ba viszünk tovább.
Az aktiváló ügynökhöz ezen felül: **`06-aktivalo-ugynok-hangnem.md`** (hangnem, aláírás, GDPR-típusok, gyakoriság), **`07-gyarto-ag-spec.md`** (a „Készítsük el neked" gyártó ág) és **`08-aktivalo-ugynok-elso-kor.md`** (állapotok, sorozatok, jóváhagyás, felzárkóztatás).
