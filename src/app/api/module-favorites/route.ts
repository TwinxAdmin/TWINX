// /api/module-favorites — kedvenc modulok (a bejelentkezett felhasználóé).
//   GET               → { favorites: href[], lastUsed: { [href]: iso } }
//   POST   { href }   → kedvencnek jelölés (csak a katalógusban szereplő, látható modul; max FAVORITES_MAX)
//   DELETE { href }   → kedvenc törlése
// Az írás a felhasználó saját munkamenetével történik — az RLS csak a saját sorait engedi.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { FAVORITES_MAX, FEATURE_TO_HREF, isSelectableModule } from "@/lib/module-favorites";

export const runtime = "nodejs";

const MIGRATION_HINT = "Futtasd le a module-favorites.sql migrációt.";

async function readHref(request: Request): Promise<string | null> {
  try {
    const body = (await request.json()) as { href?: unknown };
    return typeof body.href === "string" ? body.href.trim() : null;
  } catch {
    return null;
  }
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });

  const [{ data: favs, error }, { data: history }] = await Promise.all([
    supabase.from("user_module_favorites").select("module_href, created_at").eq("user_id", user.id).order("created_at", { ascending: true }),
    supabase.from("usage_history").select("feature_used, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(300),
  ]);
  if (error) {
    return NextResponse.json({ error: /user_module_favorites/.test(error.message) ? MIGRATION_HINT : error.message }, { status: 500 });
  }

  const lastUsed: Record<string, string> = {};
  for (const h of history ?? []) {
    const href = FEATURE_TO_HREF[h.feature_used as string];
    if (href && !lastUsed[href]) lastUsed[href] = h.created_at as string;
  }

  return NextResponse.json({
    favorites: (favs ?? []).map((f) => f.module_href as string).filter(isSelectableModule),
    lastUsed,
  });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });

  const href = await readHref(request);
  if (!href || !isSelectableModule(href)) return NextResponse.json({ error: "Ismeretlen modul." }, { status: 422 });

  const { count } = await supabase.from("user_module_favorites").select("module_href", { count: "exact", head: true }).eq("user_id", user.id);
  if ((count ?? 0) >= FAVORITES_MAX) {
    return NextResponse.json({ error: `Legfeljebb ${FAVORITES_MAX} kedvenc modul lehet.` }, { status: 409 });
  }

  const { error } = await supabase.from("user_module_favorites").upsert({ user_id: user.id, module_href: href });
  if (error) {
    return NextResponse.json({ error: /user_module_favorites/.test(error.message) ? MIGRATION_HINT : error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });

  const href = await readHref(request);
  if (!href) return NextResponse.json({ error: "Hiányzó modul." }, { status: 400 });

  const { error } = await supabase.from("user_module_favorites").delete().eq("user_id", user.id).eq("module_href", href);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
