# TWINX ügynökség — gyártó ág („Készítsük el neked”)

> **Mi ez:** az aktiváló ügynök (D11) „megcsináljuk helyetted” ajánlatának végrehajtó része. A felhasználó beküldi az anyagát, az ügynökség legyártja a TWINX meglévő moduljaival, és a kész anyag a felhasználó fiókjába kerül.
> **Döntések:** D11, D12, D13 (01-alap-es-szabalyok.md). **Hangnem:** 06-aktivalo-ugynok-hangnem.md.
> **Állapot:** terv, jóváhagyva 2026-11-05. Fejlesztés a Code-ban, az ügynökség éles indulási kapuja után (3. szakasz az alapban).

---

## 1. A felhasználó útja

1. **Meghívó levél** (az aktiváló ügynök küldi, „A TWINX csapata” aláírással):
   „Küldd el egy hirdetésed fotóit, és **mi elkészítjük neked** a bemutató videót. **Ezt most mi álljuk, a kreditjeid érintetlenek maradnak.**” (Általános szöveg, konkrét kreditszám nélkül, mert a felhasználók egyenlege eltérő.) Egy gomb: **„Elküldöm a fotókat”** → személyes link.
2. **Feltöltő oldal** (`twinx.hu/keszitsuk-el?t=<token>`, belépés nélkül is működik a tokennel):
   - Mit kérsz? Kártyák: videó / hirdetéskép / értékbecslés (csak az engedélyezett modulok, lásd 7. pont).
   - Fotók feltöltése (4–5 db) VAGY a hirdetés linkje.
   - Alapadatok (ár, település, méret, szobák), ha a linkből nem jönnek ki. Előre kitöltve, ha a link alapján megvannak.
   - Pipa: „A fotók az enyémek, vagy jogom van felhasználni őket.”
   - Gomb: **„Kérem az elkészítést”**.
   - Köszönő képernyő: „Megkaptuk! 24 órán belül elkészítjük, és levélben szólunk. Ezt most mi álljuk, a kreditjeid megmaradnak.”
3. **Értesítő levél, ha kész:** „Elkészült a videód! Nézd meg a fiókodban.” Gomb: **„Megnézem”** → belépés → a fiókja „Korábbi munkák” részébe, a kész anyagra.
4. **A fiókjában** a kész anyag ugyanúgy szerepel, mint amit maga készített: letölthető, átnevezhető, mappába tehető. Mellette egy halk jelölés: „A TWINX csapata készítette neked”.
5. **Visszajelzés-kérés, amikor megnézte a kész anyagot** (belépés után a munkája mellett egy kis kártyán, ÉS ha 2 napon belül nem válaszol, egy rövid levélben):
   - „Tetszett, hogy elkészítettük helyetted?” → 1–5 csillag.
   - „Igénybe vennéd később is, hogy mi készítsük el helyetted az anyagaidat?” → *Igen, szívesen / Talán / Nem, inkább magam csinálom*.
   - „Mit gondolsz a TWINX-ről? Mi tetszik, mi hiányzik?” → szabad szöveg (nem kötelező).
   - Köszönő szöveg: „Köszönjük! Minden visszajelzést elolvasunk.”

**Szabály:** **felhasználónként 1 ingyenes gyártás** jár. A második kérésnél a feltöltő oldal barátságosan jelzi, hogy az ingyenes elkészítést már igénybe vette, és felajánlja, hogy a modult maga is használhatja a kreditjeiből.

**Kommunikáció:** barátságosan, de mindig kimondva, hogy **ezt a TWINX állja**, és a kreditek megmaradnak. Ez az ajánlat lényege. Kreditszámot nem írunk, mert egyenlegenként eltér.

**A visszajelzés célja (későbbre):** ha valakinek tetszik, hogy helyette dolgozunk, abból egy **fizetős „Készítsük el neked” szolgáltatás** lehet, ahol az ügynökség rendszeresen gyárt a partner helyett. A felhasználó felé ez mindig „a TWINX csapata elkészíti” formában jelenik meg (D12), nem AI-ügynökként. Az „Igen, szívesen” válaszolók listája lesz az első célcsoport, amikor a fizetős változat elindul.

