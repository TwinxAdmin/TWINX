# TWINX „Hozzáférések" ablak és cégvezetői szabályok — terv (D46, kiegészítve D47–D49)

> **Státusz:** elfogadott terv, 2026-11-23. A `12-admin-terv.md` 5. szakaszának részletes kidolgozása; ebből készül majd a CODE-prompt (amikor Márk átadja).
> **Felülírja:** a D41 „fizetni csak a fizető cégvezető" és „meghívási jog másnak" pontját, a D45 „a cégvezetői státuszt az admin állítja" pontját.
> **Kiegészítés:** az adatmodell részleteit a `14`, a meghívó e-mail **végleges szövegét** a `16` (D49) tartalmazza; az 5. szakasz ezekre mutat.
> **Nyelv:** magyar. Nincs „kredit" szó a felületen.

---

## 1. Döntések (D46)

1. **Egy közös „Hozzáférések" ablak, modulonként egy sorral.** A cégvezető egy helyen látja az egész cégét.
2. **A meghívó lefoglalja a helyet,** amíg el nem fogadják vagy le nem jár (javaslat: **7 nap**); lejáratkor a hely felszabadul. A cégvezető vissza is vonhatja.
3. **A cégvezető csak akkor foglal helyet, ha ő is használni akarja a modult** (ilyenkor magának is ad egyet, ugyanazzal a művelettel).
4. **Mindegyik cégvezető fizethet.** Nincs külön „fizető cégvezető".
5. **A cégvezetői státusz cégenként él:** aki cégvezető, az a cég minden moduljánál az.
6. **Cégvezetővé tehet felhasználót az admin, és a cégvezető is** (a kinevezett jogai bővülnek: meghívhat, eltávolíthat, fizethet, kinevezhet). A kinevezett csak a cég már **aktív tagja** lehet, nem tetszőleges e-mail cím.
7. **Mindenki csak a saját cégvezetői státuszát adhatja fel; másét elvenni csak az admin tudja.** Így a cégen belül nem lehet „kiforgatni" a többi cégvezetőt.
8. **Minden cégnek mindig van legalább egy cégvezetője.** Az utolsót nem lehet feladni vagy levenni; a szerver ezt tranzakcióban tiltja (mint az utolsó admint).
9. **Eltávolításkor a hely azonnal felszabadul,** a kolléga hozzáférése megszűnik, a munkái nála maradnak.
10. **A külön „meghívási jog" megszűnik,** mert a cégvezetői kinevezés ugyanezt (és többet) ad. `[Alapértelmezés, megerősítendő.]`
11. **Az Aktiválás csak akkor engedett, ha a cégnek van legalább egy aktív cégvezetője** (Márk megerősítette). A Céggé alakításkor még nincs cégvezető: **az első cégvezetőt az admin jelöli ki** a Cég oldalán (a kapcsolattartó, miután regisztrált és a cég aktív tagja lett), és ettől kezdve az 8. pont védi az utolsót.

## 2. Ki mit lát

