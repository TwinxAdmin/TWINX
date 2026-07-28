// Kódból rajzolt ingatlanhirdetés — AI NÉLKÜL.
// A partner fotóit MI rendezzük el egy igényes sablonba, a feliratokat élesen írjuk rá.
// A "hangulat" színtéma: ugyanaz az elrendezés, más paletta/kezelés.
//
// A böngészőben (html2canvas) renderelünk, ezért minden méret PIXELBEN van, és kerüljük
// a levágott betűket: SOHA nincs `font` rövidítés, minden szöveget előre rövidítünk
// (nem `overflow:hidden`-nel vágunk), és bő sormagasságot + alsó ráhagyást adunk.
import { getBrandingFont } from "@/lib/branding";
import type { FlyerProfileData } from "@/lib/flyer-template";

// --- Hangulatok (színtéma) ---------------------------------------------------
export type FlyerMood = { value: string; label: string; desc: string };

export const FLYER_MOODS: FlyerMood[] = [
  { value: "luxus", label: "Elegáns luxus", desc: "Sötét fejléc, arany hajszálvonal — exkluzív, prémium hatás." },
  { value: "letisztult", label: "Letisztult, világos", desc: "Sok fehér, finom vonalak — modern, nyugodt megjelenés." },
  { value: "meleg", label: "Meleg, otthonos", desc: "Krémszínű alap, lágy sarkok — barátságos, hívogató." },
  { value: "kontrasztos", label: "Kontrasztos, erős", desc: "Sötét blokkok, éles sarkok — feltűnő a hirdetési felületeken." },
];

export function getFlyerMood(v: string): FlyerMood {
  return FLYER_MOODS.find((m) => m.value === v) ?? FLYER_MOODS[0];
}

export const FLYER_SIZES = [
  { value: "1:1", label: "Négyzet 1:1", hint: "Instagram, Facebook", w: 1080, h: 1080 },
  { value: "9:16", label: "Álló 9:16", hint: "Story, Reels", w: 1080, h: 1920 },
  { value: "4:3", label: "Fekvő 4:3", hint: "Portálok, e-mail", w: 1440, h: 1080 },
] as const;

export function getFlyerSize(v: string) {
  return FLYER_SIZES.find((s) => s.value === v) ?? FLYER_SIZES[0];
}

/**
 * A hirdetés KÖZÖS geometriája (szerver-render ÉS kliens-előnézet ugyanebből dolgozik).
 * Méretenként más kompozíció: az álló 9:16 karcsúbb sávot kap, mint az 1:1.
 * Minden érték a vászon pixeleiben (u = W/1080 alapegység).
 */
export function flyerGeom(w: number, h: number) {
  const u = w / 1080;
  const ratio = w / h;
  const story = h / w >= 1.4;            // álló (9:16) — mobil-első kompozíció
  const land = !story && ratio >= 1.25;  // fekvő — oldalsó színátmenet, nincs hullám
  const wide = land && ratio >= 1.6;     // 16:9 — szélesebb, más elrendezés, mint a 4:3
  const waveH = land ? 0 : Math.round(h * (story ? 0.28 : 0.29));
  const amp = land ? 0 : Math.round(40 * u);
  const bandH = waveH - amp;
  const gapT = Math.round(14 * u);
  // Kis képek: story oszlop 220; fekvő és 1:1 sor 170.
  const thumbD = Math.round((story ? 220 : 170) * u);
  return {
    u, story, land, wide, waveH, amp, bandH, gapT, thumbD,
    right0: Math.round(60 * u),
    B0: land ? Math.round(60 * u) : bandH + gapT, // a kis képek alapvonala (alulról)
  };
}

