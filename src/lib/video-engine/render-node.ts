// TWINX VIDEÓMOTOR — renderelő (2. fázis).
//
// Kész: jelenet-hátterek (fotó + kameramozgás, okos képkivágással), a sablon
// rétegei (forma, szöveg, halmozott adatblokk, kép) animált megjelenéssel, és a
// jelenetek közötti áttűnések. Következik: feliratsáv, zárókártya-áttűnés, zene.
//
// Felépítés:
//  1) Áttűnés-képkockák: Satori (vektor → átlátszó PNG), fél felbontásban,
//     sablon/szín/méret szerint EGYSZER — a partner adataitól független.
//  2) Rétegek: jelenetenként, a megjelenés-animáció szerint csoportosítva egy-egy
//     átlátszó PNG (Satori), amit az ffmpeg animálva (csúszás, áttűnés) ültet rá.
//  3) Jelenetek: kameramozgás fotónként. OKOS KIVÁGÁS: ha a fotó sokkal
//     szélesebb a vászonnál (pl. fekvő fotó álló videóban), nem nagyítunk bele,
//     hanem lassan végigpásztázzuk a teljes szélességét — így az egész helyiség látszik.
//  4) Összefűzés, rétegek, áttűnések (a vágás a teljes takarás pillanatában).
//
// CSAK SZERVEROLDALON fut (Node: fájlrendszer + ffmpeg).
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { ImageResponse } from "next/og";
import {
  ASPECT_SIZES, resolveColor, sceneStarts, totalDuration,
  type Appear, type AspectId, type Layer, type Motion, type TwinxTemplate,
} from "./template-schema";
import {
  chevronCutProgress, chevronWipeFrame, panelRevealFrame, softDipFrame, symbolZoomFrame, symbolMaskFrame,
  PANEL_CUT, DIP_CUT, SYMBOL_CUT, type SatoriNode, type EstateSymbol,
} from "./transitions";
import { layersFrame, type BindData } from "./layers";

export type EngineFont = { name: string; data: ArrayBuffer; weight: 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900; style: "normal" };

export type RenderInput = {
  template: TwinxTemplate;
  aspect: AspectId;
  /** Helyi fájlútvonalak, sorrendben (photo.1 = photos[0]). */
  photos: string[];
  /** A partner adatai (cím, ár, ügynök…) a rétegekhez. */
  data?: BindData;
  /** A sablon betűi (a hívó tölti be: helyi fájl vagy Google Fonts). */
  fonts?: EngineFont[];
  /** Zene (helyi fájl). Hiányában néma videó készül. */
  music?: string | null;
  workDir: string;
  ffmpegPath: string;
  outName?: string;
  log?: (msg: string) => void;
};

export type RenderResult = { file: string; seconds: number; timings: Record<string, number> };

