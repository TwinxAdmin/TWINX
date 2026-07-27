// A hirdetés szövegrétege: az AI-háttérre ÉLESEN ráírt feliratok.
// A szöveget mi rendereljük (nem az AI), így a magyar ékezetek, a telefonszám és az
// e-mail cím mindig hibátlanok. A betűszínt és az alátámasztó sávot a háttér mért
// világossága/zajossága határozza meg (flyer-zones.ts).
import { getBrandingFont } from "@/lib/branding";
import { ZONES, type ZoneReading } from "@/lib/flyer-zones";
import type { FlyerProfileData } from "@/lib/flyer-template";

function esc(s: string): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function truncate(s: string, max: number): string {
  const t = String(s ?? "").trim();
  return t.length <= max ? t : t.slice(0, Math.max(0, max - 1)).trimEnd() + "…";
}
/** Betűstílus külön tulajdonságokkal — a `font` rövidítés levágná a sormagasságot. */
function type(weight: number, size: number, extra = ""): string {
  return `font-weight:${weight};font-size:${size}px;${extra}`;
}
/** Olvasható szöveg egy háttérszínen. */
function onColor(hex: string): string {
  const h = (hex || "#000000").replace("#", "");
  const r = parseInt(h.slice(0, 2), 16) || 0;
  const g = parseInt(h.slice(2, 4), 16) || 0;
  const b = parseInt(h.slice(4, 6), 16) || 0;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? "#16120e" : "#ffffff";
}
function rgba(hex: string, a: number): string {
  const h = (hex || "#000000").replace("#", "");
  return `rgba(${parseInt(h.slice(0, 2), 16) || 0}, ${parseInt(h.slice(2, 4), 16) || 0}, ${parseInt(h.slice(4, 6), 16) || 0}, ${a})`;
}

export type OverlayText = {
  title: string;
  subtitle: string;
  price: string;
  chips: string[];
};

export type OverlayOpts = {
  bgUrl: string;
  width: number;
  height: number;
  profile: FlyerProfileData;
  text: OverlayText;
  readings: { header: ZoneReading; price: ZoneReading; facts: ZoneReading };
  watermark?: boolean;
};

