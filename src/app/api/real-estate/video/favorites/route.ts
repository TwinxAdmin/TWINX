// /api/real-estate/video/favorites — a partner kedvenc videósablonjai.
//   GET  → { favorites: string[] }          (sablon-azonosítók, pl. ["mozaik"])
//   POST { templateId, favorite: boolean }   → csillagozás / visszavonás
// Tábla: video_template_favorites (video-favorites.sql) — RLS: mindenki csak a sajátját.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ENGINE_TEMPLATES } from "@/lib/video-engine/templates/index";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KNOWN = new Set(ENGINE_TEMPLATES.map((t) => t.id));

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });
  const { data, error } = await supabase
    .from("video_template_favorites")
    .select("template_id")
    .eq("user_id", user.id);
  // Ha a tábla még nincs létrehozva: üres lista (a szerkesztő ettől még működik).
  if (error) return NextResponse.json({ favorites: [], unavailable: true });
  return NextResponse.json({ favorites: (data ?? []).map((r) => r.template_id as string).filter((id) => KNOWN.has(id)) });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });

  // 1) Validáció
  let body: { templateId?: unknown; favorite?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Érvénytelen kérés." }, { status: 400 }); }
  const templateId = String(body.templateId ?? "");
  if (!KNOWN.has(templateId)) return NextResponse.json({ error: "Ismeretlen sablon." }, { status: 422 });
  const favorite = body.favorite === true;

  // 2) Mentés
  const { error } = favorite
    ? await supabase.from("video_template_favorites").upsert({ user_id: user.id, template_id: templateId }, { onConflict: "user_id,template_id", ignoreDuplicates: true })
    : await supabase.from("video_template_favorites").delete().eq("user_id", user.id).eq("template_id", templateId);
  if (error) {
    // A tábla még nincs létrehozva (video-favorites.sql nem futott le) → érthető üzenet.
    const missingTable = error.code === "42P01" || error.code === "PGRST205" || /video_template_favorites/.test(error.message ?? "");
    console.error("[video/favorites]", error.code, error.message);
    return NextResponse.json({
      error: missingTable
        ? "A kedvencek még nincsenek bekapcsolva (hiányzik az adatbázis-tábla: futtasd a video-favorites.sql-t a Supabase-ben)."
        : `A kedvenc mentése nem sikerült (${error.message}).`,
    }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
