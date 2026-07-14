// Hirdetés HTML sablon — egy erős, portré elrendezés (a mintához hasonló).
// Testreszabható: akcentszín, betűtípus, világos/sötét téma, szekciók ki/be, méret.
// A HTML-t a flyer-render.ts rendereli PDF/PNG-be (puppeteer).
import type { FlyerFormat, FlyerText } from "@/lib/flyer";

export type FlyerProfileData = {
  display_name: string;
  title: string;
  phone: string;
  email: string;
  company: string;
  website: string;
  slogan: string;
  logo_url: string | null;
  agent_photo_url: string | null;
  accent_color: string;
  font: string;
  theme: "light" | "dark";
};

// Strukturált alapadatok az ikonos oszlophoz (Keys elrendezés).
export type FlyerKeyFacts = {
  rooms?: string;
  size?: string;
  propertyType?: string;
  condition?: string;
};

export type FlyerSections = {
  highlights: boolean;
  characteristics: boolean;
  gallery: boolean;
  infra: boolean;
  transport: boolean;
};

const FONT_MAP: Record<string, { family: string; link: string }> = {
  inter: { family: "'Inter', sans-serif", link: "https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap" },
  montserrat: { family: "'Montserrat', sans-serif", link: "https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;800&display=swap" },
  playfair: { family: "'Playfair Display', serif", link: "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;700&family=Inter:wght@400;600&display=swap" },
  poppins: { family: "'Poppins', sans-serif", link: "https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;800&display=swap" },
  clash: { family: "'Clash Display', sans-serif", link: "https://api.fontshare.com/v2/css?f[]=clash-display@500,600,700&display=swap" },
};

function esc(s: string): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Az árból csak a számot vesszük ki (a "M" és "Ft" a sablonból jön automatikusan).
function priceNumber(raw: string): string {
  const m = String(raw ?? "").match(/\d+([.,]\d+)?/);
  return m ? m[0] : String(raw ?? "").trim();
}

// Olvasható szövegszín egy háttérszínre (sötét háttéren fehér, világoson sötét).
function contrastText(hex: string): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  return lum > 150 ? "#1c1005" : "#ffffff";
}

