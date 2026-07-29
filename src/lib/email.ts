// E-mail küldés Resend API-val (natív fetch, külön csomag nélkül).
import type { LeadInput } from "@/lib/leads";

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
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  // Külön címzett is megadható; ha nincs, a szokásos értesítési címre megy.
  const to = process.env.CREDIT_NOTIFY_EMAIL || process.env.LEADS_NOTIFY_EMAIL;
  if (!apiKey || !to) {
    throw new Error("Hiányzó RESEND_API_KEY vagy értesítési e-mail cím.");
  }
  const from = process.env.RESEND_FROM || "Twinx <onboarding@resend.dev>";
  const site = (process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || "").replace(/\/$/, "");

  const html = `
    <h2>Kredit-kérés érkezett</h2>
    <p><strong>Kérelmező:</strong> ${escapeHtml(req.requesterName || "-")} (${escapeHtml(req.requesterEmail)})</p>
    <p><strong>Kért mennyiség:</strong> ${req.amount} kredit</p>
    ${typeof req.balance === "number" ? `<p><strong>Jelenlegi egyenlege:</strong> ${req.balance} kredit</p>` : ""}
    ${req.reason ? `<p><strong>Indoklás:</strong><br>${escapeHtml(req.reason).replace(/\n/g, "<br>")}</p>` : ""}
    <p>Jóváhagyás vagy elutasítás${site ? `: <a href="${site}/admin/credit-requests">${site}/admin/credit-requests</a>` : " az admin felület Kredit-kérések oldalán."}</p>
  `;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to,
      reply_to: req.requesterEmail,
      subject: `Kredit-kérés: ${req.amount} kredit — ${req.requesterName || req.requesterEmail}`,
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
