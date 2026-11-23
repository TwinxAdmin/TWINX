// Lejárati figyelmeztetés az adminnak (terv 19 / 5.): 3 és 1 nappal a lejárat előtt, egy lejáratra egyszer.
// E-mail (BOOKING_NOTIFY_EMAILS) + Telegram, ha be van állítva. Cégnek az első fázisban nem megy levél.
// Soha nem dob hibát (a napi cron hívja).
import { createAdminClient } from "@/lib/supabase/admin";
import { esc, layout, sendMail } from "@/lib/booking-notify";
import { moduleName } from "@/lib/module-registry";
import { PAYMENT_STATUS, type PaymentStatus } from "@/lib/finance";

export async function notifyExpiries(): Promise<number> {
  try {
    const admin = createAdminClient();
    const { data: due, error } = await admin.rpc("expiry_notifications_due");
    if (error) return 0;   // a finance migráció előtt
    let sent = 0;
    for (const d of (due ?? []) as { company_module_id: string; valid_until: string; days_before: number }[]) {
      const { data: marked } = await admin.rpc("expiry_mark_notified", { p_cm: d.company_module_id, p_valid_until: d.valid_until, p_days: d.days_before });
      if (!marked) continue;
      const { data: cm } = await admin.from("company_modules").select("company_id, module_key").eq("id", d.company_module_id).maybeSingle();
      const { data: c } = cm ? await admin.from("companies").select("name").eq("id", cm.company_id).maybeSingle() : { data: null };
      const { data: last } = await admin.from("company_payments").select("status").eq("company_module_id", d.company_module_id)
        .eq("kind", "havi_dij").order("created_at", { ascending: false }).limit(1).maybeSingle();
      const head = `Lejár ${d.days_before} nap múlva: ${(c?.name as string) ?? "?"} · ${moduleName((cm?.module_key as string) ?? "?")}`;
      const lines = [head, `Lejárat: ${d.valid_until}`,
        `Legutóbbi havi díj: ${last ? PAYMENT_STATUS[last.status as PaymentStatus].label : "nincs tétel"}`, "Admin → Pénzügy / Előfizetések"];
      const to = (process.env.BOOKING_NOTIFY_EMAILS || process.env.LEADS_NOTIFY_EMAIL || "").split(",").map((s) => s.trim()).filter(Boolean);
      if (to.length) await sendMail(to, head, layout(lines.map(esc)), lines.join("\n"));
      const token = process.env.TELEGRAM_BOT_TOKEN, chat = process.env.CAP_TELEGRAM_CHAT_ID || process.env.BOOKING_TELEGRAM_CHAT_ID;
      if (token && chat) {
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chat, text: lines.join("\n"), disable_web_page_preview: true }) }).catch(() => {});
      }
      sent++;
    }
    return sent;
  } catch (e) {
    console.error("[expiry-notify]", e);
    return 0;
  }
}
