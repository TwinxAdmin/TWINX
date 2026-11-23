// Foglalási értesítések (terv 15 / 2., 6. szakasz; a szövegek: docs/terv/16-email-szovegek.md, D49). CSAK szerver.
//
// - A látogatónak: visszaigazolás (időponttal / visszahívás), lemondás megerősítése — Resend, HTML + egyszerű szöveg.
// - Márknak és Tibinek: e-mail (BOOKING_NOTIFY_EMAILS, vesszővel; tartalék: LEADS_NOTIFY_EMAIL) és Telegram, ha be van
//   állítva (TELEGRAM_BOT_TOKEN + BOOKING_TELEGRAM_CHAT_ID). A Telegram-üzenet EGYSZERŰ SZÖVEG (parse_mode nélkül),
//   a látogató szövege kurtítva — nem lehet belőle formázott/manipulált üzenet.
// - Az értesítés NEM veszélyeztetheti a foglalást: a foglalás előbb mentődik, a hiba csak a *_sent_at mezők üresen
//   maradásával és a naplóban látszik (Admin → Foglalások, újraküldés a 2e lépésben).
import { createAdminClient } from "@/lib/supabase/admin";
import { fmtFullBudapest } from "@/lib/bookings";

const SIGN = "A TWINX csapata";
const CONTACT = "office@twinx.hu";

function siteUrl(fallback?: string): string {
  // Helyi fejlesztésnél a link a localhostra mutasson, hogy a lemondás kipróbálható legyen.
  if (fallback && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(fallback)) return fallback;
  return (process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || fallback || "https://twinx.hu").replace(/\/$/, "");
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Egységes, egyszerű levélkeret (TWINX színek, gomb opcionális). */
function layout(paragraphs: string[], button?: { label: string; href: string }, after: string[] = []): string {
  const para = (list: string[]) => list.map((p) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:#1c1815">${p}</p>`).join("");
  const body = para(paragraphs);
  const btn = button
    ? `<p style="margin:22px 0"><a href="${esc(button.href)}" style="display:inline-block;background:#ef7a5a;color:#1c1005;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:999px;font-size:14px">${esc(button.label)}</a></p>`
    : "";
  return `<!doctype html><html lang="hu"><body style="margin:0;background:#f7f3ec;font-family:Arial,Helvetica,sans-serif">
<div style="max-width:560px;margin:0 auto;padding:32px 24px">
<p style="font-size:22px;font-weight:700;margin:0 0 24px;color:#1c1815">TWIN<span style="color:#ef7a5a">X</span></p>
${body}${btn}${para(after)}
<p style="margin:22px 0 0;font-size:15px;color:#1c1815">${SIGN}</p>
<p style="margin:28px 0 0;font-size:12px;color:#6e655c;border-top:1px solid #e8e1d6;padding-top:14px">${CONTACT}</p>
</div></body></html>`;
}

async function sendMail(to: string | string[], subject: string, html: string, text: string, replyTo?: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) { console.error("[booking-notify] Hiányzó RESEND_API_KEY"); return false; }
  const from = process.env.BOOKING_MAIL_FROM || process.env.RESEND_FROM || `${SIGN} <${CONTACT}>`;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject, html, text, ...(replyTo ? { reply_to: replyTo } : {}) }),
    });
    if (!res.ok) console.error("[booking-notify] Resend hiba", res.status, (await res.text()).slice(0, 300));
    return res.ok;
  } catch (e) {
    console.error("[booking-notify] Resend kivétel", e);
    return false;
  }
}

async function sendTelegram(text: string): Promise<boolean | null> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.BOOKING_TELEGRAM_CHAT_ID;
  if (!token || !chat) return null; // nincs beállítva — nem hiba
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chat, text: text.slice(0, 3500), disable_web_page_preview: true }),
    });
    if (!res.ok) console.error("[booking-notify] Telegram hiba", res.status);
    return res.ok;
  } catch (e) {
    console.error("[booking-notify] Telegram kivétel", e);
    return false;
  }
}

function adminRecipients(): string[] {
  return (process.env.BOOKING_NOTIFY_EMAILS || process.env.LEADS_NOTIFY_EMAIL || "")
    .split(",").map((s) => s.trim()).filter(Boolean);
}

/** Egysoros, kurtított, vezérlőkaraktertől mentes szöveg a Telegramhoz. */
function plainShort(s: string | null | undefined, max = 200): string {
  const t = (s ?? "").replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();
  return t.length > max ? t.slice(0, max - 1) + "…" : t;
}

type BookingRow = {
  id: string; kind: "idopont" | "visszahivas"; starts_at: string | null; host_id: string | null;
  name: string; company_name: string; email: string; phone: string; message: string | null;
};

async function loadBooking(id: string): Promise<(BookingRow & { hostName: string | null }) | null> {
  const admin = createAdminClient();
  const { data } = await admin.from("bookings")
    .select("id, kind, starts_at, host_id, name, company_name, email, phone, message").eq("id", id).maybeSingle();
  if (!data) return null;
  let hostName: string | null = null;
  if (data.host_id) {
    const { data: h } = await admin.from("booking_hosts").select("display_name").eq("user_id", data.host_id).maybeSingle();
    hostName = (h?.display_name as string | undefined) ?? null;
  }
  return { ...(data as BookingRow), hostName };
}

async function logEvent(bookingId: string, data: Record<string, unknown>) {
  await createAdminClient().from("booking_events").insert({ booking_id: bookingId, actor: "rendszer", kind: "ertesites", data });
}

