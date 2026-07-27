// A hirdetés HTML-je: STÍLUS × ARÁNY × KÉPSZÁM.
// A kliens (html2canvas) rendereli, ezért minden méret PIXELBEN van, és kerüljük a
// böngészőfüggő CSS-t (nincs line-clamp, backdrop-filter, grid — flex és abszolút pozíció).
//
// Grafikai elvek:
//  • Egy fő szín (az arculatból) — abból származtatott harmonikus paletta.
//  • Garantált kontraszt: minden színes felületre contrastOn() adja a betűszínt.
//  • Nincs túlcsordulás: truncate + fitSize + fix magasságú dobozok.
//  • A képszám vezérli a ritmust: 1 kép = nagy kép + nagy adatok; 4 kép = fő kép + galéria.
import type { FlyerText } from "@/lib/flyer";
import type { FlyerProfileData, FlyerKeyFacts } from "@/lib/flyer-template";
import { getBrandingFont } from "@/lib/branding";
import {
  getFlyerStyle, getFlyerRatio, imagePlan, buildPalette, contrastOn,
  fitSize, truncate, boxCss, TEXT_LIMITS,
  type FlyerPalette, type FlyerStyle,
} from "@/lib/flyer-design";

function esc(s: string): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Az árból a szám (a "M Ft" a sablonból jön). */
function priceParts(raw: string): { num: string; suffix: string } {
  const s = String(raw ?? "").trim();
  const m = s.match(/\d+([.,]\d+)?/);
  if (!m) return { num: s, suffix: "" };
  const rest = s.slice(m.index! + m[0].length).trim();
  return { num: m[0], suffix: rest || "M Ft" };
}

type BuildOpts = {
  style: string;
  ratio: string;
  images: string[];
  profile: FlyerProfileData;
  text: FlyerText;
  facts?: FlyerKeyFacts;
  watermark?: boolean;
};

export function buildAdHtml(opts: BuildOpts): string {
  const st = getFlyerStyle(opts.style);
  const ratio = getFlyerRatio(opts.ratio);
  const images = (opts.images ?? []).filter(Boolean).slice(0, 4);
  const plan = imagePlan(images.length || 1, ratio.id);
  const pal = buildPalette(opts.profile.accent_color, opts.profile.theme);
  const font = getBrandingFont(opts.profile.font);

  const W = ratio.width;
  const H = ratio.height;
  const u = W / 1080; // méretskála: minden px érték ehhez igazodik
  const pad = Math.round(48 * u);

  const layoutArgs = {
    st, pal, W, H, u, pad, images, plan,
    profile: opts.profile, text: opts.text, facts: opts.facts,
  };
  const body = st.surface === "overlay" ? overlayLayout(layoutArgs) : panelLayout(layoutArgs);

  const wm = opts.watermark
    ? `<div style="position:absolute;inset:0;z-index:90;display:flex;flex-direction:column;justify-content:space-around;align-items:center;transform:rotate(-24deg) scale(1.4);pointer-events:none">
        ${Array.from({ length: 6 }).map(() => `<span style="font:800 ${Math.round(44 * u)}px ${font.family};letter-spacing:${6 * u}px;color:rgba(255,255,255,.30);text-shadow:0 2px 8px rgba(0,0,0,.35);white-space:nowrap">ELŐNÉZET · TWINX</span>`).join("")}
      </div>`
    : "";

  return `<!doctype html><html lang="hu"><head><meta charset="utf-8">
<link rel="stylesheet" href="${font.link}">
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{width:${W}px;height:${H}px}
  .flyer{position:relative;width:${W}px;height:${H}px;overflow:hidden;background:${pal.paper};color:${pal.ink};font-family:${font.family};-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .img{background-size:cover;background-position:center;background-repeat:no-repeat}
</style></head><body>
<div class="flyer">${body}${wm}</div>
</body></html>`;
}

// --- Közös építőelemek -----------------------------------------------------

