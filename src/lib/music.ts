// Random zene a videó hosszához illő mappából: `music/{stílus}/{hossz-bin}/`.
// Ha a bin-mappa üres, visszaesik a stílus gyökerére (ha oda töltöttek zenét).
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "music";
const AUDIO_RE = /\.(mp3|m4a|wav|aac|ogg)$/i;

async function pickFrom(folder: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data: list } = await admin.storage.from(BUCKET).list(folder, { limit: 100 });
  const tracks = (list ?? []).filter((f) => AUDIO_RE.test(f.name));
  if (tracks.length === 0) return null;
  const chosen = tracks[Math.floor(Math.random() * tracks.length)];
  return admin.storage.from(BUCKET).getPublicUrl(`${folder}/${chosen.name}`).data.publicUrl;
}

export async function pickRandomMusic(
  styleSlug: string,
  lengthBin: string
): Promise<string | null> {
  if (!styleSlug) return null;
  // Elsődleges: stílus + hossz-bin.
  const primary = await pickFrom(`${styleSlug}/${lengthBin}`);
  if (primary) return primary;
  // Fallback: a stílus gyökere (ha valaki bin nélkül töltött fel).
  return pickFrom(styleSlug);
}
