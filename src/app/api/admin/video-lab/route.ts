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
import { captionForPhoto, isValidMusicStyle, type VideoCaptionFacts } from "@/lib/video";
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

  // --- 2) Validáció ---
  let form: FormData;
  try { form = await request.formData(); } catch {
    return NextResponse.json({ error: "Érvénytelen kérés." }, { status: 400 });
  }
  const files = form.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length < AURORA.photos.min || files.length > AURORA.photos.max) {
    return NextResponse.json({ error: `${AURORA.photos.min}–${AURORA.photos.max} fotó kell.` }, { status: 422 });
  }
  for (const f of files) {
    if (!ALLOWED.includes(f.type)) return NextResponse.json({ error: `Nem támogatott fájl: ${f.name}` }, { status: 422 });
    if (f.size > MAX_PHOTO_BYTES) return NextResponse.json({ error: `Túl nagy fájl (max 15 MB): ${f.name}` }, { status: 422 });
  }
  const aspect: AspectId = form.get("aspect") === "1:1" ? "1:1" : "9:16";
  const variantId = str(form.get("variant"), 20) || "aurora";
  const variant = AURORA_VARIANTS.find((v) => v.id === variantId) ?? null;
  const musicStyle = str(form.get("musicStyle"), 30);
  if (musicStyle && musicStyle !== "none" && !isValidMusicStyle(musicStyle)) {
    return NextResponse.json({ error: "Érvénytelen zenei stílus." }, { status: 422 });
  }
  const tpl = applyVariant(AURORA, variant);
  const tplErrors = validateTemplate(tpl);
  if (tplErrors.length) return NextResponse.json({ error: "Sablonhiba", details: tplErrors }, { status: 500 });

  const facts: VideoCaptionFacts = {
    location: str(form.get("location"), 80),
    address: str(form.get("address"), 80),
    price: str(form.get("price"), 40),
    size: str(form.get("size"), 20),
    rooms: str(form.get("rooms"), 40),
    bathrooms: str(form.get("bathrooms"), 60),
    floor: str(form.get("floor"), 40),
  };
  const type = str(form.get("type"), 60);
  const sizeText = /^\d+([.,]\d+)?$/.test(facts.size) ? `${facts.size} m²` : facts.size;

  // Ügynök adatai: a kiválasztott arculati profilból (csak a sajátja).
  const admin = createAdminClient();
  const profileId = str(form.get("profileId"), 60);
  let agent = { name: "", phone: "", email: "", photo: "", logo: "" };
  if (profileId) {
    const { data: p } = await admin.from("branding_profiles")
      .select("user_id, display_name, phone, email, agent_photo_url, logo_url")
      .eq("id", profileId).maybeSingle();
    if (p && p.user_id === staff.userId) {
      agent = {
        name: p.display_name ?? "", phone: p.phone ?? "", email: p.email ?? "",
        photo: p.agent_photo_url ?? "", logo: p.logo_url ?? "",
      };
    }
  }

  const caption = (i: number) => {
    const c = captionForPhoto(i, facts);
    return [c.line1, c.line2].filter(Boolean).join("\n");
  };
  const data: BindData = {
    "property.title": facts.address || facts.location,
    "property.city": facts.address ? facts.location : "",
    "property.type": type,
    "property.price": facts.price,
    "property.specs": [facts.rooms, facts.bathrooms, sizeText].filter(Boolean).join("\n"),
    "agent.name": agent.name,
    "agent.phone": agent.phone,
    "agent.email": agent.email,
    "agent.photo": agent.photo,
    "agent.logo": agent.logo,
    "caption.2": caption(1),
    "caption.3": caption(2),
    "caption.4": caption(3),
    "caption.5": caption(4),
  };

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

    // --- 4) Mentés a Storage-ba (csak a labor mappájába) ---
    const key = `video-lab/${staff.userId}/${id}.mp4`;
    const { error: upErr } = await admin.storage.from(BUCKET)
      .upload(key, fs.readFileSync(result.file), { contentType: "video/mp4", upsert: false });
    if (upErr) throw new Error(`Feltöltés: ${upErr.message}`);
    const url = admin.storage.from(BUCKET).getPublicUrl(key).data.publicUrl;

    return NextResponse.json({
      ok: true, url,
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
