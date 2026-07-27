// A hirdetés HTML-je: STÍLUS × ARÁNY × KÉPSZÁM.
// A kliens (html2canvas) rendereli, ezért minden méret PIXELBEN van, és kerüljük a
// böngészőfüggő CSS-t (nincs line-clamp, backdrop-filter, grid — flex és abszolút pozíció).
//
// Grafikai elvek:
//  • Egy fő szín (az arculatból) — abból származtatott harmonikus paletta.
//  • Garantált kontraszt: minden színes felületre contrastOn() adja a betűszínt.
//  • Nincs levágott betű: SOHA nem használjuk a `font` rövidítést (az felülírná a
//    sormagasságot), és minden szövegdoboz kap ráhagyást az ékezeteknek.
//  • A képszám vezérli a ritmust: 1 kép = nagy kép + nagy adatok; 4 kép = fő kép + galéria.
import type { FlyerText } from "@/lib/flyer";
import type { FlyerProfileData, FlyerKeyFacts } from "@/lib/flyer-template";
import { getBrandingFont } from "@/lib/branding";
import {
  getFlyerStyle, getFlyerRatio, imagePlan, buildPalette, contrastOn,
  fitSize, truncate, lineCss, TEXT_LIMITS,
  type FlyerPalette, type FlyerStyle,
} from "@/lib/flyer-design";

