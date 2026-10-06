// Üdvözlő levélsorozat az új regisztrálóknak — CSAK a levelek tartalma és formája.
//
// A kiküldést NEM ez a fájl végzi: a napi ütemezett API route (lásd később:
// /api/cron/onboarding) dönti el, kinek melyik lépés jár, és Resenddel küldi.
// Itt csak az van, hogy egy adott lépés hogyan néz ki (tárgy, előnézet, HTML, szöveg).
//
// A levelek e-mail-biztos HTML-ek: táblázatos felépítés, inline stílusok, 600 px,
// ugyanaz a TWINX-arculat, mint a Smartlead/Brevo hírleveleké.

export type OnboardingStepKey = "welcome" | "valuation" | "tips";

export type OnboardingStep = {
  key: OnboardingStepKey;
  /** Hány nappal a regisztráció után esedékes (0 = az első napi futáskor). */
  dayOffset: number;
  /** Csak annak menjen, aki MÉG NEM használt kreditet (pl. „így kezdj bele”). */
  onlyIfUnused?: boolean;
};

/** A sorozat lépései, sorrendben. A kulcs a naplóban is ez lesz — ne nevezd át. */
export const ONBOARDING_STEPS: OnboardingStep[] = [
  { key: "welcome", dayOffset: 0 },
  { key: "valuation", dayOffset: 3, onlyIfUnused: true },
  { key: "tips", dayOffset: 7 },
];

export type OnboardingRecipient = {
  /** Teljes név a profilból (lehet üres). */
  name: string | null;
  /** Kezdő ajándékkredit: /ingatlan landingről 10, egyébként 3. */
  welcomeCredits: number;
  /** Aláírt, személyre szóló leiratkozó link (a küldő route állítja elő). */
  unsubscribeUrl: string;
};

// ---- Arculat -----------------------------------------------------------------
const CREAM = "#F7F3EC", CARD = "#FDFBF6", INK = "#1C1815", MUTED = "#6E655C";
const LINE = "#E8E1D6", CORAL = "#EF7A5A", CORAL_DEEP = "#7A2E17", BTN_TEXT = "#1C1005";
const DISPLAY = "'Space Grotesk','Segoe UI',Helvetica,Arial,sans-serif";
const BODY = "Inter,'Segoe UI',Helvetica,Arial,sans-serif";

function site(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || "https://twinx.hu").replace(/\/$/, "");
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Keresztnév: a magyar névsorrend miatt az UTOLSÓ szó (Kovács Márk → Márk). */
function firstName(name: string | null): string {
  const n = (name ?? "").trim();
  return n ? n.split(/\s+/).slice(-1)[0] : "";
}

// ---- Tartalom ------------------------------------------------------------------
type Block =
  | { t: "p"; text: string }        // **félkövér** jelölhető
  | { t: "h"; text: string }
  | { t: "list"; items: string[] }
  | { t: "cta"; label: string; path: string };

type Content = { subject: string; preheader: string; title: string; blocks: Block[] };

function content(key: OnboardingStepKey, r: OnboardingRecipient): Content {
  const c = r.welcomeCredits;
  switch (key) {
    case "welcome":
      return {
        subject: "Üdv a TWINX-ben — így használd el okosan a krediteidet",
        preheader: `${c} kredittel indulsz. Mutatjuk, mire érdemes elsőként elkölteni.`,
        title: "Üdv a TWINX-ben!",
        blocks: [
          { t: "p", text: `Köszönjük, hogy regisztráltál. A fiókodban **${c} ajándékkredit** vár — ezzel bankkártya nélkül kipróbálhatod a modulokat, és a kredit nem jár le.` },
          { t: "h", text: "Mire érdemes elsőként elkölteni?" },
          { t: "list", items: [
            "Értékbecslés egy oldalon, a saját arculatoddal — 1 kredit",
            "Telefonfotóból profi fotó a Képjavítóval — 1 kredit",
            "Egy meglévő hirdetésed pontozása és átírása — 1 kredit",
          ] },
          { t: "p", text: "Tipp: kezdd egy olyan ingatlannal, amin épp dolgozol — így rögtön látod, mennyi időt spórolsz." },
          { t: "cta", label: "Belépek a TWINX-be", path: "/dashboard" },
        ],
      };
    case "valuation":
      return {
        subject: "Egy értékbecslés 5 lépésben — próbáld ki 1 kreditből",
        preheader: "Adatok be, sávval és levezetéssel kész lap ki — a saját logóddal.",
        title: "Értékbecslés, lépésről lépésre",
        blocks: [
          { t: "p", text: "Láttuk, hogy még nem használtad a krediteidet. Az értékbecsléssel a legkönnyebb kezdeni — az eladó úgyis ezzel kezdi: „mennyit ér?”" },
          { t: "list", items: [
            "Nyisd meg az Értékbecslés modult.",
            "Add meg az ingatlan adatait (cím, méret, állapot, emelet).",
            "Ha van, tölts fel 1–2 fotót — pontosabb lesz az állapot-becslés.",
            "Válaszd ki a saját arculatodat (logó, színek).",
            "Kész: becsült érték, értéksáv és levezetés egy letölthető oldalon.",
          ] },
          { t: "p", text: "Egy értékbecslés **1 kredit** — a kezdőkreditjeidből bőven kijön." },
          { t: "cta", label: "Elkészítem az első értékbecslést", path: "/dashboard/real-estate/valuation" },
        ],
      };
    case "tips":
      return {
        subject: "3 tipp, amivel a TWINX a legtöbbet hozza neked",
        preheader: "Videó fotókból, hirdetés-ellenőrzés, és mi a teendő, ha elfogyott a kredit.",
        title: "Egy hét a TWINX-ben",
        blocks: [
          { t: "p", text: "Egy hete regisztráltál — összeszedtünk három dolgot, amit a legtöbben későn fedeznek fel:" },
          { t: "list", items: [
            "Fotókból zenés, feliratos álló videó Reelsre és TikTokra — vágás nélkül.",
            "Hirdetés ellenőrzés: bemásolod a linket, és kiderül, mi hiányzik belőle.",
            "Arculat: egyszer beállítod a logódat és színeidet, és minden anyagodon ott lesz.",
          ] },
          { t: "p", text: "Ha elfogytak a krediteid, a csomagok között választhatsz — a vásárolt kredit **nem jár le havonta**." },
          { t: "cta", label: "Megnézem a modulokat", path: "/dashboard" },
        ],
      };
  }
}

