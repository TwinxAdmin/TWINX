// /api/office/works/versions — módosítási napló egy munkához.
//   GET  ?historyId=…          — változatok (ki, mikor, milyen művelet)
//   POST { versionId }          — visszaállítás: a régi változat lesz az aktuális (új naplóbejegyzéssel)
// Jogosultság: aki a munkát szerkesztheti (saját, vagy egy általa látott közös mappában van).
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canEditWork, LOCK_TTL_MS, namesFor } from "@/lib/office-folders";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });
  const historyId = new URL(request.url).searchParams.get("historyId") ?? "";
  const edit = await canEditWork(historyId, user.id);
  if (!edit.ok) return NextResponse.json({ error: "Ehhez a munkához nincs hozzáférésed." }, { status: 403 });

  const { data, error } = await createAdminClient()
    .from("work_versions").select("id, saved_by, kind, output_file_url, created_at")
    .eq("history_id", historyId).order("created_at", { ascending: false }).limit(100);
  if (error) {
    return NextResponse.json({ error: /work_versions/.test(error.message) ? "Futtasd le az office-work-edit.sql migrációt." : error.message }, { status: 500 });
  }
  const names = await namesFor((data ?? []).map((v) => (v.saved_by as string) ?? ""));
  return NextResponse.json({
    versions: (data ?? []).map((v, i) => ({
      id: v.id as string,
      kind: v.kind as string,
      savedBy: names.get((v.saved_by as string) ?? "") ?? "—",
      url: (v.output_file_url as string) ?? null,
      createdAt: v.created_at as string,
      current: i === 0,
    })),
  });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });
  let versionId = "";
  try { versionId = String((await request.json()).versionId ?? ""); } catch { /* üres */ }

  const admin = createAdminClient();
  const { data: v } = await admin
    .from("work_versions").select("id, history_id, output_text, output_file_url").eq("id", versionId).maybeSingle();
  if (!v) return NextResponse.json({ error: "A változat nem található." }, { status: 404 });

  const edit = await canEditWork(v.history_id as string, user.id);
  if (!edit.ok) return NextResponse.json({ error: "Ehhez a munkához nincs hozzáférésed." }, { status: 403 });

  // Ha más épp szerkeszti, ne írjuk felül alatta.
  const { data: lock } = await admin.from("work_locks").select("user_id, locked_at").eq("history_id", v.history_id).maybeSingle();
  if (lock && lock.user_id !== user.id && Date.now() - new Date(lock.locked_at as string).getTime() < LOCK_TTL_MS) {
    return NextResponse.json({ error: "Egy kolléga épp szerkeszti — próbáld újra később." }, { status: 409 });
  }

  const { error } = await admin.from("usage_history").update({
    output_text: v.output_text, output_file_url: v.output_file_url, edited_at: new Date().toISOString(),
  }).eq("id", v.history_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin.from("work_versions").insert({
    history_id: v.history_id, saved_by: user.id, kind: "restore",
    output_text: v.output_text, output_file_url: v.output_file_url,
  });
  return NextResponse.json({ ok: true, url: v.output_file_url });
}
