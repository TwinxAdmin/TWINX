// PATCH /api/office/mode — munkamód váltása. body: { mode: "office" | "private" }
// „office" = az irodai keretből dolgozik, „private" = a saját kreditjéből.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });

  let body: { mode?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Érvénytelen kérés." }, { status: 400 }); }
  const mode = body.mode === "office" || body.mode === "private" ? body.mode : null;
  if (!mode) return NextResponse.json({ error: "Ismeretlen munkamód." }, { status: 422 });

  const { data, error } = await createAdminClient()
    .from("office_members").update({ work_mode: mode }).eq("user_id", user.id).select("work_mode").maybeSingle();
  if (error) {
    return NextResponse.json(
      { error: /work_mode/.test(error.message) ? "Futtasd le az office-mode.sql migrációt." : error.message },
      { status: 500 }
    );
  }
  if (!data) return NextResponse.json({ error: "Nem vagy tagja irodának." }, { status: 403 });
  return NextResponse.json({ ok: true, mode: data.work_mode });
}
