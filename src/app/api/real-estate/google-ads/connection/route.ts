// GET /api/real-estate/google-ads/connection — összekötés állapota + customer_id.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { oauthConfigured } from "@/lib/google-ads-api";

export const runtime = "nodejs";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });

  const admin = createAdminClient();
  const { data } = await admin
    .from("google_ads_connections")
    .select("customer_id, login_customer_id, created_at")
    .eq("user_id", user.id)
    .maybeSingle();

  return NextResponse.json({
    configured: oauthConfigured(),
    connected: Boolean(data),
    customerId: data?.customer_id ?? null,
  });
}
