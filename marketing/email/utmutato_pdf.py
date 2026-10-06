# -*- coding: utf-8 -*-
"""
TWINX hírlevelek — kiküldési útmutató PDF (Smartlead + Brevo), munkatársaknak.
Futtatás (a repó gyökeréből):  python3 marketing/email/utmutato_pdf.py
Kimenet: marketing/email/TWINX-hirlevel-kikuldesi-utmutato.pdf
A tárgyak és az időzítések a content.py-ból jönnek, így mindig naprakészek.
"""
import os, sys
sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from content import WARM  # noqa: E402

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
                                KeepTogether, PageBreak, CondPageBreak)

OUT = os.path.join(HERE, "TWINX-hirlevel-kikuldesi-utmutato.pdf")

FONTS = {
    "Body": "/usr/share/fonts/truetype/lato/Lato-Regular.ttf",
    "BodyBold": "/usr/share/fonts/truetype/lato/Lato-Bold.ttf",
    "Head": "/usr/share/fonts/truetype/google-fonts/Poppins-Bold.ttf",
    "HeadMed": "/usr/share/fonts/truetype/google-fonts/Poppins-Medium.ttf",
}
for n, p in FONTS.items():
    pdfmetrics.registerFont(TTFont(n, p))
pdfmetrics.registerFontFamily("Body", normal="Body", bold="BodyBold", italic="Body", boldItalic="BodyBold")

INK = colors.HexColor("#1C1815"); MUTED = colors.HexColor("#6E655C"); LINE = colors.HexColor("#E8E1D6")
CORAL = colors.HexColor("#EF7A5A"); DEEP = colors.HexColor("#7A2E17"); SOFT = colors.HexColor("#FCE5DD")
CREAM = colors.HexColor("#F7F3EC"); CARD = colors.HexColor("#FDFBF6")
BLUE_SOFT = colors.HexColor("#E6EEF8"); BLUE = colors.HexColor("#1F4E8C")

st = {
    "title": ParagraphStyle("t", fontName="Head", fontSize=24, leading=29, textColor=INK, spaceAfter=4),
    "sub": ParagraphStyle("s", fontName="Body", fontSize=11.5, leading=16, textColor=MUTED, spaceAfter=14),
    "h1": ParagraphStyle("h1", fontName="Head", fontSize=16, leading=21, textColor=INK, spaceBefore=14, spaceAfter=6),
    "h2": ParagraphStyle("h2", fontName="HeadMed", fontSize=12.5, leading=17, textColor=DEEP, spaceBefore=10, spaceAfter=4),
    "p": ParagraphStyle("p", fontName="Body", fontSize=10.5, leading=15.5, textColor=INK, spaceAfter=6),
    "small": ParagraphStyle("sm", fontName="Body", fontSize=9, leading=12.5, textColor=MUTED),
    "cell": ParagraphStyle("c", fontName="Body", fontSize=9.5, leading=13, textColor=INK),
    "cellb": ParagraphStyle("cb", fontName="BodyBold", fontSize=9.5, leading=13, textColor=INK),
    "code": ParagraphStyle("code", fontName="Body", fontSize=9.5, leading=13, textColor=DEEP),
    "step": ParagraphStyle("st", fontName="Body", fontSize=10.5, leading=15, textColor=INK),
    "num": ParagraphStyle("n", fontName="Head", fontSize=10.5, leading=15, textColor=colors.white, alignment=1),
}


def code(t):  # kiemelt „kód” (változók, beállításnevek)
    return f'<font name="BodyBold" color="#7A2E17">{t}</font>'


def steps(items):
    """Számozott lépések: korall kör + szöveg."""
    rows = []
    for i, t in enumerate(items, 1):
        rows.append([Paragraph(str(i), st["num"]), Paragraph(t, st["step"])])
    tb = Table(rows, colWidths=[8 * mm, None])
    tb.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BACKGROUND", (0, 0), (0, -1), CORAL),
        ("ROUNDEDCORNERS", [3, 3, 3, 3]),
        ("LEFTPADDING", (1, 0), (1, -1), 8), ("BOTTOMPADDING", (0, 0), (-1, -1), 5), ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("LINEBELOW", (0, 0), (-1, -1), 3, colors.white),
    ]))
    return tb


def callout(title, text, warn=True):
    bg, fg = (SOFT, DEEP) if warn else (BLUE_SOFT, BLUE)
    tb = Table([[Paragraph(f'<font name="BodyBold" color="{fg.hexval()}">{title}</font><br/>{text}', st["p"])]],
               colWidths=[None])
    tb.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), bg), ("LEFTPADDING", (0, 0), (-1, -1), 10),
                            ("RIGHTPADDING", (0, 0), (-1, -1), 10), ("TOPPADDING", (0, 0), (-1, -1), 8),
                            ("BOTTOMPADDING", (0, 0), (-1, -1), 4), ("LINEBEFORE", (0, 0), (0, -1), 3, fg)]))
    return KeepTogether([tb, Spacer(1, 8)])


