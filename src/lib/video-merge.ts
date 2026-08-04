// JSON-merge motor: egy kész Shotstack template-JSON-t tölt fel a partner
// adataival (merge-mezők), lecseréli a zenét, és beküldhető render-testet ad.
//
// A profi videógenerátorok így működnek: a dizájn a JSON-ban van (fontok,
// grafikák, animációk), mi csak a {{ HELYŐRZŐKET }} töltjük ki. Nincs Satori-
// újraépítés — a Shotstack pixelpontosan azt rendereli, ami a sablonban van.

/* eslint-disable @typescript-eslint/no-explicit-any */

export type TemplateJson = {
  timeline: { tracks: Array<{ clips: any[] }>; [k: string]: any };
  output: { size?: { width: number; height: number }; [k: string]: any };
  merge?: Array<{ find: string; replace: string }>;
  [k: string]: any;
};

function clone<T>(o: T): T {
  return JSON.parse(JSON.stringify(o));
}

/** Az összes {{ NÉV }} helyőrző a JSON-ban (szöveges kereséssel). */
export function collectPlaceholders(tpl: TemplateJson): string[] {
  const s = JSON.stringify(tpl);
  const set = new Set<string>();
  for (const m of s.matchAll(/\{\{\s*([A-Z0-9_]+)\s*\}\}/g)) set.add(m[1]);
  return [...set];
}

/** Hány IMAGE_n fotó-helyőrző van (ebből adódik a kötelező képszám). */
export function countImagePlaceholders(tpl: TemplateJson): number {
  const nums = new Set<number>();
  for (const p of collectPlaceholders(tpl)) {
    const m = p.match(/^IMAGE_(\d+)$/);
    if (m) nums.add(Number(m[1]));
  }
  return nums.size;
}

/** A sablon kimeneti mérete → arány + méret. */
export function outputSize(tpl: TemplateJson): { width: number; height: number; aspect: string } {
  const w = tpl.output?.size?.width ?? 1024;
  const h = tpl.output?.size?.height ?? 576;
  const r = w / h;
  const aspect = Math.abs(r - 1) < 0.05 ? "1:1" : r < 1 ? "9:16" : "16:9";
  return { width: w, height: h, aspect };
}

/** A zene lecserélése a saját (licencmentes) sávunkra minden audio-klipben. */
function swapAudio(tpl: TemplateJson, musicUrl: string | null): void {
  if (!musicUrl) return;
  for (const track of tpl.timeline.tracks) {
    for (const clip of track.clips) {
      if (clip?.asset?.type === "audio") {
        clip.asset.src = musicUrl;
        clip.asset.effect = clip.asset.effect ?? "fadeOut";
      }
    }
  }
}

/**
 * Kiüríti azokat a KÉP-klipeket, amelyek helyőrzőjéhez nincs érték (pl. nincs
 * ügynökfotó vagy logó). Így a Shotstack nem hasal el üres image-src miatt.
 * A luma-maszkot (kör) is elrejtjük, ha az utána jövő kép üres.
 */
function pruneEmptyImageClips(tpl: TemplateJson, values: Record<string, string>): void {
  const empty = (src: any): boolean => {
    if (typeof src !== "string") return false;
    const m = src.match(/^\{\{\s*([A-Z0-9_]+)\s*\}\}$/);
    return !!m && !String(values[m[1]] ?? "").trim();
  };
  for (const track of tpl.timeline.tracks) {
    const before = track.clips.length;
    track.clips = track.clips.filter((clip: any) => {
      if (clip?.asset?.type === "image" && empty(clip.asset.src)) return false;
      return true;
    });
    // Ha a képet töröltük egy olyan sávból, ahol luma-maszk is volt (ügynök-kör),
    // a maszk önmagában felesleges — töröljük az egész sávot, ha csak luma maradt.
    if (before !== track.clips.length && track.clips.every((c: any) => c?.asset?.type === "luma")) {
      track.clips = [];
    }
  }
  // Az üres klipsávok maradhatnak (Shotstack elfogadja), de takarítsuk ki.
  tpl.timeline.tracks = tpl.timeline.tracks.filter((t) => t.clips.length > 0);
}

export type MergeInput = {
  images: string[];              // publikus fotó-URL-ek, sorrendben
  musicUrl: string | null;       // saját zene
  values: Record<string, string>; // egyéb helyőrzők: ADDRESS, SUBURB, AGENT_NAME, ...
  callbackUrl: string;
};

/** A beküldhető Shotstack render-test összeállítása a sablonból. */
export function buildMergeRenderBody(tpl: TemplateJson, input: MergeInput): Record<string, unknown> {
  const t = clone(tpl);

  // 1) A helyőrzők végső értékei: a sablon saját merge-alapértelmezései, felülírva
  //    a mi értékeinkkel és a fotókkal.
  const values: Record<string, string> = {};
  for (const d of t.merge ?? []) values[d.find] = d.replace;
  for (const [k, v] of Object.entries(input.values)) values[k] = v ?? "";
  input.images.forEach((url, i) => { values[`IMAGE_${i + 1}`] = url; });

  // 2) Zene + üres képek kezelése.
  swapAudio(t, input.musicUrl);
  pruneEmptyImageClips(t, values);

  // 3) A merge-tömb a végső értékekből (csak amikre van helyőrző a sablonban).
  const used = new Set(collectPlaceholders(t));
  const merge = [...used].map((find) => ({ find, replace: values[find] ?? "" }));

  // 4) A sablon saját callback/destinations mezőit nem visszük tovább — a mienk megy.
  const output = clone(t.output);
  if (output && "destinations" in output) delete output.destinations;

  return {
    timeline: t.timeline,
    output,
    merge,
    callback: input.callbackUrl,
  };
}
