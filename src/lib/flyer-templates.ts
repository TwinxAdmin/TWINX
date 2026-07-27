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
  fitSize, truncate, boxCss, lineCss, TEXT_LIMITS,
  type FlyerPalette, type FlyerStyle,
} from "@/lib/flyer-design";

function esc(s: string): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Betűstílus külön tulajdonságokkal (a `font` shorthand levágná a sormagasságot). */
function type(weight: number, size: number, extra = ""): string {
  return `font-weight:${weight};font-size:${size}px;${extra}`;
}

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
  const u = W / 1080;
  const pad = Math.round(48 * u);

  const layoutArgs = {
    st, pal, W, H, u, pad, images, plan,
    profile: opts.profile, text: opts.text, facts: opts.facts,
  };
  const body =
    st.id === "premium"
      ? premiumLayout(layoutArgs)
      : st.surface === "overlay"
        ? overlayLayout(layoutArgs)
        : panelLayout(layoutArgs);

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

// --- Közös építőelemek -----------------------------------------------------

function priceBlock(text: FlyerText, pal: FlyerPalette, st: FlyerStyle, u: number, onDark: boolean) {
  if (!text.price) return "";
  const { num, suffix } = priceParts(text.price);
  const size = fitSize(num.length, 5, Math.round(72 * u));
  const color = st.id === "bold" || onDark ? "#ffffff" : pal.accent;
  return `<div style="display:flex;align-items:baseline;gap:${6 * u}px;white-space:nowrap;line-height:1.2;padding-bottom:${Math.ceil(size * 0.06)}px">
    <span style="${type(900, size, "line-height:1.1;")}color:${color}">${esc(num)}</span>
    <span style="${type(800, Math.round(size * 0.36), "line-height:1.2;")}color:${color};opacity:.92">${esc(truncate(suffix, 8))}</span>
  </div>`;
}

function chips(items: string[], pal: FlyerPalette, st: FlyerStyle, u: number, onDark: boolean) {
  const list = items.filter(Boolean).slice(0, 4);
  if (!list.length) return "";
  const h = Math.round(50 * u);
  const fs = Math.round(20 * u);
  return `<div style="display:flex;flex-wrap:wrap;gap:${10 * u}px">${list
    .map((raw) => {
      const t = esc(truncate(raw, TEXT_LIMITS.highlight));
      const common = `display:inline-flex;align-items:center;height:${h}px;padding:0 ${18 * u}px;${type(700, fs, "line-height:1;")}white-space:nowrap`;
      if (st.chip === "solid") {
        const bg = onDark ? "rgba(255,255,255,.20)" : pal.accent;
        const fg = onDark ? "#ffffff" : contrastOn(pal.accent);
        return `<span style="${common};border-radius:999px;background:${bg};color:${fg}">${t}</span>`;
      }
      if (st.chip === "outline") {
        const bc = onDark ? "rgba(255,255,255,.55)" : pal.accent;
        const fg = onDark ? "#ffffff" : pal.ink;
        return `<span style="${common};border-radius:999px;border:${Math.max(1, 2 * u)}px solid ${bc};color:${fg}">${t}</span>`;
      }
      const fg = onDark ? "#ffffff" : pal.ink;
      return `<span style="${common};padding:0 ${4 * u}px;border-bottom:${Math.max(2, 3 * u)}px solid ${pal.accent};color:${fg}">${t}</span>`;
    })
    .join("")}</div>`;
}