## 2. Az ügynökség belső útja

| Lépés | Ügynök | Mit csinál | Ember |
|---|---|---|---|
| 1 | **Beérkeztető** | Fogadja a kérést, ellenőrzi a képszámot, a méretet és az adatokat. Ha valami hiányzik, előkészít egy visszakérdező levelet. | – |
| 2 | **Napi keret őre (MAX)** | Ha aznap már 10 gyártás elindult, a kérés várólistára kerül, és MAX Telegramon jelez. | Márk dönt: „+N” engedély vagy holnapra |
| 3 | **Gyártó** | A felhasználó nevében, szerveroldalon elindítja a TWINX-modult a beküldött anyaggal. Szöveget a hirdetésből vesz, nem talál ki adatot. | – |
| 4 | **Minőségellenőr** | Ellenőrzi: stimmelnek-e az adatok (ár, méret, település), olvashatók-e a feliratok, rajta van-e a jelölés vagy vízjel, nincs-e hibás vagy üres kocka. Hibánál egyszer újragyárt, utána jelez. | – |
| 5 | **Jóváhagyás** | Telegram: előnézeti kép + adatok + két gomb (Mehet / Újra). **Kivétel: az értékbecslés** — ott nincs emberi jóváhagyás, a saját motor eredménye a minőségellenőr után megy (lásd 9. pont). | Márk, kb. 10 mp |
| 6 | **Kézbesítő** | A kész anyagot a felhasználó fiókjába teszi, és elküldi az értesítő levelet. | – |

## 3. Napi keret

- Legfeljebb **10 gyártás indulhat egy naptári napon** (Europe/Budapest).
- A 11. kérésnél MAX Telegram-üzenetet küld: „Ma már 10 gyártás ment. 3 kérés vár. Engedélyezel többet?” Gombok: **+3 / +5 / Holnapra**.
- Engedély nélkül a kérés várólistán marad, és másnap elsőként indul. A felhasználó a köszönő képernyőn és levélben is 24 órás határidőt kap, ehhez kell tartani magunkat.

## 4. Költség

- A gyártás **a TWINX költsége**: a felhasználótól nem vonunk kreditet (`credits_charged = 0`).
- Minden gyártás API-költsége rögzül (a meglévő költségnaplóba, `source = 'agency'` jelöléssel), így látszik, mennyibe kerül egy aktivált felhasználó.
- Az alapértelmezett modulok olcsók (Alap videó, hirdetéskép, értékbecslés). A drága PRO videó nem része az ajánlatnak.

## 5. Adat és technika (a Code-nak)

- **Ügynökség-oldal (`twinx-agents` Supabase):** `production_requests` tábla — felhasználó, kért modul, beküldött anyag hivatkozása, státusz (`beerkezett → varolista → gyartas → ellenorzes → kapura_var → kezbesitve / elakadt`), napi sorszám, költség, időbélyegek. A feladat-tábla mintáját követi.
- **Termék-oldal (TWINX Supabase):** a feltöltött fotók a felhasználó saját tárhely-útvonalára kerülnek. A kész anyag a megszokott helyre kerül (`usage_history` / `video_jobs`), `credits_charged = 0` és egy jelölés (pl. `input_data.made_by = 'twinx-team'`), hogy a felületen megjelenhessen a „A TWINX csapata készítette neked” címke.
- **Gyártás a felhasználó nevében:** egy belső, csak szerveroldalról hívható végpont, ami a meglévő modul-logikát futtatja egy adott `user_id`-re, kreditlevonás nélkül. Csak az ügynökség szolgáltatáskulcsával hívható, kívülről nem érhető el.
- **Token-link:** felhasználónként egyedi, aláírt token, 14 napig érvényes, egyszer beküldhető. A token csak a saját fiókjához ad feltöltési jogot.
- **Feltöltési korlát:** képenként max. méret (kliensoldali tömörítéssel, ahogy a többi modulnál), legfeljebb 5 kép, csak képformátum.
- **Biztonság:** a hirdetés-link tartalma külső input, karanténban kezelendő. Csak adatot nyerünk ki belőle, utasítást nem hajtunk végre.

