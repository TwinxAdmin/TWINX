# -*- coding: utf-8 -*-
"""
TWINX — Smartlead levélsorozatok (HTML + sima szöveg) generátora.

Futtatás (a repó gyökeréből):   python3 marketing/email/build.py
Kimenet:
  marketing/email/meleg/NN-*.html + .txt   — meglévő partnereknek (képes, gazdagabb)
  marketing/email/hideg/NN-*.html + .txt   — hideg listának (könnyű, szöveg-központú)
  marketing/email/elonezet.html            — egy oldalon az összes levél (csak belső átnézésre)

A szövegeket a content.py-ban lehet szerkeszteni; ez a fájl csak a formát adja.
Minden stílus inline (a levelezők nagy része kidobja a <style> blokkot),
a felépítés táblázatos (Outlook miatt), a szélesség 600 px.
"""
import base64, html, io, os, re, sys
sys.dont_write_bytecode = True

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
sys.path.insert(0, HERE)
from content import SITE, IMG_BASE, WARM, COLD, SENDER, utm  # noqa: E402

# ---- TWINX színek -----------------------------------------------------------
CREAM = "#F7F3EC"; CARD = "#FDFBF6"; INK = "#1C1815"; MUTED = "#6E655C"
LINE = "#E8E1D6"; CORAL = "#EF7A5A"; CORAL_DEEP = "#7A2E17"; CORAL_SOFT = "#FCE5DD"
BTN_TEXT = "#1C1005"   # ugyanaz, mint az oldalon a .twx-btn (korall alapon sötét szöveg)

DISPLAY = "'Space Grotesk','Segoe UI',Helvetica,Arial,sans-serif"
BODY = "Inter,'Segoe UI',Helvetica,Arial,sans-serif"


def esc(t: str) -> str:
    """HTML-escape, de a Smartlead-változók ({{...}}, %...%) érintetlenek maradnak."""
    return html.escape(t, quote=False)


def para(t: str) -> str:
    # **félkövér** jelölés a szövegben
    t = esc(t)
    t = re.sub(r"\*\*(.+?)\*\*", r'<strong style="color:%s;">\1</strong>' % INK, t)
    return (f'<p style="margin:0 0 16px 0;font-family:{BODY};font-size:16px;line-height:1.6;'
            f'color:{INK};">{t}</p>')


def checklist(items) -> str:
    rows = "".join(
        f'<tr><td valign="top" style="padding:0 10px 10px 0;font-family:{BODY};font-size:16px;'
        f'line-height:1.5;color:{CORAL};font-weight:bold;">&#10003;</td>'
        f'<td valign="top" style="padding:0 0 10px 0;font-family:{BODY};font-size:16px;line-height:1.5;'
        f'color:{INK};">{esc(i)}</td></tr>' for i in items)
    return f'<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px 0;">{rows}</table>'


def button(label: str, href: str) -> str:
    # „golyóálló” gomb: táblázatcella + link, Outlookban is gomb marad
    return (f'<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 22px 0;">'
            f'<tr><td align="center" bgcolor="{CORAL}" style="border-radius:999px;">'
            f'<a href="{href}" target="_blank" style="display:inline-block;padding:14px 28px;font-family:{DISPLAY};'
            f'font-size:16px;font-weight:bold;color:{BTN_TEXT};text-decoration:none;border-radius:999px;">'
            f'{esc(label)}</a></td></tr></table>')


def wordmark(size=22) -> str:
    return (f'<span style="font-family:{DISPLAY};font-size:{size}px;font-weight:bold;letter-spacing:1px;'
            f'color:{INK};">TWIN<span style="color:{CORAL};">X</span></span>')


def blocks_html(blocks, href) -> str:
    out = []
    for b in blocks:
        kind = b[0]
        if kind == "p":
            out.append(para(b[1]))
        elif kind == "list":
            out.append(checklist(b[1]))
        elif kind == "cta":
            out.append(button(b[1], href))
        elif kind == "h":
            out.append(f'<p style="margin:4px 0 10px 0;font-family:{DISPLAY};font-size:17px;font-weight:bold;'
                       f'color:{INK};">{esc(b[1])}</p>')
    return "".join(out)