function footer(p: FlyerProfileData, pal: FlyerPalette, u: number, onDark: boolean) {
  const fg = onDark ? "#ffffff" : pal.ink;
  const muted = onDark ? "rgba(255,255,255,.80)" : pal.inkMuted;
  const contact = [p.phone, p.email, p.website].filter(Boolean).map((x) => esc(truncate(x, 30))).join("  ·  ");
  const name = esc(truncate(p.display_name || p.company, 26));
  const nameSize = Math.round(26 * u);
  const roleSize = Math.round(18 * u);
  return `<div style="display:flex;align-items:center;justify-content:space-between;gap:${18 * u}px">
    <div style="display:flex;align-items:center;gap:${14 * u}px;min-width:0;flex:1 1 auto">
      ${p.agent_photo_url ? `<div class="img" style="width:${68 * u}px;height:${68 * u}px;border-radius:999px;background-image:url('${esc(p.agent_photo_url)}');border:${Math.max(2, 3 * u)}px solid ${pal.accent};flex:0 0 auto"></div>` : ""}
      <div style="min-width:0;flex:1 1 auto">
        <div style="${type(800, nameSize)}${lineCss(nameSize)}color:${fg}">${name}</div>
        ${p.title ? `<div style="${type(500, roleSize)}${lineCss(roleSize)}color:${muted}">${esc(truncate(p.title, 30))}</div>` : ""}
        ${contact ? `<div style="${type(600, roleSize)}${lineCss(roleSize)}color:${fg};opacity:.92;margin-top:${2 * u}px">${contact}</div>` : ""}
      </div>
    </div>
    ${p.logo_url
      ? `<div style="flex:0 0 auto;display:flex;align-items:center;justify-content:center;height:${76 * u}px;min-width:${76 * u}px;max-width:${200 * u}px;padding:${10 * u}px ${14 * u}px;background:#ffffff;border-radius:${12 * u}px">
           <img src="${esc(p.logo_url)}" style="max-height:${54 * u}px;max-width:${170 * u}px;object-fit:contain" />
         </div>`
      : p.company
        ? `<div style="${type(800, Math.round(24 * u))}${lineCss(Math.round(24 * u))}color:${fg};text-align:right;flex:0 0 auto">${esc(truncate(p.company, 22))}</div>`
        : ""}
  </div>`;
}

