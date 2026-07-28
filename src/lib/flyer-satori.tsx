// A hirdetés Satori-kompatibilis fája (next/og ImageResponse) — PRÉMIUM, teljes-képes stílus.
// Pixelpontos, valódi TTF-fel → nincs levágott ékezet, minden gépen egyforma.
// Korlátok: csak flexbox, pixelek, egyszerű CSS + egyszerű SVG (hullám, ikonok).
import React from "react";
import { buildTheme, truncate, type RenderOpts } from "@/lib/flyer-poster";

type Style = React.CSSProperties;
function box(style: Style, children?: React.ReactNode): React.ReactElement {
  return React.createElement("div", { style: { display: "flex", ...style } }, children);
}
function img(src: string, style: Style): React.ReactElement {
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
  return React.createElement("img", { src, style });
}
function onColor(hex: string): string {
  const h = (hex || "#000000").replace("#", "");
  const r = parseInt(h.slice(0, 2), 16) || 0, g = parseInt(h.slice(2, 4), 16) || 0, b = parseInt(h.slice(4, 6), 16) || 0;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? "#171310" : "#ffffff";
}

/** Az első szám a szövegből (pl. "1 fürdőszoba + külön WC" → "1"). */
function numOf(s?: string): string {
  const m = String(s ?? "").match(/\d+([.,]\d+)?/);
  return m ? m[0] : "";
}
/** Rövid címke: a zárójeles rész és a felesleges farok nélkül. */
function shortLabel(s: string, max = 16): string {
  const base = String(s ?? "").split("(")[0].split("/")[0].trim();
  return truncate(base, max);
}

// --- Vonalas ikonok (24×24 rács, stroke) ------------------------------------
const ICON_PATHS: Record<string, string[]> = {
  area: ["M3 3h18v18H3z", "M8 3v18", "M3 8h18"],                                  // alaprajz / m²
  bed: ["M3 18v-7a2 2 0 012-2h14a2 2 0 012 2v7", "M3 14h18", "M3 18h18", "M7 9V6h5v3"], // szoba
  bath: ["M4 12h16v3a4 4 0 01-4 4H8a4 4 0 01-4-4z", "M7 12V6a2 2 0 114 0", "M6 19l-1 2", "M18 19l1 2"], // fürdő
  stairs: ["M3 20h4v-4h4v-4h4V8h4V4"],                                            // szint
  brick: ["M3 6h18v5H3z", "M3 13h18v5H3z", "M9 6v5", "M15 6v5", "M6 13v5", "M12 13v5", "M18 13v5"], // szerkezet
  check: ["M20 6L9 17l-5-5"],                                                     // állapot
};

function icon(kind: keyof typeof ICON_PATHS | string, size: number, color: string): React.ReactElement {
  const paths = ICON_PATHS[kind] ?? ICON_PATHS.check;
  return React.createElement(
    "svg",
    { width: size, height: size, viewBox: "0 0 24 24", fill: "none", style: { display: "flex" } },
    paths.map((d, i) =>
      React.createElement("path", {
        key: i, d, stroke: color, strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round",
      })
    )
  );
}

