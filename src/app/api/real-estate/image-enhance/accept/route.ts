// POST /api/real-estate/image-enhance/accept
// A partner jóváhagyta az eredményt: csak EKKOR kerül be az elkészült munkák közé.
// Body: { mode, items: [{ original, enhanced }] }
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isEnhanceMode } from "@/lib/image-enhance";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const mode = String(body?.mode ?? "");
  if (!isEnhanceMode(mode)) return NextResponse.json({ error: "Érvénytelen mód." }, { status: 422 });

  const raw = Array.isArray(body?.items) ? body.items : [];
  const items = raw
    .map((i: { original?: unknown; enhanced?: unknown }) => ({ original: String(i?.original ?? ""), enhanced: String(i?.enhanced ?? "") }))
    .filter((i: { original: string; enhanced: string }) => i.enhanced);
  if (!items.length) return NextResponse.json({ error: "Nincs elfogadható kép." }, { status: 422 });

  const { data: job, error } = await supabase
    .from("image_enhance_jobs")
    .insert({ user_id: user.id, mode, items })
    .select("id, mode, items, created_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, job });
}
