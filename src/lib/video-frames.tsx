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

/**
 * MODERN SÁRGA NYITÓKÉP — teljes réteg a videó első pár másodpercére.
 * Bal oldali, majdnem a túloldalig érő sötét arculati háromszög (chevron),
 * rajta NAGY, szépen elrendezett fő infók: cím, elhelyezkedés, típus, adatok, ár.
 * Ugyanaz a felépítés 9:16-ra és 1:1-re is (méretarányos).
 */
export async function renderModernIntro(
  ctx: VideoFrameCtx,
  opts: {
    photoUrl: string; title: string; location: string; type: string; price: string;
    rooms: string; bathrooms: string; size: string;
    /** A sablon szín-variánsának kiemelő színe (alapértelmezés: az eredeti sárga). */
    accent?: string;
    /** A ferde panel (a szöveg mögötti nagy felület) színe a variánsból. */
    panel?: string;
    /** A kiemelt szövegek (cím, típus, ár) színe. Új variánsoknál FEHÉR. */
    heading?: string;
  }
): Promise<Buffer> {
  const { width: W, height: H } = ctx;
  const u = W / 1080;
  const hex = (v: string | undefined) => (/^#[0-9a-fA-F]{6}$/.test(v ?? "") ? (v as string) : null);
  // ACCENT: a grafikai elemek (ferde él, kis vonal). HEADING: a kiemelt szövegek.
  const ACCENT = hex(opts.accent) ?? "#f0c20c";
  const HEADING = hex(opts.heading) ?? ACCENT;
  const PANEL = (opts.panel ?? "").trim() || "rgba(26,18,48,0.94)";
  const SKEW = "skewX(-9deg)"; // átlós (ferde) él — dinamikus kompozíció
  const tall = H / W > 1.3; // 9:16 → magas; 1:1 → négyzetes
  const textW = Math.round(W * 0.58);
  const edgeX = Math.round(W * 0.60); // a ferde él nagyjából itt fut

  const bigTitle = truncate(opts.title || "Eladó ingatlan", 24);
  const titleFs = Math.round((bigTitle.length > 16 ? 74 : 92) * u);

  // Aspektus-függő méretek: 9:16-nál nagyobb adat- és ár-betűk, tágabb térközök.
  const statFs = tall ? 46 : 40;
  const statGap = tall ? 22 : 13;
  const priceFs = tall ? 88 : 68;

  // A statisztikák CSAK a fehér értékek (a sárga „Szoba/Fürdő/Méret" címkék
  // feleslegesek — az érték magától érthető). A hosszú érték nem vágódik le, tördel.
  const statLine = (val: string) =>
    val
      ? box({ fontSize: Math.round(statFs * u), color: "#ffffff", fontWeight: 700, lineHeight: 1.15, marginTop: Math.round(statGap * u) }, truncate(val, 42))
      : null;

  // FONTOS: a gyökér ÁTLÁTSZÓ (nincs fotó) — a fotót a sablon adja alatta, így
  // a fotó rögtön látszik, és CSAK ez a panel + szöveg úszik be (balról jobbra).
  void opts.photoUrl;
  const el = box(
    { position: "relative", width: W, height: H, fontFamily: ctx.family },
    [
      // Arculati panel — túlméretezett, FERDE (átlós élű) parallelogramma.
      box({ position: "absolute", top: -Math.round(H * 0.35), left: -Math.round(W * 0.45), width: Math.round(W * 1.05), height: Math.round(H * 1.7), background: PANEL, transform: SKEW }),
      // Vékony sárga átlós akcentus a panel élén.
      box({ position: "absolute", top: -Math.round(H * 0.35), left: edgeX, width: Math.round(9 * u), height: Math.round(H * 1.7), background: ACCENT, transform: SKEW }),
      // Szövegblokk — 9:16-nál FELÜLRE tolva és tágabban; 1:1-nél középre.
      box(
        {
          position: "absolute", top: 0, left: 0, width: textW, height: H,
          flexDirection: "column",
          justifyContent: tall ? "flex-start" : "center",
          paddingTop: tall ? Math.round(H * 0.12) : 0,
          paddingLeft: Math.round(76 * u), paddingRight: Math.round(48 * u),
        },
        [
          box({ width: Math.round(84 * u), height: Math.round(7 * u), background: ACCENT, marginBottom: Math.round(24 * u) }, ""),
          box({ fontSize: titleFs, fontWeight: 800, color: HEADING, lineHeight: 1.03 }, bigTitle),
          opts.location
            ? box({ fontSize: Math.round(37 * u), color: "#ffffff", opacity: 0.92, marginTop: Math.round(15 * u) }, truncate(opts.location, 34))
            : null,
          opts.type
            ? box({ fontSize: Math.round(33 * u), fontWeight: 800, color: HEADING, letterSpacing: Math.round(2 * u), marginTop: Math.round(24 * u) }, truncate(opts.type.toUpperCase(), 34))
            : null,
          box({ flexDirection: "column", marginTop: tall ? Math.round(H * 0.087) : Math.round(28 * u) }, [
            statLine(opts.rooms),
            statLine(opts.bathrooms),
            statLine(opts.size),
          ].filter(Boolean)),
          opts.price
            ? box({ fontSize: Math.round(priceFs * u), fontWeight: 800, color: HEADING, marginTop: tall ? Math.round(H * 0.087) : Math.round(36 * u), lineHeight: 1.0 }, truncate(opts.price, 18))
            : null,
        ].filter(Boolean)
      ),
    ]
  );
  return renderPng(el, ctx);
}

/**
 * MODERN SÁRGA ZÁRÓKÉP — fotó NÉLKÜL, a sablon színes (sötét lila) hátterén.
 * Nagy, jól olvasható összegzés: elhelyezkedés, ár, adatok + az ingatlanos
 * elérhetősége. Mindkét méretre (9:16 és 1:1) méretarányosan.
 */
export async function renderModernClosing(
  ctx: VideoFrameCtx,
  opts: { location: string; price: string; specs: string; contactName: string; contactPhone: string; contactEmail: string }
): Promise<Buffer> {
  const { width: W, height: H } = ctx;
  const u = W / 1080;
  const YELLOW = "#f0c20c";
  const BG = "#1a1230";
  const tall = H / W > 1.3;

  const el = box(
    {
      position: "relative", width: W, height: H, background: BG, fontFamily: ctx.family,
      flexDirection: "column", alignItems: "center", justifyContent: "center", padding: Math.round(80 * u),
    },
    [
      box({ width: Math.round(100 * u), height: Math.round(8 * u), background: YELLOW, marginBottom: Math.round(34 * u) }, ""),
      opts.location
        ? box({ fontSize: Math.round((tall ? 62 : 56) * u), fontWeight: 800, color: "#ffffff", textAlign: "center", lineHeight: 1.05 }, truncate(opts.location, 34))
        : null,
      opts.price
        ? box({ fontSize: Math.round((tall ? 116 : 100) * u), fontWeight: 800, color: YELLOW, marginTop: Math.round(24 * u), lineHeight: 1.0 }, truncate(opts.price, 18))
        : null,
      opts.specs
        ? box({ fontSize: Math.round((tall ? 42 : 40) * u), fontWeight: 700, color: "#ffffff", marginTop: Math.round(24 * u), textAlign: "center", lineHeight: 1.2 }, truncate(opts.specs, 60))
        : null,
      // Elválasztó
      box({ width: Math.round(W * 0.52), height: Math.round(3 * u), background: "rgba(255,255,255,0.28)", marginTop: Math.round(50 * u), marginBottom: Math.round(38 * u) }, ""),
      opts.contactName
        ? box({ fontSize: Math.round((tall ? 54 : 50) * u), fontWeight: 800, color: "#ffffff", textAlign: "center" }, truncate(opts.contactName, 30))
        : null,
      opts.contactPhone
        ? box({ fontSize: Math.round((tall ? 64 : 58) * u), fontWeight: 800, color: YELLOW, marginTop: Math.round(14 * u) }, truncate(opts.contactPhone, 22))
        : null,
      opts.contactEmail
        ? box({ fontSize: Math.round((tall ? 34 : 32) * u), fontWeight: 700, color: "#ffffff", opacity: 0.9, marginTop: Math.round(12 * u), textAlign: "center" }, truncate(opts.contactEmail, 38))
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

/** ZÁRÓ KÉP: háttérfotó + erős sötétítő + NAGY, jól olvasható összegző az ingatlanról
 *  (social-ready 9:16 és 1:1 esetén is), alatta a kontakt egy sorban. */
export async function renderClosingPhoto(
  ctx: VideoFrameCtx,
  opts: { photoUrl: string; summary: string }
): Promise<Buffer> {
  const { width: W, height: H, profile: p } = ctx;
  const u = W / 1080;
  const accent = /^#[0-9a-fA-F]{6}$/.test(p.accent_color) ? p.accent_color : "#1e3a5f";
  const summary = truncate((opts.summary || "").trim(), 120);
  // Font a hosszhoz igazítva: rövid → nagy, hosszú → kisebb, de végig jól olvasható.
  const fs = Math.round((summary.length > 80 ? 46 : summary.length > 50 ? 58 : 72) * u);
  const contact = truncate([p.display_name || p.company, p.phone].filter(Boolean).join("  ·  "), 46);

  const el = box(
    { position: "relative", width: W, height: H, background: "#0d0d0d", fontFamily: ctx.family },
    [
      box(
        { position: "absolute", top: 0, left: 0, width: W, height: H, overflow: "hidden" },
        img(opts.photoUrl, { width: W, height: H, objectFit: "cover" })
      ),
      box({
        position: "absolute", top: 0, left: 0, width: W, height: H,
        backgroundImage: "linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.28) 40%, rgba(0,0,0,0.80) 100%)",
      }),
      box(
        {
          position: "absolute", left: 0, bottom: Math.round(120 * u), width: W,
          flexDirection: "column", alignItems: "center",
          paddingLeft: Math.round(70 * u), paddingRight: Math.round(70 * u),
        },
        [
          box({ width: Math.round(90 * u), height: Math.round(5 * u), background: accent, marginBottom: Math.round(30 * u) }, ""),
          box({
            fontSize: fs, fontWeight: 700, color: "#ffffff", lineHeight: 1.15,
            textAlign: "center", textShadow: "0 3px 20px rgba(0,0,0,0.95)",
          }, summary),
          contact
            ? box({
                fontSize: Math.round(30 * u), fontWeight: 700, color: "#ffffff", opacity: 0.92,
                marginTop: Math.round(26 * u), textAlign: "center", textShadow: "0 2px 12px rgba(0,0,0,0.9)",
              }, contact)
            : null,
        ].filter(Boolean)
      ),
    ]
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
export type CaptionPosition = "bottom" | "center";

export async function renderCaptionOverlay(
  ctx: VideoFrameCtx,
  opts: { line1: string; line2?: string; position?: CaptionPosition; accent?: string }
): Promise<Buffer> {
  const { width: W, height: H, profile: p } = ctx;
  const u = W / 1080;
  const t = buildTheme(MOOD, p.accent_color);
  // A kis arculati vonal színe: ha a sablon szín-variánsa megadja, az az elsődleges.
  const variantAccent = /^#[0-9a-fA-F]{6}$/.test(opts.accent ?? "") ? (opts.accent as string) : null;
  const hasLine2 = Boolean((opts.line2 ?? "").trim());
  const zoneH = Math.round((hasLine2 ? 430 : 360) * u);

  // A fő sor betűmérete a hosszhoz igazodik, hogy sose lógjon ki — de nagyobb, olvashatóbb.
  const line1 = truncate(opts.line1, 42);
  const mainFs = Math.round((line1.length > 30 ? 54 : line1.length > 22 ? 66 : 80) * u);
  const line2 = truncate((opts.line2 ?? "").trim(), 42);
  const subFs = Math.round((line2.length > 30 ? 50 : line2.length > 22 ? 58 : 68) * u);
  const hair = variantAccent ?? t.hair ?? p.accent_color;

  // KÖZÉPRE igazított változat: lágy vízszintes sáv, a szöveg fölött ÉS alatt is
  // ott az arculati vonal. A fotó teteje-alja szabadon marad.
  if ((opts.position ?? "bottom") === "center") {
    const bandH = Math.round((hasLine2 ? 500 : 430) * u);
    const rule = (mt: number) =>
      box({
        width: Math.round(100 * u), height: Math.max(3, Math.round(4 * u)),
        background: hair, opacity: 0.95, marginTop: mt,
      });
    const centered = box(
      { position: "relative", width: W, height: H, fontFamily: ctx.family },
      [
        box({
          position: "absolute", left: 0, top: Math.round((H - bandH) / 2), width: W, height: bandH,
          backgroundImage:
            "linear-gradient(180deg, rgba(12,14,16,0) 0%, rgba(12,14,16,0.58) 26%, rgba(12,14,16,0.64) 74%, rgba(12,14,16,0) 100%)",
        }),
        box(
          {
            position: "absolute", left: 0, top: 0, width: W, height: H,
            flexDirection: "column", alignItems: "center", justifyContent: "center",
            paddingLeft: Math.round(48 * u), paddingRight: Math.round(48 * u),
          },
          [
            rule(0),
            box({
              fontSize: mainFs, fontWeight: 700, color: "#ffffff", lineHeight: 1.12,
              letterSpacing: Math.round(1 * u), textShadow: "0 3px 18px rgba(0,0,0,0.9)",
              textAlign: "center", marginTop: Math.round(26 * u),
            }, line1),
            hasLine2
              ? box({
                  fontSize: subFs, fontWeight: 700, color: "#ffffff",
                  lineHeight: 1.12, letterSpacing: Math.round(1 * u),
                  marginTop: Math.round(10 * u), textShadow: "0 3px 18px rgba(0,0,0,0.9)",
                  textAlign: "center",
                }, line2)
              : null,
            rule(Math.round(26 * u)),
          ].filter(Boolean)
        ),
      ]
    );
    return renderPng(centered, ctx);
  }

  const el = box(
    // A gyökéren NINCS background → a PNG átlátszó marad.
    { position: "relative", width: W, height: H, fontFamily: ctx.family },
    [
      box({
        position: "absolute", left: 0, bottom: 0, width: W, height: zoneH,
        backgroundImage: "linear-gradient(0deg, rgba(12,14,16,0.74) 0%, rgba(12,14,16,0.36) 55%, rgba(12,14,16,0) 100%)",
      }),
      box(
        {
          position: "absolute", left: 0, bottom: Math.round(66 * u), width: W,
          flexDirection: "column", alignItems: "center",
          paddingLeft: Math.round(48 * u), paddingRight: Math.round(48 * u),
        },
        [
          box({
            fontSize: mainFs, fontWeight: 700, color: "#ffffff", lineHeight: 1.12,
            letterSpacing: Math.round(1 * u), textShadow: "0 3px 18px rgba(0,0,0,0.9)",
            textAlign: "center",
          }, line1),
          hasLine2
            ? box({
                fontSize: subFs, fontWeight: 700, color: "#ffffff", opacity: 1,
                lineHeight: 1.12, letterSpacing: Math.round(1 * u),
                marginTop: Math.round(10 * u), textShadow: "0 3px 18px rgba(0,0,0,0.9)",
                textAlign: "center",
              }, line2)
            : null,
        ].filter(Boolean)
      ),
      // Finom arculati hangsúly: rövid vonal a szöveg fölött.
      box({
        position: "absolute", left: Math.round(W / 2 - 50 * u), bottom: Math.round((hasLine2 ? 210 : 160) * u),
        width: Math.round(100 * u), height: Math.max(3, Math.round(4 * u)),
        background: hair, opacity: 0.95,
      }),
    ]
  );
  return renderPng(el, ctx);
}