/** Új foglalás után: visszaigazolás a látogatónak + értesítés Márknak és Tibinek. Soha nem dob hibát. */
export async function notifyNewBooking(bookingId: string, cancelToken: string, origin?: string): Promise<void> {
  try {
    const b = await loadBooking(bookingId);
    if (!b) return;
    const admin = createAdminClient();
    const when = b.starts_at ? fmtFullBudapest(b.starts_at) : null;

    // --- A látogatónak (terv 16: 2. és 3. pont) ---
    let visitorOk: boolean;
    if (b.kind === "idopont" && when) {
      const cancelUrl = `${siteUrl(origin)}/foglalas/lemondas?t=${encodeURIComponent(cancelToken)}`;
      const host = b.hostName ?? "Kollégánk";
      const text = `Szia!\n\nRögzítettük az ingyenes felmérési időpontodat: ${when}. ${host} telefonon hív erre a számra: ${b.phone}.\n\nHa nem jó, itt lemondhatod: ${cancelUrl}\n\nKérdésed van? ${CONTACT}\n\n${SIGN}`;
      const html = layout([
        "Szia!",
        `Rögzítettük az ingyenes felmérési időpontodat: <strong>${esc(when)}</strong>. ${esc(host)} telefonon hív erre a számra: ${esc(b.phone)}.`,
        "Ha nem jó, itt lemondhatod:",
      ], { label: "Lemondás", href: cancelUrl }, [`Kérdésed van? ${CONTACT}`]);
      visitorOk = await sendMail(b.email, `Foglalásodat rögzítettük — ${when}`, html, text, CONTACT);
    } else {
      const text = `Szia!\n\nMegkaptuk a megkeresésed, hamarosan keresünk ezen a számon: ${b.phone}.\n\nAddig is: ${CONTACT}\n\n${SIGN}`;
      const html = layout(["Szia!", `Megkaptuk a megkeresésed, hamarosan keresünk ezen a számon: ${esc(b.phone)}.`, `Addig is: ${CONTACT}`]);
      visitorOk = await sendMail(b.email, "Megkaptuk a kérésed", html, text, CONTACT);
    }
    if (visitorOk) await admin.from("bookings").update({ visitor_mail_sent_at: new Date().toISOString() }).eq("id", b.id);

    // --- Márknak és Tibinek (terv 16: 5. pont; az e-mail ugyanazt mondja) ---
    const head = b.kind === "idopont" && when ? `Új foglalás: ${when} · ${b.hostName ?? "?"}` : "Új visszahívási kérés";
    const lines = [head, `${plainShort(b.name, 120)}, ${plainShort(b.company_name, 160)}`, `${b.phone} · ${b.email}`];
    const msg = plainShort(b.message);
    if (msg) lines.push(msg);
    const recipients = adminRecipients();
    const adminMail = recipients.length
      ? await sendMail(recipients, head, layout(lines.map(esc)), lines.join("\n"), b.email)
      : false;
    const tg = await sendTelegram(lines.join("\n"));
    if (adminMail || tg) await admin.from("bookings").update({ admin_notified_at: new Date().toISOString() }).eq("id", b.id);

    await logEvent(b.id, { visitor_mail: visitorOk, admin_mail: adminMail, telegram: tg, recipients: recipients.length });
  } catch (e) {
    console.error("[booking-notify] notifyNewBooking", e);
  }
}

/** Lemondás után (látogató vagy admin): megerősítés a látogatónak + jelzés Márknak és Tibinek. Soha nem dob hibát. */
export async function notifyCanceledBooking(bookingId: string, by: "latogato" | "admin", origin?: string): Promise<void> {
  try {
    const b = await loadBooking(bookingId);
    if (!b) return;
    const when = b.starts_at ? fmtFullBudapest(b.starts_at) : null;

    // --- A látogatónak (terv 16: 4. pont) ---
    let visitorOk = false;
    if (when) {
      const site = siteUrl(origin);
      const text = `Szia!\n\nA(z) ${when} időpontot lemondtuk. Ha mégis szeretnél beszélni velünk, itt foglalhatsz újat: ${site.replace(/^https?:\/\//, "")}\n\n${SIGN}`;
      const html = layout(["Szia!", `A(z) ${esc(when)} időpontot lemondtuk. Ha mégis szeretnél beszélni velünk, itt foglalhatsz újat: <a href="${esc(site)}" style="color:#b4553a">${esc(site.replace(/^https?:\/\//, ""))}</a>`]);
      visitorOk = await sendMail(b.email, "Foglalásodat lemondtuk", html, text, CONTACT);
    }

    // --- Márknak és Tibinek ---
    const head = `Lemondva${by === "admin" ? " (admin)" : ""}: ${when ?? "visszahívási kérés"} · ${b.hostName ?? "-"}`;
    const lines = [head, `${plainShort(b.name, 120)}, ${plainShort(b.company_name, 160)}`, `${b.phone} · ${b.email}`];
    const recipients = adminRecipients();
    const adminMail = recipients.length ? await sendMail(recipients, head, layout(lines.map(esc)), lines.join("\n")) : false;
    const tg = await sendTelegram(lines.join("\n"));

    await logEvent(b.id, { cancel: by, visitor_mail: visitorOk, admin_mail: adminMail, telegram: tg });
  } catch (e) {
    console.error("[booking-notify] notifyCanceledBooking", e);
  }
}
