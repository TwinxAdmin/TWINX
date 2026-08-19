// E-mail küldés Resend API-val (natív fetch, külön csomag nélkül).
import type { LeadInput } from "@/lib/leads";
import type { BillingInfo } from "@/lib/billing";

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
  const billBlock = req.billing
    ? `
    <h3 style="margin-bottom:4px">Számlázási adatok</h3>
    <pre style="background:#f6f3ef;padding:10px;border-radius:8px;font-family:monospace;font-size:13px;white-space:pre-wrap">${escapeHtml(
      [
        req.billing.billing_name,
        req.billing.billing_tax_number ? `Adószám: ${req.billing.billing_tax_number}` : null,
        [req.billing.billing_zip, req.billing.billing_city].filter(Boolean).join(" ") || null,
        req.billing.billing_address,
        req.billing.billing_country,
        req.billing.billing_email ? `E-mail: ${req.billing.billing_email}` : null,
      ].filter(Boolean).join("\n")
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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
