// /api/admin/bookings — Admin → Foglalások → Beérkezett (CSAK admin; terv 15 / 5.A).
//   GET            → { migrated, me, hosts, bookings: AdminBooking[] }   (legfeljebb 200, a legújabb elöl)
//   GET ?id=…      → { events: BookingEvent[] }                         (a kibontott sor története)
//   POST { action, id, … } → frissített lista:
//     set_status { status }  — az állapotgép szerint (DB-függvény, naplózva)
//     note       { note }    — belső jegyzet (naplózva)
//     cancel     {}          — admin-lemondás; a látogató és a gazdák értesítést kapnak
//     resend     {}          — a ki nem ment értesítés újraküldése (látogató: új lemondási linkkel)
// A cancel_token_hash SOSEM megy ki; a látogató szabad szövege csak szövegként jelenik meg a felületen.
import { after, NextResponse } from "next/server";
import { createHash, randomBytes } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStaffRole } from "@/lib/staff";
import { notifyCanceledBooking, notifyNewBooking } from "@/lib/booking-notify";
import { BOOKING_MIGRATION, type AdminBooking, type BookingEvent, type BookingStatus } from "@/lib/bookings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireAdmin() {
  const staff = await getStaffRole(await createClient());
  return staff && staff.role === "admin" ? staff : null;
}
const missing = (m: string) => /bookings|booking_|function .* does not exist/i.test(m);

const COLS = "id, kind, status, starts_at, host_id, name, company_name, email, phone, message, source, created_at, updated_at, " +
  "visitor_mail_sent_at, admin_notified_at, admin_note, handled_by, canceled_at, canceled_by, user_id";

async function payload(userId: string) {
  const admin = createAdminClient();
  const [b, h] = await Promise.all([
    admin.from("bookings").select(COLS).order("created_at", { ascending: false }).limit(200),
    admin.from("booking_hosts").select("user_id, display_name"),
  ]);
  if (b.error) return { migrated: !missing(b.error.message), error: b.error.message, me: userId, hosts: [], bookings: [] };
  const hostName = new Map((h.data ?? []).map((r) => [r.user_id as string, r.display_name as string]));
  const bookings: AdminBooking[] = (b.data ?? []).map((r) => {
    const x = r as unknown as Record<string, string | null>;
    return {
      id: x.id as string, kind: x.kind as AdminBooking["kind"], status: x.status as BookingStatus,
      startsAt: x.starts_at, hostId: x.host_id, hostName: x.host_id ? hostName.get(x.host_id) ?? null : null,
      name: x.name as string, company: x.company_name as string, email: x.email as string, phone: x.phone as string,
      message: x.message, source: x.source as string, createdAt: x.created_at as string,
      visitorMailSentAt: x.visitor_mail_sent_at, adminNotifiedAt: x.admin_notified_at, note: x.admin_note,
      handledBy: x.handled_by ? hostName.get(x.handled_by) ?? "admin" : null,
      canceledBy: x.canceled_by as AdminBooking["canceledBy"], registered: !!x.user_id,
    };
  });
  return { migrated: true, me: userId, hosts: [...hostName.entries()].map(([id, name]) => ({ id, name })), bookings };
}

export async function GET(request: Request) {
  const staff = await requireAdmin();
  if (!staff) return NextResponse.json({ error: "Nincs jogosultság." }, { status: 403 });
  const id = new URL(request.url).searchParams.get("id");
  if (id) {
    const { data } = await createAdminClient().from("booking_events")
      .select("id, actor, kind, data, created_at").eq("booking_id", id).order("created_at");
    const events: BookingEvent[] = (data ?? []).map((e) => ({
      id: e.id as number, actor: e.actor as string, kind: e.kind as string,
      data: (e.data as Record<string, unknown> | null) ?? null, at: e.created_at as string,
    }));
    return NextResponse.json({ events });
  }
  return NextResponse.json(await payload(staff.userId));
}

const STATUS_ERR: Record<string, string> = {
  tiltott_valtas: "Ebből az állapotból ide nem lehet váltani.",
  nincs_ilyen: "A foglalás nem található.",
};

export async function POST(request: Request) {
  const staff = await requireAdmin();
  if (!staff) return NextResponse.json({ error: "Nincs jogosultság." }, { status: 403 });
  let b: Record<string, unknown>;
  try { b = await request.json(); } catch { return NextResponse.json({ error: "Érvénytelen kérés." }, { status: 400 }); }
  const admin = createAdminClient();
  const id = String(b.id ?? "");
  const origin = new URL(request.url).origin;
  let notice: string | undefined;

  switch (String(b.action ?? "")) {
    case "set_status": {
      const { data, error } = await admin.rpc("admin_set_booking_status", {
        p_booking_id: id, p_status: String(b.status ?? ""), p_admin_id: staff.userId,
      });
      if (error) return NextResponse.json({ error: missing(error.message) ? `Futtasd le a ${BOOKING_MIGRATION} migrációt.` : error.message }, { status: 500 });
      const r = data as { ok: boolean; error?: string };
      if (!r.ok) return NextResponse.json({ error: STATUS_ERR[r.error ?? ""] ?? "Nem sikerült." }, { status: 422 });
      notice = "Állapot módosítva.";
      break;
    }
    case "note": {
      const note = String(b.note ?? "").trim().slice(0, 2000);
      const { error } = await admin.from("bookings")
        .update({ admin_note: note || null, handled_by: staff.userId, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      await admin.from("booking_events").insert({ booking_id: id, actor: "admin", actor_id: staff.userId, kind: "jegyzet" });
      notice = "Jegyzet mentve.";
      break;
    }
    case "cancel": {
      const { data, error } = await admin.rpc("admin_cancel_booking", { p_booking_id: id, p_admin_id: staff.userId });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      if (!(data as { ok: boolean }).ok) return NextResponse.json({ error: "A foglalás már nem aktív." }, { status: 409 });
      after(() => notifyCanceledBooking(id, "admin", origin));
      notice = "Foglalás lemondva, az időpont újra szabad. A látogató értesítést kap.";
      break;
    }
    case "resend": {
      const { data: row } = await admin.from("bookings")
        .select("status, kind, starts_at, visitor_mail_sent_at, admin_notified_at").eq("id", id).maybeSingle();
      if (!row) return NextResponse.json({ error: "A foglalás nem található." }, { status: 404 });
      const active = row.status === "uj" || row.status === "egyeztetve";
      const visitor = !row.visitor_mail_sent_at && active;
      const admins = !row.admin_notified_at;
      if (!visitor && !admins) return NextResponse.json({ error: "Nincs újraküldendő értesítés." }, { status: 409 });
      // A régi lemondási link nyers tokenje nincs meg (csak a hash-e) — új tokent adunk, a régi érvénytelen lesz.
      const token = randomBytes(32).toString("base64url");
      if (visitor) {
        await admin.from("bookings").update({ cancel_token_hash: createHash("sha256").update(token).digest("hex") }).eq("id", id);
      }
      const res = await notifyNewBooking(id, token, origin, { visitor, admins });
      const ok = (!visitor || res.visitor) && (!admins || res.admins);
      if (!ok) return NextResponse.json({ error: "Az újraküldés nem sikerült. A részletek a fejlesztői naplóban (pl. a Resend domain-hitelesítése)." }, { status: 502 });
      notice = "Értesítés elküldve.";
      break;
    }
    default:
      return NextResponse.json({ error: "Ismeretlen művelet." }, { status: 400 });
  }
  return NextResponse.json({ ...(await payload(staff.userId)), notice });
}
