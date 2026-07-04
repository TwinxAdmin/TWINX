// dashboard/real-estate/video — Marketing videó generátor (wireframe).
// Server Component: kigyűjti a korábbi látványterv-képeket (előzményből), majd
// átadja a kliens VideoBuilder komponensnek.
import { createClient } from "@/lib/supabase/server";
import VideoBuilder from "@/components/VideoBuilder";

export const runtime = "nodejs";

export default async function VideoPage() {
  const supabase = await createClient();

  const { data: history } = await supabase
    .from("usage_history")
    .select("input_data, output_file_url")
    .eq("feature_used", "visualization")
    .order("created_at", { ascending: false })
    .limit(50);

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

  return <VideoBuilder historyImages={[...set]} />;
}
