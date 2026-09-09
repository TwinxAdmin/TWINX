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

/** Ingatlanos kampány — a JELENTKEZŐ megkapja a kódját és a regisztrációs linket. */
export async function sendInviteCodeEmail(invite: {
  name: string;
  email: string;
  code: string;
  credits: number;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("Hiányzó RESEND_API_KEY.");
  const from = process.env.RESEND_FROM || "Twinx <onboarding@resend.dev>";
  const site = (process.env.NEXT_PUBLIC_SITE_URL || "https://twinx.hu").replace(/\/$/, "");
  const link = `${site}/register?kod=${encodeURIComponent(invite.code)}`;

  const html = `
    <p>Kedves ${escapeHtml(invite.name)}!</p>
    <p>Köszönjük a jelentkezésed — jóváhagytuk, így a TWINX-et <strong>${invite.credits} ingyenes kredittel</strong> tudod kipróbálni.</p>
    <p>Az ajándékkódod:</p>
    <p style="font-size:22px;font-weight:700;letter-spacing:2px">${escapeHtml(invite.code)}</p>
    <p><a href="${link}" style="display:inline-block;padding:12px 20px;background:#ef7a5a;color:#fff;border-radius:10px;text-decoration:none;font-weight:600">Regisztrálok a kóddal</a></p>
    <p>A link automatikusan kitölti a kódot. Ha már van fiókod, belépés után a kezdőlapon is beváltható.</p>
    <p style="color:#6b6b6b;font-size:13px">A kód egyszer használható fel.</p>
    <p>Üdvözlettel,<br>TWINX</p>
  `;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from, to: invite.email,
      subject: `A TWINX ajándékkódod: ${invite.credits} kredit`,
      html,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Resend hiba (${res.status}): ${text.slice(0, 300)}`);
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
