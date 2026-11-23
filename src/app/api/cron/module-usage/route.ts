// GET /api/cron/module-usage — napi karbantartás (Vercel Cron, vercel.json; terv 20 / 4.): az elakadt (60 percnél
// régebbi, el nem számolt) foglalások feloldása és az esedékes 80% / 100%-os keret-jelzések kiküldése.
// Védelem: CRON_SECRET (Authorization: Bearer …).
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkCapThresholds } from "@/lib/module-cap";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Nincs jogosultság." }, { status: 401 });
  }
  const { data: released, error } = await createAdminClient().rpc("usage_release_stale", { p_minutes: 60 });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const notified = await checkCapThresholds();
  return NextResponse.json({ released, notified });
}
