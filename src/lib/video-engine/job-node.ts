// SAJÁT MOTOR — egy videó teljes elkészítése a szerkesztő mezőiből.
//
// KÖZÖS a Videólabornak és a partnerek videó-útvonalának, hogy a kettő garantáltan
// ugyanazt a videót adja: ugyanaz az adat-összeállítás, betű, zene és render.
//
// SZERVEROLDALI (Node) modul: fájlrendszer + ffmpeg.
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import ffmpegStatic from "ffmpeg-static";
import { splitCaption, type VideoCaptionFacts } from "@/lib/video";
import { formatPrice, formatSize } from "@/lib/flyer-poster";
import type { FlyerProfileData } from "@/lib/flyer-template";
import { validateTemplate, ASPECT_SIZES, type AspectId, type TwinxTemplate } from "@/lib/video-engine/template-schema";
import { resolveEngineTemplate } from "@/lib/video-engine/templates/index";
import { renderVideo, imageInfo, classifyPhoto, type RenderResult } from "@/lib/video-engine/render-node";
import { loadEngineFonts } from "@/lib/video-engine/fonts-node";
import { resolveMusic } from "@/lib/video-engine/music-node";
import type { BindData } from "@/lib/video-engine/layers";

/** A közös munkakönyvtár (az áttűnés-gyorsítótár miatt jobonként közös). */
export const ENGINE_WORK_DIR = path.join(os.tmpdir(), "twinx-video-engine");

export type EnginePhoto = { bytes: Uint8Array; type: string };

export type EngineJobInput = {
  /** A sablon (vagy színváltozat) azonosítója — pl. "skandi-zsalya". Üres → colorVariant dönt. */
  engineTemplate: string;
  /** A régi varázsló színválasztója (csak ha nincs engineTemplate): "ejkek" → Nocturne. */
  colorVariant?: string;
  aspect: AspectId;
  photos: EnginePhoto[];
  facts: Partial<VideoCaptionFacts> & { propertyType?: string };
  captions: string[];
  captionPositions: Array<"bottom" | "center">;
  profile: Partial<FlyerProfileData>;
  musicStyle: string;
  /** Egyedi azonosító (a munkamappa neve). */
  id: string;
  log?: (msg: string) => void;
};

export type EngineJobResult = RenderResult & {
  templateId: string;
  templateName: string;
  photoKinds: ("wide" | "matching" | "tall")[];
  fontSource: "local" | "google" | "none";
  music: string | null;
  /** A munkamappa — a hívó törli, miután a kész fájlt feltöltötte. */
  jobDir: string;
};

const clip = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

/** A választott sablon feloldása (engineTemplate → sablon / színváltozat). */
export function pickEngineTemplate(engineTemplate: string, colorVariant?: string): { id: string; tpl: TwinxTemplate } {
  const id = engineTemplate || (colorVariant === "ejkek" ? "nocturne" : "aurora");
  return { id, tpl: resolveEngineTemplate(id) };
}

/** A sablon kötött adatai (szövegek, képek) a szerkesztő mezőiből. */
export function buildEngineData(tpl: TwinxTemplate, input: Omit<EngineJobInput, "photos" | "id" | "aspect" | "musicStyle" | "engineTemplate">, photoCount: number): BindData {
  const raw = input.facts;
  const facts = {
    location: clip(raw.location, 80), address: clip(raw.address, 80), price: clip(raw.price, 40),
    size: clip(raw.size, 20), rooms: clip(raw.rooms, 40), bathrooms: clip(raw.bathrooms, 60),
  };
  const profile = input.profile;
  const data: BindData = {
    "property.title": facts.address || facts.location,
    "property.city": facts.address ? facts.location : "",
    "property.type": clip(raw.propertyType, 60),
    "property.price": formatPrice(facts.price),
    "property.specs": [facts.rooms, facts.bathrooms, formatSize(facts.size)].filter(Boolean).join("\n"),
    "agent.name": clip(profile.display_name, 80),
    "agent.phone": clip(profile.phone, 40),
    "agent.email": clip(profile.email, 80),
    "agent.photo": clip(profile.agent_photo_url, 500),
    "agent.logo": clip(profile.logo_url, 500),
  };
  // Az 1. fotó a nyitókép (azon az adatpanel ül) — felirat a 2. fotótól jár.
  for (let i = 1; i < photoCount; i++) {
    const raw = String(input.captions[i] ?? "");
    let text: string;
    if (tpl.captionMaxChars) {
      // Hosszú-feliratos sablon (pl. Skandi): a teljes szöveg megy, a sablon tördeli.
      text = raw.replace(/\s+/g, " ").trim().slice(0, tpl.captionMaxChars);
    } else {
      // A régi sablonok (Aurora): két kiegyensúlyozott sorra bontva.
      const c = splitCaption(raw);
      text = [c.line1, c.line2].filter(Boolean).join("\n");
    }
    if (text) data[`caption.${i + 1}`] = text;
    data[`captionpos.${i + 1}`] = input.captionPositions[i] ?? "bottom";
  }
  return data;
}

/** A videó elkészítése. Hibánál kivételt dob (a hívó dönt a visszatérítésről). */
export async function runEngineJob(input: EngineJobInput): Promise<EngineJobResult> {
  const { id: templateId, tpl } = pickEngineTemplate(input.engineTemplate, input.colorVariant);
  const tplErrors = validateTemplate(tpl);
  if (tplErrors.length) throw new Error(`Sablonhiba: ${tplErrors.join("; ")}`);
  if (input.photos.length < tpl.photos.min || input.photos.length > tpl.photos.max) {
    throw new Error(`${tpl.photos.min}–${tpl.photos.max} fotó kell.`);
  }

  const jobDir = path.join(ENGINE_WORK_DIR, "jobs", input.id);
  fs.mkdirSync(jobDir, { recursive: true });

  const photos: string[] = input.photos.map((p, i) => {
    const ext = p.type === "image/png" ? "png" : p.type === "image/webp" ? "webp" : "jpg";
    const file = path.join(jobDir, `foto-${i + 1}.${ext}`);
    fs.writeFileSync(file, p.bytes);
    return file;
  });

  const { width: W, height: H } = ASPECT_SIZES[input.aspect];
  const photoKinds = photos.map((p) => classifyPhoto(imageInfo(p), W, H));
  const data = buildEngineData(tpl, input, photos.length);

  const { fonts, source: fontSource } = await loadEngineFonts(tpl, Object.values(data).filter((v): v is string => Boolean(v)));
  const style = input.musicStyle && input.musicStyle !== "none" ? input.musicStyle : "";
  const music = style ? await resolveMusic(style, ENGINE_WORK_DIR) : null;

  const ffmpegPath = process.env.FFMPEG_PATH || (ffmpegStatic as unknown as string) || "ffmpeg";
  const result = await renderVideo({
    template: tpl, aspect: input.aspect, photos, data, fonts, music: music?.file ?? null,
    workDir: ENGINE_WORK_DIR, ffmpegPath,
    outName: `jobs/${input.id}/twinx-${templateId}-${input.aspect.replace(":", "x")}.mp4`,
    log: input.log,
  });

  return {
    ...result,
    templateId,
    templateName: tpl.name.replace(/^TWINX\s+/, ""),
    photoKinds,
    fontSource,
    music: music ? decodeURIComponent(music.url.split("/").pop() ?? "") : null,
    jobDir,
  };
}