export function buildFlyerHtml(opts: {
  format: FlyerFormat;
  profile: FlyerProfileData;
  text: FlyerText;
  images: string[];
  sections: FlyerSections;
  layout?: string;
  watermark?: boolean;
  facts?: FlyerKeyFacts;
}): string {
  const { format, profile, text, images, sections, watermark } = opts;
  const facts = opts.facts ?? {};
  const isOverlay = opts.layout === "overlay";
  const accent = /^#[0-9a-fA-F]{6}$/.test(profile.accent_color) ? profile.accent_color : "#ef7a5a";
  const onAccent = contrastText(accent); // olvasható szöveg az accent dobozokon
  const font = FONT_MAP[profile.font] ?? FONT_MAP.inter;
  const dark = profile.theme === "dark";

  const bg = dark ? "#12100e" : "#f7f3ec";
  const card = dark ? "#1c1815" : "#ffffff";
  const ink = dark ? "#f4efe7" : "#1c1815";
  const muted = dark ? "#a79f94" : "#6e655c";
  const line = dark ? "rgba(255,255,255,0.10)" : "#e8e1d6";

  const hero = images[0];
  const gallery = images.slice(1);

  const contact = [
    profile.phone && `<span>${esc(profile.phone)}</span>`,
    profile.email && `<span>${esc(profile.email)}</span>`,
    profile.website && `<span>${esc(profile.website)}</span>`,
  ]
    .filter(Boolean)
    .join('<span style="opacity:.4"> · </span>');

  // ---- FRAME (social) elrendezés: négyzet / story — teljes képet kitöltő poszter ----
  if (format.mode === "frame") {
    const w = format.width;
    const h = format.height;
    const isStory = h / w > 1.4;
    const pad = Math.round(w * 0.055);
    const titleSize = isStory ? 58 : 46;
    const priceSize = isStory ? 68 : 56;
    return `<!doctype html><html lang="hu"><head><meta charset="utf-8">
<link rel="stylesheet" href="${font.link}">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: ${w}px; height: ${h}px; }
  .flyer { position: relative; width: ${w}px; height: ${h}px; overflow: hidden; font-family: ${font.family}; color: #fff; background: #111; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .fh { position: absolute; inset: 0; background-size: cover; background-position: center; background-repeat: no-repeat; }
  .grad { position: absolute; inset: 0; background: linear-gradient(to bottom, rgba(0,0,0,.55) 0%, rgba(0,0,0,0) 24%, rgba(0,0,0,0) 40%, rgba(0,0,0,.86) 100%); }
  .fgal { display: grid; grid-template-columns: repeat(${Math.min(3, Math.max(1, gallery.length))}, 1fr); gap: 8px; }
  .fgi { height: ${isStory ? 150 : 92}px; border-radius: 12px; background-size: cover; background-position: center; background-repeat: no-repeat; border: 1px solid rgba(255,255,255,.35); }
  .fcontent { position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: space-between; padding: ${pad}px; z-index: 3; }
  .ftitle { font-size: ${titleSize}px; font-weight: 800; text-transform: uppercase; line-height: 1.02; letter-spacing: -0.5px; text-shadow: 0 2px 20px rgba(0,0,0,.55); max-width: 92%; }
  .fsub { display: inline-flex; align-items: center; height: 36px; margin-top: 14px; background: ${accent}; color: ${onAccent}; font-weight: 700; font-size: 18px; padding: 0 16px; border-radius: 8px; }
  .fbot { display: flex; flex-direction: column; gap: 18px; }
  .fprice { display: inline-flex; align-items: baseline; gap: 5px; }
  .fprice .lab { font-size: 14px; letter-spacing: 2px; opacity: .85; margin-right: 4px; align-self: center; }
  .fprice .num, .fprice .mil { font-size: ${priceSize}px; font-weight: 800; color: ${accent}; line-height: 1; }
  .fprice .ft { font-size: 22px; font-weight: 700; }
  .fhl { display: flex; flex-wrap: wrap; gap: 8px; }
  .fhl span { display: inline-flex; align-items: center; height: 34px; background: rgba(255,255,255,.16); border: 1px solid rgba(255,255,255,.45); border-radius: 999px; padding: 0 16px; font-size: 14px; font-weight: 600; }
  .ffoot { display: flex; align-items: center; justify-content: space-between; gap: 16px; border-top: 1px solid rgba(255,255,255,.28); padding-top: 16px; }
  .ffoot .who b { font-size: 20px; display: block; }
  .ffoot .who .role { font-size: 13px; opacity: .85; }
  .ffoot .who .contact { font-size: 13px; opacity: .92; margin-top: 3px; }
  .ffoot .brand { text-align: right; }
  .ffoot .brand img { max-height: 48px; max-width: 160px; object-fit: contain; }
  .ffoot .brand .company { font-size: 15px; font-weight: 700; }
  .wm { position: absolute; inset: 0; z-index: 50; display: flex; flex-direction: column; justify-content: space-around; align-items: center; transform: rotate(-24deg) scale(1.5); pointer-events: none; }
  .wm span { font-size: 46px; font-weight: 800; letter-spacing: 6px; white-space: nowrap; color: rgba(255,255,255,0.22); }
</style></head><body>
<div class="flyer">
  ${hero ? `<div class="fh" style="background-image:url('${esc(hero)}')"></div>` : `<div class="fh" style="background:${bg}"></div>`}
  <div class="grad"></div>
  ${watermark ? `<div class="wm">${Array.from({ length: 6 }).map(() => `<span>ELŐNÉZET · TWINX</span>`).join("")}</div>` : ""}
  <div class="fcontent">
    <div class="ftop">
      <div class="ftitle">${esc(text.title || "Eladó ingatlan")}</div>
      ${text.subtitle ? `<div class="fsub">${esc(text.subtitle)}</div>` : ""}
    </div>
    <div class="fbot">
      ${sections.gallery && gallery.length ? `<div class="fgal">${gallery.slice(0, 3).map((g) => `<div class="fgi" style="background-image:url('${esc(g)}')"></div>`).join("")}</div>` : ""}
      ${text.price ? `<div class="fprice"><span class="lab">ÁRA</span><span class="num">${esc(priceNumber(text.price))}</span><span class="mil">M</span><span class="ft">Ft</span></div>` : ""}
      ${sections.highlights && text.highlights.length ? `<div class="fhl">${text.highlights.slice(0, 4).map((hl) => `<span>${esc(hl)}</span>`).join("")}</div>` : ""}
      <div class="ffoot">
        <div class="who"><b>${esc(profile.display_name)}</b>${profile.title ? `<div class="role">${esc(profile.title)}</div>` : ""}${contact ? `<div class="contact">${contact}</div>` : ""}</div>
        <div class="brand">${profile.logo_url ? `<img src="${esc(profile.logo_url)}"/>` : profile.company ? `<div class="company">${esc(profile.company)}</div>` : ""}</div>
      </div>
    </div>
  </div>
</div>
</body></html>`;
  }

  // ---- KEYS elrendezés (a "The Keys" referencia szerint, magyarul) ----
  if (opts.layout === "keys") {
    const w = format.width;
    const k = w / 900;
    const px = (n: number) => Math.round(n * k);
    const price = text.price ? priceNumber(text.price) : "";
    const gal3 = gallery.slice(0, 3);
    const icoBed = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6"/><path d="M3 18h18"/><path d="M7 10V7h6v3"/></svg>`;
    const icoArea = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="1"/><path d="M4 9h4M4 15h4M9 4v4M15 4v4"/></svg>`;
    const icoHome = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/></svg>`;
    const icoCheck = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>`;
    const rows: Array<[string, string]> = [];
    if (facts.rooms) rows.push([icoBed, `${facts.rooms} szoba`]);
    if (facts.size) rows.push([icoArea, facts.size]);
    if (facts.propertyType) rows.push([icoHome, facts.propertyType]);
    if (facts.condition) rows.push([icoCheck, facts.condition]);
    return `<!doctype html><html lang="hu"><head><meta charset="utf-8">
<link rel="stylesheet" href="${font.link}">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: ${w}px; }
  .flyer { position: relative; width: ${w}px; background: ${bg}; color: ${ink}; font-family: ${font.family}; padding: ${px(14)}px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .frame { border: ${px(6)}px solid ${accent}; padding: ${px(22)}px; display: flex; flex-direction: column; gap: ${px(18)}px; }
  .k-head { display: flex; align-items: stretch; justify-content: space-between; gap: ${px(16)}px; }
  .k-price { display: flex; flex-direction: column; justify-content: center; }
  .k-price .lab { font-size: ${px(15)}px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: ${muted}; }
  .k-price .val { font-size: ${px(50)}px; font-weight: 800; color: ${accent}; line-height: 1.05; }
  .k-price .val small { font-size: ${px(22)}px; }
  .k-logo { display: flex; align-items: center; justify-content: flex-end; min-width: ${px(160)}px; }
  .k-logo img { max-height: ${px(96)}px; max-width: ${px(220)}px; object-fit: contain; }
  .k-logo .co { font-size: ${px(24)}px; font-weight: 800; text-align: right; line-height: 1.15; color: ${accent}; }
  .k-top { }
  .k-title { font-size: ${px(34)}px; font-weight: 800; text-transform: uppercase; letter-spacing: -0.5px; line-height: 1.05; }
  .k-loc { display: block; margin-top: ${px(6)}px; color: ${accent}; font-weight: 700; font-size: ${px(16)}px; }
  .k-hero { width: 100%; height: ${px(420)}px; background-size: cover; background-position: center; }
  .k-gal { display: grid; grid-template-columns: repeat(${Math.max(1, gal3.length)}, 1fr); gap: ${px(12)}px; }
  .k-gi { height: ${px(155)}px; background-size: cover; background-position: center; border: 1px solid ${line}; }
  .k-cols { display: grid; grid-template-columns: 1fr ${px(2)}px 1.05fr ${px(2)}px 0.9fr; gap: ${px(20)}px; align-items: start; }
  .k-div { background: ${accent}; align-self: stretch; }
  .row { display: flex; align-items: center; gap: ${px(12)}px; margin-bottom: ${px(14)}px; }
  .row .ic { width: ${px(30)}px; height: ${px(30)}px; color: ${accent}; flex: none; }
  .row .ic svg { width: 100%; height: 100%; display: block; }
  .row .tx { font-size: ${px(15)}px; font-weight: 600; }
  .more div { font-size: ${px(13)}px; color: ${muted}; margin-top: ${px(4)}px; }
  .k-desc .lbl { font-size: ${px(13)}px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: ${accent}; margin-top: ${px(6)}px; }
  .k-desc p { font-size: ${px(14)}px; line-height: 1.55; margin-top: ${px(3)}px; }
  .k-agent { display: flex; flex-direction: column; align-items: center; text-align: center; }
  .k-agent .ph { width: ${px(150)}px; height: ${px(150)}px; border-radius: 50%; background-size: cover; background-position: center; border: ${px(4)}px solid ${accent}; }
  .k-agent .nm { margin-top: ${px(12)}px; background: ${accent}; color: ${onAccent}; font-weight: 800; font-size: ${px(18)}px; letter-spacing: .5px; text-transform: uppercase; padding: 0 ${px(16)}px; border-radius: ${px(4)}px; height: ${px(34)}px; display: inline-flex; align-items: center; justify-content: center; line-height: 1; }
  .k-agent .ct { margin-top: ${px(10)}px; font-size: ${px(14)}px; line-height: 1.5; }
  .k-foot { background: ${accent}; color: ${onAccent}; text-align: center; font-size: ${px(16)}px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; padding: ${px(12)}px; }
  .wm { position: absolute; inset: 0; z-index: 50; display: flex; flex-direction: column; justify-content: space-around; align-items: center; transform: rotate(-24deg) scale(1.5); pointer-events: none; }
  .wm span { font-size: ${px(46)}px; font-weight: 800; letter-spacing: 6px; white-space: nowrap; color: ${dark ? "rgba(255,255,255,0.16)" : "rgba(28,24,21,0.13)"}; }
</style></head><body>
<div class="flyer">
  <div class="frame">
    <div class="k-top">
      <div class="k-title">${esc(text.title || "Eladó ingatlan")}</div>
      ${text.subtitle ? `<div class="k-loc">${esc(text.subtitle)}</div>` : ""}
    </div>
    <div class="k-head">
      <div class="k-price">
        ${price ? `<div class="lab">Kiinduló ár</div><div class="val">${esc(price)}<small> M Ft</small></div>` : ""}
      </div>
      <div class="k-logo">${profile.logo_url ? `<img src="${esc(profile.logo_url)}"/>` : `<div class="co">${esc(profile.company || profile.display_name)}</div>`}</div>
    </div>
    ${hero ? `<div class="k-hero" style="background-image:url('${esc(hero)}')"></div>` : ""}
    ${sections.gallery && gal3.length ? `<div class="k-gal">${gal3.map((g) => `<div class="k-gi" style="background-image:url('${esc(g)}')"></div>`).join("")}</div>` : ""}
    <div class="k-cols">
      <div class="k-facts">
        ${rows.map(([ic, tx]) => `<div class="row"><span class="ic">${ic}</span><span class="tx">${esc(tx)}</span></div>`).join("")}
        ${sections.characteristics && text.characteristics.length ? `<div class="more">${text.characteristics.slice(0, 4).map((c) => `<div>• ${esc(c)}</div>`).join("")}</div>` : ""}
      </div>
      <div class="k-div"></div>
      <div class="k-desc">
        ${sections.infra && text.infra ? `<div class="lbl">Infrastruktúra</div><p>${esc(text.infra)}</p>` : ""}
        ${sections.transport && text.transport ? `<div class="lbl">Közlekedés</div><p>${esc(text.transport)}</p>` : ""}
        ${!(text.infra || text.transport) && text.subtitle ? `<p>${esc(text.subtitle)}</p>` : ""}
      </div>
      <div class="k-div"></div>
      <div class="k-agent">
        ${profile.agent_photo_url ? `<div class="ph" style="background-image:url('${esc(profile.agent_photo_url)}')"></div>` : ""}
        <div class="nm">${esc(profile.display_name)}</div>
        <div class="ct">${profile.email ? esc(profile.email) : ""}${profile.email && profile.phone ? "<br>" : ""}${profile.phone ? esc(profile.phone) : ""}</div>
      </div>
    </div>
    <div class="k-foot">${esc(profile.website || "www.twinx.hu")}</div>
  </div>
  ${watermark ? `<div class="wm">${Array.from({ length: 6 }).map(() => `<span>ELŐNÉZET · TWINX</span>`).join("")}</div>` : ""}
</div>
</body></html>`;
  }

  return `<!doctype html><html lang="hu"><head><meta charset="utf-8">
<link rel="stylesheet" href="${font.link}">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: ${format.width}px; height: ${format.height}px; background: ${bg}; overflow: hidden; }
  .flyer {
    position: relative;
    width: ${format.width}px; min-height: ${format.height}px;
    background: ${bg}; color: ${ink};
    font-family: ${font.family};
    display: flex; flex-direction: column; overflow: hidden;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .wm { position: absolute; inset: 0; z-index: 50; display: flex; flex-direction: column; justify-content: space-around; align-items: center; transform: rotate(-24deg) scale(1.5); pointer-events: none; }
  .wm span { font-size: 48px; font-weight: 800; letter-spacing: 6px; white-space: nowrap; color: ${dark ? "rgba(255,255,255,0.16)" : "rgba(28,24,21,0.13)"}; }
  .head { padding: 36px 44px 20px; }
  .title { font-size: 42px; font-weight: 800; line-height: 1.02; text-transform: uppercase; letter-spacing: -0.6px; }
  .subtitle { display: inline-flex; align-items: center; height: 30px; margin-top: 12px; background: ${accent}; color: ${onAccent}; font-weight: 600; font-size: 16px; padding: 0 15px; border-radius: 6px; line-height: 1; }
  .hero-wrap { position: relative; padding: 0 40px; }
  .hero { width: 100%; height: 360px; background-size: cover; background-position: center; background-repeat: no-repeat; border-radius: 16px; }
  .price { position: absolute; right: 60px; bottom: -24px; background: ${card}; border: 2px solid ${accent}; border-radius: 16px; padding: 12px 26px; box-shadow: 0 12px 30px rgba(0,0,0,.18); display: flex; flex-direction: column; align-items: center; justify-content: center; min-width: 128px; }
  .price small { font-size: 12px; color: ${muted}; letter-spacing: 1.5px; line-height: 1; }
  .price .val { display: flex; width: 100%; align-items: baseline; justify-content: center; gap: 4px; margin-top: 5px; }
  .price .num, .price .mil { font-size: 36px; font-weight: 800; color: ${accent}; line-height: 1; }
  .price .ft { font-size: 16px; font-weight: 700; color: ${ink}; }
  /* Overlay elrendezés — címes fő kép */
  .hero-overlay { position: relative; }
  .hero-full { width: 100%; height: 520px; background-size: cover; background-position: center; background-repeat: no-repeat; }
  .hero-cap { position: absolute; left: 0; right: 0; bottom: 0; padding: 40px; background: linear-gradient(to top, rgba(0,0,0,.78), rgba(0,0,0,0)); }
  .title-o { font-size: 46px; font-weight: 800; text-transform: uppercase; line-height: 1.0; color: #fff; }
  .subtitle-o { display: inline-flex; align-items: center; height: 30px; margin-top: 12px; background: ${accent}; color: ${onAccent}; font-weight: 600; font-size: 16px; padding: 0 15px; border-radius: 6px; line-height: 1; }
  .price-o { position: absolute; right: 40px; top: 40px; background: ${card}; border: 2px solid ${accent}; border-radius: 16px; padding: 10px 22px; display: flex; flex-direction: column; align-items: center; justify-content: center; min-width: 118px; }
  .price-o small { font-size: 11px; color: ${muted}; letter-spacing: 1px; line-height: 1; }
  .price-o .val { display: flex; width: 100%; align-items: baseline; justify-content: center; gap: 5px; margin-top: 5px; }
  .price-o .num, .price-o .mil { font-size: 32px; font-weight: 800; color: ${accent}; line-height: 1; }
  .price-o .ft { font-size: 14px; font-weight: 700; color: ${ink}; }
  .body { padding: ${isOverlay ? "30px 40px 18px" : "40px 40px 18px"}; display: flex; flex-direction: column; gap: 18px; }
  .hl { display: flex; flex-wrap: wrap; gap: 10px; }
  .hl span { display: inline-flex; align-items: center; justify-content: center; height: 30px; background: ${accent}22; color: ${ink}; border: 1px solid ${accent}; border-radius: 999px; padding: 0 16px; font-size: 13px; font-weight: 600; line-height: 1; }
  .sec-title { font-size: 14px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: ${accent}; margin-bottom: 8px; }
  ul.ch { list-style: none; columns: 2; column-gap: 28px; }
  ul.ch li { font-size: 13.5px; padding: 3px 0 3px 22px; position: relative; break-inside: avoid; }
  ul.ch li:before { content: "✓"; position: absolute; left: 0; color: ${accent}; font-weight: 800; }
  .gallery { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
  .gallery .gi { width: 100%; height: 155px; background-size: cover; background-position: center; background-repeat: no-repeat; border-radius: 12px; }
  .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
  .cols p { font-size: 13.5px; color: ${ink}; line-height: 1.5; }
  .foot { margin-top: auto; background: ${dark ? "#0c0b0a" : "#12100e"}; color: #f4efe7; padding: 22px 40px; display: flex; align-items: center; justify-content: space-between; gap: 20px; }
  .foot .who b { font-size: 20px; }
  .foot .who .role { color: #a79f94; font-size: 13px; }
  .foot .who .contact { margin-top: 6px; font-size: 13px; color: #d8d1c6; }
  .foot .who .slogan { margin-top: 6px; font-size: 12px; color: ${accent}; }
  .foot .brand { text-align: right; }
  .foot .brand img { max-height: 54px; max-width: 180px; object-fit: contain; }
  .foot .brand .company { font-size: 15px; font-weight: 700; }
</style></head><body>
<div class="flyer">
  ${watermark ? `<div class="wm">${Array.from({ length: 6 }).map(() => `<span>ELŐNÉZET · TWINX</span>`).join("")}</div>` : ""}
  ${
    isOverlay && hero
      ? `<div class="hero-overlay">
          <div class="hero-full" style="background-image:url('${esc(hero)}')"></div>
          ${text.price ? `<div class="price-o"><small>ÁRA</small><div class="val"><span class="num">${esc(priceNumber(text.price))}</span><span class="mil">M</span><span class="ft">Ft</span></div></div>` : ""}
          <div class="hero-cap">
            <div class="title-o">${esc(text.title || "Eladó ingatlan")}</div>
            ${text.subtitle ? `<div class="subtitle-o">${esc(text.subtitle)}</div>` : ""}
          </div>
        </div>`
      : `<div class="head">
          <div class="title">${esc(text.title || "Eladó ingatlan")}</div>
          ${text.subtitle ? `<div class="subtitle">${esc(text.subtitle)}</div>` : ""}
        </div>
        ${
          hero
            ? `<div class="hero-wrap"><div class="hero" style="background-image:url('${esc(hero)}')"></div>${
                text.price ? `<div class="price"><small>ÁRA</small><div class="val"><span class="num">${esc(priceNumber(text.price))}</span><span class="mil">M</span><span class="ft">Ft</span></div></div>` : ""
              }</div>`
            : ""
        }`
  }

  <div class="body">
    ${
      sections.highlights && text.highlights.length
        ? `<div class="hl">${text.highlights.map((h) => `<span>${esc(h)}</span>`).join("")}</div>`
        : ""
    }
    ${
      sections.characteristics && text.characteristics.length
        ? `<div><div class="sec-title">Az ingatlan jellemzői</div><ul class="ch">${text.characteristics
            .map((c) => `<li>${esc(c)}</li>`)
            .join("")}</ul></div>`
        : ""
    }
    ${
      sections.gallery && gallery.length
        ? `<div class="gallery">${gallery.slice(0, 3).map((g) => `<div class="gi" style="background-image:url('${esc(g)}')"></div>`).join("")}</div>`
        : ""
    }
    ${
      (sections.infra && text.infra) || (sections.transport && text.transport)
        ? `<div class="cols">${sections.infra && text.infra ? `<div><div class="sec-title">Infrastruktúra</div><p>${esc(text.infra)}</p></div>` : ""}${sections.transport && text.transport ? `<div><div class="sec-title">Közlekedés</div><p>${esc(text.transport)}</p></div>` : ""}</div>`
        : ""
    }
  </div>

  <div class="foot">
    <div class="who">
      <b>${esc(profile.display_name)}</b>
      ${profile.title ? `<div class="role">${esc(profile.title)}</div>` : ""}
      ${contact ? `<div class="contact">${contact}</div>` : ""}
      ${profile.slogan ? `<div class="slogan">${esc(profile.slogan)}</div>` : ""}
    </div>
    <div class="brand">
      ${profile.logo_url ? `<img src="${esc(profile.logo_url)}"/>` : profile.company ? `<div class="company">${esc(profile.company)}</div>` : ""}
      ${profile.logo_url && profile.company ? `<div class="company" style="margin-top:6px">${esc(profile.company)}</div>` : ""}
    </div>
  </div>
</div>
</body></html>`;
}