function gallery(images: string[], u: number, h: number, radius: number) {
  const rest = images.slice(1);
  if (!rest.length) return "";
  const gap = Math.round(12 * u);
  return `<div style="display:flex;gap:${gap}px;flex:0 0 auto">${rest
    .map((src) => `<div class="img" style="flex:1 1 0;height:${h}px;border-radius:${radius}px;background-image:url('${esc(src)}')"></div>`)
    .join("")}</div>`;
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

// --- 1) OVERLAY elrendezés (Modern, Erőteljes) -----------------------------
function overlayLayout(a: {
  st: FlyerStyle; pal: FlyerPalette; W: number; H: number; u: number; pad: number;
  images: string[]; plan: ReturnType<typeof imagePlan>; profile: FlyerProfileData;
  text: FlyerText; facts?: FlyerKeyFacts;
}) {
  const { st, pal, H, u, pad, images, plan, profile, text } = a;
  const f = a.facts ?? {};
  const hero = images[0];
  const bold = st.id === "bold";

  const safeTop = Math.round(H * 0.05);
  const safeBottom = Math.round(H * 0.05);

  const titleSize = fitSize((text.title || "").length, 26, Math.round(62 * u * plan.textScale));
  const facts = [f.rooms, f.size, f.propertyType, f.condition].filter(Boolean) as string[];
  const galleryH = plan.count > 1 ? Math.round(140 * u) : 0;

  // A szövegblokk mögé mindig kerül elég sötétítés, hogy a fehér betű olvasható legyen.
  const scrim = bold
    ? `<div style="position:absolute;left:0;right:0;bottom:0;height:${Math.round(H * 0.56)}px;background:linear-gradient(to top, ${pal.accentDeep} 0%, ${pal.accentDeep} 60%, rgba(0,0,0,0) 100%)"></div>`
    : `<div style="position:absolute;inset:0;background:linear-gradient(to top, rgba(0,0,0,.88) 0%, rgba(0,0,0,.62) 26%, rgba(0,0,0,.12) 52%, rgba(0,0,0,.45) 100%)"></div>`;

  return `
  ${hero ? `<div class="img" style="position:absolute;inset:0;background-image:url('${esc(hero)}')"></div>` : `<div style="position:absolute;inset:0;background:${pal.surface}"></div>`}
  ${scrim}
  <div style="position:absolute;left:${pad}px;right:${pad}px;top:${safeTop}px;z-index:5">
    ${text.subtitle ? `<div style="display:inline-flex;align-items:center;height:${Math.round(48 * u)}px;padding:0 ${20 * u}px;border-radius:999px;background:${bold ? "#ffffff" : pal.accent};color:${bold ? pal.accentDeep : contrastOn(pal.accent)};${type(800, Math.round(20 * u), "line-height:1;")}white-space:nowrap;max-width:100%;overflow:hidden">${esc(truncate(text.subtitle, TEXT_LIMITS.subtitle))}</div>` : ""}
  </div>

  <div style="position:absolute;left:${pad}px;right:${pad}px;bottom:${safeBottom}px;z-index:5;display:flex;flex-direction:column;gap:${18 * u}px">
    ${plan.count > 1 ? gallery(images, u, galleryH, st.radius) : ""}
    <div style="${type(st.titleWeight, titleSize, st.titleUpper ? "text-transform:uppercase;" : "")}${boxCss(2, titleSize, 1.14)}color:#ffffff;letter-spacing:${-0.4 * u}px;text-shadow:0 ${2 * u}px ${18 * u}px rgba(0,0,0,.55)">${esc(truncate(text.title || "Eladó ingatlan", TEXT_LIMITS.title))}</div>
    ${priceBlock(text, pal, st, u, true)}
    ${chips(facts, pal, st, u, true)}
    <div style="height:1px;background:rgba(255,255,255,.34)"></div>
    ${footer(profile, pal, u, true)}
  </div>`;
}

// --- 2) PANEL elrendezés (Klasszikus, Minimál, Magazin) --------------------
function panelLayout(a: {
  st: FlyerStyle; pal: FlyerPalette; W: number; H: number; u: number; pad: number;
  images: string[]; plan: ReturnType<typeof imagePlan>; profile: FlyerProfileData;
  text: FlyerText; facts?: FlyerKeyFacts;
}) {
  const { st, pal, W, u, pad, images, plan, profile, text } = a;
  const f = a.facts ?? {};
  const hero = images[0];
  const magazin = st.id === "magazin";
  const minimal = st.id === "minimal";

  // A főkép RUGALMAS: kitölti a maradék helyet, így nincs üres sáv a lapon.
  const galleryH = plan.count > 1 ? Math.round((plan.count === 2 ? 170 : plan.count === 3 ? 150 : 130) * u) : 0;
  const titleSize = fitSize((text.title || "").length, 24, Math.round(52 * u * plan.textScale));
  const facts = [f.rooms, f.size, f.propertyType, f.condition].filter(Boolean) as string[];
  const headerH = Math.round(62 * u);

  const header = minimal
    ? `<div style="display:flex;align-items:center;justify-content:space-between;gap:${16 * u}px;padding-bottom:${14 * u}px;border-bottom:${Math.max(1, 2 * u)}px solid ${pal.accent};flex:0 0 auto">
         <span style="${type(700, Math.round(20 * u))}${lineCss(Math.round(20 * u))}letter-spacing:${3 * u}px;text-transform:uppercase;color:${pal.accent}">Eladó</span>
         ${profile.company ? `<span style="${type(600, Math.round(18 * u))}${lineCss(Math.round(18 * u))}color:${pal.inkMuted}">${esc(truncate(profile.company, 26))}</span>` : ""}
       </div>`
    : `<div style="display:flex;align-items:center;justify-content:space-between;gap:${16 * u}px;height:${headerH}px;padding:0 ${20 * u}px;border-radius:${st.radius}px;background:${pal.accent};color:${contrastOn(pal.accent)};flex:0 0 auto">
         <span style="${type(800, Math.round(22 * u), "line-height:1;")}letter-spacing:${2 * u}px;text-transform:uppercase;white-space:nowrap">Eladó ingatlan</span>
         ${profile.company ? `<span style="${type(700, Math.round(20 * u), "line-height:1;")}white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:45%">${esc(truncate(profile.company, 24))}</span>` : ""}
       </div>`;

  const highlights = (text.highlights ?? []).slice(0, magazin ? 3 : 2);

  const bodyText = magazin
    ? `<div style="display:flex;gap:${24 * u}px;align-items:flex-start">
         <div style="flex:1 1 0;min-width:0">
           <div style="${type(st.titleWeight, titleSize, st.titleUpper ? "text-transform:uppercase;" : "")}${boxCss(3, titleSize, 1.16)}color:${pal.ink}">${esc(truncate(text.title || "Eladó ingatlan", TEXT_LIMITS.title))}</div>
           ${text.subtitle ? `<div style="margin-top:${8 * u}px;${type(600, Math.round(22 * u))}${boxCss(1, Math.round(22 * u), 1.35)}color:${pal.accent}">${esc(truncate(text.subtitle, TEXT_LIMITS.subtitle))}</div>` : ""}
           ${highlights.length ? `<div style="margin-top:${14 * u}px;display:flex;flex-direction:column;gap:${6 * u}px">${highlights.map((h) => `<div style="${type(500, Math.round(20 * u))}${boxCss(1, Math.round(20 * u), 1.4)}color:${pal.inkMuted}">• ${esc(truncate(h, TEXT_LIMITS.characteristic))}</div>`).join("")}</div>` : ""}
         </div>
         <div style="flex:0 0 ${Math.round(W * 0.32)}px;padding:${18 * u}px;border-radius:${st.radius}px;background:${pal.accentSoftBg}">
           ${priceBlock(text, pal, st, u, false)}
           <div style="margin-top:${10 * u}px;display:flex;flex-direction:column;gap:${6 * u}px">
             ${facts.slice(0, 4).map((x) => `<div style="${type(600, Math.round(19 * u))}${boxCss(1, Math.round(19 * u), 1.4)}color:${pal.ink}">${esc(truncate(x, TEXT_LIMITS.characteristic))}</div>`).join("")}
           </div>
         </div>
       </div>`
    : `<div>
         <div style="${type(st.titleWeight, titleSize, st.titleUpper ? "text-transform:uppercase;" : "")}${boxCss(2, titleSize, 1.16)}color:${pal.ink};letter-spacing:${-0.3 * u}px">${esc(truncate(text.title || "Eladó ingatlan", TEXT_LIMITS.title))}</div>
         ${text.subtitle ? `<div style="margin-top:${6 * u}px;${type(600, Math.round(24 * u))}${boxCss(1, Math.round(24 * u), 1.35)}color:${pal.accent}">${esc(truncate(text.subtitle, TEXT_LIMITS.subtitle))}</div>` : ""}
         <div style="margin-top:${16 * u}px;display:flex;align-items:flex-end;justify-content:space-between;gap:${20 * u}px;flex-wrap:wrap">
           ${priceBlock(text, pal, st, u, false)}
           <div style="flex:1 1 auto;min-width:0;display:flex;justify-content:flex-end">${chips(facts, pal, st, u, false)}</div>
         </div>
       </div>`;

  return `
  <div style="position:absolute;inset:0;display:flex;flex-direction:column;padding:${pad}px;gap:${16 * u}px;background:${minimal ? pal.paper : pal.surface}">
    ${header}
    ${hero
      ? `<div class="img" style="flex:1 1 auto;min-height:${Math.round(180 * u)}px;border-radius:${st.radius}px;background-image:url('${esc(hero)}')"></div>`
      : `<div style="flex:1 1 auto;border-radius:${st.radius}px;background:${pal.accentSoftBg}"></div>`}
    ${plan.count > 1 ? gallery(images, u, galleryH, st.radius) : ""}
    <div style="flex:0 0 auto">${bodyText}</div>
    <div style="height:1px;background:${pal.line};flex:0 0 auto"></div>
    <div style="flex:0 0 auto">${footer(profile, pal, u, false)}</div>
  </div>`;
}
