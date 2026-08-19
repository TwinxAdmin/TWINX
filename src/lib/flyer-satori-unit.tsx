// „Adatlap" hirdetés-sablon (Satori).
// Fölül ívelt aljú főkép, alatta sötét sáv a főcímmel, az árral és egy
// hajszálvonalas adattáblával; középen világos blokk feliratozott képráccsal és
// egy „áttekintés" oszloppal (leírás + ikonos adatok + cím); lent kapcsolat-sáv.
//
// Minden méreten működik: az álló (9:16) változatban az áttekintés a képrács ALÁ
// kerül teljes szélességben, a fekvő és négyzetes méretnél mellé.
import React from "react";
import {
  buildTheme, truncate, flyerGeom, formatPrice, formatSize, type RenderOpts,
} from "@/lib/flyer-poster";
import {
  box, img, onColor, compact, numOf, icon, factItems, heroFill, fitFs, fitHeadline, fitParagraph,
  type Style,
} from "@/lib/flyer-satori-kit";

/** Helyiség-felirat szépítése: verzál, ékezethelyesen, rövidítve. */
function labelOf(s: string, fallback: string): string {
  const v = String(s ?? "").trim();
  return truncate((v || fallback).toUpperCase(), 18);
}

export function buildUnitElement(o: RenderOpts, family: string): React.ReactElement {
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
  const labels = o.thumbLabels ?? [];

  // --- Sávok: a négy rész PONTOSAN kiadja a vászon magasságát ----------------
  // Állóban (9:16) a cím és az adattábla EGYMÁS ALATT van, ezért ott a sötét sáv
  // magasabb — különben az utolsó adatsor beleér a világos blokkba.
  // FEKVŐN (4:3) magasabb a sötét sáv: a rövid vászonmagasság miatt korábban
  // beleért az utolsó adatsor a világos blokkba. Ezzel az áttekintés és a képrács
  // is lejjebb csúszik — csak a 4:3-at érinti.
  const heroH = Math.round(H * (g.story ? 0.33 : g.land ? 0.24 : 0.28));
  const bandH = Math.round(H * (g.story ? 0.23 : g.land ? 0.23 : 0.20));
  const footH = Math.round(H * (g.story ? 0.10 : g.land ? 0.10 : 0.11));
  const midH = H - heroH - bandH - footH;
  const P = Math.round((g.land ? 56 : 60) * u);
  const hairOp = 0.3;

  // ===========================================================================
  // 1) FŐKÉP + ÍVELT ALSÓ ÉL
  // ===========================================================================
  const heroImg = heroFill(hero, W, heroH, o.heroPos?.x ?? 50, o.heroPos?.y ?? 50, o.heroDim?.w ?? 0, o.heroDim?.h ?? 0);
  const heroBand = box(
    { position: "absolute", left: 0, top: 0, width: W, height: heroH, overflow: "hidden", background: "#e9e5df" },
    heroImg ?? undefined
  );

  // Az ív a főkép aljába lóg bele. FONTOS: nem tömör folt — alul teljesen fedő,
  // fölfelé fokozatosan átlátszó, így a fotóból sokkal több marad látható.
  const curveH = Math.round(Math.min(heroH * 0.46, 230 * u));
  const curvePath =
    `M0,${curveH} L0,${Math.round(curveH * 0.42)} ` +
    `C ${Math.round(W * 0.30)},${Math.round(curveH * 0.02)} ${Math.round(W * 0.64)},${Math.round(curveH * 0.86)} ${W},${Math.round(curveH * 0.46)} ` +
    `L ${W},${curveH} Z`;
  const curve = React.createElement(
    "svg",
    { width: W, height: curveH, viewBox: `0 0 ${W} ${curveH}`, style: { position: "absolute", left: 0, top: heroH - curveH } },
    [
      React.createElement(
        "defs",
        { key: "d" },
        React.createElement(
          "linearGradient",
          { id: "twxCurveFade", x1: "0", y1: "1", x2: "0", y2: "0" },
          [
            // MEREDEK átmenet: közvetlenül a sáv fölött már erősen világosodik,
            // az alsó negyedben ~35%-ra esik, feljebb szinte teljesen eltűnik —
            // így a főképből alig takar ki valamit.
            React.createElement("stop", { key: 0, offset: "0%", stopColor: t.band, stopOpacity: 1 }),
            React.createElement("stop", { key: 1, offset: "8%", stopColor: t.band, stopOpacity: 0.6 }),
            React.createElement("stop", { key: 2, offset: "22%", stopColor: t.band, stopOpacity: 0.35 }),
            React.createElement("stop", { key: 3, offset: "50%", stopColor: t.band, stopOpacity: 0.1 }),
            React.createElement("stop", { key: 4, offset: "100%", stopColor: t.band, stopOpacity: 0 }),
          ]
        )
      ),
      React.createElement("path", { key: "p", d: curvePath, fill: "url(#twxCurveFade)" }),
    ]
  );

  // ===========================================================================
  // 2) SÖTÉT SÁV — főcím + ár + adattábla
  // ===========================================================================
  const title = truncate((o.text.title || "Eladó ingatlan").toUpperCase(), 46);
  const titleK = g.story ? 1.0 : g.land ? 0.84 : 0.94;
  // A cím oszlopa FIX szélességű — a betűméretet ehhez igazítjuk, hogy a hosszú
  // településnevek (pl. „SZÉKESFEHÉRVÁRON") se lógjanak át a jobb oldali adatokra.
  const titleColW = g.story ? W - 2 * P : Math.round((W - 2 * P) * 0.46);

  // Állóban a pontos cím KIEMELT: jóval nagyobb és erősebb, mert telefonon
  // ez a legfontosabb tájékozódási pont a cím alatt.
  const subTxt = truncate(o.text.subtitle ?? "", 56);
  const subFs = subTxt
    ? (g.story
        ? fitHeadline(subTxt, titleColW, 40 * u, 20 * u, 2, 0.62)
        : fitHeadline(subTxt, titleColW, 22 * u, 14 * u, 2, 0.58))
    : 0;
  const subTop = Math.round((g.story ? 16 : 10) * u);
  const subH = subTxt ? Math.round(subFs * 1.32) + subTop : 0;

  // A cím MAGASSÁGRA is illesztve: a sávban rendelkezésre álló hely alapján
  // választjuk a sorszámot (3 → 2 → 1), és ahhoz a betűméretet. Enélkül a
  // hosszú, háromsoros cím felül/alul levágódna a sötét sávban.
  const bandPadY = Math.round(P * (g.story ? 0.34 : 0.5));
  const availTitleH = Math.max(Math.round(30 * u), bandH - 2 * bandPadY - subH);
  let titleFs = Math.round(24 * u);
  for (const maxLines of [3, 2, 1]) {
    const fs = fitHeadline(title, titleColW, 72 * u * titleK, 24 * u, maxLines, 0.75);
    const perLine = Math.max(1, Math.floor((titleColW * 0.97) / (fs * 0.75)));
    const lines = Math.max(1, Math.ceil(title.length / perLine));
    titleFs = fs;
    if (lines * Math.round(fs * 1.1) <= availTitleH) break;
  }

  const titleCol = box(
    { flexDirection: "column", width: titleColW, flexShrink: 0, overflow: "hidden" },
    [
      box({ fontSize: titleFs, fontWeight: 700, color: t.bandInk, lineHeight: 1.06, letterSpacing: Math.round(1 * u) }, title),
      subTxt
        ? box(
            {
              fontSize: subFs, fontWeight: g.story ? 700 : 400, color: t.bandInk,
              opacity: g.story ? 0.96 : 0.82, marginTop: subTop, lineHeight: 1.28,
            },
            subTxt
          )
        : null,
    ].filter(Boolean)
  );

  const rawPrice = formatPrice(String(o.text.price ?? ""));
  const priceIsBare = /^\d+([.,]\d+)?$/.test(rawPrice);
  const priceTxt = priceIsBare ? `${rawPrice} M Ft` : truncate(rawPrice, 18);

  const hair = (key: string) =>
    box({ key, width: "100%", height: Math.max(1, Math.round(1.5 * u)), background: t.bandInk, opacity: hairOp, marginTop: Math.round(12 * u), marginBottom: Math.round(12 * u) } as Style, "");
  const specLabel = (s: string, key: string) =>
    box({ key, fontSize: Math.round(19 * u), fontWeight: 700, color: t.bandInk, opacity: 0.72, letterSpacing: Math.round(2 * u), whiteSpace: "nowrap" } as Style, s);
  const specValue = (s: string, key: string) =>
    box({ key, fontSize: fitFs(s, 24 * u, 20, 0.72), fontWeight: 700, color: t.bandInk, whiteSpace: "nowrap" } as Style, s);

  const typeTxt = compact(o.text.chips.filter(Boolean)[1] || "", 24);
  const sizeTxt = formatSize(d.size ?? "");

  // Az ÁLLAPOT sor kikerült: az ismétlődő „Újszerű / Új építésű" nem ad hozzá a
  // hirdetéshez, viszont sávmagasságot evett. Marad a TÍPUS és a MÉRET.
  // FEKVŐN a kettő EGY sorba kerül (mint a nyomtatott adatlapokon), így a sötét
  // sávban nem csúszik ki az utolsó sor.
  const specRows: React.ReactElement[] = [];
  const pair = (label: string, value: string, key: string) =>
    box({ key, alignItems: "center", gap: Math.round(12 * u) } as Style, [
      specLabel(label, `${key}l`), specValue(value, `${key}v`),
    ]);

  if (g.land && typeTxt && sizeTxt) {
    specRows.push(hair("h1"));
    specRows.push(box({ key: "r1", width: "100%", alignItems: "center", justifyContent: "space-between", gap: Math.round(18 * u) } as Style, [
      pair("TÍPUS", typeTxt, "p1"), pair("MÉRET", sizeTxt, "p2"),
    ]));
  } else {
    if (typeTxt) {
      specRows.push(hair("h1"));
      specRows.push(box({ key: "r1", width: "100%", alignItems: "center", justifyContent: "space-between", gap: Math.round(18 * u) } as Style, [
        specLabel("TÍPUS", "l1"), specValue(typeTxt, "v1"),
      ]));
    }
    if (sizeTxt) {
      specRows.push(hair("h2"));
      specRows.push(box({ key: "r2", width: "100%", alignItems: "center", justifyContent: "space-between", gap: Math.round(18 * u) } as Style, [
        specLabel("MÉRET", "l2"), specValue(sizeTxt, "v2"),
      ]));
    }
  }

  const priceCol = box(
    { flexDirection: "column", width: g.story ? "100%" : Math.round((W - 2 * P) * 0.48), flexShrink: 0, marginTop: g.story ? Math.round(16 * u) : 0 },
    [
      rawPrice
        ? box({ key: "pr", width: "100%", alignItems: "baseline", justifyContent: "space-between", gap: Math.round(18 * u) } as Style, [
            specLabel("IRÁNYÁR", "lp"),
            box({ key: "vp", fontSize: fitFs(priceTxt, 58 * u, 12, 0.5), fontWeight: 700, color: t.bandInk, lineHeight: 1.05, whiteSpace: "nowrap" } as Style, priceTxt),
          ])
        : null,
      ...specRows,
    ].filter(Boolean)
  );

  const darkBand = box(
    {
      position: "absolute", left: 0, top: heroH, width: W, height: bandH, background: t.band,
      overflow: "hidden",
      paddingLeft: P, paddingRight: P,
      paddingTop: Math.round(P * (g.story ? 0.34 : 0.5)), paddingBottom: Math.round(P * (g.story ? 0.34 : 0.5)),
      flexDirection: g.story ? "column" : "row",
      alignItems: g.story ? "stretch" : "center",
      justifyContent: g.story ? "center" : "space-between", gap: Math.round((g.story ? 18 : 30) * u),
    },
    [titleCol, priceCol]
  );

  // ===========================================================================
  // 3) VILÁGOS BLOKK — feliratozott képrács + áttekintés
  // ===========================================================================
  const midPad = Math.round(P * 0.72);
  const innerW = W - 2 * P;
  const innerH = midH - 2 * midPad;
  const gap = Math.round(20 * u);
  const capH = Math.round(34 * u); // a felirat sávja a kép alatt

  // FEKVŐN (4:3) MOZAIK: balra egy NÉGYZETES nagy kép, mellette a másik kettő
  // egymás alatt. A méreteket a rendelkezésre álló MAGASSÁGBÓL számoljuk, így a
  // kis képek is normál arányúak maradnak (nem lapulnak csíkká).
  const mosaic = g.land && thumbs.length >= 3;
  const bigSide = Math.max(Math.round(120 * u), innerH - capH);
  const smallH = Math.max(Math.round(60 * u), Math.floor((bigSide - capH - gap) / 2));
  const smallW = Math.round(smallH * 1.45);

  const gridW = mosaic
    ? bigSide + gap + smallW
    : g.story ? innerW : Math.round(innerW * (g.land ? 0.64 : 0.60));
  const overW = g.story
    ? innerW
    : Math.max(Math.round(220 * u), innerW - gridW - Math.round(gap * 1.8));

  // --- Az áttekintés-blokk mérőszámai (a rács előtt kellenek: állóban a rács
  //     csak azt a helyet kapja meg, ami az áttekintés TELJES tartalma után marad,
  //     így ott egyetlen adat sem esik ki) ---
  const allItems = factItems(d, sizeTxt).slice(0, 4);
  const statIcon = Math.round((g.land ? 28 : 34) * u);
  const statTop = Math.round((g.land ? 10 : 14) * u);
  const statCellW = Math.floor((overW - gap) / 2);
  const headH = Math.round(24 * u * 1.3) + Math.round(12 * u);
  const blurbLineH = Math.round(21 * u * 1.45);
  const statRowH = statTop + statIcon + Math.round(5 * u) + Math.round(21 * u * 1.3);
  const hairH = Math.round(16 * u) + Math.round(4 * u) + 1;
  const addrH = hairH + Math.round(10 * u) + Math.round(24 * u * 1.35);
  const overBlurbRaw =
    String(o.text.blurb ?? "").trim() ||
      [o.text.subtitle, [sizeTxt, numOf(d.rooms) ? `${numOf(d.rooms)} szoba` : ""].filter(Boolean).join(", ")]
        .filter(Boolean).join(" — ") ||
      "Kérj részletes tájékoztatót és időpontot a megtekintéshez.";
  // A leírás VALÓS sorszáma az alapméreten — ennyit foglalunk le neki.
  const blurbLines0 = Math.min(3, Math.max(1,
    Math.ceil(overBlurbRaw.length / Math.max(8, Math.floor(overW / (Math.round(21 * u) * 0.52))))
  ));
  const overWant =
    headH + blurbLines0 * blurbLineH +
    (allItems.length ? hairH + Math.ceil(allItems.length / 2) * statRowH : 0) +
    addrH;

  // Állóban EGY SORBAN áll a három kép — így természetes arányúak maradnak
  // (két sorban a keskeny helyen csíkká laposodnának).
  const cols = g.story
    ? Math.max(1, Math.min(thumbs.length, 3))
    : thumbs.length >= 3 ? 2 : thumbs.length === 2 ? 2 : 1;
  const rows = Math.ceil(Math.max(thumbs.length, 1) / cols);
  const cellW = Math.floor((gridW - (cols - 1) * gap) / cols);
  // A kép magassága a SZÉLESSÉGBŐL jön (természetes, 3:2 körüli arány), de a
  // rendelkezésre álló helyre korlátozva — így sem szét nem nyúlik, sem nem lóg ki.
  const gridBudget = g.story
    ? Math.max(Math.round(innerH * 0.34), innerH - overWant - Math.round(gap * 1.2))
    : innerH;
  const picH = Math.max(
    Math.round(80 * u),
    Math.min(
      Math.round(cellW * 0.66),
      Math.floor((gridBudget - rows * capH - (rows - 1) * gap) / rows)
    )
  );
  const cellH = picH + capH;
  const gridH = mosaic ? bigSide + capH : rows * cellH + (rows - 1) * gap;

  const FALLBACK_LABELS = ["NAPPALI", "KONYHA", "HÁLÓSZOBA", "FÜRDŐSZOBA"];
  /** Egy képcella: kép + alatta a helyiség felirata. */
  const cellOf = (src: string, w: number, h: number, i: number) =>
    box({ key: `c${i}`, flexDirection: "column", width: w, flexShrink: 0 } as Style, [
      box(
        { key: "im", width: w, height: h, overflow: "hidden", borderRadius: Math.round(6 * u), background: "#e9e5df" } as Style,
        img(src, { width: w, height: h, objectFit: "cover" })
      ),
      box(
        { key: "cp", height: capH, alignItems: "center", fontSize: Math.round(18 * u), fontWeight: 700, color: "#4a4642", letterSpacing: Math.round(2 * u), whiteSpace: "nowrap" } as Style,
        labelOf(labels[i] ?? "", FALLBACK_LABELS[i] ?? "FOTÓ")
      ),
    ]);

  let grid: React.ReactElement | null = null;
  if (mosaic) {
    // Bal: négyzetes főkép a kisképek közül. Jobb: két kép egymás alatt,
    // együtt pontosan a nagy kép magasságát adják ki.
    grid = box({ gap, width: gridW, flexShrink: 0 }, [
      cellOf(thumbs[0], bigSide, bigSide, 0),
      box({ key: "col", flexDirection: "column", gap, width: smallW, flexShrink: 0 } as Style, [
        cellOf(thumbs[1], smallW, smallH, 1),
        cellOf(thumbs[2], smallW, smallH, 2),
      ]),
    ]);
  } else if (thumbs.length) {
    const gridRows: React.ReactElement[] = [];
    for (let r = 0; r < rows; r++) {
      const slice = thumbs.slice(r * cols, r * cols + cols);
      if (!slice.length) break;
      gridRows.push(
        box({ key: `r${r}`, gap, width: gridW, marginTop: r ? gap : 0 } as Style,
          slice.map((s, j) => cellOf(s, cellW, picH, r * cols + j)))
      );
    }
    grid = box({ flexDirection: "column", width: gridW, flexShrink: 0 }, gridRows);
  }

  // --- Áttekintés-oszlop: MAGASSÁGRA illesztve -------------------------------
  // Sorrend szerint annyi fér bele, amennyi ténylegesen kifér: cím → leírás →
  // ikonos adatok → cím-sor. Ami nem fér, az kimarad (nem lóg az alsó sávba).
  const overAvail = g.story ? innerH - gridH - Math.round(gap * 1.2) : innerH;

  // Helyfoglalás SORRENDBEN: a TÉNYADATOK élveznek elsőbbséget a leírással szemben
  // (azok a fontos, tömör információk), de a leírás kap egy 2 soros minimumot.
  //   1) fejléc → 2) a leírás minimuma → 3) ikonos adatok → 4) cím-sor → 5) a maradék a leírásé
  let rem = overAvail - headH;
  const minBlurbH = 2 * blurbLineH;
  rem -= minBlurbH;
  let statRowCount = 0;
  if (rem >= hairH + statRowH) {
    statRowCount = Math.min(Math.ceil(allItems.length / 2), Math.floor((rem - hairH) / statRowH));
    if (statRowCount > 0) rem -= hairH + statRowCount * statRowH;
  }
  const items = allItems.slice(0, statRowCount * 2);
  const showAddr = rem >= addrH;
  if (showAddr) rem -= addrH;
  // A leírás a minimumon FELÜL megkapja a maradékot; a betűméret annyira csökken,
  // hogy a teljes szöveg kiférjen (nem vágjuk le a végét).
  const par = fitParagraph(
    overBlurbRaw, overW, minBlurbH + Math.max(0, rem), Math.round(21 * u), Math.round(14 * u)
  );
  const statCell = (it: { k: string; v: string }, i: number) =>
    box({ key: `s${i}`, flexDirection: "column", width: statCellW, marginTop: statTop, flexShrink: 0 } as Style, [
      icon(it.k, statIcon, "#4a4642", 1.6),
      box({ key: "v", fontSize: fitFs(it.v, 21 * u, 14, 0.72), fontWeight: 700, color: "#2c2926", marginTop: Math.round(5 * u), whiteSpace: "nowrap" } as Style, it.v),
    ]);
  const statRows: React.ReactElement[] = [];
  for (let r = 0; r < Math.ceil(items.length / 2); r++) {
    const slice = items.slice(r * 2, r * 2 + 2);
    statRows.push(box({ key: `sr${r}`, gap, width: overW, flexShrink: 0 } as Style, slice.map((it, j) => statCell(it, r * 2 + j))));
  }

  const lightHair = box({ width: "100%", height: 1, background: "#cfc9c1", marginTop: Math.round(16 * u), marginBottom: Math.round(4 * u), flexShrink: 0 }, "");
  const address = truncate([o.text.subtitle].filter(Boolean).join(" ") || p.company || "", 46);

  const overview = box(
    { flexDirection: "column", width: overW, height: Math.max(0, overAvail), overflow: "hidden", flexShrink: 0 },
    [
      box({ fontSize: Math.round(24 * u), fontWeight: 700, color: "#2c2926", letterSpacing: Math.round(5 * u), flexShrink: 0 }, "ÁTTEKINTÉS"),
      box({ fontSize: par.fs, fontWeight: 400, color: "#4a4642", lineHeight: 1.45, marginTop: Math.round(12 * u), flexShrink: 0 }, par.text),
      items.length ? lightHair : null,
      ...statRows,
      address && showAddr ? lightHair : null,
      address && showAddr
        ? box({ alignItems: "center", gap: Math.round(10 * u), marginTop: Math.round(10 * u) }, [
            icon("pin", Math.round(24 * u), "#4a4642", 1.6),
            box({ fontSize: Math.round(19 * u), fontWeight: 400, color: "#4a4642", lineHeight: 1.35, lineClamp: 1 }, address),
          ])
        : null,
    ].filter(Boolean)
  );

  const midBand = box(
    {
      position: "absolute", left: 0, top: heroH + bandH, width: W, height: midH, background: t.paper,
      paddingTop: midPad, paddingBottom: midPad, paddingLeft: P, paddingRight: P,
      flexDirection: g.story ? "column" : "row",
      alignItems: "flex-start", justifyContent: "space-between",
      gap: g.story ? Math.round(gap * 1.2) : Math.round(gap * 1.8),
    },
    [grid, overview].filter(Boolean)
  );

  // ===========================================================================
  // 4) KAPCSOLAT-SÁV
  // ===========================================================================
  const ctaH = Math.round(Math.min(footH * 0.54, 86 * u));
  const ctaBtn = box(
    {
      height: ctaH, alignItems: "center", justifyContent: "center", flexShrink: 0,
      paddingLeft: Math.round(32 * u), paddingRight: Math.round(32 * u),
      borderRadius: Math.round(8 * u), border: `${Math.max(1, Math.round(2 * u))}px solid ${t.bandInk}`,
    },
    box({ fontSize: Math.round(26 * u), fontWeight: 700, color: t.bandInk, letterSpacing: Math.round(1 * u), whiteSpace: "nowrap" }, "KAPCSOLAT")
  );
  const contactChip = (kind: string, v: string, key: string) =>
    box({ key, alignItems: "center", gap: Math.round(12 * u), minWidth: 0 } as Style, [
      box({ key: "ic", width: Math.round(40 * u), height: Math.round(40 * u), borderRadius: 9999, alignItems: "center", justifyContent: "center", flexShrink: 0, border: `${Math.max(1, Math.round(1.5 * u))}px solid ${t.bandInk}` } as Style,
        icon(kind, Math.round(22 * u), t.bandInk, 1.6)),
      box({ key: "tx", fontSize: fitFs(v, 25 * u, 24, 0.62), fontWeight: 700, color: t.bandInk, whiteSpace: "nowrap" } as Style, truncate(v, 34)),
    ]);

  const chips: React.ReactElement[] = [];
  if (p.phone) chips.push(contactChip("phone", p.phone, "cp"));
  if (p.email) chips.push(contactChip("mail", p.email, "ce"));
  if (!chips.length && p.website) chips.push(contactChip("globe", p.website, "cw"));

  const footBand = box(
    {
      position: "absolute", left: 0, bottom: 0, width: W, height: footH, background: t.band,
      alignItems: "center", paddingLeft: P, paddingRight: P, gap: Math.round(26 * u),
      justifyContent: g.story ? "space-between" : "flex-start",
    },
    [ctaBtn, ...chips]
  );

  const wm = o.watermark
    ? box(
        { position: "absolute", top: 0, left: 0, width: W, height: H, flexDirection: "column", justifyContent: "space-around", alignItems: "center", transform: "rotate(-24deg)" },
        Array.from({ length: 6 }).map((_, i) =>
          box({ key: i, fontSize: Math.round(46 * u), fontWeight: 700, color: "rgba(120,90,60,0.28)", letterSpacing: Math.round(6 * u) } as Style, "ELŐNÉZET · TWINX")
        )
      )
    : null;

  // Az accent egy vékony jelzőcsíkban jelenik meg a sötét sáv tetején (arculat).
  const accentLine = box({ position: "absolute", left: 0, top: heroH + bandH, width: W, height: Math.max(2, Math.round(5 * u)), background: accent, color: accInk }, "");

  // FONTOS: az accent-csík a világos blokk UTÁN kerül a fába, különben az takarná.
  return box(
    { position: "relative", width: W, height: H, fontFamily: family, background: t.paper },
    [heroBand, curve, darkBand, midBand, accentLine, footBand, wm].filter(Boolean)
  );
}
