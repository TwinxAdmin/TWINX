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

/** A TARTALMI fotók idő-ablakai (IMAGE_n első előfordulása), sorrendben.
 *  Ehhez igazítjuk a képenkénti felirat-sávot (a záró háttér ismétlést kihagyja). */
export function contentImageWindows(tpl: TemplateJson): Array<{ start: number; length: number }> {
  const n = countImagePlaceholders(tpl);
  const firstByIdx: Record<number, { start: number; length: number }> = {};
  for (const track of tpl.timeline.tracks) {
    for (const clip of track.clips) {
      const src = clip?.asset?.src;
      if (typeof src !== "string") continue;
      const m = src.match(/^\{\{\s*IMAGE_(\d+)\s*\}\}$/);
      if (!m) continue;
      const idx = Number(m[1]);
      const start = Number(clip.start) || 0;
      if (!firstByIdx[idx] || start < firstByIdx[idx].start) {
        firstByIdx[idx] = { start, length: Number(clip.length) || 0 };
      }
    }
  }
  const out: Array<{ start: number; length: number }> = [];
  for (let i = 1; i <= n; i++) if (firstByIdx[i]) out.push(firstByIdx[i]);
  return out;
}

/** A sablon kimeneti mérete → arány + méret. */
export function outputSize(tpl: TemplateJson): { width: number; height: number; aspect: string } {
  const w = tpl.output?.size?.width ?? 1024;
  const h = tpl.output?.size?.height ?? 576;
  const r = w / h;
  const aspect = r < 1 ? "9:16" : "1:1";
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

/**
 * Kiüríti azokat a rich-text feliratokat, amelyek NEM tartalmaznak {{ helyőrzőt }},
 * vagyis fix, sablonba drótozott szövegek (pl. „HOUSE"). Így a videóban csak a
 * partner által megadott, merge-mezőből jövő szöveg jelenik meg — más semmi.
 */
function blankLiteralText(tpl: TemplateJson): void {
  for (const track of tpl.timeline.tracks) {
    for (const clip of track.clips) {
      const a = clip?.asset;
      if (a?.type === "rich-text" && typeof a.text === "string" && !/\{\{/.test(a.text)) {
        a.text = "";
      }
    }
  }
}

export type MergeInput = {
  images: string[];              // publikus fotó-URL-ek, sorrendben
  musicUrl: string | null;       // saját zene
  values: Record<string, string>; // egyéb helyőrzők: ADDRESS, SUBURB, AGENT_NAME, ...
  callbackUrl: string;
  // Képenkénti felirat-sáv (kész, átlátszó PNG-k) az adott idő-ablakokra ráültetve.
  captionOverlays?: Array<{ src: string; start: number; length: number }>;
  // A ZÁRÓKÉP háttere: a sablon a záró szegmensben az 1. fotót ismétli — ezt
  // cseréljük a partner által feltöltött, dedikált záró képre (ha van).
  closingBgUrl?: string | null;
};

/** A beküldhető Shotstack render-test összeállítása a sablonból. */
export function buildMergeRenderBody(tpl: TemplateJson, input: MergeInput): Record<string, unknown> {
  const t = clone(tpl);

  // 1) A helyőrzők végső értékei: KIZÁRÓLAG a partner adatai + a fotói.
  //    A sablon saját példa-értékeit (MAROUBRA, NSW, AUCTION, minta-képek stb.)
  //    SZÁNDÉKOSAN nem vesszük át — csak az jelenjen meg, amit a partner megadott.
  const values: Record<string, string> = {};
  for (const [k, v] of Object.entries(input.values)) values[k] = v ?? "";
  input.images.forEach((url, i) => { values[`IMAGE_${i + 1}`] = url; });

  // 1/B) ZÁRÓKÉP háttér: a legkésőbb induló IMAGE_n klip (a záró szegmens
  //      ismételt 1. fotója) helyére a dedikált záró kép kerül (literál URL).
  if (input.closingBgUrl) {
    let best: any = null;
    for (const track of t.timeline.tracks) {
      for (const clip of track.clips) {
        const src = clip?.asset?.src;
        if (typeof src === "string" && /^\{\{\s*IMAGE_\d+\s*\}\}$/.test(src)) {
          if (!best || (Number(clip.start) || 0) > (Number(best.start) || 0)) best = clip;
        }
      }
    }
    if (best) best.asset.src = input.closingBgUrl;
  }

  // 2) Zene, üres képek, és a NEM-ADAT (fix) feliratok kiürítése.
  swapAudio(t, input.musicUrl);
  pruneEmptyImageClips(t, values);
  blankLiteralText(t); // pl. a fixen bedrótozott „HOUSE" — nem a partner adata

  // 2/B) Képenkénti felirat-sáv a legfelső rétegre (átlátszó PNG-k).
  if (input.captionOverlays?.length) {
    t.timeline.tracks.unshift({
      clips: input.captionOverlays.map((o) => ({
        asset: { type: "image", src: o.src },
        start: o.start, length: o.length, fit: "cover",
      })),
    });
  }

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
