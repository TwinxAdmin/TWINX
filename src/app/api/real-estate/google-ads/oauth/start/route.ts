// GET /api/real-estate/google-ads/oauth/start — a Google Ads fiók összekötésének indítása.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildAuthUrl, oauthConfigured } from "@/lib/google-ads-api";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });
  if (!oauthConfigured()) {
    return NextResponse.json(
      { error: "A Google Ads OAuth nincs beállítva (GOOGLE_ADS_OAUTH_CLIENT_ID/SECRET, GOOGLE_ADS_DEVELOPER_TOKEN)." },
      { status: 503 }
    );
  }
  const origin = new URL(request.url).origin;
  const redirectUri = `${origin}/api/real-estate/google-ads/oauth/callback`;
  return NextResponse.redirect(buildAuthUrl(redirectUri, user.id));
}