/** Ár-blokk: a legfontosabb szám, mindig olvasható kontraszttal. */
function priceBlock(text: FlyerText, pal: FlyerPalette, st: FlyerStyle, u: number, onDark: boolean) {
  if (!text.price) return "";
  const { num, suffix } = priceParts(text.price);
  const size = fitSize(num.length, 5, Math.round(72 * u));
  const color = st.id === "bold" || onDark ? "#ffffff" : pal.accent;
  return `<div style="display:flex;align-items:baseline;gap:${6 * u}px;white-space:nowrap">
    <span style="font:900 ${size}px inherit;line-height:1;color:${color}">${esc(num)}</span>
    <span style="font:800 ${Math.round(size * 0.36)}px inherit;color:${color};opacity:.92">${esc(truncate(suffix, 8))}</span>
  </div>`;
}

/** Adat-chipek (szoba, méret, állapot) — a stílus szerint tömör / kontúros / aláhúzott. */
function chips(items: string[], pal: FlyerPalette, st: FlyerStyle, u: number, onDark: boolean) {
  const list = items.filter(Boolean).slice(0, 4);
  if (!list.length) return "";
  const h = Math.round(46 * u);
  const fs = Math.round(20 * u);
  return `<div style="display:flex;flex-wrap:wrap;gap:${10 * u}px">${list
    .map((raw) => {
      const t = esc(truncate(raw, TEXT_LIMITS.highlight));
      if (st.chip === "solid") {
        const bg = onDark ? "rgba(255,255,255,.18)" : pal.accent;
        const fg = onDark ? "#ffffff" : contrastOn(pal.accent);
        return `<span style="display:inline-flex;align-items:center;height:${h}px;padding:0 ${18 * u}px;border-radius:${999}px;background:${bg};color:${fg};font:700 ${fs}px inherit;white-space:nowrap">${t}</span>`;
      }
      if (st.chip === "outline") {
        const bc = onDark ? "rgba(255,255,255,.55)" : pal.accent;
        const fg = onDark ? "#ffffff" : pal.ink;
        return `<span style="display:inline-flex;align-items:center;height:${h}px;padding:0 ${18 * u}px;border-radius:999px;border:${Math.max(1, 2 * u)}px solid ${bc};color:${fg};font:600 ${fs}px inherit;white-space:nowrap">${t}</span>`;
      }
      const fg = onDark ? "#ffffff" : pal.ink;
      return `<span style="display:inline-flex;align-items:center;height:${h}px;padding:0 ${4 * u}px ${6 * u}px;border-bottom:${Math.max(2, 3 * u)}px solid ${pal.accent};color:${fg};font:600 ${fs}px inherit;white-space:nowrap">${t}</span>`;
    })
    .join("")}</div>`;
}

