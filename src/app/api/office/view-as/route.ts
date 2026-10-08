// POST /api/office/view-as — irodai előnézet. body: { view: "member" | "none" | null }
//   member = kolléga-nézet · none = „nincs iroda" (mintha nem lenne tagja egy irodának sem) · null = valódi nézet
// Csak a kiválasztott iroda létrehozója / vezetője (kiosztó jogú tag) kapcsolhatja be.
// A cookie CSAK a megjelenítést befolyásolja: minden irodai API a valódi tagságot és jogot ellenőrzi.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/office-server";
import { OFFICE_VIEW_COOKIE } from "@/lib/view-as";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });

  const me = await getMembership(user.id);
  if (!me || !(me.role === "owner" || me.can_allocate)) {
    return NextResponse.json({ error: "A kolléga-nézet előnézetét a létrehozó és a vezető használhatja." }, { status: 403 });
  }

  let body: { view?: string | null };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Érvénytelen kérés." }, { status: 400 }); }

  const view = body.view === "member" || body.view === "none" ? body.view : null;
  const res = NextResponse.json({ ok: true, view });
  if (view) {
    res.cookies.set(OFFICE_VIEW_COOKIE, view, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 8 });
  } else {
    res.cookies.set(OFFICE_VIEW_COOKIE, "", { path: "/", maxAge: 0 });
  }
  return res;
}