// --- Szín-segédek ------------------------------------------------------------
function clampHex(hex: string, fallback = "#1e3a5f"): string {
  return /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : fallback;
}
function rgbOf(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function toHex(r: number, g: number, b: number): string {
  const c = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}
/** t>0: világosít fehér felé, t<0: sötétít fekete felé (|t| 0–1). */
function shade(hex: string, t: number): string {
  const [r, g, b] = rgbOf(hex);
  if (t >= 0) return toHex(r + (255 - r) * t, g + (255 - g) * t, b + (255 - b) * t);
  const k = 1 + t;
  return toHex(r * k, g * k, b * k);
}
function onColor(hex: string): string {
  const [r, g, b] = rgbOf(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? "#171310" : "#ffffff";
}

// --- Szöveg-segédek ----------------------------------------------------------
function esc(s: string): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
export function truncate(s: string, max: number): string {
  const t = String(s ?? "").trim();
  return t.length <= max ? t : t.slice(0, Math.max(0, max - 1)).trimEnd() + "…";
}

/**
 * Ár formázása: ha a partner CSAK számot ír (pl. "100" vagy "46,5"), kitesszük a
 * hiányzó mértékegységet → "100 M Ft". Ha már írt bármilyen egységet (M, Ft, mFt…),
 * változatlanul hagyjuk.
 */
export function formatPrice(raw: string): string {
  const t = String(raw ?? "").trim();
  if (!t) return "";
  if (/^\d+([.,]\d+)?$/.test(t)) return `${t} M Ft`;          // csak szám
  if (/^\d+([.,]\d+)?\s*m$/i.test(t)) return `${t.replace(/\s*m$/i, "")} M Ft`; // "100 M"
  return t;
}

/**
 * Méret formázása: ha a partner csak számot ír (pl. "100"), hozzátesszük a "m²"-t.
 * Ha már van egység (m2, m², nm, négyzetméter), változatlan marad.
 */
export function formatSize(raw: string): string {
  const t = String(raw ?? "").trim();
  if (!t) return "";
  if (/^\d+([.,]\d+)?$/.test(t)) return `${t} m²`;
  if (/^\d+([.,]\d+)?\s*(m2|nm)$/i.test(t)) return `${t.replace(/\s*(m2|nm)$/i, "")} m²`;
  return t;
}
/** Betűstílus külön tulajdonságokkal — a `font` rövidítés levágná a sormagasságot. */
function type(weight: number, size: number, lh: number, extra = ""): string {
  return `font-weight:${weight};font-size:${size}px;line-height:${lh};${extra}`;
}

// --- Téma egy hangulathoz + arculati színből ---------------------------------
export type Theme = {
  paper: string; band: string; bandInk: string; hair: string | null;
  badgeBg: string; badgeInk: string; chipBg: string; chipInk: string;
  priceBg: string; priceInk: string; radius: number;
};

export function buildTheme(mood: string, accentRaw: string): Theme {
  const accent = clampHex(accentRaw);
  const accInk = onColor(accent);
  switch (mood) {
    case "letisztult":
      return {
        paper: "#ffffff", band: accent, bandInk: accInk, hair: null,
        badgeBg: "#ffffff", badgeInk: accent,
        chipBg: "#ffffff", chipInk: "#171310",
        priceBg: accent, priceInk: accInk, radius: 16,
      };
    case "meleg":
      return {
        paper: "#f6efe4", band: accent, bandInk: accInk, hair: shade(accent, 0.35),
        badgeBg: shade(accent, 0.15), badgeInk: onColor(shade(accent, 0.15)),
        chipBg: "#fffdf9", chipInk: "#3a2e22",
        priceBg: accent, priceInk: accInk, radius: 20,
      };
    case "kontrasztos": {
      const dark = "#16181d";
      return {
        paper: "#ededed", band: dark, bandInk: "#ffffff", hair: null,
        badgeBg: accent, badgeInk: accInk,
        chipBg: accent, chipInk: accInk,
        priceBg: accent, priceInk: accInk, radius: 3,
      };
    }
    case "luxus":
    default: {
      const dark = shade(accent, -0.55);
      const gold = "#c6a052";
      return {
        paper: "#faf8f4", band: dark, bandInk: "#ffffff", hair: gold,
        badgeBg: gold, badgeInk: "#20180a",
        chipBg: "#ffffff", chipInk: "#171310",
        priceBg: dark, priceInk: "#ffffff", radius: 6,
      };
    }
  }
}

// --- A hirdetés adatai a rendernek --------------------------------------------
/** Az alsó ikonos adatsáv tételei (nyers értékek — a render formázza őket). */
export type RenderDetails = {
  size?: string;       // pl. "100" vagy "100 nm"
  rooms?: string;      // pl. "2 szoba"
  bathrooms?: string;  // pl. "1 fürdőszoba + külön WC"
  floor?: string;      // pl. "2. emelet"
  structure?: string;  // pl. "Tégla (pl. Porotherm)"
  condition?: string;  // pl. "Új építésű (kulcsrakész)"
};

export type RenderText = {
  title: string; subtitle: string; price: string; chips: string[]; badge?: string;
  details?: RenderDetails;
};

export type RenderOpts = {
  images: string[]; width: number; height: number;
  profile: FlyerProfileData; text: RenderText; mood: string; watermark?: boolean;
  /** A főkép kivágásának igazítása százalékban (50/50 = középre). */
  heroPos?: { x: number; y: number };
  /** A főkép eredeti mérete (px) — ebből számoljuk a VALÓDI mozgásteret. */
  heroDim?: { w: number; h: number };
  /** A nem-fix kis képek helye: sorban, vagy a jobb szélső (fix) kép fölött. */
  thumbSlots?: Array<"row" | "up1" | "up2">;
};

export function buildPosterHtml(o: RenderOpts): string {
  const { width: W, height: H } = o;
  const u = W / 1080;
  const font = getBrandingFont(o.profile.font);
  const t = buildTheme(o.mood, o.profile.accent_color);
  const images = (o.images ?? []).filter(Boolean).slice(0, 4);
  const hero = images[0] || "";
  const thumbs = images.slice(1);
  const r = Math.round(t.radius * u);
  const P = Math.round(40 * u);
  const G = Math.round(16 * u);

  // --- Fejléc (sáv): cím + alcím ---
  const title = truncate(o.text.title || "Eladó ingatlan", 42);
  const titleFs = Math.round((title.length > 30 ? 46 : title.length > 20 ? 54 : 62) * u);
  const subtitle = truncate(o.text.subtitle, 48);
  const hair = t.hair
    ? `<div style="height:${Math.max(2, Math.round(2 * u))}px;width:${Math.round(64 * u)}px;background:${t.hair};margin-bottom:${14 * u}px;border-radius:2px"></div>`
    : "";
  const badge = truncate((o.text.badge || "ELADÓ").toUpperCase(), 12);

  const header = `
    <div style="position:relative;background:${t.band};border-radius:${r}px;padding:${26 * u}px ${30 * u}px">
      ${hair}
      <div style="${type(800, titleFs, 1.2, `color:${t.bandInk};padding-bottom:${Math.ceil(titleFs * 0.1)}px;`)}word-break:break-word">${esc(title)}</div>
      ${subtitle ? `<div style="${type(500, Math.round(26 * u), 1.5, `color:${t.bandInk};opacity:.9;`)}white-space:nowrap;padding-bottom:${3 * u}px">${esc(subtitle)}</div>` : ""}
    </div>`;

  const badgeEl = `
    <div style="position:absolute;top:${Math.round(14 * u)}px;right:${Math.round(14 * u)}px;z-index:8;background:${t.badgeBg};color:${t.badgeInk};border-radius:${Math.round(6 * u)}px;padding:${10 * u}px ${20 * u}px;${type(800, Math.round(24 * u), 1, "letter-spacing:1px;")}box-shadow:0 ${3 * u}px ${12 * u}px rgba(0,0,0,.2)">${esc(badge)}</div>`;

  const heroEl = `
    <div style="flex:1 1 auto;min-height:${Math.round(H * 0.22)}px;border-radius:${r}px;background:#e9e5df url('${esc(hero)}') center/cover no-repeat"></div>`;

  const chips = o.text.chips.filter(Boolean).slice(0, 4);
  const chipsEl = chips.length
    ? `<div style="display:flex;flex-wrap:wrap;gap:${10 * u}px;align-items:center;flex:1 1 auto;min-width:0">
        ${chips.map((c) => `<span style="display:inline-flex;align-items:center;height:${52 * u}px;padding:0 ${22 * u}px;border-radius:999px;background:${t.chipBg};color:${t.chipInk};${type(700, Math.round(21 * u), 1, "")}white-space:nowrap;box-shadow:0 ${2 * u}px ${8 * u}px rgba(0,0,0,.1)">${esc(truncate(c, 22))}</span>`).join("")}
      </div>`
    : `<div style="flex:1 1 auto"></div>`;

  const priceEl = o.text.price
    ? `<div style="flex:0 0 auto;background:${t.priceBg};color:${t.priceInk};border-radius:${r}px;padding:${12 * u}px ${24 * u}px;text-align:right">
        <div style="${type(600, Math.round(15 * u), 1.4, `color:${t.priceInk};opacity:.8;letter-spacing:${2 * u}px;`)}">IRÁNYÁR</div>
        <div style="${type(800, Math.round(34 * u), 1.3, `color:${t.priceInk};padding-bottom:${3 * u}px;`)}white-space:nowrap">${esc(truncate(o.text.price, 18))}</div>
      </div>`
    : "";

  const infoRow = `<div style="display:flex;align-items:stretch;gap:${G}px">${chipsEl}${priceEl}</div>`;

  const galleryEl = thumbs.length
    ? `<div style="display:flex;gap:${G}px;height:${Math.round((H >= W ? 150 : 170) * u)}px">
        ${thumbs.map((src) => `<div style="flex:1 1 0;border-radius:${r}px;background:#e9e5df url('${esc(src)}') center/cover no-repeat"></div>`).join("")}
      </div>`
    : "";

  const p = o.profile;
  const contact = [p.phone, p.email, p.website].filter(Boolean).map((x) => esc(truncate(x, 32))).join("   ·   ");
  const footer = `
    <div style="display:flex;align-items:center;gap:${18 * u}px;background:${t.band};border-radius:${r}px;padding:${18 * u}px ${26 * u}px;min-height:${Math.round(96 * u)}px">
      ${p.agent_photo_url ? `<div style="width:${84 * u}px;height:${84 * u}px;border-radius:999px;background:#ccc url('${esc(p.agent_photo_url)}') center/cover no-repeat;border:${Math.max(2, Math.round(3 * u))}px solid ${t.bandInk};flex:0 0 auto"></div>` : ""}
      <div style="flex:1 1 auto;min-width:0">
        <div style="${type(800, Math.round(28 * u), 1.35, `color:${t.bandInk};padding-bottom:${2 * u}px;`)}white-space:nowrap">${esc(truncate(p.display_name || p.company, 26))}</div>
        ${p.title ? `<div style="${type(500, Math.round(19 * u), 1.4, `color:${t.bandInk};opacity:.82;padding-bottom:${2 * u}px;`)}white-space:nowrap">${esc(truncate(p.title, 30))}</div>` : ""}
        ${contact ? `<div style="${type(700, Math.round(20 * u), 1.45, `color:${t.bandInk};padding-bottom:${2 * u}px;`)}white-space:nowrap">${contact}</div>` : ""}
      </div>
      ${p.logo_url ? `<div style="flex:0 0 auto;display:flex;align-items:center;justify-content:center;height:${84 * u}px;max-width:${200 * u}px;padding:${8 * u}px ${14 * u}px;background:#ffffff;border-radius:${Math.round(12 * u)}px">
        <img src="${esc(p.logo_url)}" style="max-height:${60 * u}px;max-width:${168 * u}px;object-fit:contain" />
      </div>` : ""}
    </div>`;

  const wm = o.watermark
    ? `<div style="position:absolute;inset:0;z-index:90;display:flex;flex-direction:column;justify-content:space-around;align-items:center;transform:rotate(-24deg) scale(1.4);pointer-events:none">
        ${Array.from({ length: 6 }).map(() => `<span style="${type(800, Math.round(44 * u), 1.4, `letter-spacing:${6 * u}px;`)}color:rgba(30,20,10,.16);white-space:nowrap">ELŐNÉZET · TWINX</span>`).join("")}
      </div>`
    : "";

  return `<!doctype html><html lang="hu"><head><meta charset="utf-8">
<link rel="stylesheet" href="${font.link}">
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{width:${W}px;height:${H}px}
  .flyer{position:relative;width:${W}px;height:${H}px;overflow:hidden;background:${t.paper};font-family:${font.family};-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .stack{position:absolute;inset:0;display:flex;flex-direction:column;gap:${G}px;padding:${P}px}
</style></head><body>
<div class="flyer">
  <div class="stack">
    ${header}
    ${heroEl}
    ${infoRow}
    ${galleryEl}
    ${footer}
  </div>
  ${badgeEl}
  ${wm}
</div>
</body></html>`;
}