/** family: a Satorinak átadott betűcsalád-név (ugyanaz, mint a fonts tömbben). */
export function buildFlyerElement(o: RenderOpts, family: string): React.ReactElement {
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

  const title = truncate((o.text.title || "Eladó ingatlan").toUpperCase(), 42);
  const titleFs = Math.round((title.length > 26 ? 60 : title.length > 16 ? 74 : 88) * u);
  const subtitle = truncate(o.text.subtitle, 48);
  const badge = truncate((o.text.badge || "ELADÓ").toUpperCase(), 12);
  // Felső sor: csak a lényeg (a részletek lent, ikonosan) — nincs duplázás.
  const topLine = o.text.chips.filter(Boolean).slice(0, 2).map((c) => truncate(c, 26)).join("   ·   ").toUpperCase();
  const contact = [p.phone, p.email, p.website].filter(Boolean).map((x) => truncate(x, 32)).join("   ·   ");

  // Ár: ha a partner CSAK számot adott meg, kitesszük a nagy „M Ft" utótagot.
  const rawPrice = String(o.text.price ?? "").trim();
  const priceIsBare = /^\d+([.,]\d+)?$/.test(rawPrice);
  const priceNum = priceIsBare ? rawPrice : truncate(rawPrice, 16);
  const priceSuffix = priceIsBare ? "M Ft" : "";

  // --- Geometria (1:1 kompozíció): keskeny sáv, a pecsét és a kis képek
  // PONTOSAN FÉLIG lógnak a képbe / félig a sávba (közös vonalra igazítva) ---
  const waveH = Math.round(H * 0.32);
  const amp = Math.round(44 * u);
  const bandH = waveH - amp;                 // a tömör sáv magassága
  const boundary = bandH;                    // a sáv felső éle (alulról mérve)
  const sealD = Math.round(190 * u);
  const thumbD = Math.round(170 * u);

  // --- Réteg 1: teljes képes háttér (a kivágás igazítható: heroPos %) ---
  // A képet enyhén ránagyítjuk (ZOOM), így MINDIG van mozgástér mind a négy irányban,
  // függetlenül a fotó arányától; a tolást kézzel számoljuk (nem objectPosition).
  const hx = Math.max(0, Math.min(100, o.heroPos?.x ?? 50));
  const hy = Math.max(0, Math.min(100, o.heroPos?.y ?? 50));
  const ZOOM = 1.16;
  const overW = Math.round(W * (ZOOM - 1));
  const overH = Math.round(H * (ZOOM - 1));
  const heroLayer = box(
    { position: "absolute", top: 0, left: 0, width: W, height: H, overflow: "hidden", background: t.paper },
    hero
      ? img(hero, {
          position: "absolute",
          width: W + overW,
          height: H + overH,
          left: -Math.round((hx / 100) * overW),
          top: -Math.round((hy / 100) * overH),
          objectFit: "cover",
        })
      : undefined
  );

  // --- Réteg 2: felső sötétítés ---
  const scrim = box({
    position: "absolute", top: 0, left: 0, width: W, height: Math.round(H * 0.50),
    backgroundImage: "linear-gradient(180deg, rgba(0,0,0,0.62) 0%, rgba(0,0,0,0.12) 62%, rgba(0,0,0,0) 100%)",
  });

  // --- Réteg 3: cím-blokk ---
  const titleBlock = box(
    { position: "absolute", top: Math.round(58 * u), left: Math.round(60 * u), width: W - Math.round(230 * u), flexDirection: "column" },
    [
      t.hair ? box({ width: Math.round(70 * u), height: Math.max(2, Math.round(3 * u)), background: t.hair, marginBottom: Math.round(18 * u) }, "") : null,
      box({ fontSize: titleFs, fontWeight: 700, color: "#ffffff", lineHeight: 1.04, letterSpacing: Math.round(1 * u), textShadow: "0 2px 18px rgba(0,0,0,0.45)" }, title),
      subtitle ? box({ fontSize: Math.round(30 * u), fontWeight: 400, color: "#ffffff", opacity: 0.95, marginTop: Math.round(14 * u), letterSpacing: Math.round(1 * u), textShadow: "0 1px 10px rgba(0,0,0,0.5)" }, subtitle) : null,
      topLine ? box({ fontSize: Math.round(20 * u), fontWeight: 700, color: "#ffffff", opacity: 0.9, marginTop: Math.round(14 * u), letterSpacing: Math.round(2 * u), textShadow: "0 1px 8px rgba(0,0,0,0.5)" }, topLine) : null,
    ].filter(Boolean)
  );

  const badgeEl = box(
    { position: "absolute", top: Math.round(56 * u), right: Math.round(60 * u), background: t.badgeBg, color: t.badgeInk, borderRadius: Math.round(6 * u), paddingTop: Math.round(10 * u), paddingBottom: Math.round(10 * u), paddingLeft: Math.round(22 * u), paddingRight: Math.round(22 * u), fontSize: Math.round(24 * u), fontWeight: 700, letterSpacing: Math.round(1 * u) },
    badge
  );

  // --- Réteg 4: ívelt hullám ---
  const y0 = amp, y1 = Math.round(amp * 0.35);
  const wavePath = `M0,${y0} C ${Math.round(W * 0.30)},${y0 - amp} ${Math.round(W * 0.68)},${y1 + amp} ${W},${y1} L ${W},${waveH} L 0,${waveH} Z`;
  const wave = React.createElement(
    "svg",
    { width: W, height: waveH, viewBox: `0 0 ${W} ${waveH}`, style: { position: "absolute", left: 0, bottom: 0 } },
    React.createElement("path", { d: wavePath, fill: t.band })
  );

  // --- Ár-pecsét: FÉLIG a képen, FÉLIG a sávban (a sáv élére központozva) ---
  const seal = rawPrice
    ? box(
        { position: "absolute", left: Math.round(60 * u), bottom: boundary - Math.round(sealD / 2), width: sealD, height: sealD, borderRadius: 9999, background: accent, flexDirection: "column", alignItems: "center", justifyContent: "center", padding: Math.round(20 * u), border: `${Math.round(4 * u)}px solid #ffffff`, boxShadow: "0 10px 32px rgba(0,0,0,0.35)" },
        [
          box({ fontSize: Math.round(18 * u), fontWeight: 700, color: accInk, opacity: 0.9, letterSpacing: Math.round(3 * u), marginBottom: Math.round(4 * u) }, "ÁR"),
          box({ alignItems: "baseline", justifyContent: "center", gap: Math.round(6 * u) }, [
            box({ fontSize: Math.round((priceNum.length > 8 ? 34 : priceNum.length > 4 ? 44 : 54) * u), fontWeight: 700, color: accInk, lineHeight: 1.05 }, priceNum),
            priceSuffix ? box({ fontSize: Math.round(24 * u), fontWeight: 700, color: accInk, opacity: 0.95 }, priceSuffix) : null,
          ].filter(Boolean)),
        ]
      )
    : null;

  // --- Kis képek: a sáv éle FÖLÖTT (nem lógnak rá az értékesítő blokkra) ---
  const thumbRow = thumbs.length
    ? box(
        { position: "absolute", right: Math.round(60 * u), bottom: boundary + Math.round(14 * u), gap: Math.round(14 * u) },
        thumbs.map((src, i) =>
          box(
            { key: i, width: thumbD, height: thumbD, borderRadius: Math.round(16 * u), overflow: "hidden", border: `${Math.round(4 * u)}px solid #ffffff`, boxShadow: "0 10px 28px rgba(0,0,0,0.3)" } as Style,
            img(src, { width: "100%", height: "100%", objectFit: "cover" })
          )
        )
      )
    : null;

  // --- Ikonos adat-tételek (csak ami meg van adva) ---
  const iconSize = Math.round(32 * u);
  const items: Array<{ k: string; v: string }> = [];
  const sizeNum = numOf(d.size);
  if (sizeNum) items.push({ k: "area", v: `${sizeNum} m²` });
  const roomsNum = numOf(d.rooms);
  if (roomsNum) items.push({ k: "bed", v: `${roomsNum} szoba` });
  else if (d.rooms) items.push({ k: "bed", v: shortLabel(d.rooms, 14) });
  const bathNum = numOf(d.bathrooms);
  if (bathNum) items.push({ k: "bath", v: `${bathNum} fürdő` });
  if (d.floor) items.push({ k: "stairs", v: shortLabel(d.floor, 16) });
  if (d.structure) items.push({ k: "brick", v: shortLabel(d.structure, 16) });
  if (d.condition) items.push({ k: "check", v: shortLabel(d.condition, 18) });

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

  // JOBB OSZLOP: az értékesítő — nagyobb fotó körben, alatta név/titulus/elérhetőségek.
  // A céglogó KÜLÖN, a jobb alsó sarokban (lásd logoCorner).
  const headD = Math.round(96 * u);
  const agentHeader = box(
    { alignItems: "center", gap: Math.round(16 * u) },
    [
      p.agent_photo_url ? img(p.agent_photo_url, { width: headD, height: headD, borderRadius: 9999, objectFit: "cover", border: `${Math.round(3 * u)}px solid ${t.bandInk}` }) : null,
      box({ flexDirection: "column", flexGrow: 1 }, [
        box({ fontSize: Math.round(28 * u), fontWeight: 700, color: t.bandInk, lineHeight: 1.25 }, truncate(p.display_name || p.company, 24)),
        p.title ? box({ fontSize: Math.round(19 * u), fontWeight: 400, color: t.bandInk, opacity: 0.85, lineHeight: 1.35 }, truncate(p.title, 28)) : null,
      ].filter(Boolean)),
    ].filter(Boolean)
  );
  const contactLine = (v: string, i: number) =>
    box({ key: i, fontSize: Math.round(20 * u), fontWeight: 700, color: t.bandInk, lineHeight: 1.5 } as Style, truncate(v, 34));
  const logoD = Math.round(128 * u);
  const agentBlock = box(
    { flexDirection: "column", width: Math.round(W * 0.38), gap: Math.round(6 * u), paddingRight: p.logo_url ? logoD - Math.round(56 * u) : 0 },
    [
      agentHeader,
      ...([p.phone, p.email, p.website].filter(Boolean) as string[]).map(contactLine),
    ]
  );

  // Céglogó: jobb alsó sarok, nagyobb kör elemben.
  const logoCorner = p.logo_url
    ? box(
        { position: "absolute", right: Math.round(56 * u), bottom: Math.round(26 * u), width: logoD, height: logoD, borderRadius: 9999, background: "#ffffff", alignItems: "center", justifyContent: "center", overflow: "hidden", border: `${Math.round(3 * u)}px solid ${t.bandInk}`, boxShadow: "0 6px 20px rgba(0,0,0,0.25)" },
        img(p.logo_url, { maxWidth: Math.round(logoD * 0.74), maxHeight: Math.round(logoD * 0.74), objectFit: "contain" })
      )
    : null;

  // --- A sáv tartalma: bal = ingatlan, jobb = értékesítő; a pecsét/képek alatt kezdődik ---
  const bandContent = box(
    {
      position: "absolute", left: 0, bottom: 0, width: W, height: bandH,
      alignItems: "flex-end",
      paddingTop: Math.round(sealD / 2 + 16 * u),
      paddingLeft: Math.round(60 * u), paddingRight: Math.round(60 * u), paddingBottom: Math.round(26 * u),
      gap: Math.round(30 * u),
    },
    [factsBlock, agentBlock]
  );

  const wm = o.watermark
    ? box(
        { position: "absolute", top: 0, left: 0, width: W, height: H, flexDirection: "column", justifyContent: "space-around", alignItems: "center", transform: "rotate(-24deg)" },
        Array.from({ length: 6 }).map((_, i) => box({ key: i, fontSize: Math.round(46 * u), fontWeight: 700, color: "rgba(255,255,255,0.30)", letterSpacing: Math.round(6 * u) } as Style, "ELŐNÉZET · TWINX"))
      )
    : null;

  return box(
    { position: "relative", width: W, height: H, fontFamily: family, background: t.paper },
    [heroLayer, scrim, titleBlock, badgeEl, wave, thumbRow, seal, bandContent, logoCorner, wm].filter(Boolean)
  );
}
