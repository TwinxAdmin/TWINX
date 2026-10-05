// POST /api/admin/video-lab — VIDEÓLABOR: próbavideó a SAJÁT TWINX motorral.
//
// CSAK admin, és CSAK localhoston (vagy ha VIDEO_LAB_ENABLED=1). Kreditet nem von,
// partner-előzményt nem ír — ez a fejlesztői próbapad, ahol a saját motort a
// Shotstack-videóval összevetjük, mielőtt élesbe kerülne.
//
// Lépések (CLAUDE.md: validáció → API → mentés):
//  1) jogosultság + labor-kapcsoló
//  2) űrlap-validáció (fotók, méret, változat, zene, adatok)
//  3) render: fotók helyi fájlba → betűk → zene → renderVideo()
//  4) a kész MP4 a Storage-ba (reports/video-lab/…), válaszban az URL + mérések
import { NextResponse } from "next/server";
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import ffmpegStatic from "ffmpeg-static";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStaffRole } from "@/lib/staff";
import { isValidMusicStyle, splitCaption, type VideoCaptionFacts } from "@/lib/video";
import { formatPrice, formatSize } from "@/lib/flyer-poster";
import type { FlyerProfileData } from "@/lib/flyer-template";
import { applyVariant, validateTemplate, type AspectId } from "@/lib/video-engine/template-schema";
import { AURORA, AURORA_VARIANTS } from "@/lib/video-engine/templates/aurora";
import { renderVideo, imageInfo, classifyPhoto } from "@/lib/video-engine/render-node";
import { ASPECT_SIZES } from "@/lib/video-engine/template-schema";
import { loadEngineFonts } from "@/lib/video-engine/fonts-node";
import { resolveMusic } from "@/lib/video-engine/music-node";
import type { BindData } from "@/lib/video-engine/layers";

export const runtime = "nodejs";
export const maxDuration = 300;

const ALLOWED = ["image/jpeg", "image/png", "image/webp"];
const MAX_PHOTO_BYTES = 15 * 1024 * 1024;
const BUCKET = "reports";