function run(bin: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn(bin, args, { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    p.stderr.on("data", (d) => { err += String(d); if (err.length > 20000) err = err.slice(-20000); });
    p.on("error", reject);
    p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg hiba (${code}): ${err.slice(-1500)}`))));
  });
}

async function png(el: SatoriNode, W: number, H: number, fonts: EngineFont[] | undefined): Promise<Buffer> {
  const res = new ImageResponse(el as unknown as React.ReactElement, { width: W, height: H, fonts: fonts?.length ? fonts : undefined });
  return Buffer.from(await res.arrayBuffer());
}

// ---------------------------------------------------------------------------
// Képméret (JPEG / PNG / WebP fejlécből — külön csomag nélkül)
// ---------------------------------------------------------------------------
/** JPEG EXIF tájolás (1 = normál, 3 = 180°, 6 = 90° jobbra, 8 = 90° balra). */
function jpegOrientation(b: Buffer): number {
  let i = 2;
  while (i + 4 < b.length && b[i] === 0xff) {
    const marker = b[i + 1];
    const len = b.readUInt16BE(i + 2);
    if (marker === 0xe1 && b.toString("ascii", i + 4, i + 8) === "Exif") {
      const t = i + 10;                      // TIFF-fejléc kezdete
      const le = b.toString("ascii", t, t + 2) === "II";
      const u16 = (o: number) => (le ? b.readUInt16LE(o) : b.readUInt16BE(o));
      const u32 = (o: number) => (le ? b.readUInt32LE(o) : b.readUInt32BE(o));
      const ifd = t + u32(t + 4);
      const n = u16(ifd);
      for (let k = 0; k < n; k++) {
        const e = ifd + 2 + k * 12;
        if (u16(e) === 0x0112) return u16(e + 8);
      }
      return 1;
    }
    if (marker === 0xda) break;              // a képadat kezdete — nincs EXIF
    i += 2 + len;
  }
  return 1;
}

export type ImageInfo = {
  /** A MEGJELENÍTETT méret (az EXIF-forgatás után). */
  width: number;
  height: number;
  orientation: number;
};

/**
 * A fotó valódi mérete és tájolása (JPEG / PNG / WebP fejlécből, külön csomag nélkül).
 * FONTOS: a telefonos álló fotók sokszor fekvőként vannak eltárolva, és csak az EXIF
 * mondja meg, hogy el kell forgatni — enélkül az álló fotót fekvőnek néznénk, és
 * oldalra fordítva kerülne a videóba.
 */
export function imageInfo(file: string): ImageInfo | null {
  const b = fs.readFileSync(file);
  if (b.length > 24 && b.readUInt32BE(0) === 0x89504e47) return { width: b.readUInt32BE(16), height: b.readUInt32BE(20), orientation: 1 };
  if (b.length > 30 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") {
    const kind = b.toString("ascii", 12, 16);
    if (kind === "VP8X") return { width: 1 + b.readUIntLE(24, 3), height: 1 + b.readUIntLE(27, 3), orientation: 1 };
    if (kind === "VP8 ") return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff, orientation: 1 };
    if (kind === "VP8L") {
      const bits = b.readUInt32LE(21);
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1, orientation: 1 };
    }
  }
  if (b[0] === 0xff && b[1] === 0xd8) {
    const orientation = jpegOrientation(b);
    let i = 2;
    while (i < b.length) {
      if (b[i] !== 0xff) { i++; continue; }
      const marker = b[i + 1];
      const len = b.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        const h = b.readUInt16BE(i + 5), w = b.readUInt16BE(i + 7);
        const rotated = orientation >= 5 && orientation <= 8;
        return { width: rotated ? h : w, height: rotated ? w : h, orientation };
      }
      i += 2 + len;
    }
  }
  return null;
}

/** ffmpeg-szűrő, ami az EXIF szerinti helyes állásba forgatja a fotót. */
function orientFilter(o: number): string {
  switch (o) {
    case 2: return "hflip,";
    case 3: return "hflip,vflip,";
    case 4: return "vflip,";
    case 5: return "transpose=0,";
    case 6: return "transpose=1,";
    case 7: return "transpose=3,";
    case 8: return "transpose=2,";
    default: return "";
  }
}

/** Milyen fotót kaptunk a vászonhoz képest — ebből dől el a mozgás. */
export type PhotoKind = "wide" | "matching" | "tall";
export function classifyPhoto(info: ImageInfo | null, W: number, H: number): PhotoKind {
  if (!info) return "matching";
  const r = (info.width / info.height) / (W / H);
  if (r > 1.08) return "wide";      // szélesebb a vászonnál (pl. fekvő fotó álló videóban)
  if (r < 1 / 1.08) return "tall";  // magasabb a vászonnál
  return "matching";                // közel azonos arány (pl. 9:16-os fotó 9:16-os videóban)
}

// ---------------------------------------------------------------------------
// 1) Áttűnés-képkockák
// ---------------------------------------------------------------------------
const TRANSITION_VERSION = 2;
async function transitionFrames(opts: {
  kind: "chevronWipe" | "panelReveal" | "softDip";
  direction: "right" | "left" | "up" | "down";
  dir: string; W: number; H: number; fps: number; duration: number; fill: string; glow: string;
}): Promise<{ pattern: string; frames: number }> {
  const { W, H, fps, duration } = opts;
  const frames = Math.max(2, Math.round(duration * fps));
  const w = Math.round(W / 2), hh = Math.round(H / 2);
  // A verziószámot emeld, ha az áttűnés rajzolása változik (különben a régi gyorsítótár marad).
  const key = `${opts.kind}-${opts.direction}-v${TRANSITION_VERSION}-${w}x${hh}-${frames}-${opts.fill.slice(1)}-${opts.glow.slice(1)}`;
  const dir = path.join(opts.dir, key);
  const pattern = path.join(dir, "f%04d.png");
  if (fs.existsSync(path.join(dir, `f${String(frames - 1).padStart(4, "0")}.png`))) return { pattern, frames };
  fs.mkdirSync(dir, { recursive: true });
  for (let i = 0; i < frames; i++) {
    const pr = i / (frames - 1);
    const el = opts.kind === "panelReveal"
      ? panelRevealFrame(pr, w, hh, { fill: opts.fill, band: opts.glow })
      : opts.kind === "softDip"
        ? softDipFrame(pr, w, hh, opts.fill)
        : chevronWipeFrame(pr, w, hh, { fill: opts.fill, glow: opts.glow }, opts.direction);
    fs.writeFileSync(path.join(dir, `f${String(i).padStart(4, "0")}.png`), await png(el, w, hh, undefined));
  }
  return { pattern, frames };
}

/**
 * SZIMBÓLUM-ZOOM képkockái (fél felbontáson, gyorsítótárazva):
 *  • a LÁTHATÓ réteg (arany vonalak) a teljes áttűnésre;
 *  • a MASZK (fehér szimbólum-belső fekete alapon) csak a vágás előtti szakaszra —
 *    ezen át látszik már a következő jelenet („átlépés a következő szobába").
 */
async function symbolFrames(opts: {
  symbol: EstateSymbol; origin: { x: number; y: number; size: number };
  dir: string; W: number; H: number; fps: number; duration: number; stroke: string;
}): Promise<{ pattern: string; frames: number; maskPattern: string; maskFrames: number }> {
  const { W, H, fps, duration } = opts;
  const frames = Math.max(2, Math.round(duration * fps));
  const maskFrames = Math.max(1, Math.round(frames * SYMBOL_CUT));
  const w = Math.round(W / 2), hh = Math.round(H / 2);
  const o = opts.origin;
  const key = `symbolZoom-${opts.symbol}-v${TRANSITION_VERSION}-${w}x${hh}-${frames}-${opts.stroke.slice(1)}-${o.x}-${o.y}-${o.size}`;
  const dir = path.join(opts.dir, key);
  const pattern = path.join(dir, "f%04d.png");
  const maskPattern = path.join(dir, "m%04d.png");
  const zo = {
    symbol: opts.symbol,
    // Az origó a vászon SZÉLESSÉGÉNEK arányában van megadva (így 9:16-ban és 1:1-ben ugyanott ül).
    origin: { x: o.x * w, y: o.y * w, size: o.size * w },
    colors: { fill: "none", stroke: opts.stroke },
  };
  if (fs.existsSync(path.join(dir, `f${String(frames - 1).padStart(4, "0")}.png`))) return { pattern, frames, maskPattern, maskFrames };
  fs.mkdirSync(dir, { recursive: true });
  for (let i = 0; i < frames; i++) {
    const pr = i / (frames - 1);
    fs.writeFileSync(path.join(dir, `f${String(i).padStart(4, "0")}.png`), await png(symbolZoomFrame(pr, w, hh, zo), w, hh, undefined));
    if (i < maskFrames) {
      fs.writeFileSync(path.join(dir, `m${String(i).padStart(4, "0")}.png`), await png(symbolMaskFrame(pr, w, hh, zo), w, hh, undefined));
    }
  }
  return { pattern, frames, maskPattern, maskFrames };
}

/**
 * VIDEÓ-EFFEKT KLIPEK (előkészítve: scripts/video-fx-prepare.mjs).
 * Méretenként kivágott, 25 kép/mp-es klip HANGGAL. „Screen" keveréssel kerül a
 * videóra: a fekete része láthatatlan, a világos része „beég" a képbe.
 * `cut`: a klip legvilágosabb pillanata (mp) — ide esik a jelenetváltás, így a
 * vágás a fehér villanásban láthatatlan.
 */
const FX_CLIPS: Record<string, { cut: number; duration: number }> = {
  filmburn6: { cut: 0.52, duration: 1.168 },
};
function fxClipFile(fx: string, aspect: AspectId): string {
  return path.join(process.cwd(), "assets", "video-fx", `${fx}-${aspect.replace(":", "x")}.mp4`);
}

// ---------------------------------------------------------------------------
// 3) Kameramozgás
// ---------------------------------------------------------------------------

/**
 * A háttérfotó szűrőlánca egy jelenethez → [W×H] kimenet.
 *
 * NAGYÍTÁS NINCS (tudatos döntés, 2026-10): a ráközelítés a fotóból részleteket
 * vág le (pl. „csak az ágy sarka látszik"). Helyette:
 *  • a fotó a vászonra illesztve, a teljes rövidebb oldalával látszik;
 *  • ami túllóg (fekvő fotónál a szélesség, álló fotónál a magasság), azt a
 *    jelenet alatt lassan, lágy indulással-megállással végigpásztázzuk —
 *    így a helyiség egésze bemutatásra kerül;
 *  • ha alig lóg túl (≤ 2%), a kép áll.
 * Irány: a sablon mozgása szerint (slideRight/zoomOut/slideDown = visszafelé).
 */
/**
 * A háttérfotó szűrőlánca egy jelenethez → [W×H] kimenet.
 *
 * A MOZGÁS A FOTÓ FAJTÁJÁTÓL FÜGG (a rendszer magától felismeri):
 *  • SZÉLES fotó (pl. fekvő fotó álló videóban): PÁSZTÁZÁS — magasságra illesztve
 *    a kép teljes szélességét végigjárjuk, így a lakásból a lehető legtöbb látszik.
 *    Nagyítás nincs.
 *  • MAGAS fotó (magasabb a vászonnál): függőleges pásztázás, nagyítás nélkül.
 *  • A VÁSZONNAL EGYEZŐ arányú fotó (pl. 9:16-os fotó 9:16-os videóban):
 *    lassú KI- ÉS BEZOOMOLÁS — itt nincs mit pásztázni, a finom zoom adja az életet.
 * Az irány jelenetenként váltakozik (balra/jobbra, be/ki), így két egymás utáni fotó
 * soha nem mozog egyformán. A telefonos fotók EXIF-forgatását is kezeljük.
 */
function backgroundChain(
  input: number, file: string, m: Motion | undefined, frames: number, W: number, H: number, fps: number,
  sceneIndex = 0,
): string {
  void m; // a sablon mozgás-típusa itt csak jelzés — a fotó fajtája dönt
  const info = imageInfo(file);
  const kind = classifyPhoto(info, W, H);
  const rot = orientFilter(info?.orientation ?? 1);
  const n = `(n/${Math.max(1, frames - 1)})`;
  const ease = `(${n}*${n}*(3-2*${n}))`;
  const reverse = sceneIndex % 2 === 1;
  const along = (span: string) => (reverse ? `${span}*(1-${ease})` : `${span}*${ease}`);
  const tail = `,setsar=1,fps=${fps},trim=end_frame=${frames},setpts=PTS-STARTPTS`;
  // 2× felbontáson dolgozunk, hogy a mozgás fél pixeles lépései is simák legyenek.
  const W2 = W * 2, H2 = H * 2;

  if (kind === "wide") {
    return `[${input}:v]${rot}scale=-2:${H2},crop=${W2}:${H2}:x='${along("(iw-ow)")}':y=0,scale=${W}:${H}${tail}`;
  }
  if (kind === "tall") {
    return `[${input}:v]${rot}scale=${W2}:-2,crop=${W2}:${H2}:x=0:y='${along("(ih-oh)")}',scale=${W}:${H}${tail}`;
  }
  // Egyező arány: lassú be- (páros jelenet) vagy kizoomolás (páratlan), középre.
  //
  // REMEGÉSMENTES ZOOM: a zoompan a kivágás helyét és méretét EGÉSZ pixelre
  // kerekíti — kis felbontáson ez képkockáról képkockára 1 px-es „rángatás".
  // Ezért a fotót EGYSZER 4× felbontásra nagyítjuk (a bemenet itt NEM ismétlődő
  // kép, hanem egyetlen képkocka — lásd `photoLoops`), és a zoompan ebből gyárt
  // `frames` darab kimeneti képkockát (d=frames). Így a kerekítés a kimeneten
  // ¼ pixel alá esik, a mozgás sima.
  const W4 = W * 4, H4 = H * 4;
  const p = `(on/${Math.max(1, frames - 1)})`;
  const e = `(${p}*${p}*(3-2*${p}))`;
  const z = reverse ? `${1 + ZOOM_AMOUNT}-${ZOOM_AMOUNT}*${e}` : `1+${ZOOM_AMOUNT}*${e}`;
  return `[${input}:v]${rot}scale=${W4}:${H4}:force_original_aspect_ratio=increase:flags=lanczos,crop=${W4}:${H4},setsar=1,` +
    `zoompan=z='${z}':x='(iw-iw/zoom)/2':y='(ih-ih/zoom)/2':d=${frames}:s=${W}x${H}:fps=${fps},` +
    `setsar=1,trim=end_frame=${frames},setpts=PTS-STARTPTS`;
}

/** Kell-e a fotót ismétlődő képként (-loop 1) beadni? A zoomos (egyező arányú)
 *  fotó egyetlen képkocka — abból a zoompan maga gyártja a jelenet összes kockáját. */
function photoLoops(file: string, W: number, H: number): boolean {
  return classifyPhoto(imageInfo(file), W, H) !== "matching";
}

/** Be-/kizoomolás mértéke az egyező arányú fotóknál (0.12 = 12%). */
const ZOOM_AMOUNT = 0.12;

// ---------------------------------------------------------------------------
// Rétegek animációja (ffmpeg overlay-kifejezések)
// ---------------------------------------------------------------------------

/** Az overlay x/y kifejezése és az átlátszóság-áttűnés egy megjelenés-animációhoz. */
function appearExpr(a: Appear | undefined, start: number, W: number, H: number) {
  const st = start + (a?.delay ?? 0);
  const d = Math.max(0.01, a?.duration ?? 0.6);
  // easeOut (köbös): gyors indulás, lágy megérkezés.
  const k = `(1-pow(1-min(1,max(0,(t-${st.toFixed(3)})/${d})),3))`;
  switch (a?.type) {
    case "slideRight": return { x: `-${W}*(1-${k})`, y: "0", fade: null };
    case "slideLeft": return { x: `${W}*(1-${k})`, y: "0", fade: null };
    case "slideUp": return { x: "0", y: `${Math.round(H * 0.06)}*(1-${k})`, fade: { st, d } };
    case "slideDown": return { x: "0", y: `-${Math.round(H * 0.06)}*(1-${k})`, fade: { st, d } };
    case "fade": case "pop": return { x: "0", y: "0", fade: { st, d } };
    // Lebegés: lassú, végtelen fel-le ringás (a periódus a `duration`), lágy beúszással.
    case "float": {
      const amp = Math.round(H * (a.amount ?? 0.006));
      const period = Math.max(1, a.duration ?? 6);
      return { x: "0", y: `${amp}*sin(2*PI*(t-${st.toFixed(3)})/${period})`, fade: { st, d: 0.8 } };
    }
    default: return { x: "0", y: "0", fade: null };
  }
}

// ---------------------------------------------------------------------------
// Fő menet
// ---------------------------------------------------------------------------
export async function renderVideo(input: RenderInput): Promise<RenderResult> {
  const t0 = Date.now();
  const timings: Record<string, number> = {};
  const log = input.log ?? (() => {});
  const { template: tpl, aspect } = input;
  const { width: W, height: H } = ASPECT_SIZES[aspect];
  const fps = tpl.fps;
  fs.mkdirSync(input.workDir, { recursive: true });
  const out = path.join(input.workDir, input.outName ?? `twinx-${tpl.id}-${aspect.replace(":", "x")}.mp4`);
  const layerDir = path.join(input.workDir, `layers-${Date.now()}`);
  fs.mkdirSync(layerDir, { recursive: true });

  const starts = sceneStarts(tpl);
  const total = totalDuration(tpl);
  const family = tpl.fonts[0]?.family ?? "sans-serif";

  // --- 1) Áttűnések ---
  type Placed = { pattern: string; start: number };
  const placed: Placed[] = [];
  // „Átlépés a következő szobába": a vágás ELŐTT a következő jelenet első képkockája
  // látszik a szimbólum belsejében (maszkon át).
  type Reveal = { scene: number; maskPattern: string; maskFrames: number; start: number };
  const reveals: Reveal[] = [];
  // Filmes effekt-klipek (Screen-keverés + hang), a jelenetváltás köré igazítva.
  type FxPlaced = { file: string; start: number; volume: number };
  const fxPlaced: FxPlaced[] = [];
  for (let i = 1; i < tpl.scenes.length; i++) {
    const tr = tpl.scenes[i].transitionIn;
    if (tr?.type === "filmBurn") {
      const id = tr.fx ?? "filmburn6";
      const meta = FX_CLIPS[id];
      const file = fxClipFile(id, aspect);
      if (meta && fs.existsSync(file)) {
        fxPlaced.push({ file, start: Math.max(0, starts[i] - meta.cut), volume: tr.fxVolume ?? 0.5 });
      } else {
        log(`⚠ hiányzó effekt-klip: ${file} — sima vágás lesz helyette`);
      }
      continue;
    }
    if (tr?.type === "symbolZoom") {
      const seq = await symbolFrames({
        symbol: tr.symbol ?? "house",
        origin: tr.origin ?? { x: 0.47, y: 0.05, size: 0.06 },
        dir: path.join(input.workDir, "transitions"), W, H, fps, duration: tr.duration,
        stroke: resolveColor(tr.colors?.glow ?? "@accent", tpl.palette),
      });
      const start = starts[i] - SYMBOL_CUT * tr.duration;
      placed.push({ pattern: seq.pattern, start });
      reveals.push({ scene: i, maskPattern: seq.maskPattern, maskFrames: seq.maskFrames, start });
      continue;
    }
    if (!tr || (tr.type !== "chevronWipe" && tr.type !== "panelReveal" && tr.type !== "softDip")) continue; // fade/cut: nincs grafika
    const fill = resolveColor(tr.colors?.fill ?? "@shadow", tpl.palette);
    // Felnyíló paneleknél a második szín a világosabb sáv (shadow-szerep = @base).
    const glow = resolveColor((tr.type === "panelReveal" ? tr.colors?.shadow : tr.colors?.glow) ?? "@glow", tpl.palette);
    const direction = tr.direction ?? "right";
    const seq = await transitionFrames({ kind: tr.type, direction, dir: path.join(input.workDir, "transitions"), W, H, fps, duration: tr.duration, fill, glow });
    // A takarás pillanata a haladási hosszon múlik (függőleges iránynál a magasság).
    const along = direction === "up" || direction === "down" ? H / 2 : W / 2;
    const cut = tr.type === "panelReveal" ? PANEL_CUT : tr.type === "softDip" ? DIP_CUT : chevronCutProgress(along);
    placed.push({ pattern: seq.pattern, start: starts[i] - cut * tr.duration });
  }
  timings.transitions = (Date.now() - t0) / 1000;
  log(`áttűnések: ${placed.length} db — ${timings.transitions.toFixed(1)} mp`);

  // --- 2) Rétegek: jelenetenként, megjelenés szerint csoportosítva ---
  type Overlay = { file: string; start: number; end: number; appear?: Appear };
  const overlays: Overlay[] = [];
  const t1 = Date.now();
  for (let i = 0; i < tpl.scenes.length; i++) {
    const sc = tpl.scenes[i];
    const groups = new Map<string, Layer[]>();
    for (const l of sc.layers) {
      const key = JSON.stringify(l.appear ?? null);
      groups.set(key, [...(groups.get(key) ?? []), l]);
    }
    let g = 0;
    for (const [key, layers] of groups) {
      const el = layersFrame(layers, { W, H, aspect, palette: tpl.palette, data: input.data ?? {} }, family);
      if (!el) continue;
      const file = path.join(layerDir, `s${i}-g${g++}.png`);
      fs.writeFileSync(file, await png(el, W, H, input.fonts));
      overlays.push({ file, start: starts[i], end: starts[i] + sc.length, appear: JSON.parse(key) ?? undefined });
    }
  }
  timings.layers = (Date.now() - t1) / 1000;
  log(`rétegek: ${overlays.length} kép — ${timings.layers.toFixed(1)} mp`);

  // --- 3–4) ffmpeg: jelenetek + összefűzés + rétegek + áttűnések ---
  const args: string[] = ["-y", "-v", "error"];
  const filters: string[] = [];
  const sceneLabels: string[] = [];
  let inputIdx = 0;

  tpl.scenes.forEach((sc, i) => {
    const frames = Math.round(sc.length * fps);
    const bg = sc.background;
    const idx = inputIdx++;
    if (bg.type === "photo") {
      const n = Number(bg.bind.split(".")[1]);
      const file = input.photos[n - 1] ?? input.photos[0];
      if (photoLoops(file, W, H)) args.push("-loop", "1", "-framerate", String(fps), "-t", String(sc.length + 1), "-i", file);
      else args.push("-i", file);
      filters.push(
        backgroundChain(idx, file, bg.motion, frames, W, H, fps, i) + ",format=yuv420p" +
        (i === 0 && sc.transitionIn?.type === "fade" ? `,fade=t=in:st=0:d=${sc.transitionIn.duration}` : "") +
        `[s${i}]`,
      );
    } else {
      const color = bg.type === "color" ? resolveColor(bg.color, tpl.palette) : tpl.palette.base;
      args.push("-f", "lavfi", "-t", String(sc.length), "-i", `color=c=${color}:s=${W}x${H}:r=${fps}`);
      filters.push(`[${idx}:v]format=yuv420p,setsar=1[s${i}]`);
    }
    // A „belátáshoz" a jelenet képét kettéágaztatjuk: egyik a sorba, másik a maszkhoz.
    if (reveals.some((r) => r.scene === i)) {
      const lastF = filters.length - 1;
      filters[lastF] = filters[lastF].slice(0, -`[s${i}]`.length) + `[s${i}pre]`;
      filters.push(`[s${i}pre]split=2[s${i}][rv${i}]`);
    }
    sceneLabels.push(`[s${i}]`);
  });
  filters.push(`${sceneLabels.join("")}concat=n=${sceneLabels.length}:v=1:a=0[base]`);

  let last = "base";
  overlays.forEach((ov, k) => {
    const idx = inputIdx++;
    const len = ov.end - ov.start;
    args.push("-loop", "1", "-framerate", String(fps), "-t", String(len), "-i", ov.file);
    const a = appearExpr(ov.appear, ov.start, W, H);
    const fade = a.fade ? `,fade=t=in:st=${a.fade.st.toFixed(3)}:d=${a.fade.d}:alpha=1` : "";
    filters.push(
      `[${idx}:v]format=rgba,setpts=PTS-STARTPTS+${ov.start.toFixed(3)}/TB${fade}[l${k}]`,
      `[${last}][l${k}]overlay=x='${a.x}':y='${a.y}':eof_action=pass:enable='between(t,${ov.start.toFixed(3)},${ov.end.toFixed(3)})'[o${k}]`,
    );
    last = `o${k}`;
  });

  // „Belátás a következő szobába": a következő jelenet ELSŐ képkockája (kimerevítve)
  // a szimbólum-maszkon át, a vágás előtti szakaszban. A rétegek (feliratok) FÖLÉ
  // kerül, hogy a szimbólum belsejében már csak az új szoba látsszon.
  reveals.forEach((r, k) => {
    const idx = inputIdx++;
    const n = r.maskFrames;
    args.push("-framerate", String(fps), "-i", r.maskPattern);
    const st = r.start.toFixed(3);
    filters.push(
      `[rv${r.scene}]trim=end_frame=1,loop=loop=${n - 1}:size=1:start=0,setpts=N/${fps}/TB+${st}/TB,format=yuva420p[rvb${k}]`,
      `[${idx}:v]scale=${W}:${H},format=gray,setpts=N/${fps}/TB+${st}/TB[rvm${k}]`,
      `[rvb${k}][rvm${k}]alphamerge[rva${k}]`,
      `[${last}][rva${k}]overlay=eof_action=pass[r${k}]`,
    );
    last = `r${k}`;
  });

  placed.forEach((tr, k) => {
    const idx = inputIdx++;
    args.push("-framerate", String(fps), "-i", tr.pattern);
    filters.push(
      `[${idx}:v]format=rgba,scale=${W}:${H},setpts=PTS-STARTPTS+${tr.start.toFixed(3)}/TB[t${k}]`,
      `[${last}][t${k}]overlay=eof_action=pass[v${k}]`,
    );
    last = `v${k}`;
  });

  // --- Filmes effekt-klipek: „Screen" keverés a kész kép FÖLÉ (minden réteg fölött) ---
  // Egy fekete „effekt-sávra" rakjuk a klipeket a helyükre, és a sávot egyszerre
  // keverjük rá a videóra. Screen: fekete = nincs hatás, fehér = teljes beégés.
  const fxAudio: string[] = [];
  if (fxPlaced.length) {
    filters.push(`color=c=black:s=${W}x${H}:r=${fps}:d=${total}[fxt0]`);
    fxPlaced.forEach((f, k) => {
      const idx = inputIdx++;
      args.push("-i", f.file);
      filters.push(
        `[${idx}:v]setpts=PTS-STARTPTS+${f.start.toFixed(3)}/TB[fxv${k}]`,
        `[fxt${k}][fxv${k}]overlay=eof_action=pass[fxt${k + 1}]`,
        // A klip hangja a megadott hangerővel (alap: fele), pontosan a képhez időzítve.
        `[${idx}:a]volume=${f.volume},adelay=${Math.round(f.start * 1000)}:all=1[fxa${k}]`,
      );
      fxAudio.push(`[fxa${k}]`);
    });
    const on = fxPlaced.map((f) => `between(t,${f.start.toFixed(3)},${(f.start + 1.3).toFixed(3)})`).join("+");
    filters.push(
      `[${last}]format=gbrp[fxbg]`,
      `[fxt${fxPlaced.length}]format=gbrp[fxfg]`,
      `[fxbg][fxfg]blend=all_mode=screen:shortest=1:enable='${on}',format=yuv420p[fxout]`,
    );
    last = "fxout";
  }

  // --- Hang: zene (a videó hosszára vágva, úsztatással) + az effekt-klipek hangja ---
  const audioMap: string[] = [];
  const hasMusic = Boolean(input.music && fs.existsSync(input.music));
  if (hasMusic) {
    const idx = inputIdx++;
    args.push("-stream_loop", "-1", "-i", input.music as string); // rövid zene esetén ismétlődik
    const a = tpl.audio;
    const fades = [
      a.fadeIn > 0 ? `afade=t=in:st=0:d=${a.fadeIn}` : "",
      a.fadeOut > 0 ? `afade=t=out:st=${Math.max(0, total - a.fadeOut).toFixed(2)}:d=${a.fadeOut}` : "",
    ].filter(Boolean).join(",");
    filters.push(`[${idx}:a]atrim=0:${total},asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo,volume=${a.volume}${fades ? "," + fades : ""}[amusic]`);
  }
  if (hasMusic || fxAudio.length) {
    if (!fxAudio.length) {
      filters.push(`[amusic]anull[aout]`);
    } else {
      // A zene (vagy csend) adja a teljes hosszt; az effektek hangja ráül, NEM nyomja el.
      if (!hasMusic) filters.push(`anullsrc=r=48000:cl=stereo,atrim=0:${total}[amusic]`);
      filters.push(`[amusic]${fxAudio.join("")}amix=inputs=${fxAudio.length + 1}:normalize=0:duration=first[aout]`);
    }
    audioMap.push("-map", "[aout]", "-c:a", "aac", "-b:a", "192k");
  }

  args.push(
    "-filter_complex", filters.join(";"),
    "-map", `[${last}]`,
    ...audioMap,
    "-t", String(total), "-r", String(fps),
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
    "-movflags", "+faststart", out,
  );

  const t2 = Date.now();
  await run(input.ffmpegPath, args);
  timings.encode = (Date.now() - t2) / 1000;
  timings.total = (Date.now() - t0) / 1000;
  fs.rmSync(layerDir, { recursive: true, force: true });
  log(`videó kész — ${timings.total.toFixed(1)} mp`);
  return { file: out, seconds: total, timings };
}
