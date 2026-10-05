// GET /api/admin/video-engine — melyik videómotor fut (CSAK admin).
// Az admin fejlécében lévő jelzés olvassa: Shotstack vagy saját TWINX motor.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStaffRole } from "@/lib/staff";
import { rendererInfo } from "@/lib/video-renderer";

export const runtime = "nodejs";

export async function GET() {
  const supabase = await createClient();
  const staff = await getStaffRole(supabase);
  if (!staff || staff.role !== "admin") {
    return NextResponse.json({ error: "Nincs jogosultság." }, { status: 403 });
  }
  return NextResponse.json({
    ...rendererInfo(),
    // A jelzés localhoston mást mond (ott fejlesztünk), mint élesben.
    local: process.env.NODE_ENV !== "production",
  });
}
