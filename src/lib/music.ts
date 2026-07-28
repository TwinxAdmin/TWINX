// Random zene a stílus mappájából: `music/{stílus}/`.
// (A korábbi hossz-bin almappák megszűntek — a videóhossz fix ~20-25 mp.)
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "music";
const AUDIO_RE = /\.(mp3|m4a|wav|aac|ogg)$/i;

export async function pickMusic(styleSlug: string): Promise<string | null> {
  if (!styleSlug) return null;
  const admin = createAdminClient();
  const { data: list } = await admin.storage.from(BUCKET).list(styleSlug, { limit: 100 });
  const tracks = (list ?? []).filter((f) => AUDIO_RE.test(f.name));
  if (tracks.length === 0) return null;
  const chosen = tracks[Math.floor(Math.random() * tracks.length)];
  return admin.storage.from(BUCKET).getPublicUrl(`${styleSlug}/${chosen.name}`).data.publicUrl;
}
