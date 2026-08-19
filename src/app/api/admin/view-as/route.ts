// POST /api/admin/view-as — az „így látja a partner" előnézet be-/kikapcsolása.
// body: { view: "user" | "sales" | null }
//
// Csak admin hívhatja, és a cookie CSAK a megjelenítést befolyásolja: a
// jogosultság-ellenőrzések és a kreditlevonás továbbra is az adatbázisban lévő
// valódi szerepkört nézik (lásd lib/view-as.ts).
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { VIEW_AS_COOKIE } from "@/lib/view-as";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });

  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin") {
    return NextResponse.json({ error: "Csak admin használhatja." }, { status: 403 });
  }

  let body: { view?: string | null };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Érvénytelen kérés." }, { status: 400 }); }

  const view = body.view === "user" || body.view === "sales" ? body.view : null;

  const res = NextResponse.json({ ok: true, view });
  if (view) {
    res.cookies.set(VIEW_AS_COOKIE, view, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 8, // 8 óra — a nap végén magától megszűnik
    });
  } else {
    res.cookies.set(VIEW_AS_COOKIE, "", { path: "/", maxAge: 0 });
  }
  return res;
}
