// Random zene kiválasztása a `music/{stílus}/` Storage mappából.
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "music";

export async function pickRandomMusic(styleSlug: string): Promise<string | null> {
  if (!styleSlug) return null;
  const admin = createAdminClient();
  const { data: list } = await admin.storage.from(BUCKET).list(styleSlug, { limit: 100 });
  const tracks = (list ?? []).filter((f) => /\.(mp3|m4a|wav|aac|ogg)$/i.test(f.name));
  if (tracks.length === 0) return null;
  const chosen = tracks[Math.floor(Math.random() * tracks.length)];
  const { data: pub } = admin.storage
    .from(BUCKET)
    .getPublicUrl(`${styleSlug}/${chosen.name}`);
  return pub.publicUrl;
}