- **Cégvezető:** a „Hozzáférések" ablakot (profil menü vagy a Moduljaim menüből), csak a **saját cégére**. Más cégét nem látja.
- **User:** az ablak nem látszik neki; csak a kapott modulokat használja.
- **Admin:** nem ezt az ablakot használja, hanem a **Cégek** lista kibontható sorát és a nézet-váltót („így látja X cég"). Ott mindent lát és állíthat: helyek száma (a bővítés csak az adminnál van, mert az előfizetés egyedi), lejárat, cégvezetők, meghívók.

## 3. Az ablak felépítése (fix méretű doboz, nem ugrál)

**Fej:** a cég neve és egy rövid szöveg: *„Itt kezeled, ki használja a cégetek moduljait."*

**Modulonként egy sor:** modul neve · **helyek (használt / összes, pl. 3 / 5)** · érvényes eddig · állapotjelző. A sor kibontható; egyszerre egy sor van nyitva, a doboz magassága fix, a lista belül görgethető.

**Kibontva:**
- **Kollégák listája:** név és e-mail, állapotcímke, „⋯" menü.
  - Állapotok: **Aktív** · **Meghívva** (lejárat dátumával) · **Lejárt** · (visszavont és eltávolított nem látszik, csak a naplóban).
  - A „⋯" menü: **Meghívó visszavonása**, **Újraküldés**, **Eltávolítás**; cégvezetőknél a saját soron **Lemondok a cégvezetői státuszról**.
- **Meghívó mező:** e-mail cím + **[Meghívás]** gomb. Ha nincs szabad hely, a mező inaktív: *„Nincs szabad hely. A bővítéshez jelezd nekünk: office@twinx.hu."*
- **Saját hely:** ha a cégvezetőnek még nincs helye ebben a modulban: **[Használom én is]** gomb (a saját fiókjának ad egy helyet, azonnali).

**A cég szintjén (az ablak alján, külön doboz): Cégvezetők**
- A cégvezetők listája.
- **Kinevezés cégvezetőnek:** a cég aktív tagjai közül választható (nem szabad e-mail mező). Megerősítő lépéssel: *„X megkapja a meghívás, eltávolítás, fizetés és kinevezés jogát. Biztosan?"*
- **Lemondok a cégvezetői státuszról:** a saját soron; az utolsó cégvezetőnél inaktív, magyarázattal: *„Előbb nevezz ki másik cégvezetőt."*

**Üres állapotok:** nincs aktivált modul: *„Itt jelennek meg a céged moduljai, amint aktiváljuk őket."* Nincs kolléga: *„Még nem hívtál meg senkit. Add meg egy kolléga e-mail címét, és belép."*

**Nem látja a cégvezető (D44):** a fejlesztés alatt álló vagy még nem aktivált modult.

## 4. A meghívás folyamata

1. A cégvezető beírja az e-mail címet, és a **[Meghívás]** gombra kattint. A rendszer egy tranzakcióban ellenőrzi: a hívó a cég cégvezetője, van szabad hely (Aktív + nem lejárt Meghívva ≤ összes hely), a modul aktív és az előfizetés érvényes. Ha igen, létrejön a meghívó, és **lefoglalja a helyet**.
2. A meghívott e-mailt kap (lásd 5. szakasz) egy **„Belépés"** gombbal. A link egyszer használatos, 7 napig érvényes.
3. A link egy **meghívó oldalra** visz:
   - **Belépve, a meghívott címmel:** egy kattintással elfogadja, a modul megjelenik a „Moduljaim" menüben.
   - **Nem belépve, már regisztrált cím:** belépés (a cím előre kitöltve és zárolva), utána automatikus elfogadás.
   - **Még nincs fiókja:** regisztráció **ugyanezzel a címmel** (előre kitöltve és zárolva), az e-mail megerősítése után automatikus elfogadás. Az oldalon ez külön jelezve: *„Még nincs TWINX fiókod, hozz létre egyet ezzel az e-mail címmel."*
   - **Belépve, de más fiókkal:** *„Ez a meghívó egy másik e-mail címre szól."* Nem fogadható el.
4. Elfogadáskor a felhasználó **automatikusan a cég tagja** lesz, és megkapja a hozzáférést erre a modulra (és csak erre).
5. Ha lejár vagy visszavonják: a hely felszabadul; a link érvénytelen (*„Ez a meghívó lejárt. Kérj újat attól, aki meghívott."*).

**Egy felhasználó több cégben is lehet** (a hozzáférés felhasználóhoz és cégekhez kötött). `[Alapértelmezés, megerősítendő.]`

## 5. A meghívó e-mail (a végleges szöveg: `16-email-szovegek.md`, D49)

> A tárgy és a szöveg a `16` 1. pontjában van, az az irányadó; itt csak a követelmények maradnak.

- **Küldő:** „A TWINX csapata" (a levelet a rendszer küldi, Resend). **Tárgy:** *„Meghívást kaptál a(z) [Modul neve] használatára — [Cég neve]"*
- **Szöveg:** ugyanaz minden címnek, nem derül ki belőle, hogy a cím regisztrált-e (a pontos szöveg: `16`).
- **Gomb:** „Belépés". Lábléc: office@twinx.hu, adatkezelési tájékoztató linkje `[amint kész, vázlat: 17]`.
- **Nincs benne:** ár, „kredit", a cég belső adata a modul nevén és a cég nevén túl.

## 6. Biztonsági követelmények (kötelező a CODE-nak)

- **Tranzakció:** a meghívó létrehozása, az elfogadás, a visszavonás, az eltávolítás és a lejárat is egy-egy adatbázis-tranzakció, amely a helyek számát ellenőrzi; két gyors meghívás sem léphet túl a limiten.
- **Meghívó token:** kitalálhatatlan (hosszú, véletlen), az adatbázisban **hash-elve** tárolt, **egyszer használatos**, 7 nap után lejár, a meghívott e-mail címhez kötött.
- **Elfogadás:** csak az a belépett felhasználó fogadhatja el, akinek a **megerősített** e-mail címe megegyezik a meghívottéval.
- **Nincs információszivárgás:** a meghívó levél és az oldal ugyanazt mondja, akár regisztrált a cím, akár nem; a meghívó mező nem árulja el, hogy a cím regisztrált-e.
- **Cégre szűrés:** minden művelet szerveroldalon ellenőrzi, hogy a hívó **az adott cég cégvezetője**; a cégvezetői státusz cégenként él, és sosem lehet admin joggá emelni.
- **Hozzáférés lejáratkor:** az előfizetés lejártakor a cég minden felhasználójának megszűnik a hozzáférés (szerveroldali ellenőrzés + RLS); a függő meghívók érvénytelenek.
- **Kinevezés és lemondás:** csak a cég aktív tagja nevezhető ki; a lemondás és a levétel tranzakcióban ellenőrzi, hogy marad-e legalább egy cégvezető; a levétel (másé) csak adminnak engedett.
- **Visszaélés ellen:** meghívó-küldési korlát (pl. óránként és cégenként legfeljebb N meghívó), hogy az ablak ne legyen spamküldő.
- **Napló (kötelező):** minden lépés: meghívva, elfogadva, visszavonva, lejárt, újraküldve, eltávolítva, kinevezve cégvezetőnek, lemondott. Mezők: ki, kit/kinek, melyik cég és modul, mikor. A napló csak adminnak és a saját cég cégvezetőinek olvasható.
- **Adatvédelem:** a meghívott e-mail címét csak a meghívásra használjuk; a meghívás előtt a GDPR-tájékoztató legyen kész.

## 7. Állapotgép (egy meghívóra)

`Meghívva` → **elfogadva** → `Aktív` (a hozzáférés megvan)
`Meghívva` → **lejár** → `Lejárt` (hely felszabadul; újraküldhető)
`Meghívva` → **visszavonják** → `Visszavonva` (hely felszabadul)
`Aktív` → **eltávolítják** → `Eltávolítva` (hely felszabadul, hozzáférés megszűnik; a munkák a felhasználónál maradnak)

**Helyet foglal:** `Meghívva` (nem lejárt) és `Aktív`. **Nem foglal:** `Lejárt`, `Visszavonva`, `Eltávolítva`.

## 8. Adat-fogalmak (az adatmodell előzetese, a részletes terv a következő téma)

- **Cég** (a mi ügyfélnyilvántartásunk).
- **Cég-tagság:** felhasználó ↔ cég, `cégvezető` jelölővel (igen/nem). Egy felhasználó több cégben is tag lehet.
- **Előfizetés / hely-keret:** cég ↔ modul, helyek száma, érvényesség (az admin állítja).
- **Meghívó:** cég, modul, meghívott e-mail, token (hash), meghívó felhasználó, lejárat, állapot.
- **Modul-hozzáférés:** felhasználó ↔ cég ↔ modul, állapot (Aktív / Eltávolítva).
- **Napló:** a 6. szakasz eseményei (a pontos táblák és mezők: `14`).
- **Modul-regiszter és az Egyedi modulok lap:** lásd `12-admin-terv.md`, 6. szakasz.

## 9. Nyitott pontok

- Megerősítendő alapértelmezések: a külön meghívási jog megszűnik (1/10); egy felhasználó több cégben is lehet (4. szakasz).
- A meghívó érvényessége (7 nap) és a küldési korlát értéke.
- Mi történik, ha a kolléga a meghívó elfogadása után kiderül, hogy a cég előfizetése időközben lejárt? (Alapértelmezés: a hozzáférés nem aktiválódik, az oldal tájékoztat.)
- ~~A részletes adatmodell és a táblák~~ — kész: `14` (D47). ~~A meghívó e-mail végleges szövege~~ — kész: `16` (D49).
- Az adatkezelési tájékoztató (kapu): a vázlat kész (`17`, D50), jogászi ellenőrzés és a cég adatai hiányoznak.
- A meghívó-küldési korlát konkrét értéke (a CODE javaslatot tesz, Márk hagyja jóvá).
