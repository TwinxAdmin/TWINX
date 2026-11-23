# 19 – Fejlesztési díj, ajánlat és fizetés követése (D52 terv)

Állapot: terv, döntések rögzítve 2026-11-23-án. Kódolás nincs, a CODE-prompt csak átadáskor készül.
Kapcsolódó: `14-adatmodell-terv.md` (company_modules, naplózás), `12-admin-terv.md` (admin menü), `13-hozzaferesek-terv.md` (érvényesség és hozzáférés).

## 1. Döntések (Márk, 2026-11-23)

- **D51 – tesztkörnyezet:** nincs külön környezet. Csak additív, visszafordítható migrációk; előtte mentés/PITR; ha a csomag engedi, ideiglenes Supabase branch; minden migrációhoz down szkript; az új funkciók csak adminnak látszanak, amíg nincs leellenőrizve.
- **D52 – fizetési napló:** külön `company_payments` tábla (nem néhány mező a `company_modules`-on).
- **Számlázó:** Számlázz.hu. Az első fázisban a számla kézzel készül ott, a számlaszámot az admin írja vissza. Később a Számla Agent API köthető be (Hamarosan).
- **Láthatóság:** az első fázisban csak az admin látja a fizetési adatokat. A cégvezetői „Számláim" nézet később.
- **Ajánlat-követés kell**, és **részletfizetés lehet** (előleg / maradék, mérföldkőhöz kötve).
- **Lejárati figyelmeztetés:** automatikus, **3 nappal és 1 nappal** a lejárat előtt.

## 2. Folyamat (admin szemszögéből)

1. A cég oldalán az admin **ajánlatot** rögzít (cím, nettó összeg, ÁFA, érvényesség, megjegyzés). Állapot: Vázlat → Elküldve → Elfogadva / Elutasítva / Lejárt.
2. Az **Elfogadva** gombnál megadja a részletezést (pl. egy összegben, vagy előleg + maradék, százalékkal vagy összeggel). Egyetlen tranzakcióban létrejönnek a fizetési tételek (Esedékes), az ajánlat pedig Elfogadva lesz.
3. Az admin a Számlázz.hu-ban kiállítja a számlát, majd a tételnél rögzíti a **számlaszámot** → állapot: Kiszámlázva.
4. Befizetés után a tételnél **„Fizetve"** → állapot: Fizetve, fizetési dátummal és móddal.
   - Havi díj típusú tételnél ugyanabban a tranzakcióban nő a modul érvényessége (`company_modules.valid_until`) a tétel időszakával.
   - Fejlesztési díj tételnél az érvényesség nem változik. A modul állapotát (pl. Fejlesztés → Teszt) az admin továbbra is kézzel állítja, a rendszer legfeljebb figyelmeztet („az előleg még nincs kifizetve"). Az **Átadva** állapotba csak az átadási bejegyzéssel lehet lépni (`23`, D56); az átadás **nem változtat automatikusan** fizetési tételt, csak emlékeztetőt mutat, ha az „átadáskor" mérföldkő tétel még nincs kiszámlázva.
5. Hiba vagy tévedés esetén: **Visszatérítve** vagy **Törölve** állapot, indoklással. A sor nem törlődik, csak állapotot vált (nyomvonal).

Nincs automatikus hozzáférés-megvonás a fizetési késésből az első fázisban, a lejárat szabályát a hozzáférési terv (13/14) adja.

## 3. Adatmodell (új táblák, additív)

**`company_quotes`**: id, company_id, company_module_id (üres lehet: a modul az ajánlat után jöhet létre), title, amount_net, vat_rate, currency (HUF), valid_until, status (`vazlat`, `elkuldve`, `elfogadva`, `elutasitva`, `lejart`), sent_at, accepted_at, note, created_by, created_at, updated_at.

**`company_payments`**: id, company_id, company_module_id (üres lehet), quote_id (üres lehet), kind (`fejlesztesi_dij`, `havi_dij`, `egyeb`), milestone (`eloleg`, `maradek`, `atadaskor`, üres), description, amount_net, vat_rate, amount_gross, status (`esedekes`, `kiszamlazva`, `fizetve`, `visszaterítve`, `torolve`), due_date, invoice_number (egyedi, ha nem üres), invoice_issued_at, paid_at, payment_method (`atutalas`, `keszpenz`, `kartya`, `stripe`), period_from, period_to (havi díjhoz), billing_snapshot (jsonb: a számlázási adatok a rögzítés pillanatában, hogy utólagos módosítás ne írja át), stripe_payment_intent_id és stripe_invoice_id (üresek, a későbbi automatizmushoz), status_reason, created_by, created_at, updated_at.

**`expiry_notifications`**: id, company_module_id, valid_until (a lejárati dátum, amire szólt), days_before (3 vagy 1), sent_at. Egyedi: (company_module_id, valid_until, days_before) → ugyanarra a lejáratra egy értesítés sem megy ki kétszer; a hosszabbítás új lejárati dátumot ad, így új értesítések jönnek.

Számlázási adatok a cégen (`companies`): számlázási név, adószám, cím, számlázási e-mail. Cégalapítás és az adatok véglegesítése után töltendő (`[KITÖLTENDŐ]`); addig a mezők üresen hagyhatók.

Az `access_audit_log` mintájára minden pénzügyi állapotváltás naplózódik (ki, mikor, mi változott).

## 4. Függvények (security definer, csak service_role hívhatja; az API a munkamenetből adja át az adminazonosítót)

- `quote_create` / `quote_update_status`
- `quote_accept(quote_id, tételek[])`: ajánlat elfogadása és a fizetési tételek létrehozása **egy tranzakcióban**; ellenőrzi, hogy a tételek összege egyezik az ajánlat összegével.
- `payment_set_invoiced(payment_id, invoice_number, issued_at)`: Esedékes → Kiszámlázva; a számlaszám egyedi.
- `payment_mark_paid(payment_id, paid_at, method)`: Kiszámlázva (vagy Esedékes) → Fizetve; havi díjnál a `valid_until` meghosszabbítása **ugyanabban a tranzakcióban** (a hosszabbítás a mostani lejárat vagy a mai nap közül a későbbitől számít); naplóbejegyzés. Kétszer nem futhat le (idempotens, Fizetve állapotra nem hat újra).
- `payment_refund` / `payment_cancel`: indoklással; visszatérítésnél a már megadott érvényesség visszavonását az admin külön, tudatosan kezeli (nem automatikus, `[ELDÖNTENDŐ]`).
- `expiry_notifications_due()`: azokat a modulokat adja vissza, amelyek lejárata 3 vagy 1 nap múlva van, és még nem ment ki értesítés.

## 5. Lejárati figyelmeztetés

- Naponta egyszer fut egy ütemezett feladat (Vercel cron vagy Supabase pg_cron, a CODE választ; a végpontot titokkal kell védeni).
- A 3 és 1 nappal lejárat előtti modulokról **az adminnak** küld értesítést: Telegram (sima szöveg) és az admin felületen jelzés az „Előfizetések" listában (színes „Lejár 3 nap múlva" címke). Tartalma: cég neve, modul, lejárat dátuma, a legutóbbi fizetési tétel állapota.
- Cégnek küldött lejárati e-mail **nincs** az első fázisban (Hamarosan); a szöveg később a `16-email-szovegek.md`-be kerül.
- A számítás magyar (Budapest) idő szerint történik, a nyári/téli időszámítás váltására is helytállóan.
- Felfüggesztett (szünetel) vagy lemondott modulról nem megy értesítés.

