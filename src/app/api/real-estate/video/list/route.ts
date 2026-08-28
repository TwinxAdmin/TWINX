// GET /api/real-estate/video/list — a felhasználó videói + saját mappái.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });

  const [{ data: items, error }, { data: folders }] = await Promise.all([
    supabase
      .from("video_jobs")
      .select("id, status, output_url, poster_url, title, package, format, image_count, folder_id, created_at, meta")
      // Csak a saját videók (adminként az RLS mást is átengedne).
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("video_folders").select("id, name").order("name"),
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const list = (items ?? []).map((v) => ({
    id: v.id,
    status: v.status,
    output_url: v.output_url,
    poster_url: v.poster_url,
    title: v.title || (v.meta as { title?: string } | null)?.title || "Ingatlan videó",
    package: v.package,
    format: v.format,
    imageCount: v.image_count,
    folderId: v.folder_id,
    createdAt: v.created_at,
  }));

  return NextResponse.json({ items: list, folders: folders ?? [] });
}
