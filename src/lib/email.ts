// E-mail küldés Resend API-val (natív fetch, külön csomag nélkül).
import type { LeadInput } from "@/lib/leads";
import { billingCopyBlock, type BillingInfo } from "@/lib/billing";

export async function sendLeadNotification(lead: LeadInput): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.LEADS_NOTIFY_EMAIL;
  if (!apiKey || !to) {
    throw new Error("Hiányzó RESEND_API_KEY vagy LEADS_NOTIFY_EMAIL.");
  }
  // Éles domain hitelesítés után cseréld a saját domainedre.
  const from = process.env.RESEND_FROM || "Twinx <onboarding@resend.dev>";

  const html = `
    <h2>Új B2B ajánlatkérés</h2>
    <p><strong>Név:</strong> ${escapeHtml(lead.name)}</p>
    <p><strong>E-mail:</strong> ${escapeHtml(lead.email)}</p>
    <p><strong>Cég:</strong> ${escapeHtml(lead.company ?? "-")}</p>
    <p><strong>Üzenet:</strong></p>
    <p>${escapeHtml(lead.message).replace(/\n/g, "<br>")}</p>
  `;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      reply_to: lead.email,
      subject: `Új B2B ajánlatkérés: ${lead.name}`,
      html,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Resend hiba (${res.status}): ${text.slice(0, 300)}`);
  }
}

export async function sendIdeaNotification(idea: {
  authorName?: string;
  authorEmail?: string;
  content: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.LEADS_NOTIFY_EMAIL;
  if (!apiKey || !to) {
    throw new Error("Hiányzó RESEND_API_KEY vagy LEADS_NOTIFY_EMAIL.");
  }
  const from = process.env.RESEND_FROM || "Twinx <onboarding@resend.dev>";

  const html = `
    <h2>Új ötlet érkezett az ötletládába</h2>
    <p><strong>Név:</strong> ${escapeHtml(idea.authorName || "-")}</p>
    <p><strong>E-mail:</strong> ${escapeHtml(idea.authorEmail || "-")}</p>
    <p><strong>Ötlet:</strong></p>
    <p>${escapeHtml(idea.content).replace(/\n/g, "<br>")}</p>
    <p>Jóváhagyás / elutasítás: az admin felület /admin/ideas oldalán.</p>
  `;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      reply_to: idea.authorEmail || undefined,
      subject: "Új ötlet az ötletládában",
      html,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Resend hiba (${res.status}): ${text.slice(0, 300)}`);
  }
}

