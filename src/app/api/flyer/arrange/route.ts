// POST /api/flyer/arrange — "AI elrendezés": a hirdetés-fotókat esztétikai pontszám
// + helyiség-felismerés alapján rendezi. A legjobb pontszámú kép lesz a FŐKÉP, a
// kisképekbe pedig lehetőleg ELTÉRŐ helyiségek kerülnek (ne legyen két hasonló egymás
// mellett). A kliens az adott sorrendben rendezi át a képeit; a partner utólag módosíthat.
// Bemenet: multipart FormData, "images" a fotók sorrendben. Ingyenes (elrendezés).
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { analyzeFlyerPhotos, type VisionImage } from "@/lib/property-vision";

export const runtime = "nodejs";
export const maxDuration = 30;

const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Érvénytelen kérés." }, { status: 400 });
  }

  const files = form
    .getAll("images")
    .filter((v): v is File => v instanceof File && v.size > 0 && ALLOWED.includes(v.type))
    .slice(0, 8);

  if (files.length < 2) {
    return NextResponse.json({ order: [], applied: false });
  }

  const images: VisionImage[] = [];
  for (const f of files) {
    images.push({ bytes: new Uint8Array(await f.arrayBuffer()), mimeType: f.type });
  }

  const info = await analyzeFlyerPhotos(images);
  if (!info) {
    return NextResponse.json({ order: [], applied: false });
  }

  // 1) Főkép: a legmagasabb pontszámú (holtversenynél az első).
  const idx = info.map((_, i) => i);
  let heroIndex = 0;
  for (let i = 1; i < info.length; i++) {
    if (info[i].score > info[heroIndex].score) heroIndex = i;
  }

  // 2) A többit pontszám szerint csökkenőbe, majd úgy fűzzük fel, hogy NE kövessen
  //    egymást azonos helyiség — a magasabb pontot előnyben tartva.
  const rest = idx.filter((i) => i !== heroIndex).sort((a, b) => info[b].score - info[a].score);
  const order: number[] = [heroIndex];
  const pool = [...rest];
  let lastRoom = info[heroIndex].room;
  while (pool.length) {
    let pick = pool.findIndex((i) => info[i].room !== lastRoom);
    if (pick === -1) pick = 0; // mind azonos helyiség → a legjobb pont jön
    const [chosen] = pool.splice(pick, 1);
    order.push(chosen);
    lastRoom = info[chosen].room;
  }

  // A felismert helyiségek AZ ÚJ SORRENDBEN — ebből tölti ki a varázsló a
  // kis képek feliratait (a partner utólag átírhatja).
  const rooms = order.map((i) => String(info[i].room ?? ""));

  return NextResponse.json({ order, heroIndex, rooms, applied: true });
}
