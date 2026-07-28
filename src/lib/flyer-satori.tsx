// A hirdetés Satori-kompatibilis fája (next/og ImageResponse) — PRÉMIUM, teljes-képes stílus.
// Pixelpontos, valódi TTF-fel → nincs levágott ékezet, minden gépen egyforma.
// Korlátok: csak flexbox, pixelek, egyszerű CSS + egyszerű SVG (a hullámhoz).
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

  const title = truncate((o.text.title || "Eladó ingatlan").toUpperCase(), 42);
  const titleFs = Math.round((title.length > 26 ? 60 : title.length > 16 ? 74 : 88) * u);
  const subtitle = truncate(o.text.subtitle, 48);
  const badge = truncate((o.text.badge || "ELADÓ").toUpperCase(), 12);
  const chips = o.text.chips.filter(Boolean).slice(0, 4).map((c) => truncate(c, 22));
  const factLine = chips.join("   ·   ").toUpperCase();
  const contact = [p.phone, p.email, p.website].filter(Boolean).map((x) => truncate(x, 32)).join("   ·   ");

  // Geometria
  const waveH = Math.round(H * 0.34);       // a hullám-svg magassága
  const amp = Math.round(52 * u);           // a hullám ív-magassága
  const footerH = waveH - amp - Math.round(14 * u); // a tömör rész, ahol a szöveg ül
  const sealD = Math.round(300 * u);

  // --- Réteg 1: teljes képes háttér ---
  const heroLayer = box(
    { position: "absolute", top: 0, left: 0, width: W, height: H, background: t.paper },
    hero ? img(hero, { width: W, height: H, objectFit: "cover" }) : undefined
  );

  // --- Réteg 2: felső sötétítés a cím olvashatóságához ---
  const scrim = box({
    position: "absolute", top: 0, left: 0, width: W, height: Math.round(H * 0.52),
    backgroundImage: "linear-gradient(180deg, rgba(0,0,0,0.62) 0%, rgba(0,0,0,0.12) 60%, rgba(0,0,0,0) 100%)",
  });

  // --- Réteg 3: cím-blokk (ráúsztatva) ---
  const titleBlock = box(
    { position: "absolute", top: Math.round(58 * u), left: Math.round(60 * u), width: W - Math.round(120 * u), flexDirection: "column" },
    [
      t.hair ? box({ width: Math.round(70 * u), height: Math.max(2, Math.round(3 * u)), background: t.hair, marginBottom: Math.round(18 * u) }, "") : null,
      box({ fontSize: titleFs, fontWeight: 700, color: "#ffffff", lineHeight: 1.04, letterSpacing: Math.round(1 * u), textShadow: "0 2px 18px rgba(0,0,0,0.45)" }, title),
      subtitle ? box({ fontSize: Math.round(30 * u), fontWeight: 400, color: "#ffffff", opacity: 0.95, marginTop: Math.round(14 * u), letterSpacing: Math.round(1 * u), textShadow: "0 1px 10px rgba(0,0,0,0.5)" }, subtitle) : null,
      factLine ? box({ fontSize: Math.round(20 * u), fontWeight: 700, color: "#ffffff", opacity: 0.9, marginTop: Math.round(16 * u), letterSpacing: Math.round(2 * u), textShadow: "0 1px 8px rgba(0,0,0,0.5)" }, factLine) : null,
    ].filter(Boolean)
  );

  // --- ELADÓ jelvény (jobb felső) ---
  const badgeEl = box(
    { position: "absolute", top: Math.round(56 * u), right: Math.round(60 * u), background: t.badgeBg, color: t.badgeInk, borderRadius: Math.round(6 * u), paddingTop: Math.round(10 * u), paddingBottom: Math.round(10 * u), paddingLeft: Math.round(22 * u), paddingRight: Math.round(22 * u), fontSize: Math.round(24 * u), fontWeight: 700, letterSpacing: Math.round(1 * u) },
    badge
  );

  // --- Réteg 4: ívelt hullám (SVG) az arculati sávszínnel ---
  const y0 = amp, y1 = Math.round(amp * 0.35);
  const wavePath = `M0,${y0} C ${Math.round(W * 0.30)},${y0 - amp} ${Math.round(W * 0.68)},${y1 + amp} ${W},${y1} L ${W},${waveH} L 0,${waveH} Z`;
  const wave = React.createElement(
    "svg",
    { width: W, height: waveH, viewBox: `0 0 ${W} ${waveH}`, style: { position: "absolute", left: 0, bottom: 0 } },
    React.createElement("path", { d: wavePath, fill: t.band })
  );

  // --- Réteg 5: thumbnails (ha több kép) — a hullám fölött, jobbra ---
  const thumbRow = thumbs.length
    ? box(
        { position: "absolute", right: Math.round(56 * u), bottom: waveH - Math.round(24 * u), gap: Math.round(12 * u) },
        thumbs.map((src, i) =>
          box(
            { key: i, width: Math.round(150 * u), height: Math.round(150 * u), borderRadius: Math.round(14 * u), overflow: "hidden", border: `${Math.round(3 * u)}px solid #ffffff` } as Style,
            img(src, { width: "100%", height: "100%", objectFit: "cover" })
          )
        )
      )
    : null;

  // --- Réteg 6: ár-pecsét (bal, a hullám fölé lógva) ---
  const seal = o.text.price
    ? box(
        { position: "absolute", left: Math.round(64 * u), bottom: waveH - Math.round(52 * u), width: sealD, height: sealD, borderRadius: 9999, background: accent, flexDirection: "column", alignItems: "center", justifyContent: "center", padding: Math.round(30 * u), border: `${Math.round(4 * u)}px solid ${accInk === "#ffffff" ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.85)"}` },
        [
          box({ fontSize: Math.round(20 * u), fontWeight: 700, color: accInk, opacity: 0.85, letterSpacing: Math.round(3 * u), marginBottom: Math.round(6 * u) }, "IRÁNYÁR"),
          box({ fontSize: Math.round((o.text.price.length > 10 ? 34 : o.text.price.length > 6 ? 46 : 58) * u), fontWeight: 700, color: accInk, lineHeight: 1.1, textAlign: "center" }, truncate(o.text.price, 16)),
        ]
      )
    : null;

  // --- Réteg 7: ügynök-sáv (a hullám tömör részén) ---
  const infoCol = box({ flexDirection: "column", flexGrow: 1 }, [
    box({ fontSize: Math.round(30 * u), fontWeight: 700, color: t.bandInk, lineHeight: 1.3 }, truncate(p.display_name || p.company, 26)),
    p.title ? box({ fontSize: Math.round(20 * u), fontWeight: 400, color: t.bandInk, opacity: 0.85, lineHeight: 1.35 }, truncate(p.title, 30)) : null,
    contact ? box({ fontSize: Math.round(21 * u), fontWeight: 700, color: t.bandInk, lineHeight: 1.4, marginTop: Math.round(3 * u) }, contact) : null,
  ].filter(Boolean));
  const footer = box(
    { position: "absolute", left: 0, bottom: 0, width: W, height: footerH, alignItems: "center", paddingLeft: o.text.price ? Math.round(64 * u) + sealD + Math.round(30 * u) : Math.round(60 * u), paddingRight: Math.round(60 * u), gap: Math.round(18 * u) },
    [
      p.agent_photo_url ? img(p.agent_photo_url, { width: Math.round(88 * u), height: Math.round(88 * u), borderRadius: 9999, objectFit: "cover", border: `${Math.round(3 * u)}px solid ${t.bandInk}` }) : null,
      infoCol,
      p.logo_url
        ? box(
            { alignItems: "center", justifyContent: "center", height: Math.round(88 * u), maxWidth: Math.round(210 * u), paddingTop: Math.round(8 * u), paddingBottom: Math.round(8 * u), paddingLeft: Math.round(16 * u), paddingRight: Math.round(16 * u), background: "#ffffff", borderRadius: Math.round(12 * u) },
            img(p.logo_url, { maxHeight: Math.round(62 * u), maxWidth: Math.round(178 * u), objectFit: "contain" })
          )
        : null,
    ].filter(Boolean)
  );

  // --- Vízjel ---
  const wm = o.watermark
    ? box(
        { position: "absolute", top: 0, left: 0, width: W, height: H, flexDirection: "column", justifyContent: "space-around", alignItems: "center", transform: "rotate(-24deg)" },
        Array.from({ length: 6 }).map((_, i) => box({ key: i, fontSize: Math.round(46 * u), fontWeight: 700, color: "rgba(255,255,255,0.30)", letterSpacing: Math.round(6 * u) } as Style, "ELŐNÉZET · TWINX"))
      )
    : null;

  return box(
    { position: "relative", width: W, height: H, fontFamily: family, background: t.paper },
    [heroLayer, scrim, titleBlock, badgeEl, wave, thumbRow, seal, footer, wm].filter(Boolean)
  );
}