def grid(data, widths, head=True):
    rows = [[Paragraph(c, st["cellb"] if (head and r == 0) else st["cell"]) for c in row] for r, row in enumerate(data)]
    tb = Table(rows, colWidths=widths, repeatRows=1 if head else 0)
    style = [("GRID", (0, 0), (-1, -1), 0.5, LINE), ("VALIGN", (0, 0), (-1, -1), "TOP"),
             ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
             ("LEFTPADDING", (0, 0), (-1, -1), 6), ("RIGHTPADDING", (0, 0), (-1, -1), 6)]
    if head:
        style += [("BACKGROUND", (0, 0), (-1, 0), CREAM)]
    tb.setStyle(TableStyle(style))
    return tb


def checklist(items):
    def box():
        b = Table([[""]], colWidths=[3.8 * mm], rowHeights=[3.8 * mm])
        b.setStyle(TableStyle([("BOX", (0, 0), (-1, -1), 1, CORAL)]))
        return b
    rows = [[box(), Paragraph(t, st["step"])] for t in items]
    tb = Table(rows, colWidths=[7 * mm, None])
    tb.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("TOPPADDING", (0, 0), (-1, -1), 4),
                            ("BOTTOMPADDING", (0, 0), (-1, -1), 4), ("LEFTPADDING", (0, 0), (0, -1), 0),
                            ("TOPPADDING", (0, 0), (0, -1), 6)]))
    return tb


def on_page(c, doc):
    c.saveState()
    w, h = A4
    c.setFillColor(CORAL); c.rect(0, h - 6, w, 6, stroke=0, fill=1)
    c.setFont("Head", 10); c.setFillColor(INK); c.drawString(18 * mm, 12 * mm, "TWIN")
    tw = c.stringWidth("TWIN", "Head", 10); c.setFillColor(CORAL); c.drawString(18 * mm + tw, 12 * mm, "X")
    c.setFont("Body", 8.5); c.setFillColor(MUTED)
    c.drawRightString(w - 18 * mm, 12 * mm, f"Hírlevél-kiküldési útmutató · {doc.page}. oldal")
    c.restoreState()


