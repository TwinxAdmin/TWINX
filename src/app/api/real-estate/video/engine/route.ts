// GET /api/real-estate/video/engine — melyik videómotor fut most (bejelentkezett partnernek).
// A videó-szerkesztő ez alapján mutatja a saját motor sablonjait (Aurora, Skandi …)
// vagy — vészhelyzeti Shotstack-módban — a régi sablonválasztót.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { activeRenderer } from "@/lib/video-renderer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });
  return NextResponse.json({ renderer: await activeRenderer() });
}
