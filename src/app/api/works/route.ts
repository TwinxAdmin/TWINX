// /api/works — a SAJÁT munkák kezelése a Korábbi munkák oldalról.
//   PATCH { id, title }          — átnevezés (input_data.custom_title)
//   PATCH { id, hidden: true }   — „Törlés" = elrejtés (hidden_at); a fájl és az előzmény megmarad
//   PATCH { id, hidden: false }  — visszaállítás az Elrejtett munkák közül
// Csak a bejelentkezett felhasználó saját munkáján.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { WORK_TITLE_MAX } from "@/lib/office";

export const runtime = "nodejs";

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });

  let body: { id?: unknown; title?: unknown; hidden?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Érvénytelen kérés." }, { status: 400 }); }
  const id = String(body.id ?? "");

  const admin = createAdminClient();
  const { data: h } = await admin.from("usage_history").select("user_id, input_data, feature_used, output_file_url").eq("id", id).maybeSingle();
  if (!h || h.user_id !== user.id) return NextResponse.json({ error: "A munka nem található." }, { status: 404 });

  if (typeof body.title === "string") {
    const title = body.title.replace(/\s+/g, " ").trim();
    if (!title) return NextResponse.json({ error: "Adj meg egy nevet." }, { status: 422 });
    if (title.length > WORK_TITLE_MAX) return NextResponse.json({ error: `Legfeljebb ${WORK_TITLE_MAX} karakter lehet.` }, { status: 422 });
    const input = { ...((h.input_data as Record<string, unknown> | null) ?? {}), custom_title: title };
    const { error } = await admin.from("usage_history").update({ input_data: input }).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, title });
  }

  if (typeof body.hidden === "boolean") {
    const { error } = await admin.from("usage_history").update({ hidden_at: body.hidden ? new Date().toISOString() : null }).eq("id", id);
    if (error) {
      return NextResponse.json({ error: /hidden_at/.test(error.message) ? "Futtasd le a usage-history-hidden.sql migrációt." : error.message }, { status: 500 });
    }
    // A modulok saját könyvtárai (videó, hirdetés-ellenőrző) is kövessék — elrejtés és visszahozás egyaránt.
    const url = h.output_file_url as string | null;
    if (url) {
      const hiddenAt = body.hidden ? new Date().toISOString() : null;
      if (h.feature_used === "video") await admin.from("video_jobs").update({ hidden_at: hiddenAt }).eq("output_url", url).eq("user_id", user.id);
      if (h.feature_used === "ad-check") await admin.from("ad_checks").update({ hidden_at: hiddenAt }).eq("pdf_url", url).eq("user_id", user.id);
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Nincs mit módosítani." }, { status: 400 });
}
