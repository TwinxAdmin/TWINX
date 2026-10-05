// ZENE A SAJÁT MOTORHOZ — ugyanaz a zenetár, mint a Shotstack-láncban.
//
// A partner a varázslóban zenei STÍLUST választ (lib/video.ts → MUSIC_STYLES:
// Elegáns / Nyugodt / Cinematic). A Supabase `music` tárhely `music/{stílus}/`
// mappájában lévő, előre megvágott zenék közül a meglévő `pickMusic()` sorsol egyet.
// A Shotstack ezt URL-ről olvasta; a saját motor helyi fájlból dolgozik, ezért itt
// a kiválasztott zenét letöltjük a munkakönyvtárba (stílusonként gyorsítótárazva).
//
// CSAK SZERVEROLDALON fut.
import fs from "node:fs";
import path from "node:path";
import { pickMusic } from "@/lib/music";
import { isValidMusicStyle } from "@/lib/video";

export type ResolvedMusic = { file: string; url: string } | null;

/**
 * A választott stílushoz zene: sorsolás a zenetárból + letöltés helyi fájlba.
 * Ha a stílus érvénytelen, a mappa üres, vagy a letöltés nem sikerül → null
 * (a videó ilyenkor zene nélkül készül el, nem bukik el).
 */
export async function resolveMusic(style: string, workDir: string): Promise<ResolvedMusic> {
  if (!isValidMusicStyle(style)) return null;
  const url = await pickMusic(style);
  if (!url) return null;

  const dir = path.join(workDir, "music", style);
  fs.mkdirSync(dir, { recursive: true });
  const name = decodeURIComponent(url.split("/").pop() ?? "zene.mp3").replace(/[^\w.\-]+/g, "_");
  const file = path.join(dir, name);
  if (fs.existsSync(file) && fs.statSync(file).size > 0) return { file, url };

  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
    return { file, url };
  } catch {
    return null;
  }
}
