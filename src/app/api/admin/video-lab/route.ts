// POST /api/admin/video-lab — VIDEÓLABOR: próbavideó a SAJÁT TWINX motorral.
//
// CSAK admin (élesben is). Kreditet nem von,
// partner-előzményt nem ír — ez a fejlesztői próbapad, ahol a saját motort a
// Shotstack-videóval összevetjük, mielőtt élesbe kerülne.
//
// Lépések (CLAUDE.md: validáció → API → mentés):
//  1) jogosultság (admin)
//  2) űrlap-validáció (fotók, méret, változat, zene, adatok)
//  3) render: fotók helyi fájlba → betűk → zene → renderVideo()
//  4) a kész MP4 a Storage-ba (reports/video-lab/…), válaszban az URL + mérések
import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStaffRole } from "@/lib/staff";
import { isValidMusicStyle, type VideoCaptionFacts } from "@/lib/video";
import type { FlyerProfileData } from "@/lib/flyer-template";
import type { AspectId } from "@/lib/video-engine/template-schema";
import { runEngineJob, ENGINE_WORK_DIR } from "@/lib/video-engine/job-node";

export const runtime = "nodejs";
export const maxDuration = 300;

const ALLOWED = ["image/jpeg", "image/png", "image/webp"];
const MAX_PHOTO_BYTES = 15 * 1024 * 1024;
const BUCKET = "reports";
/** A labor félretett videói (ha a Storage-feltöltés nem sikerül). */
const LAB_DIR = path.join(ENGINE_WORK_DIR, "lab");

const str = (v: FormDataEntryValue | null, max: number) => String(v ?? "").trim().slice(0, max);

/**
 * Feltöltés újrapróbálással, MINDIG friss klienssel.
 * Miért: a render 1–3 percig tart; közben a korábban nyitott (keep-alive) kapcsolatot
 * a szerver lezárja, és az újrahasznosításakor a Node „fetch failed" hibát ad.
 */
async function uploadWithRetry(key: string, body: Buffer): Promise<{ url: string | null; error: string | null }> {
  let last = "";
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const client = createAdminClient();
      const { error } = await client.storage.from(BUCKET).upload(key, body, { contentType: "video/mp4", upsert: true });
      if (!error) return { url: client.storage.from(BUCKET).getPublicUrl(key).data.publicUrl, error: null };
      last = error.message;
    } catch (e) {
      const err = e as Error & { cause?: { message?: string; code?: string } };
      last = `${err.message}${err.cause ? ` (${err.cause.code ?? ""} ${err.cause.message ?? ""})` : ""}`;
    }
    await new Promise((r) => setTimeout(r, 1500 * attempt));
  }
  return { url: null, error: last || "ismeretlen hiba" };
}

/** GET ?id=… — a helyben félretett laborvideó lejátszása (ha a Storage-feltöltés nem ment). */
export async function GET(request: Request) {
  const supabase = await createClient();
  const staff = await getStaffRole(supabase);
  if (!staff || staff.role !== "admin") {
    return NextResponse.json({ error: "Nincs jogosultság." }, { status: 403 });
  }
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Hibás azonosító." }, { status: 400 });
  const file = path.join(LAB_DIR, "out", `${id}.mp4`);
  if (!fs.existsSync(file)) return NextResponse.json({ error: "Nem található." }, { status: 404 });
  return new NextResponse(fs.readFileSync(file), {
    headers: { "Content-Type": "video/mp4", "Cache-Control": "no-store" },
  });
}

export async function POST(request: Request) {
  // --- 1) Jogosultság ---
  const supabase = await createClient();
  const staff = await getStaffRole(supabase);
  if (!staff || staff.role !== "admin") {
    return NextResponse.json({ error: "Nincs jogosultság." }, { status: 403 });
  }

  // --- 2) Validáció — UGYANAZOK a mezők, mint az élő videó-varázslóban ---
  let form: FormData;
  try { form = await request.formData(); } catch {
    return NextResponse.json({ error: "Érvénytelen kérés." }, { status: 400 });
  }
  const files = form.getAll("images").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length < 4 || files.length > 5) {
    return NextResponse.json({ error: "4–5 fotó kell." }, { status: 422 });
  }
  for (const f of files) {
    if (!ALLOWED.includes(f.type)) return NextResponse.json({ error: `Nem támogatott fájl: ${f.name}` }, { status: 422 });
    if (f.size > MAX_PHOTO_BYTES) return NextResponse.json({ error: `Túl nagy fájl (max 15 MB): ${f.name}` }, { status: 422 });
  }
  const aspect: AspectId = form.get("aspect") === "1:1" ? "1:1" : "9:16";
  const musicStyle = str(form.get("musicStyle"), 30);
  if (musicStyle && musicStyle !== "none" && !isValidMusicStyle(musicStyle)) {
    return NextResponse.json({ error: "Érvénytelen zenei stílus." }, { status: 422 });
  }
  const parse = <T,>(key: string, fallback: T): T => {
    try { return JSON.parse(String(form.get(key) ?? "")) as T; } catch { return fallback; }
  };

  // --- 3) Render — UGYANAZ a közös motor-futtatás, mint a partnereknél ---
  const id = randomUUID();
  let jobDir: string | null = null;
  try {
    const result = await runEngineJob({
      id, aspect, musicStyle,
      engineTemplate: str(form.get("engineTemplate"), 40),
      colorVariant: str(form.get("colorVariant"), 20),
      photos: await Promise.all(files.map(async (f) => ({ bytes: new Uint8Array(await f.arrayBuffer()), type: f.type }))),
      facts: parse<Partial<VideoCaptionFacts> & { propertyType?: string }>("facts", {}),
      captions: parse<unknown[]>("captions", []).map((c) => String(c ?? "").slice(0, 200)),
      captionPositions: parse<unknown[]>("captionPositions", []).map((p) => (p === "center" ? "center" : "bottom")),
      profile: parse<Partial<FlyerProfileData>>("profile", {}),
    });
    jobDir = result.jobDir;

    // A kész videót a labor saját mappájába is félretesszük — ha a Storage-feltöltés
    // nem sikerül, innen játsszuk le (GET ?id=…), így a próba nem vész el.
    const keepDir = path.join(LAB_DIR, "out");
    fs.mkdirSync(keepDir, { recursive: true });
    const kept = path.join(keepDir, `${id}.mp4`);
    fs.copyFileSync(result.file, kept);

    // --- 4) Mentés a Storage-ba (csak a labor mappájába) ---
    const key = `video-lab/${staff.userId}/${id}.mp4`;
    const up = await uploadWithRetry(key, fs.readFileSync(kept));
    const url = up.url ?? `/api/admin/video-lab?id=${id}`;

    return NextResponse.json({
      ok: true, url,
      template: result.templateName,
      storage: up.url ? "supabase" : "local",
      uploadError: up.error,
      seconds: result.seconds,
      timings: result.timings,
      photoKinds: result.photoKinds,
      fontSource: result.fontSource,
      music: result.music,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message.slice(0, 1500) }, { status: 500 });
  } finally {
    if (jobDir) fs.rmSync(jobDir, { recursive: true, force: true });
  }
}