def build():
    s = []
    s += [Paragraph('TWINX hírlevelek — kiküldési útmutató', st["title"]),
          Paragraph("Smartlead és Brevo · meglévő partnereknek szóló, 5 levélből álló sorozat", st["sub"])]

    s += [Paragraph("Mit kaptál?", st["h1"]),
          Paragraph("Az 5 hírlevél két változatban készült: egy <b>Smartleadhez</b> és egy <b>Brevóhoz</b>. A tartalom, "
                    "a dizájn és a képek ugyanazok — csak a megszólítás, a leiratkozó link és a mérőkód más. "
                    "Mindig annak a rendszernek a csomagját használd, amelyikből küldesz.", st["p"]),
          grid([["", "Smartlead", "Brevo"],
                ["ZIP-ek neve", "TWINX-smartlead-hirlevel-…zip", "TWINX-brevo-hirlevel-…zip"],
                ["Megszólítás", code("{{first_name}}"), code("{{ contact.FIRSTNAME }}") + " (név nélkül: „Szia!”)"],
                ["Leiratkozás", code("%unsubscribe-text%"), code("{{ unsubscribe }}") + " link a levél alján"],
                ["Mérés (GA)", "utm_source=smartlead", "utm_source=brevo"]],
               [30 * mm, 68 * mm, None]),
          Spacer(1, 10),
          Paragraph("Egy levél ZIP-jében ezek vannak:", st["p"]),
          grid([["Fájl", "Mire való"],
                ["NN-tema.html", "Ezt kell a küldőrendszerbe beilleszteni. Dupla kattintásra böngészőben is megnézheted."],
                ["NN-tema.txt", "Ugyanaz a levél sima szövegként (ha a rendszer kér szöveges változatot)."],
                ["ADATLAP.txt", "Tárgy (A és B), előnézeti szöveg, időzítés, gomb és link — innen másolj."],
                ["UTMUTATO.txt", "Rövid, csak arra a levélre és rendszerre szóló lépéslista."],
                ["kep.jpg", "A levél képe tájékoztatásul (a levél a twinx.hu-ról tölti be, nem kell feltölteni)."]],
               [32 * mm, None])]

    s += [Paragraph("Az 5 levél", st["h1"]),
          grid([["#", "Téma", "Tárgy (A)", "Időzítés"]] +
               [[str(i), m["title"], m["subject"][0], m["delay"] if i > 1 else "indulás"] for i, m in enumerate(WARM, 1)],
               [8 * mm, 45 * mm, None, 22 * mm]),
          Paragraph("Az időzítés mindig az előző levélhez képest értendő. A „B” tárgyat és az előnézeti szöveget "
                    "az adott levél ADATLAP.txt-je tartalmazza.", st["small"])]

    s += [KeepTogether([Paragraph("Mielőtt bármelyikkel kezdesz", st["h1"]),
          steps(["Nyisd meg a levél <b>.html</b> fájlját dupla kattintással — így látod, amit a címzett fog.",
                 "A címzett-lista csak <b>meglévő partnereket</b> tartalmazzon, akiknek van <b>keresztneve</b> is "
                 "(a megszólításhoz).",
                 "A HTML-t <b>ne javítsd kézzel</b>. Ha szöveget kell módosítani, szólj Márknak — ő újragenerálja "
                 "mindkét változatot egyszerre.",
                 "Minden levélből küldj <b>tesztlevelet</b> magadnak, és nézd meg telefonon is."])])]

    # ---------- SMARTLEAD ----------
    s += [CondPageBreak(110 * mm), Paragraph("1. Smartlead", st["h1"]),
          Paragraph("A Smartleadben egy kampányon belül egy <b>sorozat</b> (Sequence) lesz, 5 lépéssel.", st["p"]),
          Paragraph("A) A kampány előkészítése", st["h2"]),
          steps(["Hozz létre egy új kampányt (pl. „TWINX — meglévő partnerek”).",
                 "Töltsd fel a címzett-listát. A keresztnév oszlopa legyen hozzárendelve a " + code("first_name") + " mezőhöz.",
                 "A kampány <b>beállításaiban</b> (Settings) az " + code("Optimize Email Delivery") + " legyen "
                 "<b>KIKAPCSOLVA</b>."]),
          callout("Fontos!", "Bekapcsolt „Optimize Email Delivery” mellett a Smartlead kiveszi a levélből a HTML-t, "
                             "a képet és a leiratkozó linket — és ez a kampány indulása után <b>már nem állítható át</b>."),
          Paragraph("B) Az 5 lépés beállítása (levelenként ismételd)", st["h2"]),
          steps(["A Sequence részben add hozzá a következő lépést (1., 2., … 5.).",
                 "<b>Tárgy</b>: az ADATLAP.txt „Tárgy (A)” sora. A/B teszthez a „Tárgy (B)” a második változatba kerül.",
                 "A szerkesztőben válts <b>HTML / forráskód</b> nézetre (" + code("&lt;/&gt;") + " ikon), töröld a tartalmat, "
                 "és illeszd be a .html fájl <b>teljes</b> tartalmát (szövegszerkesztőben megnyitva: Cmd+A, Cmd+C, Cmd+V).",
                 "Visszaváltva ellenőrizd: kép, narancs gomb, aláírás látszik.",
                 "<b>Várakozás</b> (delay) az előző lépés után: az ADATLAP.txt „Időzítés” sora (pl. +3 nap).",
                 "Küldj tesztlevelet."]),
          callout("Leiratkozás", "A levél alján lévő " + code("%unsubscribe-text%") + " sort <b>ne töröld</b> — ide teszi a "
                                 "Smartlead a leiratkozó linket. A tesztlevélben ez nem jelenik meg, csak az éles küldésben; "
                                 "ez normális.", warn=False),
          Paragraph("C) Indítás", st["h2"]),
          steps(["Ellenőrizd a küldési ütemezést (napok, időablak) és a küldő postafiókot.",
                 "Indítsd el a kampányt. Az első levél azonnal, a többi az időzítés szerint megy."])]

    # ---------- BREVO ----------
    s += [CondPageBreak(110 * mm), Paragraph("2. Brevo", st["h1"]),
          Paragraph("A Brevóban két út van: <b>5 külön kampány</b>, egyenként ütemezve (egyszerűbb), vagy egy "
                    "<b>Automation</b> (automatizmus), a levelek közt várakozással. Kezdőknek az 5 külön kampányt javasoljuk.",
                    st["p"]),
          Paragraph("A) Egyszeri előkészítés", st["h2"]),
          steps(["A partnerek legyenek egy <b>kontaktlistában</b> (pl. „TWINX partnerek”).",
                 "A keresztnév a névjegyek " + code("FIRSTNAME") + " mezőjében legyen. Ahol üres, ott a levél "
                 "magától „Szia!”-val köszön.",
                 "A feladó (pl. marketing@… vagy Márk címe) <b>hitelesített domainről</b> küldjön."]),
          Paragraph("B) Egy levél kiküldése (mind az 5-nél ugyanígy)", st["h2"]),
          steps(["<b>Kampányok</b> (Campaigns) → <b>Kampány létrehozása</b> → <b>E-mail</b>. "
                 "Név pl.: „TWINX 2. levél – értékbecslés”.",
                 "<b>Feladó</b> és <b>Címzettek</b>: a TWINX feladó és a partnerlista.",
                 "<b>Tárgy</b>: az ADATLAP.txt „Tárgy (A)” sora. <b>Előnézeti szöveg</b> (Preview text): az ADATLAP "
                 "„Előnézeti szöveg” sora. A/B teszthez a „B” tárgy a második változat.",
                 "<b>Tartalom / Design</b>: válaszd a <b>HTML-kód</b> szerkesztőt („Paste your code” / „Kód beillesztése”), "
                 "és illeszd be a .html fájl <b>teljes</b> tartalmát.",
                 "Az előnézetben ellenőrizd: kép, narancs gomb, aláírás, alul a „Leiratkozás” link.",
                 "Küldj tesztlevelet magadnak.",
                 "<b>Ütemezés</b>: az 1. levél az indulás napján, a többi az ADATLAP „Időzítés” sora szerint "
                 "(pl. a 2. levél 3 nappal az 1. után)."]),
          callout("Leiratkozás", "A levél alján lévő " + code("{{ unsubscribe }}") + " kódot <b>ne töröld</b> — ebből lesz "
                                 "a kötelező leiratkozó link."),
          callout("„B” tárgy", "A „B” tárgyak egy része a keresztnevet használja (pl. „Márk, élesben a TWINX”). "
                               "Csak akkor válaszd, ha a listában mindenkinél ki van töltve a FIRSTNAME.", warn=False)]

    # ---------- ELLENŐRZÉS + MÉRÉS ----------
    s += [CondPageBreak(110 * mm), Paragraph("Ellenőrző lista küldés előtt", st["h1"]),
          checklist(["A megfelelő rendszer csomagját használom (Smartlead ↔ Brevo).",
                     "A tárgy és az előnézeti szöveg az ADATLAP.txt-ből van kimásolva.",
                     "A teljes HTML be van illesztve (a tetején „&lt;!DOCTYPE html&gt;”, a végén „&lt;/html&gt;”).",
                     "A tesztlevélben látszik a kép, a narancs gomb és az aláírás.",
                     "A gomb a twinx.hu/ingatlan oldalra visz.",
                     "A megszólítás rendben van (nincs „Szia !” üres névvel).",
                     "A leiratkozó sor/kód a helyén van (Smartlead: %unsubscribe-text%, Brevo: {{ unsubscribe }}).",
                     "Smartleadben az „Optimize Email Delivery” ki van kapcsolva.",
                     "Az időzítés az ADATLAP szerint van beállítva."]),
          Paragraph("Honnan látjuk az eredményt?", st["h1"]),
          Paragraph("Minden gomb egy jelölt linkkel (UTM) mutat a twinx.hu/ingatlan oldalra, így a Google Analyticsben "
                    "külön látszik, melyik rendszer és melyik levél hozott látogatót és regisztrációt "
                    "(" + code("utm_source") + " = smartlead / brevo, " + code("utm_content") + " = a levél témája). "
                    "Az /ingatlan oldalon regisztrálók közül az első 50 kap 10 ajándék kreditet.", st["p"]),
          Paragraph("Gyakori hibák", st["h1"]),
          grid([["Mit látsz?", "Mi a teendő?"],
                ["Nem jelenik meg a kép.", "Smartleadben kapcsold ki az „Optimize Email Delivery”-t (induló kampánynál). "
                                           "Máshol: a levelező letilthatja a képeket — kattints a „képek megjelenítése” gombra."],
                ["„Szia !” — hiányzik a név.", "A listában üres a keresztnév. Smartlead: adj meg alapértéket, "
                                               "vagy töltsd ki a nevet. Brevóban ez magától „Szia!” lesz."],
                ["A tesztlevélben nincs leiratkozás.", "Smartleadben ez normális (csak éles küldésben jelenik meg). "
                                                      "Brevóban nézd meg, nem törlődött-e a {{ unsubscribe }} kód."],
                ["Szétesett a levél.", "Nem a teljes HTML lett beillesztve, vagy a szerkesztő átformázta. "
                                       "Töröld ki, és illeszd be újra HTML / forráskód nézetben."]],
               [48 * mm, None]),
          Spacer(1, 14),
          Paragraph("Kérdés vagy szövegmódosítás esetén: <b>Kovács Márk</b>", st["p"])]

    doc = SimpleDocTemplate(OUT, pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm, topMargin=18 * mm,
                            bottomMargin=20 * mm, title="TWINX hírlevelek — kiküldési útmutató", author="TWINX")
    doc.build(s, onFirstPage=on_page, onLaterPages=on_page)
    print(OUT)


if __name__ == "__main__":
    build()
