// /api/admin/bookings/availability — Admin → Foglalások → Időpontok (CSAK admin; terv 15 / 5.B).
//   GET  → { migrated, hosts, templates, slots }  (slots: a mai naptól 5 hétre, a törölteket nem)
//   POST { action, ... } → ugyanez a payload, frissítve:
//     add_template     { hostId, weekday (1–7), start "HH:MM", end "HH:MM", slotMinutes }
//     toggle_template  { id, active }
//     delete_template  { id }
//     apply_templates  {}                      — a következő 4 hétre időpontokat hoz létre (ismételhető)
//     add_slot         { hostId, date "YYYY-MM-DD", time "HH:MM", duration }
//     delete_slot      { id, cancelBooking? }  — lefoglaltnál csak cancelBooking=true-val (a foglalás lemondódik)
// Az időpontokat érintő írás a DB-függvényeken át megy (átfedés-tiltás, tranzakció); a sablon sima táblaírás.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStaffRole } from "@/lib/staff";
import {
  BOOKING_MIGRATION, budapestToUtcIso,
  type AdminSlot, type AvailabilityTemplate, type BookingHost,
} from "@/lib/bookings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireAdmin() {
  const staff = await getStaffRole(await createClient());
  return staff && staff.role === "admin" ? staff : null;
}

const missing = (msg: string) => /booking_hosts|availability_|bookings|function .* does not exist/i.test(msg);
const fail = (msg: string, status = 500) =>
  NextResponse.json({ error: missing(msg) ? `Futtasd le a ${BOOKING_MIGRATION} migrációt.` : msg }, { status });

async function payload() {
  const admin = createAdminClient();
  const from = new Date(Date.now() - 24 * 3600_000).toISOString();
  const to = new Date(Date.now() + 35 * 24 * 3600_000).toISOString();
  const [h, t, s] = await Promise.all([
    admin.from("booking_hosts").select("user_id, display_name, active").order("display_name"),
    admin.from("availability_templates").select("id, host_id, weekday, start_time, end_time, slot_minutes, active")
      .order("weekday").order("start_time"),
    admin.from("availability_slots").select("id, host_id, starts_at, duration_min, status, template_id")
      .neq("status", "torolve").gte("starts_at", from).lte("starts_at", to).order("starts_at").limit(1000),
  ]);
  const err = h.error ?? t.error ?? s.error;
  if (err) return { migrated: !missing(err.message), error: err.message, hosts: [], templates: [], slots: [] };

  // A lefoglalt időpontokhoz a foglaló neve (csak név + cég; a többi adat a Beérkezett fülön).
  const bookedIds = (s.data ?? []).filter((x) => x.status === "foglalt").map((x) => x.id as string);
  const booked = new Map<string, string>();
  if (bookedIds.length) {
    const { data: b } = await admin.from("bookings").select("slot_id, name, company_name")
      .in("slot_id", bookedIds).in("status", ["uj", "egyeztetve"]);
    for (const r of b ?? []) booked.set(r.slot_id as string, `${r.name} · ${r.company_name}`);
  }

  const hosts: BookingHost[] = (h.data ?? []).map((r) => ({ userId: r.user_id, name: r.display_name, active: r.active }));
  const templates: AvailabilityTemplate[] = (t.data ?? []).map((r) => ({
    id: r.id, hostId: r.host_id, weekday: r.weekday, start: String(r.start_time).slice(0, 5),
    end: String(r.end_time).slice(0, 5), slotMinutes: r.slot_minutes, active: r.active,
  }));
  const slots: AdminSlot[] = (s.data ?? []).map((r) => ({
    id: r.id, hostId: r.host_id, startsAt: r.starts_at, durationMin: r.duration_min, status: r.status,
    fromTemplate: !!r.template_id, bookedBy: booked.get(r.id) ?? null,
  }));
  return { migrated: true, hosts, templates, slots };
}

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Nincs jogosultság." }, { status: 403 });
  return NextResponse.json(await payload());
}

const TIME = /^\d{2}:\d{2}$/;

