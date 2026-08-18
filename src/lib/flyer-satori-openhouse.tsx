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
  const heroScrim = box({
    position: "absolute", left: 0, bottom: 0, width: W, height: Math.round(heroH * 0.8),
    backgroundImage: "linear-gradient(0deg, rgba(0,0,0,0.80) 0%, rgba(0,0,0,0.42) 46%, rgba(0,0,0,0) 100%)",
  });

  const title = truncate((o.text.title || "Eladó ingatlan").toUpperCase(), 40);
  const subtitle = truncate(o.text.subtitle, 64);
  const titleK = g.story ? 1.06 : g.land ? 0.9 : 1;
  // A cím oszlopa fix szélességű — a betűméret ehhez igazodik, hogy a hosszú
  // szavak (településnevek) ne lógjanak át a jobb oldali ár-blokkra.
  const titleColW = g.story ? W - 2 * P : Math.round((W - 2 * P) * 0.58);
  // Max 2 sor — a hero-blokk így nem nő túl nagyra a fotón.
  const titleFs = fitHeadline(title, titleColW, 86 * u * titleK, 26 * u, 2, 0.75);

  const titleCol = box(
    { flexDirection: "column", width: titleColW, flexShrink: 0, overflow: "hidden" },
    [
      box({ fontSize: titleFs, fontWeight: 700, color: "#ffffff", lineHeight: 1.02, letterSpacing: Math.round(1 * u), lineClamp: 2, textShadow: "0 2px 18px rgba(0,0,0,0.5)" }, title),
      subtitle
        ? box({ fontSize: Math.round(26 * u), fontWeight: 400, color: "#ffffff", opacity: 0.95, marginTop: Math.round(12 * u), lineHeight: 1.25, lineClamp: 2, textShadow: "0 1px 10px rgba(0,0,0,0.5)" }, subtitle)
        : null,
    ].filter(Boolean)
  );

  // Kiemelt infó-blokk (a minta dátum-blokkjának helyén): ÁR + kulcsadat.
  const rawPrice = formatPrice(String(o.text.price ?? ""));
  const priceIsBare = /^\d+([.,]\d+)?$/.test(rawPrice);
  const priceTxt = priceIsBare ? `${rawPrice} M Ft` : truncate(rawPrice, 18);
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

  const heroBottom = box(
    {
      position: "absolute", left: P, bottom: Math.round(P * (g.story ? 1.0 : 0.72)), width: W - 2 * P,
      flexDirection: g.story ? "column" : "row",
      alignItems: g.story ? "flex-start" : "flex-end",
      justifyContent: "space-between", gap: Math.round(24 * u),
    },
    [titleCol, infoCol].filter(Boolean)
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
  const innerW = W - 2 * P;
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

  const textColW = g.story ? innerW : Math.round(innerW * (g.land ? 0.34 : 0.38));
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
  const blurbBudget = Math.max(
    minBlurbH,
    innerH - (hiShown.length ? hiTop + hiShown.length * hiRowH : 0)
  );
  const par = fitParagraph(blurbRaw, textColW, blurbBudget, blurbFs, Math.round(16 * u));
  const textH = par.lines * par.lineH + (hiShown.length ? hiTop + hiShown.length * hiRowH : 0);

  const textCol = box(
    { flexDirection: "column", width: textColW, flexShrink: 0 },
    [
      box(
        { fontSize: par.fs, fontWeight: 400, color: "#3a3733", lineHeight: 1.45, flexShrink: 0 },
        par.text
      ),
      hiShown.length
        ? box({ flexDirection: "column", marginTop: hiTop, flexShrink: 0 }, hiShown.map(hiRow))
        : null,
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
          Math.round((thumbs.length ? (innerW - (thumbs.length - 1) * gap) / thumbs.length : innerW) * 1.28)
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
