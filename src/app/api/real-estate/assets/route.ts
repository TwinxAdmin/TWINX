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

  const [{ data: jobs }, { data: viz }, { data: favs }, { data: named }, { data: items }, { data: labels }, { data: hidden }, { data: itemNames }] =
    await Promise.all([
      supabase.from("image_enhance_jobs").select("items, mode, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(80),
      supabase.from("usage_history").select("input_data, output_file_url, created_at").eq("user_id", user.id).eq("feature_used", "visualization").order("created_at", { ascending: false }).limit(80),
      supabase.from("image_enhance_favorites").select("enhanced, created_at").order("created_at", { ascending: false }).limit(120),
      supabase.from("asset_folders").select("id, name, created_at").order("created_at", { ascending: false }),
      supabase.from("asset_folder_items").select("folder_id, url, created_at").order("created_at", { ascending: false }),
      supabase.from("asset_date_labels").select("date_key, name"),
      supabase.from("asset_hidden_dates").select("date_key"),
      // A partner saját elnevezései (asset-item-names.sql). Ha a tábla még nincs
      // meg, a hívás hibázik, de a többi adat ettől még megjön.
      supabase.from("asset_item_names").select("url, name"),
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
  // Melyik képen milyen munka ment végbe (jelölések a bélyegképekhez és a nagy nézethez).
  const works = new Map<string, Set<string>>();
  const mark = (url?: string | null, kind?: string) => {
    if (!url || !kind) return;
    const s = works.get(url) ?? new Set<string>();
    s.add(kind);
    works.set(url, s);
  };

  for (const j of jobs ?? []) {
    const its = (j.items ?? []) as Array<{ enhanced?: string; original?: string }>;
    for (const it of its) {
      add(j.created_at as string, it?.enhanced);
      mark(it?.enhanced, j.mode as string);
      // Ha egy kép egy korábbi eredményből készült (átjátszás), a lánc előző lépése is látszik.
      if (it?.original && works.has(it.original)) {
        for (const k of works.get(it.original)!) mark(it.enhanced, k);
      }
    }
  }
  for (const h of viz ?? []) {
    const data = (h.input_data ?? {}) as { rooms?: Array<{ output?: string }>; outputs?: string[] };
    if (Array.isArray(data.rooms)) for (const r of data.rooms) { add(h.created_at as string, r?.output); mark(r?.output, "visualization"); }
    if (Array.isArray(data.outputs)) for (const u of data.outputs) { add(h.created_at as string, u); mark(u, "visualization"); }
    add(h.created_at as string, h.output_file_url as string | null);
    mark(h.output_file_url as string | null, "visualization");
  }
  // A partner által "törölt" (elrejtett) dátum-mappák nem jelennek meg — a képek megmaradnak.
  const hiddenKeys = new Set((hidden ?? []).map((h) => h.date_key as string));

  const dateFolders: Folder[] = [...map.entries()]
    .filter(([key]) => !hiddenKeys.has(key))
    .map(([key, g]) => ({ key, latest: g.latest, label: labelMap.get(key) ?? g.label, urls: g.urls }))
    .sort((a, b) => (a.latest < b.latest ? 1 : -1))
    .map(({ key, label, urls }) => ({ id: null, key: `date:${key}`, kind: "date" as const, label, urls }));

  const favorites = [...new Set((favs ?? []).map((f) => f.enhanced as string).filter(Boolean))];

  // url -> munkatípusok (feljavitas | rendrakas | visualization)
  const badges: Record<string, string[]> = {};
  for (const [url, set] of works.entries()) badges[url] = [...set];

  // url -> a partner saját elnevezése (ha adott neki nevet)
  const names: Record<string, string> = {};
  for (const n of itemNames ?? []) names[n.url as string] = n.name as string;

  return NextResponse.json({ favorites, folders: [...namedFolders, ...dateFolders], badges, names });
}
