// A hirdetés Satori-kompatibilis fája (next/og ImageResponse).
// Satori = pixelpontos, valódi betűkészlettel → nincs levágott ékezet, minden gépen egyforma.
// Korlátok: csak flexbox, pixelértékek, egyszerű CSS. Ezért React.createElement-tel építjük.
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

/** family: a Satorinak átadott betűcsalád-név (ugyanaz, mint a fonts tömbben). */
export function buildFlyerElement(o: RenderOpts, family: string): React.ReactElement {
  const { width: W, height: H } = o;
  const u = W / 1080;
  const t = buildTheme(o.mood, o.profile.accent_color);
  const images = (o.images ?? []).filter(Boolean).slice(0, 4);
  const hero = images[0] || "";
  const thumbs = images.slice(1);
  const r = Math.round(t.radius * u);
  const P = Math.round(40 * u);
  const G = Math.round(16 * u);
  const p = o.profile;

  const title = truncate(o.text.title || "Eladó ingatlan", 42);
  const titleFs = Math.round((title.length > 30 ? 46 : title.length > 20 ? 54 : 62) * u);
  const subtitle = truncate(o.text.subtitle, 48);
  const badge = truncate((o.text.badge || "ELADÓ").toUpperCase(), 12);
  const chips = o.text.chips.filter(Boolean).slice(0, 4);
  const contact = [p.phone, p.email, p.website].filter(Boolean).map((x) => truncate(x, 32)).join("   ·   ");

  // --- Fejléc ---
  const header = box(
    { flexDirection: "column", background: t.band, borderRadius: r, padding: `${Math.round(26 * u)}px ${Math.round(30 * u)}px` },
    [
      t.hair ? box({ width: Math.round(64 * u), height: Math.max(2, Math.round(2 * u)), background: t.hair, borderRadius: 2, marginBottom: Math.round(14 * u) }, "") : null,
      box({ fontSize: titleFs, fontWeight: 700, color: t.bandInk, lineHeight: 1.2 }, title),
      subtitle ? box({ fontSize: Math.round(26 * u), fontWeight: 400, color: t.bandInk, opacity: 0.9, lineHeight: 1.4, marginTop: Math.round(8 * u) }, subtitle) : null,
    ].filter(Boolean)
  );

  // --- Főkép ---
  const heroEl = box(
    { width: "100%", flexGrow: 1, minHeight: Math.round(H * 0.26), borderRadius: r, overflow: "hidden", background: "#e9e5df" },
    hero ? img(hero, { width: "100%", height: "100%", objectFit: "cover" }) : undefined
  );

  // --- Chipek + ár ---
  const chipEls = chips.map((c, i) =>
    box(
      { key: i, alignItems: "center", height: Math.round(52 * u), paddingLeft: Math.round(22 * u), paddingRight: Math.round(22 * u), borderRadius: 999, background: t.chipBg, color: t.chipInk, fontSize: Math.round(21 * u), fontWeight: 700 } as Style,
      truncate(c, 22)
    )
  );
  const chipsWrap = box({ flexWrap: "wrap", gap: Math.round(10 * u), alignItems: "center", flexGrow: 1 }, chipEls);
  const priceEl = o.text.price
    ? box(
        { flexDirection: "column", alignItems: "flex-end", justifyContent: "center", background: t.priceBg, borderRadius: r, paddingTop: Math.round(12 * u), paddingBottom: Math.round(12 * u), paddingLeft: Math.round(24 * u), paddingRight: Math.round(24 * u) },
        [
          box({ fontSize: Math.round(15 * u), fontWeight: 600, color: t.priceInk, opacity: 0.8, letterSpacing: Math.round(2 * u) }, "IRÁNYÁR"),
          box({ fontSize: Math.round(34 * u), fontWeight: 700, color: t.priceInk, lineHeight: 1.3 }, truncate(o.text.price, 18)),
        ]
      )
    : null;
  const infoRow = box({ width: "100%", gap: G, alignItems: "stretch" }, [chipsWrap, priceEl].filter(Boolean));

  // --- Galéria ---
  const gallery = thumbs.length
    ? box(
        { width: "100%", gap: G, height: Math.round((H >= W ? 150 : 170) * u) },
        thumbs.map((src, i) => box({ key: i, flexGrow: 1, flexBasis: 0, borderRadius: r, overflow: "hidden", background: "#e9e5df" } as Style, img(src, { width: "100%", height: "100%", objectFit: "cover" })))
      )
    : null;

  // --- Lábléc (ügynök-sáv) ---
  const infoCol = box({ flexDirection: "column", flexGrow: 1 }, [
    box({ fontSize: Math.round(28 * u), fontWeight: 700, color: t.bandInk, lineHeight: 1.35 }, truncate(p.display_name || p.company, 26)),
    p.title ? box({ fontSize: Math.round(19 * u), fontWeight: 400, color: t.bandInk, opacity: 0.82, lineHeight: 1.4 }, truncate(p.title, 30)) : null,
    contact ? box({ fontSize: Math.round(20 * u), fontWeight: 700, color: t.bandInk, lineHeight: 1.45 }, contact) : null,
  ].filter(Boolean));
  const footer = box(
    { width: "100%", alignItems: "center", gap: Math.round(18 * u), background: t.band, borderRadius: r, paddingTop: Math.round(18 * u), paddingBottom: Math.round(18 * u), paddingLeft: Math.round(26 * u), paddingRight: Math.round(26 * u) },
    [
      p.agent_photo_url ? img(p.agent_photo_url, { width: Math.round(84 * u), height: Math.round(84 * u), borderRadius: 999, objectFit: "cover", border: `${Math.max(2, Math.round(3 * u))}px solid ${t.bandInk}` }) : null,
      infoCol,
      p.logo_url
        ? box(
            { alignItems: "center", justifyContent: "center", height: Math.round(84 * u), maxWidth: Math.round(200 * u), paddingTop: Math.round(8 * u), paddingBottom: Math.round(8 * u), paddingLeft: Math.round(14 * u), paddingRight: Math.round(14 * u), background: "#ffffff", borderRadius: Math.round(12 * u) },
            img(p.logo_url, { maxHeight: Math.round(60 * u), maxWidth: Math.round(168 * u), objectFit: "contain" })
          )
        : null,
    ].filter(Boolean)
  );

  // --- Jelvény + vízjel ---
  const badgeEl = box(
    { position: "absolute", top: Math.round(14 * u), right: Math.round(14 * u), background: t.badgeBg, color: t.badgeInk, borderRadius: Math.round(6 * u), paddingTop: Math.round(10 * u), paddingBottom: Math.round(10 * u), paddingLeft: Math.round(20 * u), paddingRight: Math.round(20 * u), fontSize: Math.round(24 * u), fontWeight: 700, letterSpacing: 1 },
    badge
  );
  const wm = o.watermark
    ? box(
        { position: "absolute", top: 0, left: 0, width: W, height: H, flexDirection: "column", justifyContent: "space-around", alignItems: "center", transform: "rotate(-24deg)" },
        Array.from({ length: 6 }).map((_, i) => box({ key: i, fontSize: Math.round(44 * u), fontWeight: 700, color: "rgba(30,20,10,0.16)", letterSpacing: Math.round(6 * u) } as Style, "ELŐNÉZET · TWINX"))
      )
    : null;

  return box(
    { position: "relative", width: W, height: H, flexDirection: "column", gap: G, padding: P, background: t.paper, fontFamily: family },
    [header, heroEl, infoRow, gallery, footer, badgeEl, wm].filter(Boolean)
  );
}