/** A labor csak fejlesztői környezetben fut, hacsak külön be nem kapcsolják. */
function labEnabled(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.VIDEO_LAB_ENABLED === "1";
}

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
  if (!staff || staff.role !== "admin" || !labEnabled()) {
    return NextResponse.json({ error: "Nincs jogosultság." }, { status: 403 });
  }
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Hibás azonosító." }, { status: 400 });
  const file = path.join(os.tmpdir(), "twinx-video-lab", "out", `${id}.mp4`);
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
  if (!labEnabled()) {
    return NextResponse.json({ error: "A Videólabor csak localhoston érhető el." }, { status: 403 });
  }

  // --- 2) Validáció — UGYANAZOK a mezők, mint az élő videó-varázslóban ---
  let form: FormData;
  try { form = await request.formData(); } catch {
    return NextResponse.json({ error: "Érvénytelen kérés." }, { status: 400 });
  }
  const files = form.getAll("images").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length < AURORA.photos.min || files.length > AURORA.photos.max) {
    return NextResponse.json({ error: `${AURORA.photos.min}–${AURORA.photos.max} fotó kell.` }, { status: 422 });
  }
  for (const f of files) {
    if (!ALLOWED.includes(f.type)) return NextResponse.json({ error: `Nem támogatott fájl: ${f.name}` }, { status: 422 });
    if (f.size > MAX_PHOTO_BYTES) return NextResponse.json({ error: `Túl nagy fájl (max 15 MB): ${f.name}` }, { status: 422 });
  }
  const aspect: AspectId = form.get("aspect") === "1:1" ? "1:1" : "9:16";
  // A varázsló színválasztója → a saját motor színváltozata.
  const colorId = str(form.get("colorVariant"), 20);
  const variantId = colorId === "ejkek" ? "nocturne" : "aurora";
  const variant = AURORA_VARIANTS.find((v) => v.id === variantId) ?? null;
  const musicStyle = str(form.get("musicStyle"), 30);
  if (musicStyle && musicStyle !== "none" && !isValidMusicStyle(musicStyle)) {
    return NextResponse.json({ error: "Érvénytelen zenei stílus." }, { status: 422 });
  }
  const tpl = applyVariant(AURORA, variant);
  const tplErrors = validateTemplate(tpl);
  if (tplErrors.length) return NextResponse.json({ error: "Sablonhiba", details: tplErrors }, { status: 500 });

  const parse = <T,>(key: string, fallback: T): T => {
    try { return JSON.parse(String(form.get(key) ?? "")) as T; } catch { return fallback; }
  };
  const rawFacts = parse<Partial<VideoCaptionFacts> & { propertyType?: string }>("facts", {});
  const clip = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);
  const facts: VideoCaptionFacts = {
    location: clip(rawFacts.location, 80), address: clip(rawFacts.address, 80), price: clip(rawFacts.price, 40),
    size: clip(rawFacts.size, 20), rooms: clip(rawFacts.rooms, 40), bathrooms: clip(rawFacts.bathrooms, 60),
    floor: clip(rawFacts.floor, 40),
  };
  const type = clip(rawFacts.propertyType, 60);
  const price = formatPrice(facts.price);
  const size = formatSize(facts.size);

  // Fotónkénti szabad feliratok + helyük (lent / középen), a képek sorrendjében.
  const captions = parse<unknown[]>("captions", []).map((c) => clip(c, 80));
  const positions = parse<unknown[]>("captionPositions", []).map((p) => (p === "center" ? "center" : "bottom"));

  // Elérhetőség + ügynökfotó + logó: a varázsló „profile" mezőjéből (kézzel vagy arculatból).
  const profile = parse<Partial<FlyerProfileData>>("profile", {});

  const data: BindData = {
    "property.title": facts.address || facts.location,
    "property.city": facts.address ? facts.location : "",
    "property.type": type,
    "property.price": price,
    "property.specs": [facts.rooms, facts.bathrooms, size].filter(Boolean).join("\n"),
    "agent.name": clip(profile.display_name, 80),
    "agent.phone": clip(profile.phone, 40),
    "agent.email": clip(profile.email, 80),
    "agent.photo": clip(profile.agent_photo_url, 500),
    "agent.logo": clip(profile.logo_url, 500),
  };
  // Az 1. fotó a nyitókép (azon az adatpanel ül) — felirat a 2. fotótól jár, mint az élőben.
  for (let i = 1; i < files.length; i++) {
    const c = splitCaption(captions[i] ?? "");
    const text = [c.line1, c.line2].filter(Boolean).join("\n");
    if (text) data[`caption.${i + 1}`] = text;
    data[`captionpos.${i + 1}`] = positions[i] ?? "bottom";
  }

  // --- 3) Render ---
  const id = randomUUID();
  const workDir = path.join(os.tmpdir(), "twinx-video-lab");   // közös: az áttűnések gyorsítótára
  const jobDir = path.join(workDir, "jobs", id);
  fs.mkdirSync(jobDir, { recursive: true });

  try {
    const photos: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const ext = files[i].type === "image/png" ? "png" : files[i].type === "image/webp" ? "webp" : "jpg";
      const p = path.join(jobDir, `foto-${i + 1}.${ext}`);
      fs.writeFileSync(p, Buffer.from(await files[i].arrayBuffer()));
      photos.push(p);
    }
    const { width: W, height: H } = ASPECT_SIZES[aspect];
    const photoKinds = photos.map((p) => classifyPhoto(imageInfo(p), W, H));

    const { fonts, source: fontSource } = await loadEngineFonts(tpl, Object.values(data).filter((v): v is string => Boolean(v)));
    const music = musicStyle && musicStyle !== "none" ? await resolveMusic(musicStyle, workDir) : null;

    const ffmpegPath = process.env.FFMPEG_PATH || (ffmpegStatic as unknown as string) || "ffmpeg";
    const result = await renderVideo({
      template: tpl, aspect, photos, data, fonts, music: music?.file ?? null,
      workDir, ffmpegPath, outName: `jobs/${id}/twinx-${variantId}-${aspect.replace(":", "x")}.mp4`,
    });

    // A kész videót a labor saját mappájába is félretesszük — ha a Storage-feltöltés
    // nem sikerül, innen játsszuk le (GET ?id=…), így a próba nem vész el.
    const keepDir = path.join(workDir, "out");
    fs.mkdirSync(keepDir, { recursive: true });
    const kept = path.join(keepDir, `${id}.mp4`);
    fs.copyFileSync(result.file, kept);

    // --- 4) Mentés a Storage-ba (csak a labor mappájába) ---
    const key = `video-lab/${staff.userId}/${id}.mp4`;
    const up = await uploadWithRetry(key, fs.readFileSync(kept));
    const url = up.url ?? `/api/admin/video-lab?id=${id}`;

    return NextResponse.json({
      ok: true, url,
      storage: up.url ? "supabase" : "local",
      uploadError: up.error,
      seconds: result.seconds,
      timings: result.timings,
      photoKinds,
      fontSource,
      music: music ? decodeURIComponent(music.url.split("/").pop() ?? "") : null,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message.slice(0, 1500) }, { status: 500 });
  } finally {
    fs.rmSync(jobDir, { recursive: true, force: true });
  }
}