## 6. Admin felület

- **Cég oldala → „Ajánlatok" és „Fizetések" fül.** Kártyák, a műveletek egy „⋯" menüben (Számlaszám rögzítése, Fizetve, Visszatérítés, Törlés indoklással). A váltós dobozok mérete fix, nincs ugrálás.
- **Admin menü → „Pénzügy"** (összesítő lista a cégeken át): fülek *Esedékes / Kiszámlázva / Fizetve / Lejáró modulok*; szűrés cégre és időszakra; **CSV-export a könyvelőnek** (BOM-mal, hogy az Excel ékezetesen nyissa).
- „Hamarosan" jelzés: Stripe-fizetés, Számla Agent (automatikus számlázás), cégvezetői „Számláim" nézet.
- A cégvezető és a felhasználó **semmilyen** pénzügyi adatot nem lát; az API és az RLS is megtiltja (nem csak a felület rejti el).

## 7. Biztonság és szabályok

- Az új táblákra RLS: kliensről nincs olvasás/írás; minden művelet service_role függvényen át megy.
- Pénzügyi művelet és állapotváltás mindig egy tranzakcióban (a meglévő minta).
- A böngészőben nincs titkos kulcs; a Számlázz.hu és a Stripe kulcsai csak szerveroldalon (később).
- Nincs nyilvános ár; a pénzügyi adat nem kerül a weblapra, a hírlevélbe vagy az ügynök-naplókba.
- A számlákra vonatkozó megőrzési idő és az adatkezelés a `17` tájékoztatóban jogász által ellenőrzendő pontként szerepel.
- Migráció: D51 szerint additív, down szkripttel, mentés után, admin-only bekapcsolással.

## 8. Ellenőrzési lista (a fejlesztés végére)

1. Ajánlat elfogadása: a tételek összege eltér → hibával megáll, semmi nem jön létre; egyezik → minden tétel létrejön, az ajánlat Elfogadva (egy tranzakció).
2. Számlaszám egyedi: ugyanaz a szám kétszer nem menthető.
3. Havi díj „Fizetve": a `valid_until` pontosan az időszakkal nő; kétszeri kattintás vagy két párhuzamos kérés nem hosszabbít kétszer.
4. Fejlesztési díj „Fizetve": az érvényesség nem változik.
5. Törölt és visszatérített tétel nem számít bele az összesítőbe; a sor megmarad indoklással és naplóval.
6. Lejárati értesítés: 3 és 1 nappal előtte pontosan egyszer megy ki; hosszabbítás után új lejáratra új értesítés jön; szünetelő modulról nem.
7. Cégvezető és felhasználó fiókkal a pénzügyi API 403/üres, az RLS kliensről semmit nem enged.
8. CSV-export ékezetekkel helyesen nyílik Excelben.
9. Meglévő ingatlanos modulok és a régi fizetési táblák érintetlenek.
10. Mobilon és asztali gépen a dobozok nem ugrálnak.

## 9. Nyitott pontok

- Visszatérítésnél az érvényesség automatikus visszavonása kell-e (javaslat: nem, az admin dönt).
- Késedelmes (határidőn túli, még nem fizetett) tételek jelzése az adminnak (javaslat: igen, a lista „Késik" címkéje; külön értesítés később).
- Cégnek küldött lejárati és fizetési emlékeztető e-mail (később).
- Számla Agent és Stripe bekötése: cégalapítás és Számlázz.hu-fiók beállítása után.
- A számlázási adatok mezőinek végleges köre a könyvelővel egyeztetendő.
