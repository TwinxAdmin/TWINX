// GET /api/real-estate/assets — a felhasználó korábbi ingatlan-képei egy helyen.
// Dátum szerinti mappák (Képjavító feljavított/rendberakott képei + kész látványtervek)
// és a Kedvencek. A közös AssetTray tálca ebből dolgozik minden képes modulban.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type Folder = { key: string; label: string; urls: string[] };

const dayKey = (iso: string) => new Date(iso).toISOString().slice(0, 10);
const dayLabel = (iso: string) =>
  new Date(iso).toLocaleDateString("hu-HU", { year: "numeric", month: "short", day: "numeric" });

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });

  const [{ data: jobs }, { data: viz }, { data: favs }] = await Promise.all([
    supabase
      .from("image_enhance_jobs")
      .select("items, created_at")
      .order("created_at", { ascending: false })
      .limit(80),
    supabase
      .from("usage_history")
      .select("input_data, output_file_url, created_at")
      .eq("feature_used", "visualization")
      .order("created_at", { ascending: false })
      .limit(80),
    supabase
      .from("image_enhance_favorites")
      .select("enhanced, created_at")
      .order("created_at", { ascending: false })
      .limit(120),
  ]);

  // Dátum-mappák: minden képes kimenetet a saját napjához rendelünk (duplikátum nélkül).
  const map = new Map<string, { label: string; latest: string; urls: string[]; seen: Set<string> }>();
  const add = (iso: string, url?: string | null) => {
    if (!url) return;
    const key = dayKey(iso);
    const g = map.get(key) ?? { label: dayLabel(iso), latest: iso, urls: [], seen: new Set<string>() };
    if (!g.seen.has(url)) { g.seen.add(url); g.urls.push(url); }
    if (iso > g.latest) g.latest = iso;
    map.set(key, g);
  };

  for (const j of jobs ?? []) {
    const items = (j.items ?? []) as Array<{ enhanced?: string }>;
    for (const it of items) add(j.created_at as string, it?.enhanced);
  }
  for (const h of viz ?? []) {
    const data = (h.input_data ?? {}) as { rooms?: Array<{ output?: string }>; outputs?: string[] };
    if (Array.isArray(data.rooms)) for (const r of data.rooms) add(h.created_at as string, r?.output);
    if (Array.isArray(data.outputs)) for (const u of data.outputs) add(h.created_at as string, u);
    add(h.created_at as string, h.output_file_url as string | null);
  }

  const folders: Folder[] = [...map.entries()]
    .map(([key, g]) => ({ key, label: g.label, latest: g.latest, urls: g.urls }))
    .sort((a, b) => (a.latest < b.latest ? 1 : -1))
    .map(({ key, label, urls }) => ({ key, label, urls }));

  const favorites = [...new Set((favs ?? []).map((f) => f.enhanced as string).filter(Boolean))];

  return NextResponse.json({ folders, favorites });
}
