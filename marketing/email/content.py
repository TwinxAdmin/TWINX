# -*- coding: utf-8 -*-
"""
TWINX — Smartlead levélsorozatok SZÖVEGEI. Itt kell szerkeszteni, utána:
    python3 marketing/email/build.py

Blokk-típusok egy levélben:
  ("p", "szöveg")            bekezdés; **félkövér** jelölhető
  ("h", "szöveg")            kis alcím
  ("list", ["...", "..."])   korall pipás lista
  ("cta", "Gomb felirata")   a fő gomb (a levél linkjére mutat, UTM-mel)

Smartlead-változók: {{first_name}}, {{company_name}} — a küldéskor cserélődnek.
A %unsubscribe-text% helyére a Smartlead teszi a leiratkozó linket.
"""
from urllib.parse import urlencode

SITE = "https://twinx.hu"
IMG_BASE = f"{SITE}/marketing/email"        # public/marketing/email/ → élesítés után innen töltődnek
LANDING = f"{SITE}/ingatlan"                 # innen regisztrálva jár a 10 kredit (első 50)

SENDER = {"name": "Kovács Márk", "title": "TWINX · AI eszköztár ingatlanosoknak"}


def utm(url: str, kind: str, slug: str) -> str:
    q = urlencode({"utm_source": "smartlead", "utm_medium": "email",
                   "utm_campaign": f"twinx-{kind}", "utm_content": slug})
    return f"{url}?{q}"


# =============================================================================
# MELEG SOROZAT — meglévő partnerek (ismernek minket): képes, kártyás levél
# =============================================================================
WARM = [
    {
        "slug": "elindult", "delay": "0. nap",
        "subject": ["Elindult a TWINX", "{{first_name}}, élesben a TWINX"],
        "preheader": "Az AI eszköztár, amit ingatlanosoknak raktunk össze — és 10 kredit ajándék.",
        "image": "01-elindult.jpg", "image_alt": "Elindult a TWINX — pecsét: élesben, 2026",
        "title": "Elindult a TWINX.",
        "link": LANDING,
        "blocks": [
            ("p", "Megvan: a TWINX mától élesben fut. Az elmúlt hónapokban azon dolgoztunk, hogy az "
                  "ingatlanos munka ismétlődő, időrabló részeit pár kattintásra rövidítsük."),
            ("h", "Mit tud már most?"),
            ("list", ["Értékbecslés egy oldalon, a saját arculatoddal",
                      "Fotókból zenés, posztolható videó",
                      "Meglévő hirdetés pontozva és átírva",
                      "Telefonfotóból profi fotó, pár adatból kész hirdetéskép"]),
            ("p", "Az első 50 regisztráló **10 kreditet kap ajándékba** — bankkártya nélkül, és a kredit nem jár le."),
            ("cta", "Megnézem a TWINX-et"),
            ("p", "A következő napokban modulonként megmutatom, mire jó a gyakorlatban."),
        ],
    },
    {
        "slug": "ertekbecsles", "delay": "+3 nap",
        "subject": ["Értékbecslés percek alatt — a saját arculatoddal", "Mennyit ér? Sávval és levezetéssel."],
        "preheader": "Valós piaci adatokból, sávval és levezetéssel — egyetlen, letölthető oldalon.",
        "image": "02-ertekbecsles.jpg", "image_alt": "Értékbecslés percek alatt — Anna a riportlapra támaszkodik",
        "title": "Értékbecslés percek alatt.",
        "link": LANDING,
        "blocks": [
            ("p", "Az eladó szinte mindig ezzel kezdi: „mennyit ér?” A TWINX-ben megadod az ingatlan adatait "
                  "(ha van, pár fotót is), mi pedig friss, hasonló hirdetésekből számoljuk ki az értéket."),
            ("list", ["Becsült piaci érték és értéksáv",
                      "Levezetés: mi miért emeli vagy csökkenti az árat",
                      "Egyoldalas, letölthető lap a saját logóddal és színeiddel"]),
            ("p", "Egy értékbecslés **1 kredit** — a 10 ajándék kreditből bőven kijön egy próba."),
            ("cta", "Kipróbálom az értékbecslést"),
        ],
    },
    {
        "slug": "video", "delay": "+3 nap",
        "subject": ["Pár fotó be, kész videó ki.", "Ingatlanvideó vágás nélkül"],
        "preheader": "Zenés, feliratos, álló ingatlanvideó Reelsre és TikTokra — vágás nélkül.",
        "image": "03-video.jpg", "image_alt": "Pár fotó be, kész videó ki — előtte a fotók, utána a kész videó",
        "title": "Pár fotó be, kész videó ki.",
        "link": LANDING,
        "blocks": [
            ("p", "A videós hirdetések jobban pörögnek — csak vágni nincs idő. A TWINX-ben feltöltöd az ingatlan "
                  "5–8 fotóját, megadod az adatokat, kiválasztasz egy sablont, és a videót mi rakjuk össze."),
            ("list", ["Zene és felirat helyiségenként",
                      "Álló formátum, posztolásra készen",
                      "A végén a te neveddel és elérhetőségeddel"]),
            ("cta", "Megnézem a videókészítést"),
        ],
    },
    {
        "slug": "hirdetes-ellenorzes", "delay": "+4 nap",
        "subject": ["Mit lát a vevő a hirdetésedben?", "58% → 94%: így javul egy hirdetés"],
        "preheader": "Bemásolod a linket, és kiderül, mi hiányzik — pontozva, javítva.",
        "image": "04-hirdetes-ellenorzes.jpg", "image_alt": "Mit lát a vevő a hirdetésedben? — kijavított hirdetésszöveg",
        "title": "Mit lát a vevő a hirdetésedben?",
        "link": LANDING,
        "blocks": [
            ("p", "Az „álomotthon” és a „ne hagyja ki!” már senkit nem győz meg — a vevő adatokat keres: "
                  "emeletet, rezsit, fűtést, közlekedést. A Hirdetés ellenőrzés egy linkből megmondja:"),
            ("list", ["Mennyire jó most a hirdetés, százalékban",
                      "Miben erős és miben gyenge",
                      "Mit kell javítani — és ad egy átírt, közlésre kész szöveget"]),
            ("p", "Egy ellenőrzés **1 kredit**."),
            ("cta", "Ellenőrzöm a hirdetésem"),
        ],
    },
    {
        "slug": "ajandek-10-kredit", "delay": "+4 nap",
        "subject": ["10 kredit ajándék — amíg tart az első 50 hely", "Ajándék a TWINX-től"],
        "preheader": "Bankkártya nélkül, nem jár le — bármelyik modulra beváltható.",
        "image": "05-ajandek-10-kredit.jpg", "image_alt": "Ajándék a TWINX-től — 10 kredit ingyen, az első 50 regisztrálónak",
        "title": "10 kredit ingyen.",
        "link": LANDING,
        "blocks": [
            ("p", "Ebben a sorozatban most jelentkezem utoljára. Ha még nem próbáltad a TWINX-et: "
                  "az első 50 regisztráló **10 kreditet kap ajándékba**."),
            ("list", ["Nem kell bankkártya",
                      "Nem jár le havonta",
                      "Bármelyik modulra beváltható: értékbecslés, videó, hirdetés ellenőrzés és a többi"]),
            ("p", "A regisztráció a twinx.hu/ingatlan oldalon egy perc."),
            ("cta", "Kérem a 10 kreditet"),
            ("p", "Ha kérdésed van, csak válaszolj erre a levélre — személyesen olvasom."),
        ],
    },
]