## 6. Mérés

- Hányan nyitják meg a meghívót, hányan küldenek be anyagot.
- Hányan lépnek be megnézni a kész anyagot (ez az aktiválás).
- Hányan használják utána **maguk** az oldalt 7 napon belül.
- Hányan vásárolnak 30 napon belül.
- A visszajelzések: átlagos csillag, és hányan válaszolnak „Igen, szívesen” a fizetős elkészítésre.
- Átlagos költség gyártásonként és aktivált felhasználónként.

## 7. Nyitott kérdések

- **ELDÖNTVE (2026-11-05):** felhasználónként 1 ingyenes gyártás; utána visszajelzés-kérés (elégedettség, érdeklődés a fizetős szolgáltatás iránt, vélemény a TWINX-ről).
- `[KITÖLTENDŐ]` Fizetős „Készítsük el neked” szolgáltatás: ár, csomag, kreditben vagy havidíjban — a visszajelzések alapján, később.
- **ELDÖNTVE (2026-11-05):** minden modul igénybe vehető. A szükséges adatok forrását a 8. pont írja le.
- **ELDÖNTVE (2026-11-05):** gyenge fotóknál is legyártjuk az anyagot, és a kézbesítő levélben barátságos, **képre szabott** tippet adunk (lásd 10. pont).

## 8. Honnan veszi az ügynökség az adatokat? (modul-receptek)

**Alapelv:** minden modulnak van egy **receptje**: mely adatok kötelezők, és honnan jönnek. A feltöltő oldal ebből a receptből építi fel a saját mini-űrlapját, így a kérés csak akkor küldhető be, ha minden kötelező adat megvan. Visszakérdezni csak kivételes esetben kell.

**Források, ebben a sorrendben:**

1. **A hirdetés linkje** (ha megadja): cím, ár, település/kerület, alapterület, szobaszám, típus, leírás, fotók. Csak a saját, nyilvános hirdetéséből. A tartalom külső input, karanténban kezelve: csak adatot nyerünk ki belőle.
2. **A fiókja:** arculati profil (név, titulus, telefon, e-mail, logó, iroda), ha van; különben a profil adatai (név, cég, telefon).
3. **A feltöltő oldal űrlapja:** amit az 1–2. pont nem adott meg, azt itt kérjük. Az ismert adatok előre ki vannak töltve, a felhasználó javíthatja őket.
4. **Az ügynökség választása:** amit nem kell a felhasználótól kérdezni (sablon, méret, képsorrend, képfeliratok, hangnem), azt a gyártó ügynök választja, a felhasználó viszont kérheti a sajátját („Bízd ránk” az alapértelmezett).

**Szabály:** adatot **soha nem találunk ki**. Ha egy kötelező adat nincs meg, az űrlap kéri; ha egy nem kötelező adat hiányzik, kimarad az anyagból.

### Hirdetéskép (példa a receptre)

| Adat | Kötelező? | Forrás |
|---|---|---|
| Fotók (1 fő + max. 3) | igen | link vagy feltöltés |
| Cím / főcím | igen | link → űrlap |
| Ár | igen | link → űrlap |
| Település, kerület | igen | link → űrlap |
| Alapterület, szobaszám | igen | link → űrlap |
| Rövid leírás, kiemelések | nem | link szövegéből az ügynök rövidíti (új tényt nem tesz hozzá) |
| Ingatlanos neve, telefon, e-mail | igen | arculati profil → profil → űrlap |
| Logó | nem | arculati profil |
| Sablon és méret | nem | „Bízd ránk” (az ügynök választ), vagy a felhasználó kiválasztja |
| Képfeliratok | nem | helyiség-felismerés (a meglévő `/api/flyer/arrange`) |