// ---- Megjelenítés -------------------------------------------------------------
function para(text: string): string {
  const html = esc(text).replace(/\*\*(.+?)\*\*/g, `<strong style="color:${INK};">$1</strong>`);
  return `<p style="margin:0 0 16px 0;font-family:${BODY};font-size:16px;line-height:1.6;color:${INK};">${html}</p>`;
}

function blockHtml(b: Block): string {
  switch (b.t) {
    case "p":
      return para(b.text);
    case "h":
      return `<p style="margin:4px 0 10px 0;font-family:${DISPLAY};font-size:17px;font-weight:bold;color:${INK};">${esc(b.text)}</p>`;
    case "list": {
      const rows = b.items
        .map((i) =>
          `<tr><td valign="top" style="padding:0 10px 10px 0;font-family:${BODY};font-size:16px;line-height:1.5;color:${CORAL};font-weight:bold;">&#10003;</td>` +
          `<td valign="top" style="padding:0 0 10px 0;font-family:${BODY};font-size:16px;line-height:1.5;color:${INK};">${esc(i)}</td></tr>`)
        .join("");
      return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px 0;">${rows}</table>`;
    }
    case "cta":
      return (
        `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 22px 0;">` +
        `<tr><td align="center" bgcolor="${CORAL}" style="border-radius:999px;">` +
        `<a href="${esc(site() + b.path)}" target="_blank" style="display:inline-block;padding:14px 28px;font-family:${DISPLAY};` +
        `font-size:16px;font-weight:bold;color:${BTN_TEXT};text-decoration:none;border-radius:999px;">${esc(b.label)}</a>` +
        `</td></tr></table>`
      );
  }
}

function blockText(b: Block): string {
  switch (b.t) {
    case "p":
      return b.text.replace(/\*\*/g, "") + "\n";
    case "h":
      return b.text + "\n";
    case "list":
      return b.items.map((i) => `- ${i}`).join("\n") + "\n";
    case "cta":
      return `${b.label}: ${site()}${b.path}\n`;
  }
}

/** Egy lépés teljes levele a címzettnek: tárgy + HTML + sima szöveg. */
export function renderOnboardingEmail(
  key: OnboardingStepKey,
  r: OnboardingRecipient,
): { subject: string; html: string; text: string } {
  const c = content(key, r);
  const fn = firstName(r.name);
  const greeting = fn ? `Szia ${fn}!` : "Szia!";
  const unsub = esc(r.unsubscribeUrl);

  const pad = "&#847;&zwnj;&nbsp;".repeat(40);
  const html = `<!DOCTYPE html>
<html lang="hu"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting"><meta name="color-scheme" content="light only"><title>${esc(c.subject)}</title></head>
<body style="margin:0;padding:0;background:${CREAM};">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${CREAM};opacity:0;">${esc(c.preheader)}${pad}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${CREAM}" style="background:${CREAM};">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:${CARD};border:1px solid ${LINE};border-radius:16px;">
<tr><td style="padding:24px 28px 8px 28px;"><span style="font-family:${DISPLAY};font-size:22px;font-weight:bold;letter-spacing:1px;color:${INK};">TWIN<span style="color:${CORAL};">X</span></span></td></tr>
<tr><td style="padding:16px 28px 26px 28px;">
<h1 style="margin:0 0 16px 0;font-family:${DISPLAY};font-size:26px;line-height:1.25;color:${INK};">${esc(c.title)}</h1>
${para(greeting)}${c.blocks.map(blockHtml).join("")}${para("Márk")}
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-top:1px solid ${LINE};margin-top:8px;"><tr><td style="padding-top:16px;">
<p style="margin:0;font-family:${BODY};font-size:15px;line-height:1.5;color:${INK};"><strong>Kovács Márk</strong><br>
<span style="color:${MUTED};">TWINX · AI eszköztár ingatlanosoknak</span><br>
<a href="${esc(site())}" style="color:${CORAL_DEEP};text-decoration:none;font-weight:bold;">twinx.hu</a></p>
</td></tr></table>
</td></tr></table>
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;"><tr><td style="padding:0 20px;">
<p style="margin:18px 0 0 0;font-family:${BODY};font-size:12px;line-height:1.5;color:${MUTED};text-align:center;">
Azért kapod ezt a levelet, mert regisztráltál a TWINX-be. <a href="${unsub}" style="color:${MUTED};text-decoration:underline;">Leiratkozás az ilyen levelekről</a></p>
</td></tr></table>
</td></tr></table>
</body></html>`;

  const text = [
    greeting,
    "",
    ...c.blocks.map(blockText),
    "Márk",
    "",
    "Kovács Márk",
    "TWINX · AI eszköztár ingatlanosoknak",
    site(),
    "",
    `Leiratkozás az ilyen levelekről: ${r.unsubscribeUrl}`,
  ].join("\n");

  return { subject: c.subject, html, text };
}
