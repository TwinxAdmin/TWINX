// A videó képkockái Satorival (next/og) — a flyer arculati elemeivel.
// Nyitókártya: cím + lokáció + ár-pecsét. Zárókártya: körök (fotó+logó) + név + kontakt.
// Fotó-keret: a fotó teljes felületen + ALSÓ arculati felirat-sáv (váltakozó adatokkal).
// A feliratok itt is Satori-szöveggel készülnek → hibátlan magyar ékezetek.
import React from "react";
import { ImageResponse } from "next/og";
import { buildTheme, formatPrice } from "@/lib/flyer-poster";
import { getBrandingFont } from "@/lib/branding";
import { loadGoogleFont, googleFamilyOf } from "@/lib/google-font";
import type { FlyerProfileData } from "@/lib/flyer-template";

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
function truncate(s: string, max: number): string {
  const t = String(s ?? "").trim();
  return t.length <= max ? t : t.slice(0, Math.max(0, max - 1)).trimEnd() + "…";
}

const MOOD = "luxus"; // egységes prémium téma (mint a flyernél)

export type VideoFrameCtx = {
  width: number;
  height: number;
  profile: FlyerProfileData;
  family: string;
  fonts: Array<{ name: string; data: ArrayBuffer; style: "normal"; weight: 400 | 700 }>;
};

/** Betűk betöltése egyszer — minden képkocka ugyanazt használja. */
export async function loadVideoFonts(profile: FlyerProfileData, texts: string[]): Promise<{
  family: string;
  fonts: VideoFrameCtx["fonts"];
}> {
  const used = [
    ...texts,
    "ELADÓ ÁR IRÁNYÁR",
    "AÁBCDEÉFGHIÍJKLMNOÓÖŐPQRSTUÚÜŰVWXYZ",
    "aábcdeéfghiíjklmnoóöőpqrstuúüűvwxyz",
    "0123456789.,:;·-–—/()%²+&@ ",
  ].join(" ");
  const charset = Array.from(new Set(used.split(""))).join("");
  const wanted = googleFamilyOf(getBrandingFont(profile.font).family);
  let family = wanted;
  let loaded = await loadGoogleFont(wanted, charset).catch(() => null);
  if (!loaded) { family = "Montserrat"; loaded = await loadGoogleFont("Montserrat", charset); }
  const fonts = loaded.map((f) => ({
    name: family, data: f.data, style: "normal" as const,
    weight: (f.weight >= 700 ? 700 : 400) as 400 | 700,
  }));
  return { family, fonts };
}

async function renderPng(el: React.ReactElement, ctx: VideoFrameCtx): Promise<Buffer> {
  const res = new ImageResponse(el, { width: ctx.width, height: ctx.height, fonts: ctx.fonts });
  return Buffer.from(await res.arrayBuffer());
}

/** NYITÓKÁRTYA: arculati háttér, arany hajszálvonal, cím, lokáció, ár-pecsét. */
export async function renderOpeningCard(
  ctx: VideoFrameCtx,
  opts: { title: string; location: string; price: string }
): Promise<Buffer> {
  const { width: W, height: H, profile: p } = ctx;
  const u = W / 1080;
  const t = buildTheme(MOOD, p.accent_color);
  const accent = /^#[0-9a-fA-F]{6}$/.test(p.accent_color) ? p.accent_color : "#1e3a5f";
  const accInk = onColor(accent);
  const title = truncate((opts.title || "Eladó ingatlan").toUpperCase(), 40);
  const titleFs = Math.round((title.length > 24 ? 72 : 88) * u);
  const sealD = Math.round(260 * u);
  const price = formatPrice(opts.price); // „100" → „100 M Ft"

  const el = box(
    { position: "relative", width: W, height: H, background: t.band, fontFamily: ctx.family, flexDirection: "column", alignItems: "center", justifyContent: "center", padding: Math.round(80 * u) },
    [
      t.hair ? box({ width: Math.round(90 * u), height: Math.round(4 * u), background: t.hair, marginBottom: Math.round(36 * u) }, "") : null,
      box({ fontSize: titleFs, fontWeight: 700, color: t.bandInk, lineHeight: 1.15, textAlign: "center", letterSpacing: Math.round(1 * u) }, title),
      opts.location
        ? box({ fontSize: Math.round(34 * u), fontWeight: 400, color: t.bandInk, opacity: 0.9, marginTop: Math.round(22 * u), textAlign: "center" }, truncate(opts.location, 44))
        : null,
      price
        ? box(
            { width: sealD, height: sealD, borderRadius: 9999, background: accent, flexDirection: "column", alignItems: "center", justifyContent: "center", marginTop: Math.round(48 * u), border: `${Math.round(5 * u)}px solid rgba(255,255,255,0.6)` },
            [
              box({ fontSize: Math.round(22 * u), fontWeight: 700, color: accInk, opacity: 0.9, letterSpacing: Math.round(3 * u), marginBottom: Math.round(6 * u) }, "ÁR"),
              box({ fontSize: Math.round((price.length > 10 ? 38 : 52) * u), fontWeight: 700, color: accInk, lineHeight: 1.1, textAlign: "center" }, truncate(price, 16)),
            ]
          )
        : null,
    ].filter(Boolean)
  );
  return renderPng(el, ctx);
}