function esc(s: string): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Betűstílus külön tulajdonságokkal (a `font` shorthand levágná a sormagasságot). */
function type(weight: number, size: number, extra = ""): string {
  return `font-weight:${weight};font-size:${size}px;${extra}`;
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
  const u = W / 1080;
  const pad = Math.round(48 * u);

  const layoutArgs = {
    st, pal, W, H, u, pad, images, plan,
    profile: opts.profile, text: opts.text, facts: opts.facts,
  };
  const body = premiumLayout(layoutArgs);

  const wm = opts.watermark
    ? `<div style="position:absolute;inset:0;z-index:90;display:flex;flex-direction:column;justify-content:space-around;align-items:center;transform:rotate(-24deg) scale(1.4);pointer-events:none">
        ${Array.from({ length: 6 }).map(() => `<span style="${type(800, Math.round(44 * u), `line-height:1.4;letter-spacing:${6 * u}px;`)}color:rgba(255,255,255,.30);text-shadow:0 2px 8px rgba(0,0,0,.35);white-space:nowrap">ELŐNÉZET · TWINX</span>`).join("")}
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

// --- 0) PRÉMIUM elrendezés (saját tervezésű sablon) ------------------------
// Szerkezet: nagy hero (logó, ELADÓ jelvény, cím, alcím, ár-doboz) → chipek →
// képsor → arculati színű ügynök-sáv. Minden méret a vászon szélességéhez skálázódik,
// a hero pedig a maradék helyet kapja, így minden arányban kitölti a lapot.
function premiumLayout(a: {
  st: FlyerStyle; pal: FlyerPalette; W: number; H: number; u: number; pad: number;
  images: string[]; plan: ReturnType<typeof imagePlan>; profile: FlyerProfileData;
  text: FlyerText; facts?: FlyerKeyFacts;
}) {
  const { pal, W, H, u, images, plan, profile, text } = a;
  const f = a.facts ?? {};
  const hero = images[0];
  const thumbs = images.slice(1);
  const onAcc = contrastOn(pal.accent);
  const side = Math.round(48 * u);

  const factList = [f.rooms, f.size, f.propertyType, f.condition].filter(Boolean) as string[];

  // Sávmagasságok (a vászon szélességéhez skálázva), a hero a maradékot kapja.
  const chipsH = factList.length ? Math.round(86 * u) : 0;
  const thumbsH = thumbs.length ? Math.round(174 * u) : 0;
  const agentH = Math.round(160 * u);
  const heroH = Math.max(Math.round(H * 0.34), H - chipsH - thumbsH - agentH);

  // Tipográfia — hosszú szövegnél automatikusan kisebb, hogy ne lógjon ki.
  const titleFs = fitSize((text.title || "").length, 28, Math.round(54 * u * plan.textScale));
  const titleH = Math.round(titleFs * 1.3 * 2 + titleFs * 0.2); // max 2 sor
  const subFs = Math.round(25 * u);
  const priceFs = fitSize((text.price || "").length, 9, Math.round(44 * u));
  const priceBoxW = Math.round(260 * u);

  const chip = (t: string) =>
    `<div style="height:${Math.round(54 * u)}px;padding:0 ${26 * u}px;border:1px solid ${pal.accent};border-radius:${Math.round(27 * u)}px;display:flex;align-items:center;${type(700, Math.round(20 * u), "line-height:1;")}letter-spacing:${1 * u}px;color:${pal.accent};white-space:nowrap;overflow:hidden;max-width:${Math.round(234 * u)}px;margin-right:${16 * u}px">${esc(truncate(t, TEXT_LIMITS.highlight))}</div>`;

  const contact = [profile.phone, profile.email, profile.website].filter(Boolean).map((x) => esc(truncate(x, 28))).join(" · ");

  return `
  <div style="position:absolute;inset:0;display:flex;flex-direction:column;background:${pal.paper}">
    <!-- HERO -->
    <div class="img" style="position:relative;width:${W}px;height:${heroH}px;${hero ? `background-image:url('${esc(hero)}')` : `background:${pal.surface}`}">
      <div style="position:absolute;top:0;left:0;right:0;height:${Math.round(110 * u)}px;background:linear-gradient(to bottom, rgba(18,15,10,0.55) 0%, rgba(18,15,10,0) 100%)"></div>
      <div style="position:absolute;left:0;right:0;bottom:0;height:${Math.round(heroH * 0.62)}px;background:linear-gradient(to top, rgba(18,15,10,0.92) 0%, rgba(18,15,10,0.52) 55%, rgba(18,15,10,0) 100%)"></div>

      ${profile.logo_url
        ? `<div style="position:absolute;top:${30 * u}px;left:${side}px;width:${190 * u}px;height:${56 * u}px;display:flex;align-items:center">
             <img src="${esc(profile.logo_url)}" alt="" style="width:${190 * u}px;height:${56 * u}px;object-fit:contain;object-position:left center" />
           </div>`
        : profile.company
          ? `<div style="position:absolute;top:${34 * u}px;left:${side}px;${type(800, Math.round(24 * u))}${lineCss(Math.round(24 * u))}color:#ffffff;max-width:${420 * u}px">${esc(truncate(profile.company, 24))}</div>`
          : ""}

      <div style="position:absolute;top:${36 * u}px;right:${side}px;height:${42 * u}px;padding:0 ${20 * u}px;border:1px solid rgba(255,255,255,0.45);border-radius:${21 * u}px;display:flex;align-items:center;${type(600, Math.round(13 * u), "line-height:1;")}letter-spacing:${2 * u}px;color:rgba(255,255,255,0.9)">ELADÓ</div>

      <div style="position:absolute;left:${side}px;right:${text.price ? Math.round(340 * u) : side}px;bottom:${40 * u}px">
        <div style="${type(700, Math.round(14 * u))}${lineCss(Math.round(14 * u))}letter-spacing:${5 * u}px;color:rgba(255,255,255,0.85);margin-bottom:${12 * u}px">EXKLUZÍV AJÁNLAT</div>
        <div style="${type(300, titleFs)}line-height:1.3;color:#ffffff;height:${titleH}px;overflow:hidden;padding-bottom:${Math.ceil(titleFs * 0.1)}px;display:flex;flex-direction:column;justify-content:flex-end">${esc(truncate(text.title || "Eladó ingatlan", TEXT_LIMITS.title))}</div>
        ${text.subtitle ? `<div style="${type(400, subFs)}${lineCss(subFs)}color:rgba(255,255,255,0.88);margin-top:${8 * u}px">${esc(truncate(text.subtitle, TEXT_LIMITS.subtitle))}</div>` : ""}
      </div>

      ${text.price
        ? `<div style="position:absolute;right:${side}px;bottom:${40 * u}px;width:${priceBoxW}px;background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.35);border-radius:${6 * u}px;padding:${16 * u}px ${24 * u}px ${18 * u}px">
             <div style="${type(600, Math.round(12 * u))}${lineCss(Math.round(12 * u))}letter-spacing:${3 * u}px;color:rgba(255,255,255,0.72)">IRÁNYÁR</div>
             <div style="${type(300, priceFs)}line-height:1.25;color:#ffffff;white-space:nowrap;overflow:hidden;padding-bottom:${Math.ceil(priceFs * 0.08)}px;margin-top:${2 * u}px">${esc(truncate(text.price, TEXT_LIMITS.price))}</div>
           </div>`
        : ""}
    </div>

    <!-- CHIPEK -->
    ${factList.length
      ? `<div style="display:flex;width:${W}px;height:${chipsH}px;padding:${32 * u}px ${side}px 0;flex:0 0 auto">${factList.slice(0, 4).map(chip).join("")}</div>`
      : ""}

    <!-- KÉPSOR -->
    ${thumbs.length
      ? `<div style="display:flex;gap:${24 * u}px;width:${W}px;height:${thumbsH}px;padding:${24 * u}px ${side}px 0;flex:0 0 auto">
           ${thumbs.map((src) => `<div class="img" style="flex:1 1 0;height:${150 * u}px;border-radius:${6 * u}px;background-image:url('${esc(src)}');border:1px solid rgba(0,0,0,0.1)"></div>`).join("")}
         </div>`
      : ""}

    <!-- ÜGYNÖK SÁV -->
    <div style="margin-top:auto;height:${agentH}px;background:${pal.accent};display:flex;align-items:center;padding:0 ${side}px;flex:0 0 auto">
      ${profile.agent_photo_url
        ? `<div class="img" style="width:${100 * u}px;height:${100 * u}px;border-radius:999px;background-image:url('${esc(profile.agent_photo_url)}');border:2px solid ${onAcc};flex:0 0 auto"></div>`
        : ""}
      <div style="margin-left:${profile.agent_photo_url ? 24 * u : 0}px;flex:1 1 auto;min-width:0;overflow:hidden">
        <div style="${type(800, Math.round(28 * u))}${lineCss(Math.round(28 * u))}color:${onAcc}">${esc(truncate(profile.display_name || profile.company, 26))}</div>
        ${profile.title ? `<div style="${type(500, Math.round(19 * u))}${lineCss(Math.round(19 * u))}color:${onAcc};opacity:.82">${esc(truncate(profile.title, 30))}</div>` : ""}
        ${contact ? `<div style="${type(700, Math.round(21 * u))}${lineCss(Math.round(21 * u))}color:${onAcc};margin-top:${2 * u}px">${contact}</div>` : ""}
      </div>
      <div style="height:${58 * u}px;padding:0 ${32 * u}px;margin-left:${24 * u}px;background:${pal.paper};border-radius:${29 * u}px;display:flex;align-items:center;${type(700, Math.round(17 * u), "line-height:1;")}letter-spacing:${2 * u}px;color:${pal.ink};white-space:nowrap;flex:0 0 auto">MEGTEKINTÉS</div>
    </div>
  </div>`;
}
