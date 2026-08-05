// GET /api/real-estate/google-ads/oauth/callback — az OAuth visszahívó: tokenek
// begyűjtése és tárolása, majd vissza a modulra.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { exchangeCode, listAccessibleCustomers } from "@/lib/google-ads-api";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const back = `${url.origin}/dashboard/real-estate/fb-ads`;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${url.origin}/login`);

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const err = url.searchParams.get("error");
  if (err) return NextResponse.redirect(`${back}?gads=error`);
  if (!code || state !== user.id) return NextResponse.redirect(`${back}?gads=error`);

  try {
    const redirectUri = `${url.origin}/api/real-estate/google-ads/oauth/callback`;
    const tok = await exchangeCode(code, redirectUri);
    if (!tok.refresh_token) return NextResponse.redirect(`${back}?gads=norefresh`);

    let customerId: string | null = null;
    try {
      const ids = await listAccessibleCustomers(tok.access_token);
      customerId = ids[0] ?? null;
    } catch { customerId = null; }

    const admin = createAdminClient();
    await admin.from("google_ads_connections").upsert({
      user_id: user.id,
      refresh_token: tok.refresh_token,
      customer_id: customerId,
      updated_at: new Date().toISOString(),
    });

    return NextResponse.redirect(`${back}?gads=connected`);
  } catch {
    return NextResponse.redirect(`${back}?gads=error`);
  }
}
