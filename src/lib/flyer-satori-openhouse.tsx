// „Magazin" hirdetés-sablon (Satori).
// Három vízszintes sáv: FÖNT teljes szélességű főkép a címmel és egy kiemelt
// infó-blokkal (ár + kulcsadat), KÖZÉPEN világos sáv rövid leírással, pipás
// előnyökkel és képkollázzsal, LENT sötét kapcsolat-sáv.
//
// Minden méreten működik: az álló (9:16) változatban a középső sáv blokkjai
// egymás alá kerülnek, a fekvőnél (4:3) egymás mellé.
import React from "react";
import {
  buildTheme, truncate, flyerGeom, formatPrice, formatSize, type RenderOpts,
} from "@/lib/flyer-poster";
import {
  box, img, onColor, compact, numOf, icon, checkBox, heroFill, fitFs, fitHeadline, fitParagraph,
  type Style,
} from "@/lib/flyer-satori-kit";

export function buildOpenHouseElement(o: RenderOpts, family: string): React.ReactElement {
  const { width: W, height: H } = o;
  const u = W / 1080;
  const g = flyerGeom(W, H);
  const t = buildTheme(o.mood, o.profile.accent_color);
  const accent = /^#[0-9a-fA-F]{6}$/.test(o.profile.accent_color) ? o.profile.accent_color : "#1e3a5f";
  const accInk = onColor(accent);
  const p = o.profile;
  const d = o.text.details ?? {};

  const images = (o.images ?? []).filter(Boolean).slice(0, 4);
  const hero = images[0] || "";
  const thumbs = images.slice(1, 4);

  // --- Sávmagasságok: a három rész PONTOSAN kiadja a vászon magasságát --------
  const heroH = Math.round(H * (g.story ? 0.42 : g.land ? 0.40 : 0.45));
  const footH = Math.round(H * (g.story ? 0.15 : g.land ? 0.15 : 0.16));
  const midH = H - heroH - footH;
  const P = Math.round((g.land ? 56 : 60) * u);

  // ===========================================================================
  // 1) FŐKÉP-SÁV
  // ===========================================================================
  const heroImg = heroFill(hero, W, heroH, o.heroPos?.x ?? 50, o.heroPos?.y ?? 50, o.heroDim?.w ?? 0, o.heroDim?.h ?? 0);
  // A nagy főcím a fotó világosabb részére is átnyúlhat, ezért a sötétítés a
  // TELJES fotósávra kiterjed — alul erős, fölfelé fokozatosan elfogy.
  const heroScrim = box({
    position: "absolute", left: 0, bottom: 0, width: W, height: heroH,
    backgroundImage:
      "linear-gradient(0deg, rgba(0,0,0,0.86) 0%, rgba(0,0,0,0.58) 34%, rgba(0,0,0,0.22) 64%, rgba(0,0,0,0) 100%)",
  });

  // Hosszabb cím is TELJESEN kifér: a méret igazodik hozzá, nem vágjuk le.
  const title = truncate((o.text.title || "Eladó ingatlan").toUpperCase(), 54);
  const subtitle = truncate(o.text.subtitle, 64);
  const titleK = g.story ? 1.06 : g.land ? 0.95 : 1.05;
  // A cím a magazin-sablon FŐSZEREPLŐJE: széles oszlopot és nagy alapméretet kap.
  // A betűméret két korlát közül a szigorúbbat veszi (leghosszabb szó szélessége,
  // illetve a sorszám), a sorszámot pedig a hero magassága szabja meg — így a cím
  // a lehető legnagyobb, de sem oldalra, sem fölfelé nem lóg ki.
  const titleColW = g.story ? W - 2 * P : Math.round((W - 2 * P) * 0.62);
  // A LAKÁS CÍME kiemelt: telefonon ez a legfontosabb. SAJÁT, TELJES SZÉLESSÉGŰ
  // sorba kerül, és MINDIG EGY SORBAN marad (nowrap) — a betűméret úgy áll be,
  // hogy a teljes cím kiférjen a vászon szélességébe.
  const innerW = W - 2 * P;
  const subFs = subtitle
    ? Math.max(
        Math.round(18 * u),
        Math.min(
          Math.round((g.story ? 36 : 32) * u),
          Math.floor((innerW * 0.97) / (subtitle.length * 0.55))
        )
      )
    : 0;
  const subH = subtitle ? Math.round(subFs * 1.3) + Math.round(14 * u) : 0;
  // A magazinos serif verzáljai keskenyebbek a sans félkövérnél, ezért kisebb
  // karakterszélességgel számolunk — így nagyobb, de még kiférő címet kapunk.
  const titleCharW = o.displayFamily ? 0.66 : 0.75;
  const titleBudget = Math.round(heroH * (g.story ? 0.46 : 0.62)) - subH;
  let titleFs = Math.round(26 * u);
  for (const maxLines of [3, 2]) {
    const fs = fitHeadline(title, titleColW, 100 * u * titleK, 26 * u, maxLines, titleCharW);
    const perLine = Math.max(1, Math.floor((titleColW * 0.97) / (fs * titleCharW)));
    const lines = Math.max(1, Math.ceil(title.length / perLine));
    titleFs = fs;
    if (lines * Math.round(fs * 1.08) <= titleBudget) break;
  }

  // FONTOS: a Satori elhasal az `undefined` stílusértéken — a betűcsaládot csak
  // akkor tesszük rá, ha tényleg betöltött (magyar ékezetekkel együtt).
  const titleStyle: Style = {
    fontSize: titleFs, fontWeight: 700, color: "#ffffff", lineHeight: 1.04,
    // A serif magától is elegáns, nem kell szétfeszíteni; a sansnál marad a ritkítás.
    letterSpacing: o.displayFamily ? 0 : Math.round(1 * u),
    textShadow: "0 2px 18px rgba(0,0,0,0.55)",
  };
  if (o.displayFamily) titleStyle.fontFamily = o.displayFamily;

  const titleCol = box(
    { flexDirection: "column", width: titleColW, flexShrink: 0, overflow: "hidden" },
    box(titleStyle, title)
  );

  // A cím külön, teljes szélességű sor — sosem tördelődik.
  const subRow = subtitle
    ? box(
        {
          width: innerW, flexShrink: 0, marginTop: Math.round(12 * u),
          // Visszafogott: normál vastagság, enyhén halványítva — a főcím marad a hangsúlyos.
          fontSize: subFs, fontWeight: 400, color: "#ffffff", opacity: 0.94,
          lineHeight: 1.28, whiteSpace: "nowrap",
          textShadow: "0 2px 10px rgba(0,0,0,0.55)",
        },
        subtitle
      )
    : null;

  // Kiemelt infó-blokk (a minta dátum-blokkjának helyén): ÁR + kulcsadat.
  // A mértékegységet (Ft / M Ft) a formatPrice teszi ki — itt már NEM toldunk hozzá,
  // különben "63 900 000 Ft M Ft" lenne belőle.
  const rawPrice = formatPrice(String(o.text.price ?? ""));
  const priceTxt = truncate(rawPrice, 20);
  const keyBits = [formatSize(d.size ?? ""), numOf(d.rooms) ? `${numOf(d.rooms)} szoba` : compact(d.rooms ?? "", 14)]
    .filter(Boolean).join("  ·  ");
  const infoCol = rawPrice || keyBits
    ? box(
        { flexDirection: "column", alignItems: g.story ? "flex-start" : "flex-end", marginTop: g.story ? Math.round(18 * u) : 0 },
        [
          rawPrice
            ? box({ fontSize: Math.round(20 * u), fontWeight: 700, color: "#ffffff", opacity: 0.85, letterSpacing: Math.round(4 * u), marginBottom: Math.round(6 * u) }, "IRÁNYÁR")
            : null,
          rawPrice
            ? box({ fontSize: fitFs(priceTxt, 54 * u, 12, 0.55), fontWeight: 700, color: "#ffffff", lineHeight: 1.1, whiteSpace: "nowrap", textShadow: "0 2px 14px rgba(0,0,0,0.45)" }, priceTxt)
            : null,
          keyBits
            ? box({ fontSize: Math.round(24 * u), fontWeight: 400, color: "#ffffff", opacity: 0.92, marginTop: Math.round(8 * u), whiteSpace: "nowrap" }, truncate(keyBits, 30))
            : null,
        ].filter(Boolean)
      )
    : null;

  // Elrendezés: állóban egymás alatt (cím → lakás címe → ár), fekvőn/négyzeten
  // a cím és az ár egy sorban, ALATTA a teljes szélességű lakás-cím.
  const heroTop = g.story
    ? box({ flexDirection: "column", width: innerW }, [titleCol, subRow, infoCol].filter(Boolean))
    : box(
        { flexDirection: "column", width: innerW },
        [
          box(
            { width: innerW, alignItems: "flex-end", justifyContent: "space-between", gap: Math.round(24 * u) },
            [titleCol, infoCol].filter(Boolean)
          ),
          subRow,
        ].filter(Boolean)
      );

  const heroBottom = box(
    {
      position: "absolute", left: P, bottom: Math.round(P * (g.story ? 1.0 : 0.72)), width: innerW,
      flexDirection: "column",
    },
    heroTop
  );

  const heroBand = box(
    { position: "absolute", left: 0, top: 0, width: W, height: heroH, overflow: "hidden", background: "#e9e5df" },
    [heroImg, heroScrim, heroBottom].filter(Boolean)
  );

  // ===========================================================================
  // 2) KÖZÉPSŐ SÁV — leírás + pipás előnyök + képkollázs
  // ===========================================================================
  const midPadY = Math.round(P * 0.78);
  const innerH = midH - 2 * midPadY;
  const gap = Math.round(22 * u);

  // Előnyök: az AI kiemelései, ha vannak; különben a megadott adatokból.
  const fallbackHi = [
    formatSize(d.size ?? "") ? `${formatSize(d.size ?? "")} alapterület` : "",
    numOf(d.rooms) ? `${numOf(d.rooms)} szoba` : compact(d.rooms ?? "", 20),
    d.condition ? compact(d.condition, 22) : d.structure ? compact(d.structure, 22) : "",
  ].filter(Boolean);
  const highlights = (o.text.highlights ?? []).map((s) => String(s ?? "").trim()).filter(Boolean);
  const hiList = (highlights.length ? highlights : fallbackHi).slice(0, 3).map((s) => truncate(s, 26));

  const blurbRaw =
    String(o.text.blurb ?? "").trim() ||
      [o.text.subtitle, keyBits].filter(Boolean).join(" — ") ||
      "Vedd fel velünk a kapcsolatot a részletekért és az időpont-egyeztetésért.";

  // ÁLLÓBAN (9:16) a szövegsáv KÉT EGYENLŐ oszlop: balra a pipás előnyök,
  // jobbra a leírás — így szimmetrikus, és nem marad üres folt a sáv alatt.
  const colGap = Math.round(gap * 1.6);
  const halfW = Math.floor((innerW - colGap) / 2);
  const textColW = g.story ? halfW : Math.round(innerW * (g.land ? 0.34 : 0.38));
  const hiFs = Math.round((g.land ? 26 : 29) * u);
  const hiBox = Math.round((g.land ? 34 : 38) * u);
  const hiRow = (s: string, i: number) =>
    box({ key: i, alignItems: "center", gap: Math.round(16 * u), marginTop: Math.round(14 * u) } as Style, [
      checkBox(hiBox, t.band, Math.max(2, Math.round(2.5 * u))),
      box({ fontSize: fitFs(s, hiFs, 18, 0.7), fontWeight: 700, color: t.band, lineHeight: 1.25 }, s),
    ]);

  // A szövegoszlop MAGASSÁGRA illesztve: előbb a pipás előnyök férjenek el, a
  // maradék helyre a leírás — a betűméret annyira csökken, hogy a TELJES szöveg
  // kiférjen (nem vágjuk le a végét). Így a blokk sosem lóg az alsó sávba.
  const blurbFs = Math.round((g.land ? 23 : 25) * u);
  const hiRowH = Math.round(14 * u) + Math.max(hiBox, Math.round(hiFs * 1.3));
  const hiTop = Math.round(20 * u);
  const minBlurbH = Math.round(16 * u * 1.45) * 2; // legalább 2 sor a legkisebb méreten
  let hiCount = hiList.length;
  while (hiCount > 1 && innerH - hiTop - hiCount * hiRowH < minBlurbH) hiCount--;
  const hiShown = hiList.slice(0, hiCount);
  const hiBlockH = hiShown.length ? hiShown.length * hiRowH : 0;
  // Állóban a két oszlop EGYMÁS MELLETT van, ezért a leírás a saját fél
  // szélességén és a pipás blokk magasságában kap helyet.
  const blurbBudget = g.story
    ? Math.max(minBlurbH, hiBlockH)
    : Math.max(minBlurbH, innerH - (hiShown.length ? hiTop + hiBlockH : 0));
  const par = fitParagraph(blurbRaw, textColW, blurbBudget, blurbFs, Math.round(16 * u));

  const blurbBox = box(
    {
      width: textColW, flexShrink: 0, fontSize: par.fs, fontWeight: 400,
      color: "#3a3733", lineHeight: 1.45,
      // Állóban a két oszlop első sora egy vonalban induljon.
      marginTop: g.story ? Math.round(14 * u) : 0,
    },
    par.text
  );
  const hiBlock = hiShown.length
    ? box({ flexDirection: "column", width: textColW, flexShrink: 0 }, hiShown.map(hiRow))
    : null;

  const textH = g.story
    ? Math.max(hiBlockH, par.lines * par.lineH)
    : par.lines * par.lineH + (hiShown.length ? hiTop + hiBlockH : 0);

  const textCol = g.story
    ? box(
        { width: innerW, gap: colGap, alignItems: "flex-start", flexShrink: 0 },
        [hiBlock, blurbBox].filter(Boolean)
      )
    : box(
        { flexDirection: "column", width: textColW, flexShrink: 0 },
        [
          blurbBox,
          hiBlock ? box({ flexDirection: "column", marginTop: hiTop, flexShrink: 0 }, hiShown.map(hiRow)) : null,
        ].filter(Boolean)
      );

  // Kollázs: a mintához hasonlóan nagy bal kép + két álló kép jobbra.
  const galW = g.story ? innerW : innerW - textColW - Math.round(gap * 1.6);
  // Állóban a kollázs a szövegblokk ALATT van: a magasságát a cella SZÉLESSÉGÉHEZ
  // kötjük (természetes fotóarány), de sosem lóghat túl a maradék helyen.
  const galH = g.story
    ? Math.max(
        Math.round(160 * u),
        Math.min(
          innerH - textH - Math.round(gap * 1.2),
          Math.round((thumbs.length ? (innerW - (thumbs.length - 1) * gap) / thumbs.length : innerW) * 1.75)
        )
      )
    : innerH;
  const rad = Math.round(10 * u);
  const cell = (src: string, w: number, h: number, key: string) =>
    box(
      { key, width: w, height: h, overflow: "hidden", borderRadius: rad, background: "#e9e5df", flexShrink: 0 } as Style,
      img(src, { width: w, height: h, objectFit: "cover" })
    );

  let gallery: React.ReactElement | null = null;
  if (thumbs.length && galW > 0 && galH > 0) {
    if (g.story) {
      // Állóban: egy sor, egyenlő cellák.
      const cw = Math.floor((galW - (thumbs.length - 1) * gap) / thumbs.length);
      gallery = box({ gap, width: galW, height: galH },
        thumbs.map((s, i) => cell(s, cw, galH, `t${i}`)));
    } else if (thumbs.length >= 3) {
      const bigW = Math.round(galW * 0.54);
      const sideW = galW - bigW - gap;
      const sideH = Math.floor((galH - gap) / 2);
      gallery = box({ gap, width: galW, height: galH }, [
        cell(thumbs[0], bigW, galH, "t0"),
        box({ key: "col", flexDirection: "column", gap, width: sideW, height: galH } as Style, [
          cell(thumbs[1], sideW, sideH, "t1"),
          cell(thumbs[2], sideW, galH - sideH - gap, "t2"),
        ]),
      ]);
    } else if (thumbs.length === 2) {
      const cw = Math.floor((galW - gap) / 2);
      gallery = box({ gap, width: galW, height: galH }, [
        cell(thumbs[0], cw, galH, "t0"),
        cell(thumbs[1], galW - cw - gap, galH, "t1"),
      ]);
    } else {
      gallery = box({ width: galW, height: galH }, cell(thumbs[0], galW, galH, "t0"));
    }
  }

  const midBand = box(
    {
      position: "absolute", left: 0, top: heroH, width: W, height: midH, background: t.paper,
      paddingTop: midPadY, paddingBottom: midPadY, paddingLeft: P, paddingRight: P,
      flexDirection: g.story ? "column" : "row",
      alignItems: g.story ? "stretch" : "flex-start",
      justifyContent: "space-between",
      gap: g.story ? Math.round(gap * 1.2) : Math.round(gap * 1.6),
    },
    [textCol, gallery].filter(Boolean)
  );

  // ===========================================================================
  // 3) KAPCSOLAT-SÁV
  // ===========================================================================
  const ctaH = Math.round(Math.min(footH * 0.52, 92 * u));
  const ctaText = truncate(p.phone || p.email || "KAPCSOLAT", 20);
  const ctaBtn = box(
    {
      height: ctaH, alignItems: "center", justifyContent: "center", flexShrink: 0,
      paddingLeft: Math.round(34 * u), paddingRight: Math.round(34 * u),
      background: t.bandInk === "#ffffff" ? "#ffffff" : accent,
      borderRadius: Math.round(4 * u),
    },
    box(
      { fontSize: fitFs(ctaText, 34 * u, 14, 0.62), fontWeight: 700, color: t.bandInk === "#ffffff" ? t.band : accInk, letterSpacing: Math.round(1 * u), whiteSpace: "nowrap" },
      ctaText
    )
  );

  const contactLines = [p.email, p.website].filter(Boolean) as string[];
  const contactCol = box({ flexDirection: "column", minWidth: 0 }, [
    box({ fontSize: Math.round(22 * u), fontWeight: 400, color: t.bandInk, opacity: 0.82, lineHeight: 1.35 },
      truncate(p.display_name || p.company || "Elérhetőség", 30)),
    ...contactLines.map((v, i) =>
      box({ key: i, fontSize: Math.round(24 * u), fontWeight: 700, color: t.bandInk, lineHeight: 1.4 } as Style, truncate(v, 34))
    ),
  ]);

  const markD = Math.round(Math.min(footH * 0.5, 96 * u));
  const mark = p.logo_url
    ? box(
        { width: markD, height: markD, borderRadius: 9999, background: "#ffffff", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 },
        img(p.logo_url, { maxWidth: Math.round(markD * 0.74), maxHeight: Math.round(markD * 0.74), objectFit: "contain" })
      )
    : p.agent_photo_url
      ? img(p.agent_photo_url, { width: markD, height: markD, borderRadius: 9999, objectFit: "cover", border: `${Math.round(2 * u)}px solid ${t.bandInk}` })
      : box({ width: markD, height: markD, alignItems: "center", justifyContent: "center", flexShrink: 0 }, icon("globe", Math.round(markD * 0.62), t.bandInk, 1.6));

  const divider = box({ width: Math.max(1, Math.round(2 * u)), height: Math.round(ctaH * 0.78), background: t.bandInk, opacity: 0.35, flexShrink: 0 }, "");

  const footBand = box(
    {
      position: "absolute", left: 0, bottom: 0, width: W, height: footH, background: t.band,
      alignItems: "center", paddingLeft: P, paddingRight: P, gap: Math.round(28 * u),
    },
    [ctaBtn, divider, mark, contactCol]
  );

  const wm = o.watermark
    ? box(
        { position: "absolute", top: 0, left: 0, width: W, height: H, flexDirection: "column", justifyContent: "space-around", alignItems: "center", transform: "rotate(-24deg)" },
        Array.from({ length: 6 }).map((_, i) =>
          box({ key: i, fontSize: Math.round(46 * u), fontWeight: 700, color: "rgba(120,90,60,0.28)", letterSpacing: Math.round(6 * u) } as Style, "ELŐNÉZET · TWINX")
        )
      )
    : null;

  return box(
    { position: "relative", width: W, height: H, fontFamily: family, background: t.paper },
    [heroBand, midBand, footBand, wm].filter(Boolean)
  );
}