export async function POST(request: Request) {
  const staff = await requireAdmin();
  if (!staff) return NextResponse.json({ error: "Nincs jogosultság." }, { status: 403 });

  let b: Record<string, unknown>;
  try { b = await request.json(); } catch { return NextResponse.json({ error: "Érvénytelen kérés." }, { status: 400 }); }
  const admin = createAdminClient();
  const action = String(b.action ?? "");
  let notice: string | undefined;

  if (action === "add_template") {
    const weekday = Number(b.weekday), slotMinutes = Number(b.slotMinutes ?? 45);
    const start = String(b.start ?? ""), end = String(b.end ?? "");
    if (!(weekday >= 1 && weekday <= 7) || !TIME.test(start) || !TIME.test(end) || !(slotMinutes >= 15 && slotMinutes <= 240)) {
      return NextResponse.json({ error: "Hiányos vagy hibás adat." }, { status: 422 });
    }
    if (end <= start) return NextResponse.json({ error: "A vége legyen később, mint a kezdete." }, { status: 422 });
    const { error } = await admin.from("availability_templates")
      .insert({ host_id: String(b.hostId ?? ""), weekday, start_time: start, end_time: end, slot_minutes: slotMinutes });
    if (error) return fail(/foreign key/i.test(error.message) ? "Ismeretlen gazda." : error.message, 422);
  } else if (action === "toggle_template") {
    const { error } = await admin.from("availability_templates").update({ active: !!b.active }).eq("id", String(b.id ?? ""));
    if (error) return fail(error.message);
  } else if (action === "delete_template") {
    // A már létrehozott időpontok megmaradnak (template_id → null).
    const { error } = await admin.from("availability_templates").delete().eq("id", String(b.id ?? ""));
    if (error) return fail(error.message);
  } else if (action === "apply_templates") {
    const { data, error } = await admin.rpc("admin_apply_templates", { p_admin_id: staff.userId, p_weeks: 4 });
    if (error) return fail(error.message);
    notice = Number(data) > 0 ? `${data} új időpont jött létre.` : "Nem jött létre új időpont (a sablon időpontjai már megvannak).";
  } else if (action === "add_slot") {
    const iso = budapestToUtcIso(String(b.date ?? ""), String(b.time ?? ""));
    if (!iso) return NextResponse.json({ error: "Adj meg napot és időt." }, { status: 422 });
    const { data, error } = await admin.rpc("admin_add_slot", {
      p_host_id: String(b.hostId ?? ""), p_starts_at: iso, p_duration: Number(b.duration ?? 45), p_admin_id: staff.userId,
    });
    if (error) return fail(error.message);
    const r = data as { ok: boolean; error?: string };
    if (!r.ok) {
      const msg = r.error === "atfedes" ? "Ennél a gazdánál erre az időre már van időpont."
        : r.error === "multbeli" ? "Múltbeli időpontot nem lehet felvenni." : "Ismeretlen gazda.";
      return NextResponse.json({ error: msg }, { status: 422 });
    }
  } else if (action === "delete_slot") {
    const { data, error } = await admin.rpc("admin_delete_slot", {
      p_slot_id: String(b.id ?? ""), p_admin_id: staff.userId, p_cancel_booking: b.cancelBooking === true,
    });
    if (error) return fail(error.message);
    const r = data as { ok: boolean; error?: string; canceled?: { ok: boolean } | null };
    if (!r.ok) {
      if (r.error === "foglalt") return NextResponse.json({ error: "foglalt", needsConfirm: true }, { status: 409 });
      return NextResponse.json({ error: "Az időpont már nem létezik." }, { status: 404 });
    }
    // A látogató értesítése a lemondásról: a 2d lépésben (e-mailek) kerül ide.
    if (r.canceled?.ok) notice = "Az időpont törölve, a foglalás lemondva.";
  } else {
    return NextResponse.json({ error: "Ismeretlen művelet." }, { status: 400 });
  }

  return NextResponse.json({ ...(await payload()), notice });
}
