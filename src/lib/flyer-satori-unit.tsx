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
  box, img, onColor, compact, numOf, icon, factItems, heroFill, fitFs, fitParagraph, type Style,
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
  const heroH = Math.round(H * (g.land ? 0.28 : 0.30));
  const bandH = Math.round(H * (g.land ? 0.20 : g.story ? 0.20 : 0.21));
  const footH = Math.round(H * (g.story ? 0.11 : g.land ? 0.11 : 0.12));
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

  // Az ív a főkép aljába lóg bele, a sáv színével — így „elvágja" a fotót.
  const curveH = Math.round(Math.min(heroH * 0.34, 150 * u));
  const curvePath =
    `M0,${curveH} L0,${Math.round(curveH * 0.58)} ` +
    `C ${Math.round(W * 0.30)},${Math.round(curveH * 0.02)} ${Math.round(W * 0.64)},${curveH} ${W},${Math.round(curveH * 0.60)} ` +
    `L ${W},${curveH} Z`;
  const curve = React.createElement(
    "svg",
    { width: W, height: curveH, viewBox: `0 0 ${W} ${curveH}`, style: { position: "absolute", left: 0, top: heroH - curveH } },
    React.createElement("path", { d: curvePath, fill: t.band })
  );

  // ===========================================================================
  // 2) SÖTÉT SÁV — főcím + ár + adattábla
  // ===========================================================================
  const title = truncate((o.text.title || "Eladó ingatlan").toUpperCase(), 46);
  const titleK = g.story ? 1.0 : g.land ? 0.84 : 0.94;
  const titleFs = Math.round(fitFs(title, 72 * u * titleK, 22, 0.5));
  const titleCol = box(
    { flexDirection: "column", width: g.story ? "100%" : Math.round((W - 2 * P) * 0.46), flexShrink: 0 },
    [
      box({ fontSize: titleFs, fontWeight: 700, color: t.bandInk, lineHeight: 1.06, letterSpacing: Math.round(1 * u), lineClamp: 3 }, title),
      o.text.subtitle
        ? box({ fontSize: Math.round(22 * u), fontWeight: 400, color: t.bandInk, opacity: 0.82, marginTop: Math.round(10 * u), lineHeight: 1.3, lineClamp: 2 }, truncate(o.text.subtitle, 56))
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
  const condTxt = compact(d.condition || d.structure || "", 20);

  const specRows: React.ReactElement[] = [];
  if (typeTxt) {
    specRows.push(hair("h1"));
    specRows.push(box({ key: "r1", width: "100%", alignItems: "center", justifyContent: "space-between", gap: Math.round(18 * u) } as Style, [
      specLabel("TÍPUS", "l1"), specValue(typeTxt, "v1"),
    ]));
  }
  if (sizeTxt || condTxt) {
    specRows.push(hair("h2"));
    specRows.push(box({ key: "r2", width: "100%", alignItems: "center", justifyContent: "space-between", gap: Math.round(18 * u) } as Style, [
      sizeTxt
        ? box({ key: "p1", alignItems: "center", gap: Math.round(12 * u) } as Style, [specLabel("MÉRET", "l2"), specValue(sizeTxt, "v2")])
        : null,
      condTxt
        ? box({ key: "p2", alignItems: "center", gap: Math.round(12 * u) } as Style, [specLabel("ÁLLAPOT", "l3"), specValue(condTxt, "v3")])
        : null,
    ].filter(Boolean)));
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
      paddingLeft: P, paddingRight: P, paddingTop: Math.round(P * 0.5), paddingBottom: Math.round(P * 0.5),
      flexDirection: g.story ? "column" : "row",
      alignItems: g.story ? "stretch" : "center",
      justifyContent: "space-between", gap: Math.round(30 * u),
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

  const gridW = g.story ? innerW : Math.round(innerW * (g.land ? 0.64 : 0.60));
  const overW = g.story ? innerW : innerW - gridW - Math.round(gap * 1.8);

  const cols = thumbs.length >= 3 ? 2 : thumbs.length === 2 ? 2 : 1;
  const rows = Math.ceil(Math.max(thumbs.length, 1) / cols);
  const cellW = Math.floor((gridW - (cols - 1) * gap) / cols);
  // A kép magassága a SZÉLESSÉGBŐL jön (természetes, 3:2 körüli arány), de a
  // rendelkezésre álló helyre korlátozva — így sem szét nem nyúlik, sem nem lóg ki.
  const gridBudget = g.story ? Math.round(innerH * 0.62) : innerH;
  const picH = Math.max(
    Math.round(80 * u),
    Math.min(
      Math.round(cellW * 0.66),
      Math.floor((gridBudget - rows * capH - (rows - 1) * gap) / rows)
    )
  );
  const cellH = picH + capH;
  const gridH = rows * cellH + (rows - 1) * gap;

  const FALLBACK_LABELS = ["NAPPALI", "KONYHA", "HÁLÓSZOBA", "FÜRDŐSZOBA"];
  const gridCell = (src: string, i: number) =>
    box({ key: `c${i}`, flexDirection: "column", width: cellW, flexShrink: 0 } as Style, [
      box(
        { key: "im", width: cellW, height: picH, overflow: "hidden", borderRadius: Math.round(6 * u), background: "#e9e5df" } as Style,
        img(src, { width: cellW, height: picH, objectFit: "cover" })
      ),
      box(
        { key: "cp", height: capH, alignItems: "center", fontSize: Math.round(18 * u), fontWeight: 700, color: "#4a4642", letterSpacing: Math.round(2 * u), whiteSpace: "nowrap" } as Style,
        labelOf(labels[i] ?? "", FALLBACK_LABELS[i] ?? "FOTÓ")
      ),
    ]);

  const gridRows: React.ReactElement[] = [];
  for (let r = 0; r < rows; r++) {
    const slice = thumbs.slice(r * cols, r * cols + cols);
    if (!slice.length) break;
    gridRows.push(
      box({ key: `r${r}`, gap, width: gridW, marginTop: r ? gap : 0 } as Style, slice.map((s, j) => gridCell(s, r * cols + j)))
    );
  }
  const grid = thumbs.length
    ? box({ flexDirection: "column", width: gridW, flexShrink: 0 }, gridRows)
    : null;

  // --- Áttekintés-oszlop: MAGASSÁGRA illesztve -------------------------------
  // Sorrend szerint annyi fér bele, amennyi ténylegesen kifér: cím → leírás →
  // ikonos adatok → cím-sor. Ami nem fér, az kimarad (nem lóg az alsó sávba).
  const allItems = factItems(d, sizeTxt).slice(0, 4);
  const statIcon = Math.round(34 * u);
  const statCellW = Math.floor((overW - gap) / 2);
  const overAvail = g.story ? innerH - gridH - Math.round(gap * 1.2) : innerH;
  const headH = Math.round(24 * u * 1.3) + Math.round(12 * u);
  const blurbLineH = Math.round(21 * u * 1.45);
  const statRowH = Math.round(14 * u) + statIcon + Math.round(5 * u) + Math.round(21 * u * 1.3);
  const hairH = Math.round(16 * u) + Math.round(4 * u) + 1;
  const addrH = hairH + Math.round(10 * u) + Math.round(24 * u * 1.35);

  let rem = overAvail - headH;
  const overBlurbRaw =
    String(o.text.blurb ?? "").trim() ||
      [o.text.subtitle, [sizeTxt, numOf(d.rooms) ? `${numOf(d.rooms)} szoba` : ""].filter(Boolean).join(", ")]
        .filter(Boolean).join(" — ") ||
      "Kérj részletes tájékoztatót és időpontot a megtekintéshez.";
  // A leírásnak a maradék hely fele jut; a betűméret annyira csökken, hogy a
  // TELJES szöveg kiférjen (nem vágjuk le a végét).
  const par = fitParagraph(overBlurbRaw, overW, Math.round(rem * 0.5), Math.round(21 * u), Math.round(14 * u));
  rem -= par.lines * par.lineH;
  let statRowCount = 0;
  if (rem >= hairH + statRowH) {
    statRowCount = Math.min(Math.ceil(allItems.length / 2), Math.floor((rem - hairH) / statRowH));
    if (statRowCount > 0) rem -= hairH + statRowCount * statRowH;
  }
  const items = allItems.slice(0, statRowCount * 2);
  const showAddr = rem >= addrH;
  const statCell = (it: { k: string; v: string }, i: number) =>
    box({ key: `s${i}`, flexDirection: "column", width: statCellW, marginTop: Math.round(14 * u), flexShrink: 0 } as Style, [
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
