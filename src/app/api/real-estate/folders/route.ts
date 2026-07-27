// Ingatlan-mappák kezelése a közös tálcához.
// POST   { name }                 -> új mappa létrehozása
// PATCH  { id, name } | { dateKey, name } -> mappa átnevezése (named vagy dátum-mappa)
// DELETE ?id=...                   -> elnevezett mappa törlése (a tagok is)
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

async function getUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function POST(request: Request) {
  const { supabase, user } = await getUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const name = String(body?.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "Adj nevet a mappának." }, { status: 422 });
  const { data, error } = await supabase
    .from("asset_folders")
    .insert({ user_id: user.id, name })
    .select("id, name")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ folder: data });
}

export async function PATCH(request: Request) {
  const { supabase, user } = await getUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const name = String(body?.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "A név nem lehet üres." }, { status: 422 });

  if (body?.id) {
    const { error } = await supabase.from("asset_folders").update({ name }).eq("id", body.id).eq("user_id", user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }
  if (body?.dateKey) {
    const { error } = await supabase
      .from("asset_date_labels")
      .upsert({ user_id: user.id, date_key: String(body.dateKey), name }, { onConflict: "user_id,date_key" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Hiányzó azonosító." }, { status: 422 });
}

export async function DELETE(request: Request) {
  const { supabase, user } = await getUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });
  const sp = new URL(request.url).searchParams;
  const id = sp.get("id");
  const dateKey = sp.get("dateKey");

  // Dátum-mappa: fizikailag nem törlünk (a képek megmaradnak), csak elrejtjük a listából.
  if (dateKey) {
    const { error } = await supabase
      .from("asset_hidden_dates")
      .upsert({ user_id: user.id, date_key: dateKey }, { onConflict: "user_id,date_key" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (!id) return NextResponse.json({ error: "Hiányzó mappa-azonosító." }, { status: 422 });
  const { error } = await supabase.from("asset_folders").delete().eq("id", id).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
