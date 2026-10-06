# TWINX — Smartlead levélsorozatok

Egy sorozat (meglévő partnereknek), az 5 témára (a Facebook-posztokkal egyezően):
1. Elindult a TWINX · 2. Értékbecslés · 3. Videókészítés · 4. Hirdetés ellenőrzés · 5. Ajándék 10 kredit

| Mappa | Kinek | Stílus |
|---|---|---|
| `meleg/` | meglévő partnerek | TWINX-kártyás levél, a posztképpel, gombbal |

Tárgyak (A/B), előnézeti szövegek, időzítés: **SEQUENCE.md**. Minden levélnek van `.txt` (sima szöveges) párja is.

## Átadás munkatársnak
A `build.py` minden futáskor elkészíti az `atadas-smartlead/` mappát: levelenként egy mappa (HTML, TXT, ADATLAP, UTMUTATO, kép)
és egy-egy ZIP (`TWINX-smartlead-hirlevel-NN-tema.zip`), plusz egy közös ZIP mind az 5 levéllel. Ugyanez **Brevóhoz** az `atadas-brevo/` mappában
(`TWINX-brevo-hirlevel-NN-tema.zip`): `{{ contact.FIRSTNAME }}` megszólítás (név nélkül „Szia!”),
`{{ unsubscribe }}` leiratkozó link, `utm_source=brevo`. A ZIP-ek nincsenek a gitben.
Közös, munkatársaknak szóló útmutató mindkét rendszerhez: **TWINX-hirlevel-kikuldesi-utmutato.pdf**
(`utmutato_pdf.py` készíti, a build is lefuttatja; a „mind-az-5” ZIP-ekbe is bekerül).

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
  `utm_campaign=twinx-meleg`, `utm_content=<téma>`), így látszik, melyik levél hozta a regisztrációt.
  Az /ingatlan oldalról regisztrálók kapják a 10 kreditet (első 50).