/** Lábléc: ügynök, elérhetőség, logó — mindig a felület kontrasztjához igazítva. */
function footer(p: FlyerProfileData, pal: FlyerPalette, u: number, onDark: boolean) {
  const fg = onDark ? "#ffffff" : pal.ink;
  const muted = onDark ? "rgba(255,255,255,.78)" : pal.inkMuted;
  const contact = [p.phone, p.email, p.website].filter(Boolean).map((x) => esc(truncate(x, 30))).join("  ·  ");
  const name = esc(truncate(p.display_name || p.company, 28));
  return `<div style="display:flex;align-items:center;justify-content:space-between;gap:${18 * u}px">
    <div style="display:flex;align-items:center;gap:${14 * u}px;min-width:0">
      ${p.agent_photo_url ? `<div class="img" style="width:${64 * u}px;height:${64 * u}px;border-radius:999px;background-image:url('${esc(p.agent_photo_url)}');border:${Math.max(2, 3 * u)}px solid ${pal.accent};flex:0 0 auto"></div>` : ""}
      <div style="min-width:0">
        <div style="font:800 ${Math.round(26 * u)}px inherit;color:${fg};white-space:nowrap;overflow:hidden">${name}</div>
        ${p.title ? `<div style="font:500 ${Math.round(18 * u)}px inherit;color:${muted};white-space:nowrap;overflow:hidden">${esc(truncate(p.title, 30))}</div>` : ""}
        ${contact ? `<div style="font:600 ${Math.round(18 * u)}px inherit;color:${fg};opacity:.92;margin-top:${3 * u}px;white-space:nowrap;overflow:hidden">${contact}</div>` : ""}
      </div>
    </div>
    ${p.logo_url
      ? `<div style="flex:0 0 auto;display:flex;align-items:center;justify-content:center;height:${72 * u}px;min-width:${72 * u}px;max-width:${210 * u}px;padding:${10 * u}px ${14 * u}px;background:#ffffff;border-radius:${12 * u}px">
           <img src="${esc(p.logo_url)}" style="max-height:${52 * u}px;max-width:${180 * u}px;object-fit:contain" />
         </div>`
      : p.company
        ? `<div style="font:800 ${Math.round(24 * u)}px inherit;color:${fg};text-align:right;white-space:nowrap">${esc(truncate(p.company, 22))}</div>`
        : ""}
  </div>`;
}

/** Galéria a fő kép mellé / alá — a képszám szerint. */
function gallery(images: string[], plan: ReturnType<typeof imagePlan>, u: number, h: number, radius: number) {
  const rest = images.slice(1);
  if (!rest.length) return "";
  const gap = Math.round(12 * u);
  return `<div style="display:flex;gap:${gap}px">${rest
    .map((src) => `<div class="img" style="flex:1 1 0;height:${h}px;border-radius:${radius}px;background-image:url('${esc(src)}')"></div>`)
    .join("")}</div>`;
}