export function buildOverlayHtml(o: OverlayOpts): string {
  const { width: W, height: H, profile, text, readings } = o;
  const u = W / 1080;
  const font = getBrandingFont(profile.font);
  const accent = /^#[0-9a-fA-F]{6}$/.test(profile.accent_color) ? profile.accent_color : "#ef7a5a";
  const onAcc = onColor(accent);

  // --- Fejléc (cím + alcím) ---
  const hz = ZONES.header;
  const hr = readings.header;
  const titleLen = (text.title || "").length;
  const titleFs = Math.round((titleLen > 34 ? 44 : titleLen > 24 ? 52 : 60) * u);
  const headerPlate = hr.needsPlate
    ? `background:${rgba(accent, 0.94)};padding:${18 * u}px ${26 * u}px;border-radius:${8 * u}px;`
    : "";
  const headerInk = hr.needsPlate ? onAcc : hr.ink;
  const headerShadow = hr.needsPlate ? "" : `text-shadow:0 ${2 * u}px ${14 * u}px rgba(0,0,0,.55);`;

  // --- Ár ---
  const pr = readings.price;
  const priceFs = Math.round(((text.price || "").length > 12 ? 30 : 38) * u);
  const priceInk = pr.needsPlate ? onAcc : pr.ink;

  // --- Adat-chipek ---
  const fr = readings.facts;
  const chipBg = fr.needsPlate ? rgba(accent, 0.94) : "rgba(255,255,255,0.92)";
  const chipInk = fr.needsPlate ? onAcc : "#16120e";

  const contact = [profile.phone, profile.email, profile.website].filter(Boolean)
    .map((x) => esc(truncate(x, 30))).join("  ·  ");

  const wm = o.watermark
    ? `<div style="position:absolute;inset:0;z-index:90;display:flex;flex-direction:column;justify-content:space-around;align-items:center;transform:rotate(-24deg) scale(1.4);pointer-events:none">
        ${Array.from({ length: 6 }).map(() => `<span style="${type(800, Math.round(44 * u), `line-height:1.4;letter-spacing:${6 * u}px;`)}color:rgba(255,255,255,.32);text-shadow:0 2px 8px rgba(0,0,0,.4);white-space:nowrap">ELŐNÉZET · TWINX</span>`).join("")}
      </div>`
    : "";

  return `<!doctype html><html lang="hu"><head><meta charset="utf-8">
<link rel="stylesheet" href="${font.link}">
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{width:${W}px;height:${H}px}
  .flyer{position:relative;width:${W}px;height:${H}px;overflow:hidden;font-family:${font.family};background:#fff}
  .bg{position:absolute;inset:0;background-size:cover;background-position:center;background-repeat:no-repeat}
</style></head><body>
<div class="flyer">
  <div class="bg" style="background-image:url('${esc(o.bgUrl)}')"></div>

  <!-- FEJLÉC: cím + alcím -->
  <div style="position:absolute;left:${hz.x * W}px;top:${hz.y * H}px;width:${hz.w * W}px;z-index:5">
    <div style="${headerPlate}">
      <div style="${type(800, titleFs, "line-height:1.18;")}color:${headerInk};${headerShadow}max-height:${Math.round(titleFs * 1.18 * 2 + titleFs * 0.2)}px;overflow:hidden;padding-bottom:${Math.ceil(titleFs * 0.1)}px;overflow-wrap:anywhere">${esc(truncate(text.title || "Eladó ingatlan", 52))}</div>
      ${text.subtitle
        ? `<div style="${type(600, Math.round(26 * u), "line-height:1.4;")}color:${headerInk};${headerShadow}opacity:.94;margin-top:${8 * u}px;padding-bottom:${3 * u}px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(truncate(text.subtitle, 58))}</div>`
        : ""}
    </div>
  </div>

  <!-- ADAT-CHIPEK -->
  ${text.chips.filter(Boolean).length
    ? `<div style="position:absolute;left:${ZONES.facts.x * W}px;top:${ZONES.facts.y * H}px;width:${ZONES.facts.w * W}px;z-index:5;display:flex;flex-wrap:wrap;gap:${10 * u}px">
         ${text.chips.filter(Boolean).slice(0, 4).map((c) =>
           `<span style="display:inline-flex;align-items:center;height:${48 * u}px;padding:0 ${20 * u}px;border-radius:${999}px;background:${chipBg};color:${chipInk};${type(700, Math.round(20 * u), "line-height:1;")}white-space:nowrap;box-shadow:0 ${2 * u}px ${10 * u}px rgba(0,0,0,.14)">${esc(truncate(c, 26))}</span>`
         ).join("")}
       </div>`
    : ""}

  <!-- ÁR -->
  ${text.price
    ? `<div style="position:absolute;left:${ZONES.price.x * W}px;top:${ZONES.price.y * H}px;width:${ZONES.price.w * W}px;z-index:5;text-align:right">
         <div style="display:inline-block;${pr.needsPlate ? `background:${rgba(accent, 0.94)};padding:${14 * u}px ${22 * u}px;border-radius:${8 * u}px;` : ""}">
           <div style="${type(600, Math.round(15 * u), "line-height:1.4;")}letter-spacing:${3 * u}px;color:${priceInk};opacity:.85;padding-bottom:${2 * u}px">IRÁNYÁR</div>
           <div style="${type(800, priceFs, "line-height:1.25;")}color:${priceInk};white-space:nowrap;padding-bottom:${Math.ceil(priceFs * 0.08)}px">${esc(truncate(text.price, 18))}</div>
         </div>
       </div>`
    : ""}

  <!-- ÜGYNÖK-SÁV: mindig tömör arculati színnel, hogy az elérhetőség biztosan olvasható legyen -->
  <div style="position:absolute;left:0;right:0;bottom:0;height:${ZONES.footer.h * H}px;z-index:6;background:${accent};display:flex;align-items:center;padding:0 ${48 * u}px">
    ${profile.agent_photo_url
      ? `<div style="width:${96 * u}px;height:${96 * u}px;border-radius:999px;background-image:url('${esc(profile.agent_photo_url)}');background-size:cover;background-position:center;border:${Math.max(2, 3 * u)}px solid ${onAcc};flex:0 0 auto"></div>`
      : ""}
    <div style="margin-left:${profile.agent_photo_url ? 22 * u : 0}px;flex:1 1 auto;min-width:0">
      <div style="${type(800, Math.round(28 * u), "line-height:1.35;")}color:${onAcc};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding-bottom:${2 * u}px">${esc(truncate(profile.display_name || profile.company, 26))}</div>
      ${profile.title ? `<div style="${type(500, Math.round(19 * u), "line-height:1.4;")}color:${onAcc};opacity:.85;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding-bottom:${2 * u}px">${esc(truncate(profile.title, 30))}</div>` : ""}
      ${contact ? `<div style="${type(700, Math.round(21 * u), "line-height:1.4;")}color:${onAcc};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding-bottom:${2 * u}px">${contact}</div>` : ""}
    </div>
    ${profile.logo_url
      ? `<div style="flex:0 0 auto;display:flex;align-items:center;justify-content:center;height:${84 * u}px;max-width:${210 * u}px;padding:${10 * u}px ${16 * u}px;background:#ffffff;border-radius:${12 * u}px;margin-left:${20 * u}px">
           <img src="${esc(profile.logo_url)}" style="max-height:${60 * u}px;max-width:${178 * u}px;object-fit:contain" />
         </div>`
      : ""}
  </div>

  ${wm}
</div>
</body></html>`;
}