A többi modul receptje a 9. pontban van, a modulok kódja alapján felülvizsgálva.

## 9. Modul-receptek — a kód alapján felülvizsgálva (2026-11-05)

> Forrás: a TWINX repó API-végpontjai és validációi (`src/app/api/...`, `src/lib/...`). A „Kötelező” oszlop azt jelenti, hogy a modul enélkül el sem indul, vagy hibás eredményt adna.
> **Jelmagyarázat a forrásnál:** L = hirdetés linkje, F = fiók (arculati profil / profil), Ű = feltöltő oldal űrlapja, Ü = az ügynökség választja („Bízd ránk”), a felhasználó felülírhatja.

### Közös szabályok minden modulnál
- **Adat-megerősítés:** a feltöltő oldal a beküldés előtt összesíti az adatokat („Ezekkel az adatokkal készítjük el”), és a felhasználónak jóvá kell hagynia. Tényadat (ár, méret, cím, szobaszám, elérhetőség) **csak a felhasználótól vagy a saját hirdetéséből** jöhet.
- **Az ügynökség csak ízlésbeli dolgokat választhat** (sablon, hangulat, zene, képsorrend, méret), tényt soha.
- **Fotók:** JPG / PNG / WEBP; a méretkorlátot a modul szabja meg (lásd lent). Kliensoldali tömörítés a 4,5 MB-os Vercel-korlát miatt.
- **Jelölés:** az AI-képeken a meglévő jelölés / vízjel automatikusan rajta van; a minőségellenőr ellenőrzi.

### Hirdetéskép-készítő (`/api/flyer/render` + `/accept`)
| Adat | Kötelező | Forrás |
|---|---|---|
| Fotók: 1–4 (az első a főkép) | igen | L / Ű |
| Főcím (`title`) | igen | L → Ű |
| Alcím / helyszín (`subtitle`) | igen | L → Ű |
| Ár (`price`) | igen | L → Ű |
| Kulcsadatok (chipek: m², szobák stb.) | igen | L → Ű |
| Rövid leírás (`blurb`), kiemelések | nem | L szövegéből rövidítve, új tény nélkül |
| Jelvény (`badge`, alap: „ELADÓ”) | nem | Ű (eladó / kiadó) |
| Elérhetőség: név, telefon, e-mail, iroda, logó, ügynökfotó | név + telefon igen | F → Ű |
| Sablon (prémium / openhouse / unit), hangulat, méret (1:1, 9:16, 4:3) | nem | Ü |
| Kis képek feliratai | nem | Ü (meglévő helyiség-felismerés) |

### Videó generálás (`/api/real-estate/video`, saját motor)
| Adat | Kötelező | Forrás |
|---|---|---|
| Fotók: **4–5 db**, max. 15 MB / kép | igen | L / Ű |
| Település, kerület (`location`) | igen | L → Ű |
| Ár (`price`) | igen | L → Ű |
| Alapterület, szobák (`size`, `rooms`) | igen | L → Ű |
| Pontos cím (`address`), emelet, fürdő/WC | nem | L → Ű (cím csak, ha a felhasználó kifejezetten kéri, hogy szerepeljen) |
| Elérhetőség a zárókártyára (név, telefon, e-mail) | igen | F → Ű |
| Képfeliratok (max. 30 karakter / kép) | nem | Ü, a fenti adatokból (`captionForPhoto`) |
| Sablon / színvilág, zenei stílus, méret (1:1 / 9:16) | nem | Ü |

