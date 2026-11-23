// /api/bookings/cancel — a látogató lemondja a foglalását a visszaigazoló levél linkjéből (terv 15 / 2. szakasz).
//   POST { token } → { ok } | { error }
// A lemondás CSAK itt, POST-tal történik (a levélben lévő link megnyitása önmagában semmit nem mond le).
// A token egyszer használatos: a DB-függvény a lemondáskor törli a hash-t. Hibás/lejárt tokennél általános üzenet.
import { after, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyCanceledBooking } from "@/lib/booking-notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GENERIC = "Ez a lemondási link már nem érvényes. Ha segítség kell, írj nekünk: office@twinx.hu.";

export async function POST(request: Request) {
  let body: { token?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: GENERIC }, { status: 400 }); }
  const token = typeof body.token === "string" ? body.token.trim() : "";
  if (token.length < 20 || token.length > 100) return NextResponse.json({ error: GENERIC }, { status: 400 });

  const hash = createHash("sha256").update(token).digest("hex");
  const { data, error } = await createAdminClient().rpc("cancel_booking_by_token", { p_token_hash: hash });
  if (error) return NextResponse.json({ error: "Most nem sikerült. Próbáld meg később, vagy írj nekünk: office@twinx.hu." }, { status: 500 });

  const r = data as { ok: boolean; booking_id?: string };
  if (!r.ok || !r.booking_id) return NextResponse.json({ error: GENERIC }, { status: 410 });

  const id = r.booking_id, origin = new URL(request.url).origin;
  after(() => notifyCanceledBooking(id, "latogato", origin));
  return NextResponse.json({ ok: true });
}
