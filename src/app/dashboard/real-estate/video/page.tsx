// dashboard/real-estate/video — Marketing videó generátor (wireframe).
// Server Component: kigyűjti a korábbi látványterv-képeket (előzményből), majd
// átadja a kliens VideoBuilder komponensnek.
import { createClient } from "@/lib/supabase/server";
import VideoBuilder from "@/components/VideoBuilder";

export const runtime = "nodejs";

export default async function VideoPage() {
  const supabase = await createClient();

  const [{ data: history }, { data: enh }] = await Promise.all([
    supabase
      .from("usage_history")
      .select("input_data, output_file_url")
      .eq("feature_used", "visualization")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("image_enhance_jobs")
      .select("items")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  // Az összes korábbi látványterv-kép URL kigyűjtése (per-room és batch modell is).
  const set = new Set<string>();
  for (const h of history ?? []) {
    const data = (h.input_data ?? {}) as {
      rooms?: Array<{ output?: string }>;
      outputs?: string[];
    };
    if (Array.isArray(data.rooms)) {
      for (const r of data.rooms) if (r.output) set.add(r.output);
    }
    if (Array.isArray(data.outputs)) {
      for (const u of data.outputs) if (u) set.add(u);
    }
    if (h.output_file_url) set.add(h.output_file_url);
  }

  // Feljavított / rendberakott képek a Képjavítóból.
  const enhSet = new Set<string>();
  for (const j of enh ?? []) {
    const items = (j.items ?? []) as Array<{ enhanced?: string }>;
    for (const it of items) if (it?.enhanced) enhSet.add(it.enhanced);
  }

  return <VideoBuilder historyImages={[...set]} enhancedImages={[...enhSet]} />;
}
