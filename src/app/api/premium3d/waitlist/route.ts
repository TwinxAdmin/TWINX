// /api/premium3d/waitlist — „Értesíts, ha elérhető" (Prémium 3D várólista).
//   GET  → { subscribed: boolean }  (a bejelentkezett felhasználó fel van-e iratkozva)
//   POST → feliratkozás (ismételten is biztonságos) → { subscribed: true }
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isOnWaitlist, joinWaitlist } from "@/lib/premium3d";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function currentUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });
  return NextResponse.json({ subscribed: await isOnWaitlist(user.id) }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });
  const r = await joinWaitlist(user.id);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 500 });
  return NextResponse.json({ subscribed: true });
}
