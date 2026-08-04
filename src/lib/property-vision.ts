// Fotó-alapú ingatlan-állapot elemzés (Gemini, szöveges/JSON kimenet).
// A partner által feltöltött 3-5 fotóból egy STRUKTURÁLT, HATÁROLT állapot-jelentést
// készít, amit az értékbecslő prompt a lakás-specifikus korrekcióknál használ fel
// (a ±5% nettó plafonon belül). A fotók hirdetési célúak, lehetnek beállítottak —
// ezért a modellnek konzervatívan, óvatosan kell értékelnie.

const TEXT_MODEL = process.env.GOOGLE_TEXT_MODEL || "gemini-2.5-flash";
const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

export type VisionImage = { bytes: Uint8Array; mimeType: string };

export type PropertyConditionReport = {
  conditionScore: number; // 1-10 (10 = kifogástalan, újszerű/prémium)
  renovationLevel: string; // "újszerű" | "felújított" | "jó" | "közepes" | "felújítandó"
  kitchen: string;
  bathroom: string;
  light: string; // fény / benapozottság
  ceilingHeight: string; // pl. "átlagos" / "magas (polgári)"
  layout: string;
  view: string; // kilátás / panoráma, ha látszik
  positives: string[];
  negatives: string[];
  netAdjustmentPct: number; // javasolt nettó állapot-korrekció, -10..+10 (határolt)
  confidence: "alacsony" | "közepes" | "magas"; // a kép-mennyiség/minőség alapján
  notes: string;
  photoCount: number;
};

const ADJ_MIN = -10;
const ADJ_MAX = 10;

function clampAdj(n: unknown): number {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.max(ADJ_MIN, Math.min(ADJ_MAX, Math.round(v)));
}

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" && v.trim() ? v.trim() : fallback;
}

function strArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => str(x)).filter(Boolean).slice(0, 6);
}

const VISION_PROMPT = `Ingatlan-értékbecslést segítő szakértő vagy. A megadott 1-5 fényképet ELEMEZD, és kizárólag a LÁTHATÓ jellemzők alapján állapítsd meg az ingatlan állapotát és minőségét. A fotók hirdetési célúak lehetnek (beállított, széles látószögű, szépített), ezért ÓVATOSAN, KONZERVATÍVAN ítélj, és amit nem látsz, azt ne találd ki.

Csak a következőket értékeld a képekről: általános állapot és felújítási szint, burkolatok (padló, falak), konyha kora/minősége, fürdő kora/minősége, természetes fény/benapozottság, belmagasság, alaprajzi benyomás, és ha az ablakból látszik, a kilátás/panoráma. NE becsülj árat, NE becsülj négyzetmétert, és ne vonj le következtetést a lokációról vagy a jogi helyzetről.

A "netAdjustmentPct" a lakás állapot/minőség miatti JAVASOLT nettó korrekció a piaci átlaghoz képest, -10 és +10 százalék között (átlagos állapot = 0). Legyen konzervatív; szélső értéket csak egyértelmű, a képen jól látható indokkal adj.

VÁLASZ: KIZÁRÓLAG egyetlen JSON objektum, semmilyen más szöveg, magyarázat vagy markdown nélkül. A JSON sémája:
{
  "conditionScore": <egész 1-10>,
  "renovationLevel": "<újszerű|felújított|jó|közepes|felújítandó>",
  "kitchen": "<rövid megállapítás>",
  "bathroom": "<rövid megállapítás>",
  "light": "<rövid megállapítás>",
  "ceilingHeight": "<rövid megállapítás>",
  "layout": "<rövid megállapítás>",
  "view": "<rövid megállapítás vagy 'nem látható'>",
  "positives": ["<max 4 rövid pont>"],
  "negatives": ["<max 4 rövid pont>"],
  "netAdjustmentPct": <egész -10..10>,
  "confidence": "<alacsony|közepes|magas>",
  "notes": "<1-2 mondat, pl. hány kép, mi nem látszik>"
}`;

