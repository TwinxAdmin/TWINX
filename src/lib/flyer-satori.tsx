// A hirdetés Satori-kompatibilis fája (next/og ImageResponse).
// Pixelpontos, valódi TTF-fel → nincs levágott ékezet, minden gépen egyforma.
// Korlátok: csak flexbox, pixelek, egyszerű CSS + egyszerű SVG (hullám, ikonok).
//
// Ez a fájl a DISZPÉCSER (buildFlyerElement) + a PRÉMIUM, teljes-képes sablon.
// A többi elrendezés külön fájlban: flyer-satori-openhouse / flyer-satori-unit.
// A közös építőelemek (box, img, ikonok, rövidítés) a flyer-satori-kit-ben laknak.
import React from "react";
import { buildTheme, truncate, flyerGeom, parsePrice, formatSize, type RenderOpts } from "@/lib/flyer-poster";
import { box, img, hexA, onColor, numOf, compact, icon, type Style } from "@/lib/flyer-satori-kit";
import { buildOpenHouseElement } from "@/lib/flyer-satori-openhouse";
import { buildUnitElement } from "@/lib/flyer-satori-unit";

/**
 * A hirdetés fája a választott sablon szerint.
 * family: a Satorinak átadott betűcsalád-név (ugyanaz, mint a fonts tömbben).
 */
export function buildFlyerElement(o: RenderOpts, family: string): React.ReactElement {
  switch (o.template) {
    case "openhouse":
      return buildOpenHouseElement(o, family);
    case "unit":
      return buildUnitElement(o, family);
    default:
      return buildPremiumElement(o, family);
  }
}

