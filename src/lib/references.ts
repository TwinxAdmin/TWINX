// Referenciakép kikeresése a `references` bucketből: [stílus]/[helység].
// Több kiterjesztést próbál; ha az adott helység nincs meg, visszaesik a stílus
// bármely elérhető képére (a stílus így is átadható), végül null (referencia nélkül).
import { createAdminClient } from "@/lib/supabase/admin";

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

  // 1) Pontos találat: stílus/helység.<ext>
  for (const ext of EXTS) {
    const { data } = await admin.storage
      .from(BUCKET)
      .download(`${styleSlug}/${roomSlug}.${ext}`);
    if (data) {
      const buf = Buffer.from(await data.arrayBuffer());
      return { bytes: new Uint8Array(buf), mimeType: mimeFromExt(ext) };
    }
  }

  // 2) Fallback: a stílus bármely elérhető képe (a stílus így is átadható).
  const { data: list } = await admin.storage.from(BUCKET).list(styleSlug, { limit: 1 });
  if (list && list.length > 0) {
    const name = list[0].name;
    const { data } = await admin.storage.from(BUCKET).download(`${styleSlug}/${name}`);
    if (data) {
      const ext = name.split(".").pop()?.toLowerCase() ?? "png";
      const buf = Buffer.from(await data.arrayBuffer());
      return { bytes: new Uint8Array(buf), mimeType: mimeFromExt(ext) };
    }
  }

  // 3) Nincs referencia -> szöveges módban generálunk.
  return null;
}
