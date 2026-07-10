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
  accent_color: string;
  font: string;
  theme: "light" | "dark";
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

export function buildFlyerHtml(opts: {
  format: FlyerFormat;
  profile: FlyerProfileData;
  text: FlyerText;
  images: string[];
  sections: FlyerSections;
  watermark?: boolean;
}): string {
  const { format, profile, text, images, sections, watermark } = opts;
  const accent = /^#[0-9a-fA-F]{6}$/.test(profile.accent_color) ? profile.accent_color : "#ef7a5a";
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
  .head { padding: 42px 44px 24px; }
  .title { font-size: 47px; font-weight: 800; line-height: 1.0; text-transform: uppercase; letter-spacing: -0.6px; }
  .subtitle { display: inline-block; margin-top: 14px; background: ${accent}; color: #1c1005; font-weight: 600; font-size: 17px; padding: 7px 15px; border-radius: 6px; }
  .hero-wrap { position: relative; padding: 0 40px; }
  .hero { width: 100%; height: 430px; object-fit: cover; border-radius: 16px; display: block; }
  .price { position: absolute; right: 60px; bottom: -26px; background: ${card}; border: 2px solid ${accent}; border-radius: 16px; padding: 12px 24px; box-shadow: 0 12px 30px rgba(0,0,0,.18); text-align: center; }
  .price small { display: block; font-size: 12px; color: ${muted}; letter-spacing: 1px; }
  .price .val { display: flex; align-items: baseline; justify-content: center; gap: 5px; }
  .price .num, .price .mil { font-size: 36px; font-weight: 800; color: ${accent}; line-height: 1; }
  .price .ft { font-size: 16px; font-weight: 700; color: ${ink}; }
  .body { padding: 44px 40px 20px; display: flex; flex-direction: column; gap: 22px; }
  .hl { display: flex; flex-wrap: wrap; gap: 10px; }
  .hl span { background: ${accent}22; color: ${ink}; border: 1px solid ${accent}; border-radius: 999px; padding: 7px 14px; font-size: 13px; font-weight: 600; }
  .sec-title { font-size: 15px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: ${accent}; margin-bottom: 8px; }
  ul.ch { list-style: none; columns: 2; column-gap: 28px; }
  ul.ch li { font-size: 14px; padding: 4px 0 4px 22px; position: relative; break-inside: avoid; }
  ul.ch li:before { content: "✓"; position: absolute; left: 0; color: ${accent}; font-weight: 800; }
  .gallery { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
  .gallery img { width: 100%; height: 190px; object-fit: cover; border-radius: 12px; }
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
  <div class="head">
    <div class="title">${esc(text.title || "Eladó ingatlan")}</div>
    ${text.subtitle ? `<div class="subtitle">${esc(text.subtitle)}</div>` : ""}
  </div>

  ${
    hero
      ? `<div class="hero-wrap"><img class="hero" src="${esc(hero)}"/>${
          text.price ? `<div class="price"><small>ÁRA</small><div class="val"><span class="num">${esc(priceNumber(text.price))}</span><span class="mil">M</span><span class="ft">Ft</span></div></div>` : ""
        }</div>`
      : ""
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
        ? `<div class="gallery">${gallery.slice(0, 3).map((g) => `<img src="${esc(g)}"/>`).join("")}</div>`
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
