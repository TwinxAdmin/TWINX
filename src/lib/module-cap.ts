// Havi plafon az egyedi modulokra (terv 20) — CSAK szerver. Minden API-költséges művelet ezzel fut:
//   const r = await withModuleCap({ userId, moduleKey, operation, estimatedFt, requestKey }, async () => { …hívás… return { actualFt } });
// Sorrend: foglalás (DB, sorzár) → a költséges hívás → siker: elszámolás / hiba: feloldás. Ha a foglalás
// adatbázis-hibával megáll, a hívás NEM indul el (a védelem javára dönt). A küszöb-ellenőrzés (80% / 100%)
// a válasz után fut (after), értesítés: admin-jelzés + e-mail (BOOKING_NOTIFY_EMAILS) + Telegram, ha be van állítva.
import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { esc, layout, sendMail } from "@/lib/booking-notify";
import { moduleName } from "@/lib/module-registry";

/** A felhasználónak mutatott semleges szöveg leálláskor (terv 22 / 3. A) — számot, Ft-ot nem ír ki. */
export const CAP_STOP_TEXT = "A havi keret erre a funkcióra elfogyott, ezért most nem indítható. Az elkészült anyagaidat továbbra is eléred. Szóltunk a csapatnak.";

export type CapResult<T> =
  | { ok: true; value: T }
  | { ok: false; status: number; error: string };

export async function withModuleCap<T>(
  p: { userId: string; moduleKey: string; operation: string; estimatedFt: number; requestKey: string; units?: number },
  run: () => Promise<{ value: T; actualFt?: number | null; jobId?: string | null }>,
): Promise<CapResult<T>> {
  const admin = createAdminClient();
  // A felhasználó (vagy admin) melyik céges példányt használja: az első, amihez érvényes hozzáférése van.
  const { data: rows, error: e1 } = await admin.from("module_access").select("company_module_id")
    .eq("user_id", p.userId).eq("module_key", p.moduleKey).eq("status", "aktiv");
  if (e1) return { ok: false, status: 500, error: "A használat ellenőrzése most nem sikerült. Próbáld újra később." };
  let cmId: string | null = null;
  for (const r of rows ?? []) {
    const { data: ok } = await admin.rpc("user_has_module_access", { p_user: p.userId, p_cm: r.company_module_id });
    if (ok === true) { cmId = r.company_module_id as string; break; }
  }
  if (!cmId) {
    // Admin (próbához): a modul bármelyik céges példánya.
    const { data: prof } = await admin.from("profiles").select("role").eq("id", p.userId).maybeSingle();
    if (prof?.role === "admin") {
      const { data: any1 } = await admin.from("company_modules").select("id").eq("module_key", p.moduleKey).limit(1).maybeSingle();
      cmId = (any1?.id as string | undefined) ?? null;
    }
  }
  if (!cmId) return { ok: false, status: 403, error: "Ez a modul most nem érhető el. Kérdezd a cégvezetőt, vagy írj nekünk: office@twinx.hu." };

  const { data: res, error } = await admin.rpc("usage_reserve", {
    p_cm: cmId, p_user: p.userId, p_operation: p.operation, p_estimated_ft: Math.max(0, Math.round(p.estimatedFt)),
    p_request_key: p.requestKey, p_units: p.units ?? 1,
  });
  if (error) {
    console.error("[module-cap] foglalási hiba — a hívás nem indul el", error.message);
    return { ok: false, status: 500, error: "A használat ellenőrzése most nem sikerült. Próbáld újra később." };
  }
  const r = res as { ok: boolean; error?: string; event_id?: string };
  if (!r.ok) {
    if (r.error === "keret_elfogyott") { after(() => checkCapThresholds()); return { ok: false, status: 429, error: CAP_STOP_TEXT }; }
    return { ok: false, status: 403, error: "Ez a modul most nem érhető el. Kérdezd a cégvezetőt, vagy írj nekünk: office@twinx.hu." };
  }
  const eventId = r.event_id as string;
  try {
    const out = await run();
    await admin.rpc("usage_settle", { p_event: eventId, p_actual_ft: out.actualFt == null ? null : Math.round(out.actualFt), p_job: out.jobId ?? null });
    after(() => checkCapThresholds());
    return { ok: true, value: out.value };
  } catch (err) {
    await admin.rpc("usage_release", { p_event: eventId });
    throw err;
  }
}

/** Esedékes 80% / 100%-os jelzések kiküldése (egyszer / hónap / keret). Soha nem dob hibát. */
export async function checkCapThresholds(): Promise<number> {
  try {
    const admin = createAdminClient();
    const { data: due } = await admin.rpc("cap_thresholds_due");
    let sent = 0;
    for (const d of (due ?? []) as { company_module_id: string; period: string; threshold: number; used_ft: number; cap_ft: number }[]) {
      const { data: marked } = await admin.rpc("cap_mark_notified", { p_cm: d.company_module_id, p_period: d.period, p_threshold: d.threshold, p_cap: d.cap_ft });
      if (!marked) continue;   // más folyamat már kiküldte
      const { data: cm } = await admin.from("company_modules").select("module_key, company_id").eq("id", d.company_module_id).maybeSingle();
      const { data: c } = cm ? await admin.from("companies").select("name").eq("id", cm.company_id).maybeSingle() : { data: null };
      const head = `${d.threshold === 100 ? "Keret elfogyott (100%)" : "Keret 80%"}: ${(c?.name as string) ?? "?"} · ${moduleName((cm?.module_key as string) ?? "?")}`;
      const lines = [head, `Felhasználva: ${d.used_ft.toLocaleString("hu-HU")} Ft / ${d.cap_ft.toLocaleString("hu-HU")} Ft (nettó önköltség), időszak: ${d.period}`,
        d.threshold === 100 ? "A modul költséges műveletei leálltak a hónap végéig vagy a keret emeléséig (Admin → Előfizetések → ⋯)." : "Az Admin → Előfizetések lapon emelheted a keretet vagy adhatsz pluszcsomagot."];
      // Személyes adat (felhasználó neve, e-mail) nincs az üzenetben (terv 20 / 5.).
      const to = (process.env.BOOKING_NOTIFY_EMAILS || process.env.LEADS_NOTIFY_EMAIL || "").split(",").map((s) => s.trim()).filter(Boolean);
      if (to.length) await sendMail(to, head, layout(lines.map(esc)), lines.join("\n"));
      const token = process.env.TELEGRAM_BOT_TOKEN, chat = process.env.CAP_TELEGRAM_CHAT_ID || process.env.BOOKING_TELEGRAM_CHAT_ID;
      if (token && chat) {
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chat, text: lines.join("\n"), disable_web_page_preview: true }),
        }).catch(() => {});
      }
      await admin.from("access_audit_log").insert({ action: d.threshold === 100 ? "keret_100" : "keret_80", company_id: cm?.company_id ?? null,
        module_key: cm?.module_key ?? null, details: { period: d.period, used_ft: d.used_ft, cap_ft: d.cap_ft } });
      sent++;
    }
    return sent;
  } catch (e) {
    console.error("[module-cap] küszöb-ellenőrzés", e);
    return 0;
  }
}