/** ZÁRÓKÁRTYA: fotó + logó körben, név, titulus, telefonszám nagyban, e-mail/web. */
export async function renderClosingCard(ctx: VideoFrameCtx): Promise<Buffer> {
  const { width: W, height: H, profile: p } = ctx;
  const u = W / 1080;
  const t = buildTheme(MOOD, p.accent_color);
  const circleD = Math.round(200 * u);

  const el = box(
    { position: "relative", width: W, height: H, background: t.band, fontFamily: ctx.family, flexDirection: "column", alignItems: "center", justifyContent: "center", padding: Math.round(80 * u) },
    [
      box({ gap: Math.round(28 * u), alignItems: "center", marginBottom: Math.round(36 * u) }, [
        p.agent_photo_url
          ? img(p.agent_photo_url, { width: circleD, height: circleD, borderRadius: 9999, objectFit: "cover", border: `${Math.round(5 * u)}px solid ${t.bandInk}` })
          : null,
        p.logo_url
          ? box(
              { width: circleD, height: circleD, borderRadius: 9999, background: "#ffffff", alignItems: "center", justifyContent: "center", overflow: "hidden", border: `${Math.round(5 * u)}px solid ${t.bandInk}` },
              img(p.logo_url, { maxWidth: Math.round(circleD * 0.72), maxHeight: Math.round(circleD * 0.72), objectFit: "contain" })
            )
          : null,
      ].filter(Boolean)),
      box({ fontSize: Math.round(52 * u), fontWeight: 700, color: t.bandInk, lineHeight: 1.2, textAlign: "center" }, truncate(p.display_name || p.company, 26)),
      p.title ? box({ fontSize: Math.round(28 * u), fontWeight: 400, color: t.bandInk, opacity: 0.85, marginTop: Math.round(6 * u) }, truncate(p.title, 32)) : null,
      p.phone ? box({ fontSize: Math.round(56 * u), fontWeight: 700, color: t.bandInk, marginTop: Math.round(30 * u) }, truncate(p.phone, 22)) : null,
      p.email ? box({ fontSize: Math.round(28 * u), fontWeight: 700, color: t.bandInk, opacity: 0.92, marginTop: Math.round(18 * u) }, truncate(p.email, 36)) : null,
      p.website ? box({ fontSize: Math.round(28 * u), fontWeight: 700, color: t.bandInk, opacity: 0.92, marginTop: Math.round(6 * u) }, truncate(p.website, 36)) : null,
    ].filter(Boolean)
  );
  return renderPng(el, ctx);
}

/** FOTÓ-KERET: CSAK a fotó, cover-kitöltéssel (a felirat külön rétegen megy rá). */
export async function renderPhotoFrame(
  ctx: VideoFrameCtx,
  opts: { photoUrl: string }
): Promise<Buffer> {
  const { width: W, height: H } = ctx;
  const el = box(
    { position: "relative", width: W, height: H, background: "#101010" },
    box(
      { position: "absolute", top: 0, left: 0, width: W, height: H, overflow: "hidden" },
      img(opts.photoUrl, { width: W, height: H, objectFit: "cover" })
    )
  );
  return renderPng(el, ctx);
}

/**
 * FELIRAT-RÉTEG: átlátszó PNG, alul a szöveggel. A videó FELSŐ rétegére kerül,
 * így NEM zoomol a képpel — végig olvasható marad. Nincs tömör színes sáv:
 * csak egy alig látható sötétedés + árnyékolt fehér betű.
 */
export async function renderCaptionOverlay(
  ctx: VideoFrameCtx,
  opts: { caption: string }
): Promise<Buffer> {
  const { width: W, height: H, profile: p } = ctx;
  const u = W / 1080;
  const t = buildTheme(MOOD, p.accent_color);
  const zoneH = Math.round(290 * u);

  const el = box(
    // A gyökéren NINCS background → a PNG átlátszó marad.
    { position: "relative", width: W, height: H, fontFamily: ctx.family },
    [
      box({
        position: "absolute", left: 0, bottom: 0, width: W, height: zoneH,
        backgroundImage: "linear-gradient(0deg, rgba(12,14,16,0.72) 0%, rgba(12,14,16,0.34) 55%, rgba(12,14,16,0) 100%)",
      }),
      box(
        { position: "absolute", left: 0, bottom: Math.round(66 * u), width: W, justifyContent: "center", paddingLeft: Math.round(48 * u), paddingRight: Math.round(48 * u) },
        box({
          fontSize: Math.round(58 * u), fontWeight: 700, color: "#ffffff",
          letterSpacing: Math.round(1 * u), textShadow: "0 3px 18px rgba(0,0,0,0.9)",
        }, truncate(opts.caption, 40))
      ),
      // Finom arculati hangsúly: rövid vonal a szöveg fölött.
      box({
        position: "absolute", left: Math.round(W / 2 - 50 * u), bottom: Math.round(160 * u),
        width: Math.round(100 * u), height: Math.max(3, Math.round(4 * u)),
        background: t.hair ?? p.accent_color, opacity: 0.95,
      }),
    ]
  );
  return renderPng(el, ctx);
}
