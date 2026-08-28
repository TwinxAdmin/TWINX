// POST /api/real-estate/assets/name — egy kép saját elnevezése (vagy a név törlése).
//
// A képek nem adatbázis-sorok, hanem URL-ek, ezért a nevet külön táblában
// tároljuk (asset_item_names, lásd asset-item-names.sql). A név csak a felületen
// jelenik meg, a fájl neve a tárhelyen nem változik.
//
// BIZTONSÁG: a sima (user) klienssel írunk, így az RLS garantálja, hogy
// mindenki csak a saját elnevezéseit hozza létre és módosítja.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const MAX_NAME = 120;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });

  let body: { url?: string; name?: string };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Érvénytelen kérés." }, { status: 400 }); }

  const url = String(body.url ?? "").trim();
  if (!url || !/^https?:\/\//.test(url) || url.length > 1000) {
    return NextResponse.json({ error: "Hiányzó vagy hibás kép." }, { status: 400 });
  }
  const name = String(body.name ?? "").trim();

  // Üres név = a saját elnevezés visszavonása (marad az alapértelmezett felirat).
  if (!name) {
    const { error } = await supabase
      .from("asset_item_names").delete().eq("user_id", user.id).eq("url", url);
    if (error) return NextResponse.json({ error: "A törlés nem sikerült." }, { status: 500 });
    return NextResponse.json({ ok: true, name: "" });
  }

  if (name.length > MAX_NAME) {
    return NextResponse.json({ error: `A név legfeljebb ${MAX_NAME} karakter lehet.` }, { status: 422 });
  }

  const { error } = await supabase
    .from("asset_item_names")
    .upsert({ user_id: user.id, url, name, updated_at: new Date().toISOString() },
      { onConflict: "user_id,url" });
  if (error) return NextResponse.json({ error: "Az átnevezés nem sikerült." }, { status: 500 });

  return NextResponse.json({ ok: true, name });
}