/** A modell szöveges válaszából kinyeri az első JSON objektumot (robusztus a ```json blokkra is). */
function extractJson(text: string): Record<string, unknown> | null {
  if (!text) return null;
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fence ? fence[1] : text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * A fotók elemzése egyetlen Gemini-hívással. Hiba esetén NEM dob — null-t ad vissza,
 * hogy az értékbecslés fotó nélkül is lefusson (a fotó opcionális extra).
 */
export async function analyzePropertyPhotos(
  images: VisionImage[]
): Promise<PropertyConditionReport | null> {
  const apiKey = process.env.GOOGLE_AI_STUDIO_API_KEY;
  if (!apiKey || images.length === 0) return null;

  const parts: Array<Record<string, unknown>> = [{ text: VISION_PROMPT }];
  for (const img of images.slice(0, 5)) {
    parts.push({
      inline_data: {
        mime_type: img.mimeType,
        data: Buffer.from(img.bytes).toString("base64"),
      },
    });
  }

  try {
    const res = await fetch(`${ENDPOINT}/${TEXT_MODEL}:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { temperature: 0.1, responseModalities: ["TEXT"] },
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text: string =
      data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p?.text ?? "").join("") ?? "";
    const obj = extractJson(text);
    if (!obj) return null;

    const score = Math.max(1, Math.min(10, Math.round(Number(obj.conditionScore) || 5)));
    const conf = str(obj.confidence, "közepes");
    return {
      conditionScore: score,
      renovationLevel: str(obj.renovationLevel, "jó"),
      kitchen: str(obj.kitchen),
      bathroom: str(obj.bathroom),
      light: str(obj.light),
      ceilingHeight: str(obj.ceilingHeight),
      layout: str(obj.layout),
      view: str(obj.view, "nem látható"),
      positives: strArray(obj.positives),
      negatives: strArray(obj.negatives),
      netAdjustmentPct: clampAdj(obj.netAdjustmentPct),
      confidence: (["alacsony", "közepes", "magas"].includes(conf) ? conf : "közepes") as
        | "alacsony"
        | "közepes"
        | "magas",
      notes: str(obj.notes),
      photoCount: images.length,
    };
  } catch {
    return null;
  }
}

// --- Hirdetés főkép-választás: esztétikai pontszám képenként ------------------
const HERO_PROMPT = `Ingatlan-hirdetéshez FŐKÉPET választasz és a képeket helyiség szerint sorolod. Az alábbi képeket a SORRENDJÜKBEN elemezd. Mindegyikhez adj:
- score: 0-100 pont, mennyire alkalmas vonzó, figyelemfelkeltő FŐKÉPNEK. Magasabb: világos, tágas, rendezett, jó kompozíciójú, hívogató FŐHELYISÉG (nappali, konyha-étkező, panorámás/kertkapcsolatos tér). Alacsonyabb: sötét, zsúfolt, szűk vagy mellékes helyiség (fürdő, WC, tároló, folyosó), életlen kép.
- room: a képen látható helyiség/tér egyike: "nappali", "konyha", "étkező", "háló", "fürdő", "wc", "előszoba", "erkély/terasz", "kert/kültér", "homlokzat", "egyéb".
VÁLASZ: KIZÁRÓLAG egyetlen JSON, más szöveg nélkül: {"photos":[{"score":<szám>,"room":"<helyiség>"}, ...]} — pontosan annyi elem, ahány kép van, a képek sorrendjében.`;

export type FlyerPhotoInfo = { score: number; room: string };

/**
 * Minden hirdetés-fotóhoz pontszám (0-100, főkép-alkalmasság) + helyiség-besorolás,
 * a képek sorrendjében. Hibatűrő: hiba esetén null (a hívó marad az eredeti sorrendnél).
 */
export async function analyzeFlyerPhotos(images: VisionImage[]): Promise<FlyerPhotoInfo[] | null> {
  const apiKey = process.env.GOOGLE_AI_STUDIO_API_KEY;
  if (!apiKey || images.length === 0) return null;

  const parts: Array<Record<string, unknown>> = [{ text: HERO_PROMPT }];
  for (const img of images.slice(0, 8)) {
    parts.push({
      inline_data: { mime_type: img.mimeType, data: Buffer.from(img.bytes).toString("base64") },
    });
  }

  try {
    const res = await fetch(`${ENDPOINT}/${TEXT_MODEL}:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { temperature: 0, responseModalities: ["TEXT"] },
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text: string =
      data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p?.text ?? "").join("") ?? "";
    const obj = extractJson(text);
    const arr = obj?.photos;
    if (!Array.isArray(arr)) return null;
    const info: FlyerPhotoInfo[] = arr.map((x) => {
      const o = (x ?? {}) as Record<string, unknown>;
      return {
        score: Math.max(0, Math.min(100, Math.round(Number(o.score) || 0))),
        room: typeof o.room === "string" && o.room.trim() ? o.room.trim().toLowerCase() : "egyéb",
      };
    });
    return info.length >= images.length ? info.slice(0, images.length) : null;
  } catch {
    return null;
  }
}

/** A jelentés promptba illeszthető szöveges blokkja (a ±5% plafonra emlékeztetve). */
export function renderConditionBlock(r: PropertyConditionReport): string {
  const pos = r.positives.length ? r.positives.join("; ") : "—";
  const neg = r.negatives.length ? r.negatives.join("; ") : "—";
  const sign = r.netAdjustmentPct > 0 ? "+" : "";
  return `FOTÓ-ALAPÚ ÁLLAPOTÉRTÉKELÉS (a partner ${r.photoCount} feltöltött fotójából, gépi képelemzés — a fotók hirdetési célúak, lehetnek beállítottak, ezért KONZERVATÍVAN súlyozd):
- Állapot-pontszám: ${r.conditionScore}/10 (megbízhatóság: ${r.confidence})
- Felújítási szint: ${r.renovationLevel}
- Konyha: ${r.kitchen || "—"}
- Fürdő: ${r.bathroom || "—"}
- Fény/benapozottság: ${r.light || "—"}
- Belmagasság: ${r.ceilingHeight || "—"}
- Alaprajz: ${r.layout || "—"}
- Kilátás: ${r.view || "nem látható"}
- Előnyök: ${pos}
- Hátrányok: ${neg}
- Fotó-alapú javasolt nettó állapot-korrekció: ${sign}${r.netAdjustmentPct}%
Ezt a lakás-specifikus korrekcióknál vedd figyelembe, a ±5% nettó plafonon belül; a fotó-alapú korrekció önmagában NE lépje túl a ±5%-ot, és bizonytalan (alacsony megbízhatóságú) kép esetén csökkentett súllyal számolj.`;
}
