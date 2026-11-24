# TWINX aktiváló ügynök — első kör (specifikáció)

> **Cél:** a regisztrált felhasználók jussanak el az első generálásig, a második használatig, végül a vásárlásig.
> **Döntések:** D11, D12, D13, D14 (01-alap-es-szabalyok.md). **Hangnem:** 06. **Gyártó ág:** 07.
> **Állapot:** terv, jóváhagyva 2026-11-05. Éles indulás az ügynökség indulási kapuja után (üzlettárs + API-költség).

---

## 1. Állapotok (napi besorolás)

Az ügynök naponta egyszer (reggel, a jóváhagyás előtt) minden `role = 'user'` felhasználót besorol a TWINX Supabase adatai alapján (`auth.users`, `profiles`, `usage_history`, `wallets`, `credit_purchases`). Csak olvas a termék-adatbázisból; a saját állapotát a `twinx-agents` adatbázisban tárolja.

| Állapot | Feltétel |
|---|---|
| **Nem erősített** | `email_confirmed_at` üres |
| **Nem kezdte el** | megerősített, 0 használat |
| **Egyszer próbálta** | 1–2 használat, az utolsó óta legalább 3 nap telt el |
| **Visszatérő** | 3+ használat |
| **Fogyó kredit** | egyenleg < 2 kredit és volt már használat |
| **Vásárló** | van jóváírt vásárlás |
| **Alvó** | 30 napja nincs belépés és használat |

Állapotváltáskor a régi sorozat azonnal leáll, és az új állapot sorozata indul.

## 2. Sorozatok (hívás nélkül — D14: egyelőre csak levelek mennek)

| Állapot | Időzítés | Levél | Típus (06, 6. pont) |
|---|---|---|---|
| Nem erősített | +1 nap | megerősítő levél újraküldése (a meglévő `auth.resend` logikával) | szolgáltatási |
| | +4 nap | még egyszer, utána leáll | szolgáltatási |
| Nem kezdte el | +2 nap | **„Készítsük el neked”** meghívó (gyártó ág, 07) | segítő |
| | +6 nap | kredit-emlékeztető: „A kreditjeid várnak, és nem járnak le.” (kreditszám nélkül) | szolgáltatási |
| | +12 nap | „Segíthetünk?” — rövid kérdés, mi kellene ahhoz, hogy kipróbálja | segítő |
| Egyszer próbálta | +3 nap | következő lépés ajánlása a használat alapján (pl. videó után hirdetéskép ugyanabból a fotóból) | segítő |
| | +7 nap | egykérdéses visszajelzés: „Mi tartott vissza?” | segítő |
| | +14 nap | „Készítsük el neked” meghívó, ha még nem vette igénybe | segítő |
| Fogyó kredit | azonnal | figyelmeztetés + csomagok | **marketing — csak hírlevél-hozzájárulással** |
| Alvó | 30 nap | „Mi újság nálunk” — 2–3 újdonság röviden | **marketing — csak hozzájárulással** |
| Visszatérő, Vásárló | – | első körben nincs sorozat | – |

**Gyakorisági korlát (minden csatornára együtt, a Brevo-leveleket is beleszámolva):** legfeljebb 3 naponta 1 levél, havonta legfeljebb 4. Ha egy levél a korlát miatt nem mehet ki, a következő szabad napra csúszik.

## 3. Küldés és a Brevo összehangolása (D14)

- Az ügynök a **saját rendszerből küld (Resend)**, a rendszerlevelek hitelesített domainjéről, „A TWINX csapata” aláírással.
- A Brevóban futó **ötrészes üdvözlő sorozat megmarad**. Az ügynök minden reggel lekéri a Brevóból, kinek mi ment ki az elmúlt napokban (Brevo API: kontakt e-mail-események), és ezt beszámítja a gyakorisági korlátba.
- **Ütközés-szabály:** amíg egy felhasználó a Brevo üdvözlő sorozatában van (az első kb. 2 hét), az ügynök csak szolgáltatási levelet küld neki (megerősítés, kredit). A segítő és marketing levelek a Brevo-sorozat után indulnak.
- Leiratkozás: minden levél alján. Az ügynök levelei és a Brevo leiratkozási listája szinkronban van (aki az egyikből leiratkozik, a másikból is).

## 4. Napi jóváhagyás Telegramon (D14)

Minden reggel (pl. 8:30, Europe/Budapest) egy üzenet:
> *Mai javaslat: 5 levél — 2 „Készítsük el neked”, 2 emlékeztető, 1 visszajelzés-kérés. [Mutasd] [Mehet mind] [Ma ne]*

- **Mehet mind:** minden levél kimegy, napközben elosztva (nem egyszerre).
- **Mutasd:** egyenként végiglapozható (címzett keresztneve, állapot, tárgy, szöveg), mindegyiknél [Mehet] [Kihagy].
- **Ma ne:** semmi nem megy ki, a levelek másnapra csúsznak.
- Ha 12:00-ig nincs válasz, aznap nem megy ki semmi (biztonsági alapállás).

## 5. Felzárkóztatás: a meglévő felhasználók (D14)

- A mostani regisztráltak (2026-11-05-én: 21 landinges + 12 egyéb) is bekerülnek.
- Az első futáskor mindenki a jelenlegi állapotába kerül, és a sorozata az **első lépéstől** indul (a regisztráció dátumától függetlenül).
- Az első levelek **3 napra elosztva** mennek ki (naponta kb. a harmada), hogy ne egyszerre kapjon mindenki levelet.

## 6. Visszajelzések (D14)

- A válaszok (egykérdéses visszajelzés, „Segíthetünk?” válaszai, a gyártó ág utáni értékelés) három helyre kerülnek:
  1. **TWINX admin → „Visszajelzések”** lista: dátum, felhasználó, állapot, kérdés, válasz, szabad szöveg; szűrhető válaszkategóriára.
  2. **Telegram:** azonnali üzenet minden új szöveges válaszról (a választható gombos válaszok csak a napi összesítőben).
  3. **Heti jelentés.**
- Ha a felhasználó a levélre e-mailben válaszol, az ügynök **választervezetet** ír, és Telegramon küldi el jóváhagyásra. Automatikus válasz nem megy ki (D12).

## 7. Heti jelentés (hétfő reggel, Telegram + admin)

- Állapotonkénti létszám és a változás az előző héthez képest.
- Kiküldött levelek típusonként, megnyitás és kattintás.
- Hányan generáltak először, hányan másodszor, hányan vásároltak.
- Visszajelzések összesítve kategóriánként + a szabad szöveges válaszok.
- „Készítsük el neked”: beküldések, elkészült anyagok, értékelések (07).

## 8. Mérőszámok (amihez az egészet mérjük)

| Mutató | Kiinduló érték (2026-11-05, landinges felhasználók) |
|---|---|
| Első generálás a regisztrációtól számított 7 napon belül | kb. 33% |
| Második használat | kb. 0% |
| Első vásárlás 30 napon belül | 0% |
| E-mail-megerősítés | 71% (15 / 21) |

## 9. Kikapcsolt / későbbre hagyott

- **Hívólista és hívás-eredmény rögzítése:** első körben kikapcsolva (D14). Ha bekapcsoljuk, az eredmény Telegramon és az admin felületen is rögzíthető lesz.
- Visszatérő és vásárló felhasználók sorozatai.
- LLM-mel személyre szabott levélszöveg: első körben sablonok + kitöltött mezők (név, használt modul, helyiség), LLM csak a választervezeteknél és a gyártó ág tippjeinél.
