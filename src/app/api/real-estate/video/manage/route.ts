// PATCH /api/real-estate/video/manage — videó áthelyezése mappába vagy átnevezése.
// DELETE ?id=... — videó VÉGLEGES törlése (a tárhelyről is).
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const BUCKET = "reports";

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });

  let body: { id?: string; folderId?: string | null; title?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Érvénytelen kérés." }, { status: 400 }); }
  const id = String(body.id ?? "");
  if (!id) return NextResponse.json({ error: "Hiányzó azonosító." }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if ("folderId" in body) patch.folder_id = body.folderId || null;
  if (typeof body.title === "string") {
    const t = body.title.trim();
    if (t.length > 120) return NextResponse.json({ error: "Túl hosszú cím." }, { status: 422 });
    patch.title = t || null;
  }
  if (!Object.keys(patch).length) return NextResponse.json({ error: "Nincs mit módosítani." }, { status: 400 });

  // RLS: csak a saját videóját módosíthatja.
  const { error } = await supabase.from("video_jobs").update(patch).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });

  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!id) return NextResponse.json({ error: "Hiányzó azonosító." }, { status: 400 });

  // A job a felhasználóé-e? (RLS-en át olvasunk.)
  const { data: job } = await supabase
    .from("video_jobs")
    .select("id, user_id, output_url, poster_url, meta")
    .eq("id", id)
    .single();
  if (!job) return NextResponse.json({ error: "Nem található." }, { status: 404 });

  // A fájlok törlése a tárhelyről (admin klienssel).
  const admin = createAdminClient();
  const paths: string[] = [`video/${job.user_id}/${job.id}.mp4`];
  // A generáláshoz készült képkockák és forrásfotók is mehetnek.
  for (const prefix of [`video-frames/${job.user_id}/${job.id}`, `video-src/${job.user_id}/${job.id}`]) {
    const { data: files } = await admin.storage.from(BUCKET).list(prefix, { limit: 100 });
    for (const f of files ?? []) paths.push(`${prefix}/${f.name}`);
  }
  await admin.storage.from(BUCKET).remove(paths);

  // Előzmény-bejegyzés is (ha van).
  if (job.output_url) {
    await admin.from("usage_history").delete().eq("output_file_url", job.output_url);
  }

  const { error } = await supabase.from("video_jobs").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