/** Kredit-kérés érkezett egy sales kollégától — az adminok kapják. */
export async function sendCreditRequestNotification(req: {
  requesterName?: string;
  requesterEmail: string;
  amount: number;
  reason?: string;
  balance?: number;
  role?: string;                 // 'sales' = ingyenes keret, egyéb = számlázandó
  netHuf?: number;               // a csomag nettó ára
  billing?: BillingInfo | null;  // a számlázási adatok pillanatképe
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  // Külön címzett is megadható; ha nincs, a szokásos értesítési címre megy.
  const to = process.env.CREDIT_NOTIFY_EMAIL || process.env.LEADS_NOTIFY_EMAIL;
  if (!apiKey || !to) {
    throw new Error("Hiányzó RESEND_API_KEY vagy értesítési e-mail cím.");
  }
  const from = process.env.RESEND_FROM || "Twinx <onboarding@resend.dev>";
  const site = (process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || "").replace(/\/$/, "");

  // A sales kolléga ingyen kap keretet; a sima felhasználónak SZÁMLÁT állítunk ki,
  // ezért az ő levelében ott a teljes számlázási adat, másolható formában.
  const isFree = req.role === "sales";
  // A blokk formázása a lib/billing.ts-ből jön — így a levélben PONTOSAN az
  // szerepel, amit az admin felületen is másolni lehet (cég = vevő, személy =
  // kapcsolattartó).
  const billBlock = req.billing
    ? `
    <h3 style="margin-bottom:4px">Számlázási adatok</h3>
    <pre style="background:#f6f3ef;padding:10px;border-radius:8px;font-family:monospace;font-size:13px;white-space:pre-wrap">${escapeHtml(
      billingCopyBlock(req.billing)
    )}</pre>`
    : "";

  const html = `
    <h2>${isFree ? "Keret-igény érkezett (sales)" : "Kredit megrendelés érkezett — SZÁMLÁZANDÓ"}</h2>
    <p><strong>Kérelmező:</strong> ${escapeHtml(req.requesterName || "-")} (${escapeHtml(req.requesterEmail)})</p>
    <p><strong>Kért mennyiség:</strong> ${req.amount} kredit</p>
    ${typeof req.netHuf === "number"
      ? `<p><strong>Fizetendő:</strong> ${req.netHuf.toLocaleString("hu-HU")} Ft + áfa</p>`
      : `<p><strong>Elszámolás:</strong> ingyenes belső keret (sales)</p>`}
    ${typeof req.balance === "number" ? `<p><strong>Jelenlegi egyenlege:</strong> ${req.balance} kredit</p>` : ""}
    ${req.reason ? `<p><strong>Megjegyzés:</strong><br>${escapeHtml(req.reason).replace(/\n/g, "<br>")}</p>` : ""}
    ${billBlock}
    ${!isFree ? `<p><em>A kredit a befizetés rögzítése után íródik jóvá.</em></p>` : ""}
    <p>Ügyintézés${site ? `: <a href="${site}/admin/credit-requests">${site}/admin/credit-requests</a>` : " az admin felület Kredit-kérések oldalán."}</p>
  `;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to,
      reply_to: req.requesterEmail,
      subject: isFree
        ? `Keret-igény: ${req.amount} kredit — ${req.requesterName || req.requesterEmail}`
        : `SZÁMLÁZANDÓ — ${req.amount} kredit / ${(req.netHuf ?? 0).toLocaleString("hu-HU")} Ft + áfa — ${req.requesterName || req.requesterEmail}`,
      html,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Resend hiba (${res.status}): ${text.slice(0, 300)}`);
  }
}

/**
 * Ingatlanos kampány — ÚJ JELENTKEZŐ. MINDEN admin megkapja (nem csak a
 * LEADS_NOTIFY_EMAIL), mert a kód kiadása admin-döntés, és ne múljon egy emberen.
 */
export async function sendInviteApplicationNotification(
  invite: { name: string; email: string; phone: string; office: string },
  adminEmails: string[]
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = adminEmails.filter(Boolean);
  if (!apiKey || !to.length) throw new Error("Hiányzó RESEND_API_KEY vagy admin cím.");
  const from = process.env.RESEND_FROM || "Twinx <onboarding@resend.dev>";
  const site = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");

  const html = `
    <h2>Új jelentkező az ingatlanos ajándékkreditre</h2>
    <p><strong>Név:</strong> ${escapeHtml(invite.name)}</p>
    <p><strong>E-mail:</strong> ${escapeHtml(invite.email)}</p>
    <p><strong>Telefon:</strong> ${escapeHtml(invite.phone)}</p>
    <p><strong>Iroda:</strong> ${escapeHtml(invite.office)}</p>
    <p>Elfogadás után a rendszer automatikusan kiküldi neki az ajándékkódot.</p>
    <p>Ügyintézés${site ? `: <a href="${site}/admin/megkeresesek">${site}/admin/megkeresesek</a>` : " az admin felület Jelentkezők oldalán."}</p>
  `;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from, to, reply_to: invite.email,
      subject: `Új ingatlanos jelentkező: ${invite.name}`,
      html,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Resend hiba (${res.status}): ${text.slice(0, 300)}`);
  }
}

/**
 * Ingatlanos kampány — a JELENTKEZŐ megkapja a kódját és a regisztrációs linket.
 *
 * Levélsablon-elvek (ezért néz ki így a kód):
 *  - Táblázatos, 600 px széles elrendezés és CSAK inline stílus: az Outlook és a
 *    Gmail app se `<style>` blokkot, se flex/grid elrendezést nem eszik meg.
 *  - Preheader: a listanézetben a tárgysor után látszó első sor — ha nem adjuk
 *    meg, a kliens a fejléc szemetét mutatja ott.
 *  - A kód KIVÁLASZTHATÓ szöveg (nem kép), mert sokan kézzel gépelik át.
 *  - Van sima szöveges változat is (`text`): a kép- és HTML-tiltó kliensek ezt
 *    kapják, és a spam-pontszámot is javítja.
 */