// --- 1) OVERLAY elrendezés (Modern, Erőteljes) -----------------------------
function overlayLayout(a: {
  st: FlyerStyle; pal: FlyerPalette; W: number; H: number; u: number; pad: number;
  images: string[]; plan: ReturnType<typeof imagePlan>; profile: FlyerProfileData;
  text: FlyerText; facts?: FlyerKeyFacts;
}) {
  const { st, pal, W, H, u, pad, images, plan, profile, text } = a;
  const f = a.facts ?? {};
  const hero = images[0];
  const bold = st.id === "bold";

  // 9:16-nál a felület alsó/felső sávját a social felület takarhatja → biztonsági zóna.
  const safeTop = Math.round(H * 0.06);
  const safeBottom = Math.round(H * 0.08);

  const titleSize = fitSize((text.title || "").length, 26, Math.round(66 * u * plan.textScale));
  const facts = [f.rooms, f.size, f.propertyType, f.condition].filter(Boolean) as string[];

  // Erőteljes: tömör színsáv a szövegnek. Modern: lágy sötét átmenet.
  const scrim = bold
    ? `<div style="position:absolute;left:0;right:0;bottom:0;height:${Math.round(H * 0.52)}px;background:linear-gradient(to top, ${pal.accentDeep} 0%, ${pal.accentDeep} 52%, rgba(0,0,0,0) 100%)"></div>`
    : `<div style="position:absolute;inset:0;background:linear-gradient(to top, rgba(0,0,0,.86) 0%, rgba(0,0,0,.30) 42%, rgba(0,0,0,.10) 62%, rgba(0,0,0,.42) 100%)"></div>`;

  const galleryH = Math.round(plan.count > 1 ? 150 * u : 0);

  return `
  ${hero ? `<div class="img" style="position:absolute;inset:0;background-image:url('${esc(hero)}')"></div>` : `<div style="position:absolute;inset:0;background:${pal.surface}"></div>`}
  ${scrim}
  <div style="position:absolute;left:${pad}px;right:${pad}px;top:${safeTop + pad / 2}px;z-index:5">
    ${text.subtitle ? `<div style="display:inline-flex;align-items:center;height:${Math.round(44 * u)}px;padding:0 ${18 * u}px;border-radius:${999}px;background:${bold ? "#ffffff" : pal.accent};color:${bold ? pal.accentDeep : contrastOn(pal.accent)};font:800 ${Math.round(20 * u)}px inherit;white-space:nowrap;max-width:100%;overflow:hidden">${esc(truncate(text.subtitle, TEXT_LIMITS.subtitle))}</div>` : ""}
  </div>

  <div style="position:absolute;left:${pad}px;right:${pad}px;bottom:${safeBottom}px;z-index:5;display:flex;flex-direction:column;gap:${20 * u}px">
    ${plan.count > 1 ? gallery(images, plan, u, galleryH, st.radius) : ""}
    <div style="${boxCss(2, titleSize, 1.06)}font:${st.titleWeight} ${titleSize}px inherit;color:#ffffff;${st.titleUpper ? "text-transform:uppercase;" : ""}letter-spacing:${-0.6 * u}px;text-shadow:0 ${2 * u}px ${18 * u}px rgba(0,0,0,.5)">${esc(truncate(text.title || "Eladó ingatlan", TEXT_LIMITS.title))}</div>
    ${priceBlock(text, pal, st, u, true)}
    ${chips(facts, pal, st, u, true)}
    <div style="height:1px;background:rgba(255,255,255,.32)"></div>
    ${footer(profile, pal, u, true)}
  </div>`;
}

// --- 2) PANEL elrendezés (Klasszikus, Minimál, Magazin) --------------------
function panelLayout(a: {
  st: FlyerStyle; pal: FlyerPalette; W: number; H: number; u: number; pad: number;
  images: string[]; plan: ReturnType<typeof imagePlan>; profile: FlyerProfileData;
  text: FlyerText; facts?: FlyerKeyFacts;
}) {
  const { st, pal, W, H, u, pad, images, plan, profile, text } = a;
  const f = a.facts ?? {};
  const hero = images[0];
  const magazin = st.id === "magazin";
  const minimal = st.id === "minimal";

  const heroH = Math.round(H * plan.heroShare);
  const galleryH = plan.count > 1 ? Math.round(Math.min(150, 190 / plan.count) * u) : 0;
  const titleSize = fitSize((text.title || "").length, 24, Math.round(54 * u * plan.textScale));
  const facts = [f.rooms, f.size, f.propertyType, f.condition].filter(Boolean) as string[];

  // Fejléc-sáv: Klasszikusnál és Magazinnál színes, Minimálnál csak vékony vonal.
  const header = minimal
    ? `<div style="display:flex;align-items:center;justify-content:space-between;gap:${16 * u}px;padding:0 0 ${14 * u}px;border-bottom:${Math.max(1, 2 * u)}px solid ${pal.accent}">
         <span style="font:700 ${Math.round(20 * u)}px inherit;letter-spacing:${3 * u}px;text-transform:uppercase;color:${pal.accent}">Eladó</span>
         ${profile.company ? `<span style="font:600 ${Math.round(18 * u)}px inherit;color:${pal.inkMuted};white-space:nowrap">${esc(truncate(profile.company, 26))}</span>` : ""}
       </div>`
    : `<div style="display:flex;align-items:center;justify-content:space-between;gap:${16 * u}px;height:${Math.round(58 * u)}px;padding:0 ${20 * u}px;border-radius:${st.radius}px;background:${pal.accent};color:${contrastOn(pal.accent)}">
         <span style="font:800 ${Math.round(22 * u)}px inherit;letter-spacing:${2 * u}px;text-transform:uppercase;white-space:nowrap">Eladó ingatlan</span>
         ${profile.company ? `<span style="font:700 ${Math.round(20 * u)}px inherit;white-space:nowrap;overflow:hidden">${esc(truncate(profile.company, 24))}</span>` : ""}
       </div>`;

  // A szövegtörzs: Magazinnál két hasáb, egyébként egy oszlop.
  const highlights = (text.highlights ?? []).slice(0, magazin ? 4 : 3);
  const bodyText = magazin
    ? `<div style="display:flex;gap:${24 * u}px;align-items:flex-start">
         <div style="flex:1 1 0;min-width:0">
           <div style="${boxCss(3, titleSize, 1.08)}font:${st.titleWeight} ${titleSize}px inherit;color:${pal.ink};${st.titleUpper ? "text-transform:uppercase;" : ""}">${esc(truncate(text.title || "Eladó ingatlan", TEXT_LIMITS.title))}</div>
           ${text.subtitle ? `<div style="margin-top:${8 * u}px;${boxCss(1, Math.round(22 * u))}font:600 ${Math.round(22 * u)}px inherit;color:${pal.accent}">${esc(truncate(text.subtitle, TEXT_LIMITS.subtitle))}</div>` : ""}
           ${highlights.length ? `<div style="margin-top:${14 * u}px;display:flex;flex-direction:column;gap:${8 * u}px">${highlights.map((h) => `<div style="${boxCss(1, Math.round(20 * u))}font:500 ${Math.round(20 * u)}px inherit;color:${pal.inkMuted}">• ${esc(truncate(h, TEXT_LIMITS.characteristic))}</div>`).join("")}</div>` : ""}
         </div>
         <div style="flex:0 0 ${Math.round(W * 0.32)}px;padding:${18 * u}px;border-radius:${st.radius}px;background:${pal.accentSoftBg}">
           ${priceBlock(text, pal, st, u, false)}
           <div style="margin-top:${12 * u}px;display:flex;flex-direction:column;gap:${8 * u}px">
             ${facts.slice(0, 4).map((x) => `<div style="${boxCss(1, Math.round(19 * u))}font:600 ${Math.round(19 * u)}px inherit;color:${pal.ink}">${esc(truncate(x, TEXT_LIMITS.characteristic))}</div>`).join("")}
           </div>
         </div>
       </div>`
    : `<div>
         <div style="${boxCss(2, titleSize, 1.08)}font:${st.titleWeight} ${titleSize}px inherit;color:${pal.ink};${st.titleUpper ? "text-transform:uppercase;" : ""}letter-spacing:${-0.4 * u}px">${esc(truncate(text.title || "Eladó ingatlan", TEXT_LIMITS.title))}</div>
         ${text.subtitle ? `<div style="margin-top:${8 * u}px;${boxCss(1, Math.round(24 * u))}font:600 ${Math.round(24 * u)}px inherit;color:${pal.accent}">${esc(truncate(text.subtitle, TEXT_LIMITS.subtitle))}</div>` : ""}
         <div style="margin-top:${18 * u}px;display:flex;align-items:flex-end;justify-content:space-between;gap:${20 * u}px">
           ${priceBlock(text, pal, st, u, false)}
           <div style="flex:1 1 0;min-width:0;display:flex;justify-content:flex-end">${chips(facts, pal, st, u, false)}</div>
         </div>
       </div>`;

  return `
  <div style="position:absolute;inset:0;display:flex;flex-direction:column;padding:${pad}px;gap:${18 * u}px;background:${minimal ? pal.paper : pal.surface}">
    ${header}
    ${hero
      ? `<div class="img" style="height:${heroH}px;border-radius:${st.radius}px;background-image:url('${esc(hero)}')"></div>`
      : `<div style="height:${heroH}px;border-radius:${st.radius}px;background:${pal.accentSoftBg}"></div>`}
    ${plan.count > 1 ? gallery(images, plan, u, galleryH, st.radius) : ""}
    <div style="flex:1 1 auto;min-height:0;display:flex;flex-direction:column;justify-content:center">
      ${bodyText}
    </div>
    <div style="height:1px;background:${pal.line}"></div>
    ${footer(profile, pal, u, false)}
  </div>`;
}