def preheader(t: str) -> str:
    # rejtett előnézeti szöveg + kitöltő, hogy a levelező ne húzzon be mást mellé
    pad = "&#847;&zwnj;&nbsp;" * 40
    return (f'<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;'
            f'color:{CREAM};opacity:0;">{esc(t)}{pad}</div>')


def signature(light: bool) -> str:
    return (f'<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" '
            f'style="border-top:1px solid {LINE};margin-top:8px;"><tr><td style="padding-top:16px;">'
            f'<p style="margin:0;font-family:{BODY};font-size:15px;line-height:1.5;color:{INK};">'
            f'<strong>{esc(SENDER["name"])}</strong><br>'
            f'<span style="color:{MUTED};">{esc(SENDER["title"])}</span><br>'
            f'<a href="{SITE}" style="color:{CORAL_DEEP};text-decoration:none;font-weight:bold;">twinx.hu</a>'
            f'</p></td></tr></table>')


def footer() -> str:
    return (f'<p style="margin:18px 0 0 0;font-family:{BODY};font-size:12px;line-height:1.5;color:{MUTED};'
            f'text-align:center;">%unsubscribe-text%</p>')


def render(mail: dict, kind: str, img_src=None) -> str:
    """kind: 'meleg' (kártyás, képes) vagy 'hideg' (könnyű, kép nélküli)."""
    href = utm(mail["link"], kind, mail["slug"]).replace("&", "&amp;")   # HTML-attribútumban &amp;
    body = blocks_html(mail["blocks"], href)
    greet = para(mail.get("greeting", "Szia {{first_name}}!"))
    sign_off = para(mail.get("sign_off", "Márk"))

    if kind == "meleg":
        src = img_src or f'{IMG_BASE}/{mail["image"]}'
        hero = (f'<tr><td style="padding:0 0 4px 0;"><a href="{href}" target="_blank">'
                f'<img src="{src}" width="560" alt="{esc(mail["image_alt"])}" '
                f'style="display:block;width:100%;max-width:560px;height:auto;border:0;border-radius:12px;"></a></td></tr>')
        inner = (
            f'<tr><td style="padding:24px 28px 8px 28px;">{wordmark()}</td></tr>'
            f'<tr><td style="padding:12px 20px 0 20px;"><table role="presentation" width="100%" cellpadding="0" '
            f'cellspacing="0" border="0">{hero}</table></td></tr>'
            f'<tr><td style="padding:22px 28px 26px 28px;">'
            f'<h1 style="margin:0 0 16px 0;font-family:{DISPLAY};font-size:26px;line-height:1.25;color:{INK};">'
            f'{esc(mail["title"])}</h1>{greet}{body}{sign_off}{signature(False)}</td></tr>'
        )
        outer_bg, card_style = CREAM, f"background:{CARD};border:1px solid {LINE};border-radius:16px;"
    else:
        inner = (
            f'<tr><td style="padding:8px 4px 18px 4px;">{wordmark(18)}</td></tr>'
            f'<tr><td style="padding:0 4px;">{greet}{body}{sign_off}{signature(True)}</td></tr>'
        )
        outer_bg, card_style = "#FFFFFF", "background:#FFFFFF;"

    return f"""<!DOCTYPE html>
<html lang="hu" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light only">
<title>{esc(mail["subject"][0])}</title>
</head>
<body style="margin:0;padding:0;background:{outer_bg};">
{preheader(mail["preheader"])}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="{outer_bg}" style="background:{outer_bg};">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;{card_style}">
{inner}
</table>
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">
<tr><td style="padding:0 20px;">{footer()}</td></tr>
</table>
</td></tr>
</table>
</body>
</html>
"""


def plain(mail: dict, kind: str) -> str:
    href = utm(mail["link"], kind, mail["slug"])
    lines = [mail.get("greeting", "Szia {{first_name}}!"), ""]
    for b in mail["blocks"]:
        if b[0] == "p":
            lines += [b[1].replace("**", ""), ""]
        elif b[0] == "h":
            lines += [b[1], ""]
        elif b[0] == "list":
            lines += [f"- {i}" for i in b[1]] + [""]
        elif b[0] == "cta":
            lines += [f"{b[1]}: {href}", ""]
    lines += [mail.get("sign_off", "Márk"), "", SENDER["name"], SENDER["title"], "twinx.hu", "", "%unsubscribe-text%"]
    return "\n".join(lines)