export function renderInviteCodeEmail(invite: {
  name: string;
  code: string;
  credits: number;
}): { subject: string; html: string; text: string; from: string; link: string } {
  const from = process.env.RESEND_FROM || "Twinx <onboarding@resend.dev>";
  const site = (process.env.NEXT_PUBLIC_SITE_URL || "https://twinx.hu").replace(/\/$/, "");
  const link = `${site}/register?kod=${encodeURIComponent(invite.code)}`;

  const name = escapeHtml(invite.name.trim().split(/\s+/).slice(-1)[0] || invite.name);
  const code = escapeHtml(invite.code);
  const credits = invite.credits;

  // Amit a kredittel ki tud próbálni — a landing APPS listájának rövid kivonata.
  const perks = [
    "Értékbecslés valós piaci adatokból",
    "Képjavítás és rendrakás a fotókon",
    "Hirdetési kép és bemutató videó",
    "Látványterv: virtuális felújítás",
    "Hirdetésszöveg generálás és ellenőrzés",
  ];

  const html = `<!DOCTYPE html>
<html lang="hu"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f7f3ec;">
  <!-- Preheader: a levéllista előnézetében ez a sor látszik. -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Itt a kódod: ${code} — ${credits} kredit ajándékba a TWINX-hez.</div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f3ec;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;background:#ffffff;border:1px solid #e8e1d6;border-radius:18px;overflow:hidden;font-family:Helvetica,Arial,sans-serif;">

        <!-- Fejléc -->
        <tr><td style="background:#12100e;padding:28px 32px;">
          <span style="color:#ffffff;font-size:24px;font-weight:700;letter-spacing:1px;">TWINX</span>
          <span style="color:#ef7a5a;font-size:12px;letter-spacing:2px;text-transform:uppercase;display:block;margin-top:6px;">Ingatlanos kampány</span>
        </td></tr>

        <!-- Törzs -->
        <tr><td style="padding:32px;color:#1c1815;font-size:16px;line-height:1.6;">
          <p style="margin:0 0 16px;">Kedves ${name}!</p>
          <p style="margin:0 0 16px;">Köszönjük a jelentkezésed — <strong>jóváhagytuk</strong>. Ezzel a kóddal
            <strong>${credits} kredittel</strong> indulsz a TWINX-ben, ingyen, bankkártya nélkül.</p>

          <!-- Kód -->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">
            <tr><td align="center" style="background:#f7f3ec;border:1px dashed #ef7a5a;border-radius:14px;padding:22px;">
              <div style="color:#6b6b6b;font-size:12px;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px;">Az ajándékkódod</div>
              <div style="color:#12100e;font-size:26px;font-weight:700;letter-spacing:3px;font-family:'Courier New',Courier,monospace;">${code}</div>
            </td></tr>
          </table>

          <!-- Fő gomb -->
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
            <tr><td style="background:#ef7a5a;border-radius:12px;">
              <a href="${link}" style="display:inline-block;padding:14px 28px;color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;">Regisztrálok a TWINX-be</a>
            </td></tr>
          </table>
          <p style="margin:0 0 24px;color:#6b6b6b;font-size:13px;line-height:1.5;">
            <strong style="color:#1c1815;">A kódot nem a regisztrációnál kell megadni.</strong>
            Előbb regisztrálj (e-maillel vagy Google-fiókkal), majd belépés után a kezdőlapon,
            az egyenleged mellett kattints az „Ajándékkód beváltása” gombra, és írd be a kódot.<br>
            Ha a gomb nem működne, másold be ezt a linket: <span style="color:#1c1815;">${link}</span>
          </p>

          <!-- Mit tudsz vele kipróbálni -->
          <div style="border-top:1px solid #e8e1d6;padding-top:20px;">
            <p style="margin:0 0 12px;font-weight:700;">Ezeket próbálhatod ki a kredittel:</p>
            <table role="presentation" cellpadding="0" cellspacing="0">
              ${perks.map((p) => `<tr><td style="padding:4px 0;color:#1c1815;font-size:15px;"><span style="color:#ef7a5a;font-weight:700;">•</span>&nbsp; ${escapeHtml(p)}</td></tr>`).join("")}
            </table>
          </div>

          <p style="margin:24px 0 0;">Ha bármi kérdésed van, csak válaszolj erre a levélre — segítünk a beállításban.</p>
          <p style="margin:16px 0 0;">Üdvözlettel,<br><strong>a TWINX csapata</strong></p>
        </td></tr>

        <!-- Lábléc -->
        <tr><td style="background:#f7f3ec;border-top:1px solid #e8e1d6;padding:20px 32px;color:#6b6b6b;font-size:12px;line-height:1.6;">
          A kód egyszer használható fel, és a jelentkezésed e-mail címéhez tartozik.<br>
          <a href="${site}" style="color:#6b6b6b;">twinx.hu</a>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body></html>`;

  const text = [
    `Kedves ${invite.name}!`,
    ``,
    `Köszönjük a jelentkezésed - jóváhagytuk. Ezzel a kóddal ${credits} kredittel indulsz a TWINX-ben, ingyen, bankkártya nélkül.`,
    ``,
    `Az ajándékkódod: ${invite.code}`,
    ``,
    `Regisztráció: ${link}`,
    `A kódot NEM a regisztrációnál kell megadni. Előbb regisztrálj (e-maillel vagy Google-fiokkal), majd belépés után a kezdőlapon, az egyenleged mellett az "Ajándékkód beváltása" gombbal váltsd be.`,
    ``,
    `Ezeket próbálhatod ki a kredittel:`,
    ...perks.map((p) => `- ${p}`),
    ``,
    `Kérdés esetén válaszolj erre a levélre.`,
    ``,
    `Üdvözlettel,`,
    `a TWINX csapata`,
    `${site}`,
    ``,
    `A kód egyszer használható fel.`,
  ].join("\n");

  return { subject: `Itt a TWINX ajándékkódod — ${credits} kredit`, html, text, from, link };
}

