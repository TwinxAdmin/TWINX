// GET /api/admin/metrics — admin-only metrikák (bevétel, költség, profit).
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getMetrics } from "@/lib/metrics";

export const runtime = "nodejs";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });
  }

  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (me?.role !== "admin") {
    return NextResponse.json({ error: "Csak admin." }, { status: 403 });
  }

  const metrics = await getMetrics();
  return NextResponse.json(metrics);
}
