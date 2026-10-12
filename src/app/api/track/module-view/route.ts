// POST /api/track/module-view — modul-oldal megnyitásának naplózása (MH2, admin „Modul-használat").
// body: { path } — a megnyitott dashboard-útvonal; a szerver dönti el, melyik modulhoz tartozik.
// Fejenként, modulonként NAPONTA EGY sor (module_views elsődleges kulcsa) — a további megnyitásokat
// ugyanazon a napon figyelmen kívül hagyja. Külső eszköz nincs; csak bejelentkezett felhasználó.
// A mérés soha nem zavarhatja a felhasználót: hiba esetén is csendben 200-zal válaszol.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { moduleForPath } from "@/lib/module-favorites";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  let body: { path?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }

  // Validáció: csak ismert, látható modul útvonala számít.
  const path = typeof body.path === "string" ? body.path.slice(0, 300) : "";
  const moduleHref = path.startsWith("/dashboard/") ? moduleForPath(path) : null;
  if (!moduleHref) return NextResponse.json({ ok: true, tracked: false });

  // Mentés: a (felhasználó, modul, nap) kulcs miatt naponta egy sor; az ismétlést elnyeli.
  const { error } = await createAdminClient()
    .from("module_views")
    .upsert({ user_id: user.id, module_href: moduleHref }, { onConflict: "user_id,module_href,day", ignoreDuplicates: true });

  // Ha a 20261012183311_module-views.sql még nem futott le, csendben kihagyjuk.
  return NextResponse.json({ ok: !error, tracked: !error, module: moduleHref });
}