/**
 * A fenti sablon KIKÜLDÉSE a jelentkezőnek, a saját nevével és címére.
 * A munkatárs előtte megnézi ugyanezt a levelet az adminban (előnézet), és
 * csak utána indítja a küldést — így nem megy ki rossz adattal.
 */
export async function sendInviteCodeEmail(invite: {
  name: string;
  email: string;
  code: string;
  credits: number;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("Hiányzó RESEND_API_KEY.");
  const { subject, html, text, from } = renderInviteCodeEmail(invite);

  // A válaszok a hivatalos, közös postafiókba fussanak be (nem egy kolléga
  // magánfiókjába). Ha nincs külön beállítva, a feladó címére válaszol a partner.
  const replyTo = process.env.RESEND_REPLY_TO || undefined;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: invite.email, subject, html, text, ...(replyTo ? { reply_to: replyTo } : {}) }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Resend hiba (${res.status}): ${t.slice(0, 300)}`);
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Ingatlanos landing — BŐVEBB TÁJÉKOZTATÁS kérése. Minden admin
 * megkapja; a válasz közvetlenül az érdeklődőnek megy (reply_to).
 */
export async function sendConsultationNotification(
  req: { name: string; email: string; phone: string; office?: string; preferred?: string; note?: string },
  adminEmails: string[]
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = adminEmails.filter(Boolean);
  if (!apiKey || !to.length) throw new Error("Hiányzó RESEND_API_KEY vagy admin cím.");
  const from = process.env.RESEND_FROM || "Twinx <onboarding@resend.dev>";

  const row = (k: string, v?: string) =>
    v && v.trim() ? `<p><strong>${k}:</strong> ${escapeHtml(v.trim()).replace(/\n/g, "<br>")}</p>` : "";

  const html = `
    <h2>Valaki szeretné, ha mesélnénk neki a TWINX-ről</h2>
    <p>Bővebb tájékoztatást kért az ingatlanos landingről — egy kolléga vegye fel vele a kapcsolatot.</p>
    ${row("Név", req.name)}
    ${row("E-mail", req.email)}
    ${row("Telefon", req.phone)}
    ${row("Ingatlaniroda", req.office)}
    ${row("Mikor kereshető", req.preferred)}
    ${row("Mire kíváncsi", req.note)}
    <p>Erre a levélre válaszolva közvetlenül neki írsz.</p>
  `;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from, to, reply_to: req.email,
      subject: `Tájékoztatás-kérés: ${req.name}`,
      html,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Resend hiba (${res.status}): ${text.slice(0, 300)}`);
  }
}
