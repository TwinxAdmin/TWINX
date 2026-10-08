// GET /api/real-estate/video/list — a felhasználó videói + saját mappái.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });

  // Csak a saját, NEM elrejtett videók (adminként az RLS mást is átengedne).
  // Ha a hidden_at oszlop még nincs (library-hidden.sql), szűrés nélkül kérdezünk.
  const cols = "id, status, output_url, poster_url, title, package, format, image_count, folder_id, created_at, meta";
  const listQ = (hide: boolean) => {
    const q = supabase.from("video_jobs").select(cols).eq("user_id", user.id);
    return (hide ? q.is("hidden_at", null) : q).order("created_at", { ascending: false }).limit(200);
  };
  const [first, { data: folders }] = await Promise.all([
    listQ(true),
    supabase.from("video_folders").select("id, name").order("name"),
  ]);
  let { data: items, error } = first;
  if (error && /hidden_at/.test(error.message)) ({ data: items, error } = await listQ(false));
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // a videóhoz tartozó usage_history sor (a Korábbi munkák mappáihoz / közös mappákhoz)
  const urls = (items ?? []).map((v) => v.output_url as string | null).filter(Boolean) as string[];
  const histByUrl = new Map<string, string>();
  if (urls.length) {
    const { data: hs } = await supabase.from("usage_history").select("id, output_file_url")
      .eq("user_id", user.id).eq("feature_used", "video").in("output_file_url", urls);
    for (const h of hs ?? []) histByUrl.set(h.output_file_url as string, h.id as string);
  }

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
    historyId: (v.output_url && histByUrl.get(v.output_url as string)) || null,
  }));

  return NextResponse.json({ items: list, folders: folders ?? [] });
}