def data_uri(path: str) -> str:
    # csak az előnézethez: a képet beágyazzuk, hogy élesítés (git push) nélkül is látszódjon
    from PIL import Image
    im = Image.open(path).convert("RGB"); im.thumbnail((600, 600))
    buf = io.BytesIO(); im.save(buf, "JPEG", quality=72, optimize=True)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()


def main():
    img_dir = os.path.join(ROOT, "public", "marketing", "email")
    preview = []
    report = []
    for kind, seq in (("meleg", WARM), ("hideg", COLD)):
        out = os.path.join(HERE, kind); os.makedirs(out, exist_ok=True)
        for i, m in enumerate(seq, 1):
            name = f"{i:02d}-{m['slug']}"
            h = render(m, kind)
            with open(os.path.join(out, name + ".html"), "w", encoding="utf-8") as f: f.write(h)
            with open(os.path.join(out, name + ".txt"), "w", encoding="utf-8") as f: f.write(plain(m, kind))
            report.append((kind, name, len(h.encode("utf-8"))))
            prev_src = data_uri(os.path.join(img_dir, m["image"])) if kind == "meleg" else None
            preview.append((kind, i, m, render(m, kind, prev_src)))

    # ---- előnézeti oldal: minden levél egymás alatt, fejléccel (tárgy, előnézet, időzítés)
    cards = []
    for kind, i, m, h in preview:
        label = "Meglévő partnerek" if kind == "meleg" else "Hideg lista"
        subj = " / ".join(esc(s) for s in m["subject"])
        cards.append(
            f'<section style="margin:0 0 40px 0;">'
            f'<div style="font:600 13px/1.4 Helvetica,Arial;color:{CORAL_DEEP};letter-spacing:1px;">'
            f'{label.upper()} · {i}. LEVÉL · {esc(m["delay"])}</div>'
            f'<div style="font:600 17px/1.4 Helvetica,Arial;color:{INK};margin:4px 0 2px;">Tárgy: {subj}</div>'
            f'<div style="font:14px/1.4 Helvetica,Arial;color:{MUTED};margin-bottom:10px;">Előnézet: {esc(m["preheader"])}</div>'
            f'<iframe srcdoc="{html.escape(h, quote=True)}" style="width:100%;max-width:680px;height:1250px;'
            f'border:1px solid {LINE};border-radius:12px;background:#fff;"></iframe></section>')
    page = (f'<!DOCTYPE html><html lang="hu"><head><meta charset="utf-8"><title>TWINX levélsorozatok — előnézet</title></head>'
            f'<body style="margin:0;padding:32px;background:#EFEAE2;">'
            f'<h1 style="font:700 26px Helvetica,Arial;color:{INK};margin:0 0 6px;">TWINX levélsorozatok — előnézet</h1>'
            f'<p style="font:15px Helvetica,Arial;color:{MUTED};margin:0 0 28px;">A képek itt beágyazva látszanak; '
            f'az éles levelekben a twinx.hu-ról töltődnek be. A %unsubscribe-text% helyére a Smartlead teszi a leiratkozó linket.</p>'
            + "".join(cards) + "</body></html>")
    with open(os.path.join(HERE, "elonezet.html"), "w", encoding="utf-8") as f: f.write(page)

    # ---- sorozat-áttekintő (tárgyak, előnézeti szöveg, időzítés) a Smartlead-beállításhoz
    md = ["# TWINX levélsorozatok — áttekintő (generált, ne kézzel szerkeszd)", ""]
    for kind, seq, label in (("meleg", WARM, "Meglévő partnerek"), ("hideg", COLD, "Hideg lista")):
        md += [f"## {label} (`{kind}/`)", "", "| # | Időzítés | Tárgy (A) | Tárgy (B) | Előnézeti szöveg | Fájl |",
               "|---|---|---|---|---|---|"]
        for i, m in enumerate(seq, 1):
            md.append(f"| {i} | {m['delay']} | {m['subject'][0]} | {m['subject'][1]} | {m['preheader']} | "
                      f"`{kind}/{i:02d}-{m['slug']}.html` |")
        md.append("")
    with open(os.path.join(HERE, "SEQUENCE.md"), "w", encoding="utf-8") as f: f.write("\n".join(md))

    for kind, name, size in report:
        print(f"{kind:6s} {name:34s} {size/1024:5.1f} KB")


if __name__ == "__main__":
    main()
