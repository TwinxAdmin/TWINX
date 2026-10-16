// Referenciakép kikeresése a `references` bucketből: [stílus]/[helység].
// Több kiterjesztést próbál; ha az adott helység nincs meg, a legközelebbi helyiség képére esik vissza
// (REFERENCE_FALLBACK), majd a stílus bármely képére, végül null (referencia nélkül).
import { createAdminClient } from "@/lib/supabase/admin";
import { referenceCandidates } from "@/lib/visualization";

const BUCKET = "references";
const EXTS = ["png", "jpg", "jpeg", "webp"];

function mimeFromExt(ext: string): string {
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "webp") return "image/webp";
  return "image/png";
}

export async function getReferenceImage(
  styleSlug: string,
  roomSlug: string
): Promise<{ bytes: Uint8Array; mimeType: string } | null> {
  if (!styleSlug) return null;
  const admin = createAdminClient();

  // 1) A saját helyiség képe, utána a legközelebbi helyiségeké (pl. gardrób → hálószoba), végül a nappali
  for (const slug of referenceCandidates(roomSlug)) {
    for (const ext of EXTS) {
      const { data } = await admin.storage.from(BUCKET).download(`${styleSlug}/${slug}.${ext}`);
      if (data) {
        const buf = Buffer.from(await data.arrayBuffer());
        return { bytes: new Uint8Array(buf), mimeType: mimeFromExt(ext) };
      }
    }
  }

  // 2) Fallback: a stílus bármely KÉPE (a mappában a stíluslap .json / .md is lehet — az nem kép)
  const { data: list } = await admin.storage.from(BUCKET).list(styleSlug, { limit: 100 });
  const img = (list ?? []).find((f) => EXTS.includes(f.name.split(".").pop()?.toLowerCase() ?? ""));
  if (img) {
    const { data } = await admin.storage.from(BUCKET).download(`${styleSlug}/${img.name}`);
    if (data) {
      const ext = img.name.split(".").pop()?.toLowerCase() ?? "png";
      const buf = Buffer.from(await data.arrayBuffer());
      return { bytes: new Uint8Array(buf), mimeType: mimeFromExt(ext) };
    }
  }

  // 3) Nincs referencia -> szöveges módban generálunk.
  return null;
}
