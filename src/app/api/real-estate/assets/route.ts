// GET /api/real-estate/assets — a felhasználó korábbi ingatlan-képei egy helyen.
// - Elnevezett (ingatlan) mappák: asset_folders + asset_folder_items (címkézés).
// - Dátum-mappák: a Képjavító feljavított képei + kész látványtervek napokra bontva
//   (asset_date_labels-szel átnevezhetők).
// - Kedvencek: image_enhance_favorites.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type Folder = { id: string | null; key: string; kind: "named" | "date"; label: string; urls: string[] };

const dayKey = (iso: string) => new Date(iso).toISOString().slice(0, 10);
const dayLabel = (iso: string) =>
  new Date(iso).toLocaleDateString("hu-HU", { year: "numeric", month: "short", day: "numeric" });

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });

  const [{ data: jobs }, { data: viz }, { data: favs }, { data: named }, { data: items }, { data: labels }] =
    await Promise.all([
      supabase.from("image_enhance_jobs").select("items, created_at").order("created_at", { ascending: false }).limit(80),
      supabase.from("usage_history").select("input_data, output_file_url, created_at").eq("feature_used", "visualization").order("created_at", { ascending: false }).limit(80),
      supabase.from("image_enhance_favorites").select("enhanced, created_at").order("created_at", { ascending: false }).limit(120),
      supabase.from("asset_folders").select("id, name, created_at").order("created_at", { ascending: false }),
      supabase.from("asset_folder_items").select("folder_id, url, created_at").order("created_at", { ascending: false }),
      supabase.from("asset_date_labels").select("date_key, name"),
    ]);

  // --- Elnevezett mappák (címkézés) ---
  const itemsByFolder = new Map<string, string[]>();
  for (const it of items ?? []) {
    const arr = itemsByFolder.get(it.folder_id as string) ?? [];
    if (!arr.includes(it.url as string)) arr.push(it.url as string);
    itemsByFolder.set(it.folder_id as string, arr);
  }
  const namedFolders: Folder[] = (named ?? []).map((f) => ({
    id: f.id as string,
    key: `named:${f.id}`,
    kind: "named",
    label: f.name as string,
    urls: itemsByFolder.get(f.id as string) ?? [],
  }));

  // --- Dátum-mappák ---
  const labelMap = new Map<string, string>();
  for (const l of labels ?? []) labelMap.set(l.date_key as string, l.name as string);

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
    const its = (j.items ?? []) as Array<{ enhanced?: string }>;
    for (const it of its) add(j.created_at as string, it?.enhanced);
  }
  for (const h of viz ?? []) {
    const data = (h.input_data ?? {}) as { rooms?: Array<{ output?: string }>; outputs?: string[] };
    if (Array.isArray(data.rooms)) for (const r of data.rooms) add(h.created_at as string, r?.output);
    if (Array.isArray(data.outputs)) for (const u of data.outputs) add(h.created_at as string, u);
    add(h.created_at as string, h.output_file_url as string | null);
  }
  const dateFolders: Folder[] = [...map.entries()]
    .map(([key, g]) => ({ key, latest: g.latest, label: labelMap.get(key) ?? g.label, urls: g.urls }))
    .sort((a, b) => (a.latest < b.latest ? 1 : -1))
    .map(({ key, label, urls }) => ({ id: null, key: `date:${key}`, kind: "date" as const, label, urls }));

  const favorites = [...new Set((favs ?? []).map((f) => f.enhanced as string).filter(Boolean))];

  return NextResponse.json({ favorites, folders: [...namedFolders, ...dateFolders] });
}
