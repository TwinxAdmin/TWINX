// POST /api/real-estate/google-ads/upload — a generált CSV alapján NATÍV feltöltés
// a partner összekötött Google Ads fiókjába (Search kampány, minden PAUSED).
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  refreshAccessToken, parseGoogleAdsCsv, createSearchCampaign, oauthConfigured,
} from "@/lib/google-ads-api";

export const runtime = "nodejs";
export const maxDuration = 90;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });
  if (!oauthConfigured()) {
    return NextResponse.json({ error: "A Google Ads integráció nincs beállítva (dev-token / OAuth kliens)." }, { status: 503 });
  }

  let body: { csv?: string; dailyBudgetHuf?: number | string; endDate?: string; location?: string; customerId?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Érvénytelen kérés." }, { status: 400 }); }

  const csv = String(body.csv ?? "").trim();
  const dailyBudgetHuf = Math.round(Number(body.dailyBudgetHuf));
  const endDate = String(body.endDate ?? "").trim();
  const location = String(body.location ?? "").trim();

  if (!csv) return NextResponse.json({ error: "Hiányzó CSV." }, { status: 422 });
  if (!Number.isFinite(dailyBudgetHuf) || dailyBudgetHuf <= 0) {
    return NextResponse.json({ error: "Adj meg egy érvényes napi keretet (HUF)." }, { status: 422 });
  }
  if (!endDate) return NextResponse.json({ error: "Adj meg egy lejárati dátumot." }, { status: 422 });

  const parsed = parseGoogleAdsCsv(csv);
  if (!parsed || !parsed.finalUrl || !parsed.keywords.length) {
    return NextResponse.json({ error: "A CSV nem értelmezhető (hiányzó Final URL vagy kulcsszó)." }, { status: 422 });
  }

  const admin = createAdminClient();
  const { data: conn } = await admin
    .from("google_ads_connections")
    .select("refresh_token, customer_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!conn?.refresh_token) {
    return NextResponse.json({ error: "Előbb kösd össze a Google Ads fiókodat.", needsConnect: true }, { status: 400 });
  }
  const customerId = String(body.customerId || conn.customer_id || "").replace(/\D/g, "");
  if (!customerId) {
    return NextResponse.json({ error: "Hiányzó Google Ads ügyfél-ID. Add meg kézzel." }, { status: 422 });
  }

  try {
    const accessToken = await refreshAccessToken(conn.refresh_token);
    const result = await createSearchCampaign({
      customerId, accessToken, parsed, dailyBudgetHuf, endDate, locationName: location || undefined,
    });
    return NextResponse.json({ ok: true, result });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || "A feltöltés nem sikerült." }, { status: 500 });
  }
}
