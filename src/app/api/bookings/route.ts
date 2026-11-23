// /api/bookings — ingyenes felmérés foglalása a kapcsolatblokkból (terv 15 / 1., 4., 7. szakasz).
//   GET  → { slots: PublicSlot[] }   — csak kezdés, hossz, gazda-név (+ átlátszó időpont-kulcs); 24 óra–30 nap
//   POST { slotId|null, name, company, email, phone, message, consent, source, website(honeypot) }
//        → { ok, kind, startsAt?, hostName? } | { error, code?, errors? }
//
// ELŐNÉZET (D51): amíg a BOOKINGS_PUBLIC=1 környezeti változó nincs beállítva, csak admin érheti el.
// Biztonság: szerveroldali validáció; honeypot; sebességkorlát IP-hash és e-mail szerint; a user_id a
// munkamenetből jön; a foglalás és az időpont lefoglalása egy DB-tranzakcióban (create_booking).
// A lemondási tokennek csak a hash-e kerül az adatbázisba; a nyers token csak a visszaigazoló levél linkjében szerepel.
// Az értesítések a válasz UTÁN mennek ki (after) — a hibájuk nem érinti a foglalást.
import { after, NextResponse } from "next/server";
import { createHash, randomBytes } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyNewBooking } from "@/lib/booking-notify";
import {
  BOOKING_CONSENT_VERSION, BOOKING_MIGRATION, BOOKING_SOURCES,
  normalizePhone, validateBooking, type BookingSource, type PublicSlot,
} from "@/lib/bookings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LIMIT_IP_PER_HOUR = 8;
const LIMIT_EMAIL_PER_DAY = 4;
const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");

/** Ki érheti el: élesítésig csak admin (D51). Visszaadja a belépett felhasználó azonosítóját is. */
async function gate(): Promise<{ allowed: boolean; userId: string | null }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (process.env.BOOKINGS_PUBLIC === "1") return { allowed: true, userId: user?.id ?? null };
  if (!user) return { allowed: false, userId: null };
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  return { allowed: me?.role === "admin", userId: user.id };
}

const busyMsg = "Most nem sikerült. Próbáld meg később, vagy írj nekünk: office@twinx.hu.";
const migrationMsg = (m: string) => (/bookings|availability_|booking_|function .* does not exist/i.test(m)
  ? `Futtasd le a ${BOOKING_MIGRATION} migrációt.` : busyMsg);

export async function GET() {
  if (!(await gate()).allowed) return NextResponse.json({ error: "Nem elérhető." }, { status: 404 });
  const { data, error } = await createAdminClient().rpc("booking_free_slots");
  if (error) return NextResponse.json({ error: migrationMsg(error.message), slots: [] }, { status: 500 });
  const slots: PublicSlot[] = ((data ?? []) as { slot_id: string; starts_at: string; duration_min: number; host_name: string }[])
    .map((r) => ({ id: r.slot_id, startsAt: r.starts_at, durationMin: r.duration_min, hostName: r.host_name }));
  return NextResponse.json({ slots });
}

export async function POST(request: Request) {
  const g = await gate();
  if (!g.allowed) return NextResponse.json({ error: "Nem elérhető." }, { status: 404 });

  let b: Record<string, unknown>;
  try { b = await request.json(); } catch { return NextResponse.json({ error: "Érvénytelen kérés." }, { status: 400 }); }

  // Honeypot: ember nem tölti ki. A robot „sikert" lát, de nem mentünk semmit.
  if (typeof b.website === "string" && b.website.trim() !== "") return NextResponse.json({ ok: true, kind: "visszahivas" });

  const input = {
    slotId: typeof b.slotId === "string" && b.slotId ? b.slotId : null,
    name: String(b.name ?? ""), company: String(b.company ?? ""), email: String(b.email ?? ""),
    phone: String(b.phone ?? ""), message: String(b.message ?? ""), consent: b.consent === true,
  };
  const errors = validateBooking(input);
  if (Object.keys(errors).length) return NextResponse.json({ error: "Nézd át a megjelölt mezőket.", errors }, { status: 422 });
  const source: BookingSource = BOOKING_SOURCES.includes(b.source as BookingSource) ? (b.source as BookingSource) : "fooldal";
  const email = input.email.trim().toLowerCase();

  // Sebességkorlát: IP-hash / óra és e-mail / nap. Minden próbálkozás számít, a sikertelen is.
  const admin = createAdminClient();
  const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "ismeretlen";
  const ipHash = sha256(`twinx-booking:${ip}`);
  const hourAgo = new Date(Date.now() - 3600_000).toISOString();
  const dayAgo = new Date(Date.now() - 24 * 3600_000).toISOString();
  const [byIp, byEmail] = await Promise.all([
    admin.from("booking_attempts").select("id", { count: "exact", head: true }).eq("ip_hash", ipHash).gte("created_at", hourAgo),
    admin.from("booking_attempts").select("id", { count: "exact", head: true }).eq("email", email).gte("created_at", dayAgo),
  ]);
  if (byIp.error) return NextResponse.json({ error: migrationMsg(byIp.error.message) }, { status: 500 });
  if ((byIp.count ?? 0) >= LIMIT_IP_PER_HOUR || (byEmail.count ?? 0) >= LIMIT_EMAIL_PER_DAY) {
    return NextResponse.json({ error: busyMsg, code: "rate_limited" }, { status: 429 });
  }
  await admin.from("booking_attempts").insert({ ip_hash: ipHash, email });

  const token = randomBytes(32).toString("base64url");
  const { data, error } = await admin.rpc("create_booking", {
    p_slot_id: input.slotId, p_name: input.name.trim(), p_company: input.company.trim(), p_email: email,
    p_phone: normalizePhone(input.phone), p_message: input.message.trim() || null, p_user_id: g.userId,
    p_source: source, p_consent_version: BOOKING_CONSENT_VERSION, p_cancel_token_hash: sha256(token),
  });
  if (error) return NextResponse.json({ error: migrationMsg(error.message) }, { status: 500 });

  const r = data as { ok: boolean; error?: string; booking_id?: string; starts_at?: string | null; host_name?: string | null };
  if (!r.ok) {
    if (r.error === "idopont_elkelt" || r.error === "ervenytelen_idopont") {
      return NextResponse.json({ error: "Ezt az időpontot közben valaki lefoglalta. Válassz másikat.", code: "idopont_elkelt" }, { status: 409 });
    }
    if (r.error === "mar_van_foglalas") {
      return NextResponse.json({
        error: "Ezzel az e-mail címmel vagy telefonszámmal már van aktív foglalás. Módosítani a visszaigazoló levél lemondási linkjével tudod, vagy írj nekünk: office@twinx.hu.",
        code: "mar_van_foglalas",
      }, { status: 409 });
    }
    return NextResponse.json({ error: busyMsg }, { status: 500 });
  }

  const bookingId = r.booking_id as string;
  const origin = new URL(request.url).origin;
  after(() => notifyNewBooking(bookingId, token, origin));
  return NextResponse.json({
    ok: true, kind: input.slotId ? "idopont" : "visszahivas",
    startsAt: r.starts_at ?? null, hostName: r.host_name ?? null,
  });
}
