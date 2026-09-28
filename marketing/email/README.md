# TWINX — Smartlead levélsorozatok

Két sorozat, ugyanarra az 5 témára (a Facebook-posztokkal egyezően):
1. Elindult a TWINX · 2. Értékbecslés · 3. Videókészítés · 4. Hirdetés ellenőrzés · 5. Ajándék 10 kredit

| Mappa | Kinek | Stílus |
|---|---|---|
| `meleg/` | meglévő partnerek | TWINX-kártyás levél, a posztképpel, gombbal |
| `hideg/` | hideg lista | könnyű, szöveg-központú, kép nélkül — jobb kézbesíthetőség |

Tárgyak (A/B), előnézeti szövegek, időzítés: **SEQUENCE.md**. Minden levélnek van `.txt` (sima szöveges) párja is.

## Szerkesztés
Szövegek: `content.py` → utána a repó gyökeréből: `python3 marketing/email/build.py`
(újragenerálja a HTML/TXT fájlokat, az `elonezet.html`-t és a `SEQUENCE.md`-t).

## Képek
A meleg levelek képei a `public/marketing/email/` mappában vannak, élesítés (git push → Vercel) után
innen töltődnek: `https://twinx.hu/marketing/email/…`. **Először élesíts, csak utána indítsd a kampányt**,
különben a levélben törött kép lesz.

## Beállítás a Smartleadben
- **HTML beillesztés:** a lépés szerkesztőjében a forráskód / HTML nézetbe másold a `.html` fájl tartalmát.
- **„Optimize Email Delivery” legyen KIKAPCSOLVA** a kampány beállításaiban — bekapcsolva a Smartlead
  kiveszi a HTML-t (és a leiratkozó linket is), és ez a kampány indulása után már nem módosítható.
- **Leiratkozás:** a levelek alján `%unsubscribe-text%` áll, ide teszi a Smartlead a leiratkozó szöveget.
  A tesztlevelekben ez nem jelenik meg, csak az éles küldésben.
- **Változók:** `{{first_name}}` — ha a listában hiányzik a név, adj meg alapértéket (pl. „Szia!”), vagy
  szűrd ki ezeket a sorokat, különben „Szia !” jelenik meg.
- **Linkek:** mind a `twinx.hu/ingatlan` oldalra mutat UTM-mel (`utm_source=smartlead`,
  `utm_campaign=twinx-meleg|twinx-hideg`, `utm_content=<téma>`), így látszik, melyik levél hozta a regisztrációt.
  Az /ingatlan oldalról regisztrálók kapják a 10 kreditet (első 50).
- **Hideg listánál:** először kisebb adaggal indíts, figyeld a válasz- és visszapattanási arányt; a hideg
  megkeresésnél a jogos érdek alapját és a leiratkozás lehetőségét a jogi háttérrel érdemes egyeztetni.