### Ingatlan értékbecslés (`/api/real-estate/valuation`) — **a legnagyobb kockázat**
| Adat | Kötelező | Forrás |
|---|---|---|
| Település, kerület | igen | L → Ű |
| Ingatlan típusa (lakás / ház …) | igen | L → Ű |
| Lakóterület (m²) | igen | L → Ű |
| Lakásnál: emelet; háznál: telekterület, a ház szintjei | igen | L → Ű |
| Építés éve | igen | **csak Ű** |
| Szobák száma, fürdők / WC | igen | L → Ű |
| Műszaki és esztétikai állapot | igen | **csak Ű** — a hirdetés szövegéből nem következtetünk rá |
| Fűtés és energetika | igen | L → Ű |
| Utca, lift, erkély (+ méret), szerkezet, jogi háttér, extrák | nem | L → Ű |
| Lokációs korrekció (átlagon aluli / átlagos / népszerű / prémium) | nem (alap: átlagos) | **csak Ű** — ez szakmai ítélet, nem az ügynökségé |
| Arculati profil, max. 2 fotó a lapra | nem | F / Ű |
**Külön szabály:** az ügynökség a becsült árat semmilyen módon nem módosítja. **Emberi jóváhagyás nincs** (döntés 2026-11-05: a saját, determinisztikus értékbecslő motorban bízunk). A minőségellenőr itt csak formai ellenőrzést végez: minden kötelező adat bekerült-e a riportba, van-e ár és értéksáv, elkészült-e a PDF / egyoldalas lap, és a comp-találatok száma eléri-e a motor saját minimumát. Ha ezek közül bármelyik hiányzik, a kézbesítés megáll, és MAX jelez Telegramon.

### Látványtervező (`/api/real-estate/visualization`)
| Adat | Kötelező | Forrás |
|---|---|---|
| Fotók: 1–4, max. 10 MB / kép | igen | Ű |
| Helyiség típusa képenként | igen | Ü (felismerés), a felhasználó ellenőrzi |
| Legalább egy változtatás képenként: stílus VAGY falszín / burkolat / padló / berendezettség / fény / megjegyzés | igen | **Ű** — a felhasználó mondja meg, mit szeretne; „Bízd ránk” esetén egy semleges, eladásbarát alap (pl. világos, letisztult, teljesen berendezett) |
| Megjegyzés (max. 500 karakter) | nem | Ű |

### Képjavító (`/api/real-estate/image-enhance`)
| Adat | Kötelező | Forrás |
|---|---|---|
| Fotók (1 vagy több) | igen | L / Ű |
| Mód: Feljavítás vagy Rendrakás | igen | Ű; „Bízd ránk” esetén az ügynök választ (zsúfolt kép → rendrakás) |
| Extrém zsúfoltság jelzése | nem | Ü (a meglévő `imageBusyness` heurisztika) |
A minőségellenőr itt külön nézi a „nem változott” esetet (a meglévő `imageMeanDiff` no-op felismerés), és ilyenkor újragenerál.

### Hirdetésszöveg generátor (`/api/real-estate/fb-ads`)
| Adat | Kötelező | Forrás |
|---|---|---|
| A hirdetés vagy landing oldal linkje, VAGY a bemásolt szöveg | igen (egyik) | L / Ű |
Ha a link nem nyitható meg (bejelentkezés, védelem), az űrlap a szöveg bemásolását kéri.

### Szöveg ellenőrzés (`/api/real-estate/ad-check`)
| Adat | Kötelező | Forrás |
|---|---|---|
| Hirdetés linkje VAGY szövege | igen (egyik) | L / Ű |
| Hangnem: elegáns / tényszerű / családias / prémium | igen | Ű; „Bízd ránk” esetén tényszerű |

### Szakember-kereső (`/api/professionals`)
| Adat | Kötelező | Forrás |
|---|---|---|
| Megye | igen | Ű |
| Szakma (listából vagy szabadon) | igen | Ű |
| Találatszám | igen | Ű (alap: a legkisebb) |
| Település, egyéb szempontok | nem | Ű |

### Nem része az ajánlatnak (most)
- **Alaprajzból 3D (Prémium 3D):** jelenleg csak adminnak érhető el, „Hamarosan” állapotban. Akkor kerül be, ha élesedik.
- **Vendéglátás modulok:** rejtettek, és nem ingatlanos célcsoportnak szólnak.