/** PRÉMIUM sablon: teljes felületű főkép, ár-pecsét, ikonos adatsáv. */
export function buildPremiumElement(o: RenderOpts, family: string): React.ReactElement {
  const { width: W, height: H } = o;
  const u = W / 1080;
  const t = buildTheme(o.mood, o.profile.accent_color);
  const accent = /^#[0-9a-fA-F]{6}$/.test(o.profile.accent_color) ? o.profile.accent_color : "#1e3a5f";
  const accInk = onColor(accent);
  const images = (o.images ?? []).filter(Boolean).slice(0, 4);
  const hero = images[0] || "";
  const thumbs = images.slice(1, 4);
  const p = o.profile;
  const d = o.text.details ?? {};

  const g = flyerGeom(W, H);
  const title = truncate((o.text.title || "Eladó ingatlan").toUpperCase(), 42);
  // Story: nagyobb tipó (telefon); fekvő: ~30%-kal kisebb cím (a széles vásznon így arányos).
  const ts = g.story ? 1.3 : g.wide ? 0.72 : g.land ? 0.85 : 1;
  const titleK = g.story ? 1.28 : g.wide ? 0.52 : g.land ? 0.7 : 1;
  const titleFs = Math.round((title.length > 26 ? 60 : title.length > 16 ? 74 : 88) * u * titleK);
  // A cím/lokáció akár 2 sorra tördelődhet (nem vágjuk le rövid limittel);
  // hosszú címnél arányosan kisebb betű, hogy két sorban is elférjen.
  const subtitle = truncate(o.text.subtitle, 110);
  const subFs = Math.round((subtitle.length > 64 ? 23 : subtitle.length > 42 ? 26 : 30) * u * ts);
  const badge = truncate((o.text.badge || "ELADÓ").toUpperCase(), 12);
  // Felső sor: csak a lényeg (a részletek lent, ikonosan) — nincs duplázás.
  const topLine = o.text.chips.filter(Boolean).slice(0, 2).map((c) => compact(c, 28)).join("   ·   ").toUpperCase();
  const topFs = Math.round((topLine.length > 42 ? 15 : topLine.length > 32 ? 17 : 20) * u * ts);
  const contact = [p.phone, p.email, p.website].filter(Boolean).map((x) => truncate(x, 32)).join("   ·   ");

  // Ár: a pecséten a SZÁM nagyban, a mértékegység kisebben áll alatta/mellette.
  // A tagolást és az egységet a parsePrice adja (lásd flyer-poster.ts).
  const parsed = parsePrice(String(o.text.price ?? ""));
  const rawPrice = parsed ? `${parsed.value} ${parsed.unit}` : String(o.text.price ?? "").trim();
  const priceNum = parsed ? parsed.value : truncate(rawPrice, 16);
  const priceSuffix = parsed ? parsed.unit : "";

  // --- Geometria: KÖZÖS forrásból (flyerGeom) — méretenként más kompozíció ---
  const waveH = g.waveH;
  const amp = g.amp;
  const bandH = g.bandH;                     // a tömör sáv magassága
  const boundary = bandH;                    // a sáv felső éle (alulról mérve)
  const sealD = Math.round((g.story ? 220 : g.wide ? 140 : g.land ? 165 : 190) * u);
  const thumbD = g.thumbD;

  // --- Réteg 1: teljes képes háttér (a kivágás igazítható: heroPos %) ---
  // Ha ismerjük a fotó valódi méretét (heroDim), a cover-kivágás TELJES rejtett
  // területén mozgatunk (+6% ránagyítás, hogy a szűk tengelyen is legyen tér).
  // E nélkül tartalék: 16%-os ránagyítás és azon belüli tolás.
  const hx = Math.max(0, Math.min(100, o.heroPos?.x ?? 50));
  const hy = Math.max(0, Math.min(100, o.heroPos?.y ?? 50));
  const iw = o.heroDim?.w ?? 0;
  const ih = o.heroDim?.h ?? 0;
  let heroImg: React.ReactElement | undefined;
  if (hero && iw > 0 && ih > 0) {
    const s = Math.max(W / iw, H / ih) * 1.06;
    const dw = Math.round(iw * s);
    const dh = Math.round(ih * s);
    heroImg = img(hero, {
      position: "absolute",
      width: dw,
      height: dh,
      left: -Math.round(((dw - W) * hx) / 100),
      top: -Math.round(((dh - H) * hy) / 100),
    });
  } else if (hero) {
    const ZOOM = 1.16;
    const overW = Math.round(W * (ZOOM - 1));
    const overH = Math.round(H * (ZOOM - 1));
    heroImg = img(hero, {
      position: "absolute",
      width: W + overW,
      height: H + overH,
      left: -Math.round((hx / 100) * overW),
      top: -Math.round((hy / 100) * overH),
      objectFit: "cover",
    });
  }
  const heroLayer = box(
    { position: "absolute", top: 0, left: 0, width: W, height: H, overflow: "hidden", background: t.paper },
    heroImg
  );

  // --- Réteg 2: felső sötétítés (állóban rövidebb — a cím relatíve kisebb részt foglal) ---
  const scrim = box({
    position: "absolute", top: 0, left: 0, width: W, height: Math.round(H * (g.story ? 0.36 : 0.50)),
    backgroundImage: "linear-gradient(180deg, rgba(0,0,0,0.62) 0%, rgba(0,0,0,0.12) 62%, rgba(0,0,0,0) 100%)",
  });

  // --- Réteg 3: cím-blokk ---
  const titleBlock = box(
    { position: "absolute", top: Math.round((g.wide ? 28 : 58) * u), left: Math.round(60 * u), width: g.land ? Math.round(W * 0.56) : W - Math.round(230 * u), flexDirection: "column" },
    [
      t.hair ? box({ width: Math.round(70 * u), height: Math.max(2, Math.round(3 * u)), background: t.hair, marginBottom: Math.round(18 * u) }, "") : null,
      box({ fontSize: titleFs, fontWeight: 700, color: "#ffffff", lineHeight: 1.04, letterSpacing: Math.round(1 * u), textShadow: "0 2px 18px rgba(0,0,0,0.45)" }, title),
      subtitle ? box({ fontSize: subFs, fontWeight: 400, color: "#ffffff", opacity: 0.95, marginTop: Math.round(14 * u), letterSpacing: Math.round(1 * u), lineHeight: 1.22, lineClamp: 2, textShadow: "0 1px 10px rgba(0,0,0,0.5)" }, subtitle) : null,
      topLine ? box({ fontSize: topFs, fontWeight: 700, color: "#ffffff", opacity: 0.9, marginTop: Math.round(14 * u), letterSpacing: Math.round(2 * u), lineHeight: 1.25, lineClamp: 2, textShadow: "0 1px 8px rgba(0,0,0,0.5)" }, topLine) : null,
    ].filter(Boolean)
  );

  const badgeEl = box(
    { position: "absolute", top: Math.round((g.wide ? 26 : 56) * u), right: Math.round((g.wide ? 40 : 60) * u), background: t.badgeBg, color: t.badgeInk, borderRadius: Math.round(6 * u), paddingTop: Math.round(10 * u), paddingBottom: Math.round(10 * u), paddingLeft: Math.round(22 * u), paddingRight: Math.round(22 * u), fontSize: Math.round(24 * u), fontWeight: 700, letterSpacing: Math.round(1 * u) },
    badge
  );

  // --- Réteg 4: FEKVŐ (4:3) → jobb oldali lineáris színátmenet (nincs hullám),
  // egyébként ívelt hullám az arculati sávszínnel ---
  let wave: React.ReactElement;
  if (g.land) {
    // A szöveg mögött tömör, majd rövid szakaszon 0-ra halványul — a fotó szabad marad.
    const fadeW = Math.round(W * 0.40);
    // FONTOS: a Satori a szög alakot kezeli megbízhatóan (270deg = balra), a "to left"-et nem.
    wave = box({
      position: "absolute", right: 0, top: 0, width: fadeW, height: H,
      backgroundImage: `linear-gradient(270deg, ${t.band} 0%, ${t.band} 62%, ${hexA(t.band, 0.55)} 82%, ${hexA(t.band, 0)} 100%)`,
    });
  } else {
    const y0 = amp, y1 = Math.round(amp * 0.35);
    const wavePath = `M0,${y0} C ${Math.round(W * 0.30)},${y0 - amp} ${Math.round(W * 0.68)},${y1 + amp} ${W},${y1} L ${W},${waveH} L 0,${waveH} Z`;
    wave = React.createElement(
      "svg",
      { width: W, height: waveH, viewBox: `0 0 ${W} ${waveH}`, style: { position: "absolute", left: 0, bottom: 0 } },
      React.createElement("path", { d: wavePath, fill: t.band })
    );
  }
  // Fekvőben a bal alsó blokk (kis képek + értékesítő) alá lágy sötétítés.
  const bottomScrim = g.land
    ? box({
        position: "absolute", left: 0, bottom: 0, width: Math.round(W * 0.64), height: Math.round(H * 0.44),
        backgroundImage: "linear-gradient(0deg, rgba(18,20,24,0.64) 0%, rgba(18,20,24,0.28) 58%, rgba(18,20,24,0) 100%)",
      })
    : null;

  // --- Ár-pecsét: 1:1-nél a sáv élére központozva; story-ban KISSÉ FELJEBB,
  // hogy ne takarja az adat-rács tetejét (csak egy kicsit lóg a sávba). ---
  // Fekvőben: a pecsét a JOBB oldalon, a jelvény ALATT (fentről mérve) — az adatok fölött.
  const sealPos: Style = g.land
    ? g.wide
      ? { right: Math.round(56 * u), top: Math.round(96 * u) } // közel a kép jobb széléhez
      : { right: Math.round(64 * u), top: Math.round(120 * u) }
    : {
        left: Math.round(60 * u),
        bottom: g.story ? boundary - Math.round(sealD * 0.18) : boundary - Math.round(sealD / 2),
      };
  // A pecsét szövege a kör méretével ARÁNYOSAN kicsinyedik — így sosem lóg ki.
  const sealK = Math.min(1, sealD / (190 * u));
  const seal = rawPrice
    ? box(
        { position: "absolute", ...sealPos, width: sealD, height: sealD, borderRadius: 9999, background: accent, flexDirection: "column", alignItems: "center", justifyContent: "center", padding: Math.round(20 * u * sealK), border: `${Math.round(4 * u)}px solid #ffffff`, boxShadow: "0 10px 32px rgba(0,0,0,0.35)" },
        [
          box({ fontSize: Math.round(18 * u * sealK), fontWeight: 700, color: accInk, opacity: 0.9, letterSpacing: Math.round(3 * u * sealK), marginBottom: Math.round(4 * u) }, "ÁR"),
          box({ alignItems: "baseline", justifyContent: "center", flexWrap: "nowrap", gap: Math.round(6 * u * sealK) }, [
            box({ fontSize: Math.round((priceNum.length > 8 ? 28 : priceNum.length > 4 ? 34 : 42) * u * sealK), fontWeight: 700, color: accInk, lineHeight: 1.05, flexShrink: 0, whiteSpace: "nowrap" }, priceNum),
            priceSuffix ? box({ fontSize: Math.round(20 * u * sealK), fontWeight: 700, color: accInk, opacity: 0.95, flexShrink: 0, whiteSpace: "nowrap" }, priceSuffix) : null,
          ].filter(Boolean)),
        ]
      )
    : null;

  // --- Kis képek: a jobb szélső FIX; a többi sorban mellette, VAGY fölé húzva
  // (thumbSlots: "row" | "up1" | "up2") — így nem takarnak ki fontos részletet. ---
  const gapT = g.gapT;
  const right0 = g.right0;
  const B0 = g.B0;
  const slots = o.thumbSlots ?? [];
  const placed: Array<{ i: number; right?: number; left?: number; bottom: number }> = [];
  if (thumbs.length) {
    if (g.land && g.wide) {
      // 16:9: BALRÓL jobbra, a fotó alján, vízszintes sorban (változatlan).
      const left0 = Math.round(60 * u);
      thumbs.forEach((_, i) => {
        placed.push({ i, left: left0 + i * (thumbD + gapT), bottom: B0 });
      });
    } else if (g.land) {
      // 4:3: BAL-horgonyú slot rendszer — a fix kép balra lent, a többi mellette (jobbra)
      // VAGY fölé húzva (up1/up2), ugyanazzal a slot-logikával, mint a többi méret.
      const left0 = Math.round(60 * u);
      // Csak EGY felső hely (up1) engedélyezett — a második fel (up2) kitakarná a
      // cím/alcím sávot, ezért azt sorba (row) tesszük.
      const fixedIdx = thumbs.length - 1;
      placed.push({ i: fixedIdx, left: left0, bottom: B0 });
      let k = 1;
      for (let i = fixedIdx - 1; i >= 0; i--) {
        const slot = slots[i] ?? "row";
        if (slot === "up1") placed.push({ i, left: left0, bottom: B0 + (thumbD + gapT) });
        else { placed.push({ i, left: left0 + k * (thumbD + gapT), bottom: B0 }); k++; }
      }
    } else {
      const fixedIdx = thumbs.length - 1;
      placed.push({ i: fixedIdx, right: right0, bottom: B0 });
      let k = 1;
      for (let i = fixedIdx - 1; i >= 0; i--) {
        const slot = slots[i] ?? "row";
        if (slot === "up1") placed.push({ i, right: right0, bottom: B0 + (thumbD + gapT) });
        else if (slot === "up2") placed.push({ i, right: right0, bottom: B0 + 2 * (thumbD + gapT) });
        else { placed.push({ i, right: right0 + k * (thumbD + gapT), bottom: B0 }); k++; }
      }
    }
  }
  const thumbEls = placed.map(({ i, right, left, bottom }) => {
    // FONTOS: a Satori elhasal az `undefined` stílusértékeken — csak a meglévőket adjuk át.
    const pos: Style = { position: "absolute", bottom };
    if (left !== undefined) pos.left = left;
    if (right !== undefined) pos.right = right;
    return box(
      { key: `th${i}`, ...pos, width: thumbD, height: thumbD, borderRadius: Math.round(16 * u), overflow: "hidden", border: `${Math.round(4 * u)}px solid #ffffff`, boxShadow: "0 10px 28px rgba(0,0,0,0.3)" } as Style,
      img(thumbs[i], { width: "100%", height: "100%", objectFit: "cover" })
    );
  });

  // --- Ikonos adat-tételek (csak ami meg van adva) ---
  const iconSize = Math.round(32 * u);
  const items: Array<{ k: string; v: string }> = [];
  const sizeTxt = formatSize(d.size ?? "");
  if (sizeTxt) items.push({ k: "area", v: truncate(sizeTxt, 14) });
  const roomsNum = numOf(d.rooms);
  if (roomsNum) items.push({ k: "bed", v: `${roomsNum} szoba` });
  else if (d.rooms) items.push({ k: "bed", v: compact(d.rooms, 14) });
  const bathNum = numOf(d.bathrooms);
  if (bathNum) items.push({ k: "bath", v: `${bathNum} fürdő` });
  if (d.floor) items.push({ k: "stairs", v: compact(d.floor, 16) });
  if (d.structure) items.push({ k: "brick", v: compact(d.structure, 16) });
  if (d.condition) items.push({ k: "check", v: compact(d.condition, 16) });

  // BAL OSZLOP: az ingatlan adatai egymás alatt (4-nél több tételnél két oszlopban).
  const factFs = Math.round(25 * u);
  const factItem = (it: { k: string; v: string }, i: number) =>
    box({ key: i, alignItems: "center", gap: Math.round(11 * u), height: Math.round(46 * u) } as Style, [
      icon(it.k, iconSize, t.bandInk),
      box({ fontSize: factFs, fontWeight: 700, color: t.bandInk, lineHeight: 1.2 }, it.v),
    ]);
  const col1 = items.slice(0, 3);
  const col2 = items.slice(3, 6);
  const factsBlock = items.length
    ? box(
        { gap: Math.round(34 * u), flexGrow: 1 },
        [
          box({ flexDirection: "column", gap: Math.round(4 * u) }, col1.map(factItem)),
          col2.length ? box({ flexDirection: "column", gap: Math.round(4 * u) }, col2.map(factItem)) : null,
        ].filter(Boolean)
      )
    : box({ flexGrow: 1 }, "");

  // JOBB OSZLOP: az értékesítő szövegei — név/titulus/elérhetőségek egymás alatt.
  // A fotó és a céglogó KÖR elemben, egymás alatt a jobb alsó sarokban (cornerCol).
  const circleD = Math.round((g.story ? 124 : 112) * u); // közös méret; story-ban kicsit nagyobb
  const agentHeader = box({ flexDirection: "column" }, [
    box({ fontSize: Math.round(28 * u), fontWeight: 700, color: t.bandInk, lineHeight: 1.25 }, truncate(p.display_name || p.company, 24)),
    p.title ? box({ fontSize: Math.round(19 * u), fontWeight: 400, color: t.bandInk, opacity: 0.85, lineHeight: 1.35 }, truncate(p.title, 28)) : null,
  ].filter(Boolean));
  const contactLine = (v: string, i: number) =>
    box({ key: i, fontSize: Math.round(20 * u), fontWeight: 700, color: t.bandInk, lineHeight: 1.5 } as Style, truncate(v, 34));
  const agentBlock = box(
    { flexDirection: "column", width: Math.round(W * 0.38), gap: Math.round(6 * u), paddingRight: Math.round((p.agent_photo_url || p.logo_url ? 180 : 0) * u), paddingBottom: Math.round(18 * u) },
    [
      agentHeader,
      ...([p.phone, p.email, p.website].filter(Boolean) as string[]).map(contactLine),
    ]
  );

  // Jobb alsó sarok (CSAK 1:1 / fekvő): a fotó és a logó azonos méretű körben, egymás alatt.
  // Story-ban a körök a sávba kerülnek, a rács mellé (lásd bandContent story-ág).
  const cornerCol = (!g.story && !g.land && (p.agent_photo_url || p.logo_url))
    ? box(
        { position: "absolute", right: Math.round(56 * u), bottom: Math.round(22 * u), flexDirection: "column", gap: Math.round(12 * u) },
        [
          p.agent_photo_url
            ? img(p.agent_photo_url, { width: circleD, height: circleD, borderRadius: 9999, objectFit: "cover", border: `${Math.round(3 * u)}px solid ${t.bandInk}`, boxShadow: "0 6px 20px rgba(0,0,0,0.25)" })
            : null,
          p.logo_url
            ? box(
                { width: circleD, height: circleD, borderRadius: 9999, background: "#ffffff", alignItems: "center", justifyContent: "center", overflow: "hidden", border: `${Math.round(3 * u)}px solid ${t.bandInk}`, boxShadow: "0 6px 20px rgba(0,0,0,0.25)" },
                img(p.logo_url, { maxWidth: Math.round(circleD * 0.74), maxHeight: Math.round(circleD * 0.74), objectFit: "contain" })
              )
            : null,
        ].filter(Boolean)
      )
    : null;

  // --- A sáv tartalma ---
  // 1:1: bal = ingatlan-oszlop, jobb = értékesítő-oszlop.
  // Story (9:16, mobil-első): KÉT SOR — felül adat-RÁCS nagy ikonokkal, alul az
  // értékesítő kiemelt telefonszám-pillel; a körök a sarokban.
  let bandContent: React.ReactElement;
  let landDataCol: React.ReactElement | null = null; // fekvő: önálló adatoszlop jobbra
  if (g.land) {
    // FEKVŐ: jobbra fent a pecsét, alatta az adatoszlop. 16:9-nél az értékesítő a kis
    // képek MELLETT (balra lent); 4:3-nál a panel ALJÁN, az adatok alatt (nincs elég szélesség).
    const rowH = Math.round((g.wide ? 45 : 48) * u);
    const dataFs = Math.round((g.wide ? 24 : 27) * u);
    const dataIcon = Math.round(36 * u);
    const dataTop = Math.round((g.wide ? 252 : 285) * u);
    const landItem = (it: { k: string; v: string }, i: number) =>
      box({ key: i, alignItems: "center", gap: Math.round(14 * u), height: rowH } as Style, [
        icon(it.k, dataIcon, t.bandInk),
        box({ fontSize: dataFs, fontWeight: 700, color: t.bandInk, lineHeight: 1.2 }, it.v),
      ]);
    // A jobb oldali OSZLOP közös bal éle: az adatok és az értékesítő ugyanabban a
    // sávban ülnek (right-margóval rögzítve), semmi nem lóg ki belőle.
    // 16:9: szélesebb oszlop, az adatok 2×3-as RÁCSBAN (a rövidebb magasság miatt).
    const colW = Math.round((g.wide ? 380 : 300) * u);
    const colRight = Math.round((g.wide ? 40 : 32) * u); // 4:3: közelebb a jobb szélhez
    if (g.wide) {
      const gcol1 = items.slice(0, 3);
      const gcol2 = items.slice(3, 6);
      landDataCol = items.length
        ? box(
            { position: "absolute", right: colRight, top: dataTop, width: colW, gap: Math.round(20 * u) },
            [
              box({ flexDirection: "column" }, gcol1.map(landItem)),
              gcol2.length ? box({ flexDirection: "column" }, gcol2.map(landItem)) : null,
            ].filter(Boolean)
          )
        : null;
    } else {
      landDataCol = items.length
        ? box(
            { position: "absolute", right: colRight, top: dataTop, width: colW, flexDirection: "column" },
            items.slice(0, 6).map(landItem)
          )
        : null;
    }

    {
      // Értékesítő: MINDKÉT fekvőnél közvetlenül az adatok alatt, ugyanabban az oszlopban.
      const circleLand = Math.round(52 * u);
      const panelW = colW;
      const nData = Math.min(items.length, 6);
      const nRows = g.wide ? Math.min(3, nData) : nData; // 16:9: rács → max 3 sor
      const agentTop = dataTop + nRows * rowH + Math.round(22 * u);
      const circlesRow = (p.agent_photo_url || p.logo_url)
        ? box({ gap: Math.round(10 * u), alignItems: "center", marginBottom: Math.round(6 * u) }, [
            p.agent_photo_url
              ? img(p.agent_photo_url, { width: circleLand, height: circleLand, borderRadius: 9999, objectFit: "cover", border: `${Math.round(2 * u)}px solid #ffffff` })
              : null,
            p.logo_url
              ? box(
                  { width: circleLand, height: circleLand, borderRadius: 9999, background: "#ffffff", alignItems: "center", justifyContent: "center", overflow: "hidden", border: `${Math.round(2 * u)}px solid #ffffff` },
                  img(p.logo_url, { maxWidth: Math.round(circleLand * 0.74), maxHeight: Math.round(circleLand * 0.74), objectFit: "contain" })
                )
              : null,
          ].filter(Boolean))
        : null;
      bandContent = box(
        { position: "absolute", right: colRight, top: agentTop, width: panelW, flexDirection: "column", gap: Math.round(2 * u) },
        [
          box({ width: "100%", height: 1, background: t.bandInk, opacity: 0.28, marginBottom: Math.round(10 * u) }, ""),
          circlesRow,
          box({ fontSize: Math.round(21 * u), fontWeight: 700, color: t.bandInk, lineHeight: 1.25 }, truncate(p.display_name || p.company, 24)),
          p.title ? box({ fontSize: Math.round(14 * u), fontWeight: 400, color: t.bandInk, opacity: 0.85, lineHeight: 1.4 }, truncate(p.title, 30)) : null,
          p.phone ? box({ fontSize: Math.round(23 * u), fontWeight: 700, color: t.bandInk, lineHeight: 1.4, marginTop: Math.round(2 * u) }, truncate(p.phone, 24)) : null,
          p.email ? box({ fontSize: Math.round(14 * u), fontWeight: 700, color: t.bandInk, opacity: 0.95, lineHeight: 1.5 }, truncate(p.email, 34)) : null,
          p.website ? box({ fontSize: Math.round(14 * u), fontWeight: 700, color: t.bandInk, opacity: 0.95, lineHeight: 1.5 }, truncate(p.website, 34)) : null,
        ].filter(Boolean)
      );
    }
  } else if (g.story) {
    // ADAT-RÁCS: két SZOROS oszlop balra — nagy ikon és nagy szöveg, bő sorköz,
    // hogy kitöltse a sáv bal oldalát (ne maradjon üres folt alatta).
    // A leghosszabb érték szerint adaptív rács-méret — így a hosszú opciók (pl.
    // „Könnyűszerkezetes") sem tolják ki az értékesítő-oszlopot a képből.
    const maxVLen = items.reduce((m, it) => Math.max(m, it.v.length), 0);
    const gridFs = Math.round((maxVLen > 15 ? 26 : maxVLen > 12 ? 32 : 38) * u);
    const gridIcon = Math.round((maxVLen > 15 ? 42 : 50) * u);
    const gridColGap = Math.round((maxVLen > 15 ? 26 : 40) * u);
    const gridItem = (it: { k: string; v: string }, i: number) =>
      box({ key: i, alignItems: "center", gap: Math.round(14 * u), height: Math.round(84 * u) } as Style, [
        icon(it.k, gridIcon, t.bandInk),
        box({ fontSize: gridFs, fontWeight: 700, color: t.bandInk, lineHeight: 1.2, whiteSpace: "nowrap" }, it.v),
      ]);
    const gcol1 = items.slice(0, 3);
    const gcol2 = items.slice(3, 6);
    const factsGrid = items.length
      ? box({ gap: gridColGap }, [
          box({ flexDirection: "column" }, gcol1.map(gridItem)),
          gcol2.length ? box({ flexDirection: "column" }, gcol2.map(gridItem)) : null,
        ].filter(Boolean))
      : null;

    // ÉRTÉKESÍTŐ: jobb oldalon — név, titulus, kiemelt telefonszám-pill,
    // alatta az e-mail, AZ ALATT a honlap (külön sorban).
    const phone = p.phone ? truncate(p.phone, 24) : "";
    const pill = phone
      ? box(
          { alignSelf: "flex-end", background: accent, color: accInk, borderRadius: 9999, paddingTop: Math.round(13 * u), paddingBottom: Math.round(13 * u), paddingLeft: Math.round(30 * u), paddingRight: Math.round(30 * u), fontSize: Math.round(32 * u), fontWeight: 700, border: `${Math.round(2 * u)}px solid rgba(255,255,255,0.7)`, marginTop: Math.round(10 * u), marginBottom: Math.round(8 * u) },
          phone
        )
      : null;
    const agentStory = box(
      { flexDirection: "column", alignItems: "flex-end", gap: Math.round(2 * u) },
      [
        box({ fontSize: Math.round(34 * u), fontWeight: 700, color: t.bandInk, lineHeight: 1.25 }, truncate(p.display_name || p.company, 24)),
        p.title ? box({ fontSize: Math.round(21 * u), fontWeight: 400, color: t.bandInk, opacity: 0.85, lineHeight: 1.35 }, truncate(p.title, 30)) : null,
        pill,
        p.email ? box({ fontSize: Math.round(22 * u), fontWeight: 700, color: t.bandInk, lineHeight: 1.45 }, truncate(p.email, 32)) : null,
        p.website ? box({ fontSize: Math.round(22 * u), fontWeight: 700, color: t.bandInk, lineHeight: 1.45 }, truncate(p.website, 32)) : null,
      ].filter(Boolean)
    );

    // A két kör NAGYOBB, a rács jobb oldalán (a kontaktok fölött).
    const circleStory = Math.round(circleD * 1.35);
    const circlesRow = (p.agent_photo_url || p.logo_url)
      ? box({ gap: Math.round(16 * u), alignItems: "center" }, [
          p.agent_photo_url
            ? img(p.agent_photo_url, { width: circleStory, height: circleStory, borderRadius: 9999, objectFit: "cover", border: `${Math.round(3 * u)}px solid ${t.bandInk}`, boxShadow: "0 6px 20px rgba(0,0,0,0.25)" })
            : null,
          p.logo_url
            ? box(
                { width: circleStory, height: circleStory, borderRadius: 9999, background: "#ffffff", alignItems: "center", justifyContent: "center", overflow: "hidden", border: `${Math.round(3 * u)}px solid ${t.bandInk}`, boxShadow: "0 6px 20px rgba(0,0,0,0.25)" },
                img(p.logo_url, { maxWidth: Math.round(circleStory * 0.74), maxHeight: Math.round(circleStory * 0.74), objectFit: "contain" })
              )
            : null,
        ].filter(Boolean))
      : null;

    bandContent = box(
      {
        position: "absolute", left: 0, bottom: 0, width: W, height: bandH,
        alignItems: "flex-start", justifyContent: "space-between",
        paddingTop: Math.round(40 * u),
        paddingLeft: Math.round(60 * u), paddingRight: Math.round(60 * u), paddingBottom: Math.round(30 * u),
        gap: Math.round(24 * u),
      },
      [
        // BAL: adat-rács (zsugorodhat, hogy a jobb oldali kontakt-oszlopnak maradjon hely)
        box({ flexDirection: "column", justifyContent: "center", height: "100%", flexShrink: 1, minWidth: 0 }, factsGrid ?? box({}, "")),
        // JOBB: körök + elérhetőségek — FIX szélesség, nem zsugorodik, így sosem vágódik le
        box({ flexDirection: "column", alignItems: "flex-end", gap: Math.round(16 * u), width: Math.round(W * 0.40), flexShrink: 0 },
          [circlesRow, agentStory].filter(Boolean)),
      ]
    );
  } else {
    bandContent = box(
      {
        position: "absolute", left: 0, bottom: 0, width: W, height: bandH,
        alignItems: "flex-end",
        paddingTop: Math.round(sealD / 2 + 16 * u),
        paddingLeft: Math.round(60 * u), paddingRight: Math.round(60 * u), paddingBottom: Math.round(26 * u),
        gap: Math.round(30 * u),
      },
      [factsBlock, agentBlock]
    );
  }

  const wm = o.watermark
    ? box(
        { position: "absolute", top: 0, left: 0, width: W, height: H, flexDirection: "column", justifyContent: "space-around", alignItems: "center", transform: "rotate(-24deg)" },
        Array.from({ length: 6 }).map((_, i) => box({ key: i, fontSize: Math.round(46 * u), fontWeight: 700, color: "rgba(255,255,255,0.30)", letterSpacing: Math.round(6 * u) } as Style, "ELŐNÉZET · TWINX"))
      )
    : null;

  return box(
    { position: "relative", width: W, height: H, fontFamily: family, background: t.paper },
    [heroLayer, scrim, wave, bottomScrim, titleBlock, badgeEl, ...thumbEls, seal, landDataCol, bandContent, cornerCol, wm].filter(Boolean)
  );
}
