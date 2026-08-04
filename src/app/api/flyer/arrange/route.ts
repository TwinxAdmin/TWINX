// POST /api/flyer/arrange — "AI elrendezés": a hirdetés-fotókat esztétikai/főkép-
// alkalmassági pontszám alapján értékeli, és megadja, melyik legyen a FŐKÉP.
// A kliens a legjobb pontszámú képet teszi előre; a partner utólag átrendezheti.
// Bemenet: multipart FormData, "images" a fotók sorrendben. Ingyenes (elrendezés).
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { scoreFlyerPhotos, type VisionImage } from "@/lib/property-vision";

export const runtime = "nodejs";
export const maxDuration = 30; // a képelemzés (Gemini) néhány másodperc

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
    // Egyetlen képnél nincs mit elrendezni.
    return NextResponse.json({ scores: [], bestIndex: 0, applied: false });
  }

  const images: VisionImage[] = [];
  for (const f of files) {
    images.push({ bytes: new Uint8Array(await f.arrayBuffer()), mimeType: f.type });
  }

  const scores = await scoreFlyerPhotos(images);
  if (!scores) {
    return NextResponse.json({ scores: [], bestIndex: 0, applied: false });
  }

  // A legmagasabb pontszámú kép lesz a főkép (holtversenynél az első ilyen).
  let bestIndex = 0;
  for (let i = 1; i < scores.length; i++) {
    if (scores[i] > scores[bestIndex]) bestIndex = i;
  }

  return NextResponse.json({ scores, bestIndex, applied: true });
}