## 10. Gyenge fotók — felmérés és képre szabott tipp

**Szabály:** a gyártás gyenge fotóval is megy. A kézbesítő levélben (és a kész anyag mellett a fiókban) egy barátságos, **konkrét** tipp jelenik meg: melyik kép, mi volt vele a gond, és hogyan lesz jobb legközelebb. Általános szöveg („használj jobb fotókat”) nem mehet ki.

**Ki méri fel:** a **minőségellenőr ügynök**, a gyártás előtt (hogy a gyártó tudjon róla) és után (hogy a tipp a végeredményre is igaz legyen).

**Hogyan méri fel (két lépés):**
1. **Gépi mérés (ingyenes, determinisztikus), képenként:**
   - Felbontás (pl. 1200 px alatti rövidebb oldal = kicsi).
   - Fényesség és kontraszt (átlagos fényerő, beégett vagy bebukott területek aránya → sötét / túlexponált ablak).
   - Élesség (élesség-mérték → elmosódott, bemozdult).
   - Dőlés (függőleges vonalak eltérése → ferde kép).
   - Zsúfoltság (a meglévő `imageBusyness` heurisztika).
   - Tájolás (álló fotó fekvő videóhoz / fordítva).
   - Ismétlődés (két szinte azonos kép → kevés különböző helyiség).
2. **Rövid vizuális ellenőrzés LLM-mel, csak ha a gépi mérés jelez:** megerősíti az okot, és megfogalmazza a tippet a hangnem-útmutató szerint (06). Így nem fizetünk minden képre LLM-et.

**A tipp formája:**
> **Egy tipp a következő fotózáshoz:** a 3. kép (fürdőszoba) elég sötét lett, ezért a videóban kevésbé látszik a burkolat. Legközelebb kapcsold fel az összes lámpát, és nappal fotózz, amikor sok fény jön be. A 2. kép kicsit ferde: ha a telefont a mellkasod magasságában, egyenesen tartod, a falak függőlegesek maradnak.

- Legfeljebb **2 tipp** egy levélben, a legfontosabbal kezdve.
- Képszámmal és helyiségnévvel (a helyiség-felismerésből), hogy a felhasználó tudja, melyikről van szó.
- Ha van rá TWINX-modul, megemlítjük: „A sötét képeken a **Képjavító** sokat segít” — csak egy mondat, nem eladás.
- Ha minden kép rendben volt, nincs tipp-blokk.

**Tipp-könyvtár (kiindulás, a minőségellenőr ebből választ és szabja személyre):**
| Ok | Tipp |
|---|---|
| Sötét | Kapcsold fel az összes lámpát, fotózz nappal, húzd el a függönyt. |
| Beégett ablak | Ne az ablakkal szemben fotózz; állj háttal vagy oldalt az ablaknak. |
| Elmosódott | Tartsd két kézzel a telefont, vagy támaszd meg; koppints a képernyőre élesíteni. |
| Ferde | Mellkasmagasságban, egyenesen tartsd a telefont; kapcsold be a rácsvonalakat a kamerában. |
| Kis felbontás | Az eredeti fotót töltsd fel, ne képernyőképet vagy üzenetben továbbított, tömörített képet. |
| Zsúfolt | Pakold el az apróságokat a felületekről fotózás előtt, vagy használd a Képjavító rendrakását. |
| Rossz tájolás | Videóhoz és posztokhoz fekvő és álló képet is készíts ugyanarról a helyiségről. |
| Kevés helyiség | Minden fontos helyiségről legyen legalább egy kép (nappali, konyha, háló, fürdő). |

**Mérés:** rögzítjük, melyik ok milyen gyakori. Ha egy ok sokszor előjön (pl. sötét fotók), az jelzés egy fotózási útmutatóra vagy a Képjavító erősebb ajánlására.
