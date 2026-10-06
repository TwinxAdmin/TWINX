// TWINX VIDEÓSABLON-FORMÁTUM (1. fázis) — a saját videómotor „nyelve".
//
// CÉL: egy új sablon vagy színváltozat elkészítése ADAT legyen, ne programozás.
// Egy sablon egyetlen, áttekinthető leírás: jelenetek egymás után, bennük rétegek
// (fotó, szöveg, kép, forma), a jelenetek között áttűnések — minden szín a
// sablon PALETTÁJÁBÓL jön, ezért egy új színváltozat csak egy új paletta.
//
// ALAPELVEK
//  • Idő: másodperc. A jelenetek egymás után következnek (`length`); az áttűnés
//    a két jelenet HATÁRÁRA ül, mindkét oldalra átnyúlva (`duration` fele-fele).
//  • Hely: a vászonhoz mért arány (0–1), így ugyanaz a sablon 9:16-ban és 1:1-ben
//    is működik. Ahol a két méret mást kíván, `byAspect` felülírást adunk meg.
//  • Betűméret: a vászon RÖVIDEBB oldalához mért arány (0.06 = a szélesség 6%-a
//    állóképnél) — így a szöveg mindkét méretben arányos marad.
//  • Szín: palettahivatkozás ("@accent") vagy fix hex ("#ffffff").
//  • Adat: `bind` kulcs (pl. "property.price") — a motor tölti ki a partner adataiból.
//    Üres adatnál a réteg kimarad (nincs „undefined" vagy üres keret a videóban).
//  • Áttűnés és mozgás KÓDBÓL rajzolódik (nincs külső videófájl) → szabadon színezhető.
//
// Ez a fájl CSAK leírás és ellenőrzés: a rajzoló motor a 2. fázisban épül rá.

// =========================================================================
// Alaptípusok
// =========================================================================

export type AspectId = "9:16" | "1:1";
export const ASPECT_SIZES: Record<AspectId, { width: number; height: number }> = {
  "9:16": { width: 1080, height: 1920 },
  "1:1": { width: 1080, height: 1080 },
};

/** Paletta-szerepek — minden sablon ezekkel a nevekkel hivatkozik a színekre. */
export type PaletteRole =
  | "shadow"   // legmélyebb tónus (zárókártya alja, árnyékok)
  | "base"     // alapszín: áttűnések, panelek
  | "glow"     // meleg fény / izzás az áttűnésekben
  | "accent"   // kiemelés: ár, cím, ügynök neve, feliratsáv csíkja
  | "text"     // fő szövegszín
  | "muted";   // másodlagos szöveg

export type Palette = Record<PaletteRole, string>; // mind "#rrggbb"

/** "@accent" = palettaszín; "#ffffff" = fix szín. */
export type ColorRef = `@${PaletteRole}` | `#${string}`;

/** Lassulási görbék — a mozgások és áttűnések „karaktere". */
export type Easing = "linear" | "easeIn" | "easeOut" | "easeInOut" | { bezier: [number, number, number, number] };

/** Doboz a vásznon, arányokban: x,y = bal felső sarok; w,h = méret (0–1). */
export type Box = { x: number; y: number; w: number; h: number };

/** Méretfüggő felülírás: ami 1:1-ben máshol/más méretben van. */
export type ByAspect<T> = { byAspect?: Partial<Record<AspectId, Partial<T>>> };

// =========================================================================
// Adatkötés — a partner adatai, egységes kulcsokkal
// =========================================================================

export const BIND_KEYS = [
  "property.title",     // cím, pl. „Budapest XIII. kerület, Pozsonyi út"
  "property.city",      // település / kerület
  "property.type",      // ingatlan típusa
  "property.price",     // irányár, formázva
  "property.specs",     // pl. „74 m² · 3 szoba"
  "agent.name",
  "agent.phone",
  "agent.email",
  "agent.photo",        // kép-URL
  "agent.logo",         // kép-URL
] as const;
export type BindKey = (typeof BIND_KEYS)[number] | `photo.${number}` | `caption.${number}`;

// =========================================================================
// Mozgás (a háttérfotó „kameramozgása")
// =========================================================================

export type Motion = {
  type: "none" | "zoomIn" | "zoomOut" | "slideLeft" | "slideRight" | "slideUp" | "slideDown";
  /** Mozgás mértéke: zoomnál a nagyítás (0.1 = +10%), csúszásnál a vászon aránya. */
  amount?: number;
  easing?: Easing;
};

// =========================================================================
// Áttűnések — saját, kódból rajzolt könyvtár
// =========================================================================

export type TransitionType =
  | "cut"           // vágás, nincs áttűnés
  | "fade"          // áttűnés (keresztúsztatás)
  | "chevronWipe"   // nyíl alakú törlőelem izzással (az Aurora jellegzetes áttűnése)
  | "panelReveal"   // átlós panelek nyílnak fel (az Aurora zárókártyája)
  | "softDip"       // lágy átúsztatás egy világos színen át (a Skandi áttűnése)
  | "symbolZoom"    // ingatlanos szimbólum a kamera felé repül, belsejében a következő fotó
  | "filmBurn"      // valódi filmes „beégés" klip Screen-keveréssel + hanggal (a Prestige áttűnése)
  | "swap";         // GALÉRIA-CSERE (Mozaik): a következő fotó a kis helyéről nagyra nő, az addigi
                    // nagy kép a megüresedett kis helyre zsugorodik. A jelenet ELEJÉN fut (nem a határon).

export type Transition = {
  type: TransitionType;
  /** Teljes hossz mp-ben; a jelenethatár KÖZEPÉN ül (fele előtte, fele utána). */
  duration: number;
  direction?: "left" | "right" | "up" | "down";
  easing?: Easing;
  /** Színek a palettából — alapból @base + @glow. */
  colors?: { fill?: ColorRef; glow?: ColorRef; shadow?: ColorRef };
  /** symbolZoom: melyik szimbólum repül (house | key | pin | building | sold). */
  symbol?: "house" | "key" | "pin" | "building" | "sold";
  /** symbolZoom: a szimbólum helye (rácsdoboz bal felső sarka + mérete) a vászon SZÉLESSÉGÉNEK arányában. */
  origin?: { x: number; y: number; size: number };
  /** filmBurn: melyik effekt-klip (assets/video-fx/<fx>-<méret>.mp4), és a hangja mekkora hangerővel szóljon (0–1). */
  fx?: "filmburn6";
  fxVolume?: number;
};

// =========================================================================
// Rétegek
// =========================================================================

/** Megjelenés-animáció egy rétegre (a jeleneten belüli időben). */
export type Appear = {
  /** pop: ELŐUGRÁS — kicsiből rugalmasan (kis túllendüléssel) nő fel a végleges méretre. */
  type: "none" | "fade" | "slideUp" | "slideDown" | "slideLeft" | "slideRight" | "pop" | "float";
  /** float: a lebegés kitérése (a vászon magasságának arányában); a periódus a `duration`. */
  amount?: number;
  /** Késleltetés a jelenet elejétől, mp. */
  delay?: number;
  duration?: number;
  easing?: Easing;
};

type LayerBase = {
  id: string;
  box: Box;
  appear?: Appear;
  /** Eltűnés a jelenet vége előtt (mp a végétől); alapból a jelenettel együtt tűnik el. */
  hideBeforeEnd?: number;
  opacity?: number;
};

type TextProps = {
  /** Adat a partnertől VAGY fix szöveg. Ha mindkettő van, a `bind` nyer (a `text` a tartalék). */
  bind?: BindKey;
  text?: string;
  font: { family: string; weight: number; size: number /* a rövidebb oldal arányában */ };
  color: ColorRef;
  align?: "left" | "center" | "right";
  valign?: "top" | "middle" | "bottom";
  lineHeight?: number;
  letterSpacing?: number;
  uppercase?: boolean;
  /** Legfeljebb ennyi sor; ha nem fér el, a motor csökkenti a betűméretet (nem vág le). */
  maxLines?: number;
};
export type TextLayer = LayerBase & TextProps & ByAspect<TextProps & { box: Box }> & { kind: "text" };

type ImageProps = {
  bind: BindKey;               // pl. "agent.photo", "agent.logo"
  fit?: "cover" | "contain";
  /** "diamond": 45°-ban elforgatott négyzet (rombusz) — a doboz oldalfelezőin a csúcsok. */
  mask?: "none" | "circle" | "rounded" | "diamond";
  border?: { width: number; color: ColorRef };
  /** Halk árnyék a kép alatt (a Mozaik kis képei). */
  shadow?: boolean;
  /**
   * LASSÚ NAGYÍTÁS a dobozon belül (csak fotónál; a motor ffmpeg-gel rajzolja, simán).
   * A nagyítás a réteg megjelenésétől (appear.delay) a jelenet végéig tart, egyenletesen.
   */
  motion?: { type: "zoomIn"; amount: number };
  /** Belső használat (csere-áttűnés képkockái): a fotó nagyítása a keretén belül. */
  zoom?: number;
};
export type ImageLayer = LayerBase & ImageProps & ByAspect<ImageProps & { box: Box }> & { kind: "image" };

type ShapeProps = {
  shape: "rect" | "roundedRect" | "circle" | "polygon";
  /** polygon csúcsai a dobozon belüli arányban (0–1). */
  points?: Array<[number, number]>;
  fill: ColorRef | { gradient: "linear" | "radial"; stops: Array<[number, ColorRef, number?]>; angle?: number };
  radius?: number;
  /** ferdítés fokban (pl. a nyitókép ferde panelje) */
  skewX?: number;
};
export type ShapeLayer = LayerBase & ShapeProps & ByAspect<ShapeProps & { box: Box }> & { kind: "shape" };

/**
 * Kész, újrahasználható elem (a motor rajzolja, a sablon csak paraméterezi):
 *  • "captionBar"  — a fotónkénti alsó feliratsáv (két sor, kiemelő csík)
 *  • "captionCard" — kártyás fotófelirat világos alapon (a Skandi felirata)
 *  • "priceSeal"   — ár-pecsét a nyitóképen
 */
export type ComponentLayer = LayerBase & {
  kind: "component";
  component: "captionBar" | "captionCard" | "priceSeal" | "marble" | "paperNote";
  bind?: BindKey;
  props?: Record<string, string | number | boolean>;
} & ByAspect<{ box: Box; props: Record<string, string | number | boolean> }>;

/**
 * HALMOZOTT BLOKK: egymás alatti elemek automatikus térközzel (mint egy névjegy).
 * Ha egy elem adata hiányzik, KIMARAD, és a többi összezár — nem marad lyuk.
 * Ez kell az olyan blokkokhoz, mint a nyitókép adatpanelje.
 */
export type StackItem =
  | ({ type: "text"; gapBefore?: number } & TextProps)
  | { type: "rule"; width: number; height: number; color: ColorRef; gapBefore?: number }
  | { type: "spacer"; height: number };
type StackProps = {
  items: StackItem[];
  align?: "left" | "center" | "right";
  valign?: "top" | "middle" | "bottom";
  /** Belső margó a dobozon belül (a rövidebb oldal arányában). */
  padding?: { top?: number; right?: number; bottom?: number; left?: number };
};
export type StackLayer = LayerBase & StackProps & ByAspect<StackProps & { box: Box }> & { kind: "stack" };

/**
 * INGATLANOS SZIMBÓLUM (vonalas ikon a landingről): ház, kulcs, térképjel, épület, tábla.
 * A doboz szélessége adja a méretét (négyzetes rajz, a doboz bal felső sarkához igazítva).
 */
type SymbolProps = {
  symbol: "house" | "key" | "pin" | "building" | "sold";
  stroke: ColorRef;
  /** Belső kitöltés; alapból nincs (csak vonal). */
  fill?: ColorRef;
};
export type SymbolLayer = LayerBase & SymbolProps & ByAspect<SymbolProps & { box: Box }> & { kind: "symbol" };

export type Layer = TextLayer | ImageLayer | ShapeLayer | ComponentLayer | StackLayer | SymbolLayer;

// =========================================================================
// Jelenetek
// =========================================================================

export type Background =
  | { type: "photo"; bind: `photo.${number}`; motion?: Motion }
  | { type: "color"; color: ColorRef }
  | { type: "gradient"; stops: Array<[number, ColorRef]>; angle?: number };

export type Scene = {
  id: string;
  /** Mire való a jelenet — a varázsló és az ellenőrző használja. */
  role: "intro" | "photo" | "closing";
  length: number;
  background: Background;
  layers: Layer[];
  /** Áttűnés a jelenet ELEJÉN (az előzőből ebbe). Az első jelenetnél ez a nyitás. */
  transitionIn?: Transition;
};

// =========================================================================
// Sablon + színváltozat
// =========================================================================

export type FontAsset = { family: string; weight: number; file: string /* assets/fonts/… */ };

export type TwinxTemplate = {
  /** Gépi azonosító, pl. "aurora". Kiadás után NE nevezd át (videók hivatkoznak rá). */
  id: string;
  name: string;
  /** Fejlesztés alatt: csak localhoston választható (élesben rejtve). */
  devOnly?: boolean;
  version: number;
  fps: 25 | 30;
  aspects: AspectId[];
  fonts: FontAsset[];
  /** Alap paletta; a színváltozatok ezt írják felül. */
  palette: Palette;
  /** Hány fotó kell (a varázsló ezt kéri be). */
  photos: { min: number; max: number };
  /** Fotónkénti felirat max. hossza ennél a sablonnál (alap: a régi 30 karakter).
   *  Akkora, hogy a leghosszabb megengedett szöveg pont kitöltse a feliratdobozt. */
  captionMaxChars?: number;
  /**
   * A fotók számához igazított változat (pl. a Mozaik 4 fotónál 3, 5 fotónál 4 kis képet
   * mutat). A motor a tényleges fotószámmal hívja; a paletta a hívó oldalon marad.
   */
  forPhotoCount?: (n: number) => TwinxTemplate;
  scenes: Scene[];
  audio: { volume: number; fadeIn: number; fadeOut: number };
};

/** Színváltozat: UGYANAZ a sablon, más palettával (pl. Aurora → Nocturne). */
export type TemplateVariant = {
  id: string;            // pl. "nocturne"
  templateId: string;    // pl. "aurora"
  name: string;          // a választóban: „TWINX Nocturne"
  palette: Partial<Palette>;
};

// =========================================================================
// Segédek + ellenőrzés
// =========================================================================

export function totalDuration(t: TwinxTemplate): number {
  return t.scenes.reduce((s, sc) => s + sc.length, 0);
}

/** A jelenetek kezdőideje (mp). */
export function sceneStarts(t: TwinxTemplate): number[] {
  const out: number[] = [];
  let acc = 0;
  for (const sc of t.scenes) { out.push(acc); acc += sc.length; }
  return out;
}

export function resolveColor(ref: ColorRef, palette: Palette): string {
  return ref.startsWith("@") ? palette[ref.slice(1) as PaletteRole] : ref;
}

export function applyVariant(t: TwinxTemplate, v: TemplateVariant | null): TwinxTemplate {
  if (!v) return t;
  if (v.templateId !== t.id) throw new Error(`A(z) ${v.id} változat nem ehhez a sablonhoz tartozik.`);
  return { ...t, palette: { ...t.palette, ...v.palette } };
}

const HEX = /^#[0-9a-fA-F]{6}$/;
const ROLES: PaletteRole[] = ["shadow", "base", "glow", "accent", "text", "muted"];

/**
 * A sablon ellenőrzése MIELŐTT a motor rajzolni kezdene. Üres tömb = rendben.
 * A hibák magyarul, sablonszerkesztőnek szólnak.
 */
export function validateTemplate(t: TwinxTemplate): string[] {
  const err: string[] = [];
  const where = (sc: Scene, l?: Layer) => `[${sc.id}${l ? ` › ${l.id}` : ""}]`;

  if (!/^[a-z0-9-]+$/.test(t.id)) err.push("A sablon azonosítója csak kisbetű, szám és kötőjel lehet.");
  if (!t.scenes.length) err.push("A sablonnak legalább egy jelenete kell.");
  for (const r of ROLES) if (!HEX.test(t.palette[r] ?? "")) err.push(`Hiányzó vagy hibás palettaszín: ${r}.`);

  const checkColor = (c: ColorRef, ctx: string) => {
    if (c.startsWith("@") ? !ROLES.includes(c.slice(1) as PaletteRole) : !HEX.test(c)) {
      err.push(`${ctx} Ismeretlen szín: ${c}`);
    }
  };
  const checkBox = (b: Box, ctx: string) => {
    const ok = [b.x, b.y, b.w, b.h].every((n) => Number.isFinite(n)) && b.w > 0 && b.h > 0 &&
      b.x >= -0.5 && b.y >= -0.5 && b.x + b.w <= 1.5 && b.y + b.h <= 1.5;
    if (!ok) err.push(`${ctx} A doboz a vásznon kívül esik vagy hibás.`);
  };

  const usedPhotos = new Set<number>();
  const ids = new Set<string>();
  t.scenes.forEach((sc, i) => {
    if (ids.has(sc.id)) err.push(`Ismétlődő jelenet-azonosító: ${sc.id}`);
    ids.add(sc.id);
    if (!(sc.length > 0)) err.push(`${where(sc)} A jelenet hossza legyen pozitív.`);

    if (sc.background.type === "photo") {
      const n = Number(sc.background.bind.split(".")[1]);
      if (!Number.isInteger(n) || n < 1) err.push(`${where(sc)} Hibás fotóhivatkozás: ${sc.background.bind}`);
      else usedPhotos.add(n);
    } else if (sc.background.type === "color") {
      checkColor(sc.background.color, where(sc));
    }

    const tr = sc.transitionIn;
    if (tr) {
      if (!(tr.duration >= 0)) err.push(`${where(sc)} Az áttűnés hossza nem lehet negatív.`);
      const prev = t.scenes[i - 1];
      // Az áttűnés fele-fele nyúlik át: egyik jelenetnél sem lehet hosszabb a felénél.
      if (prev && tr.duration / 2 > Math.min(prev.length, sc.length) / 2) {
        err.push(`${where(sc)} Az áttűnés túl hosszú a szomszédos jelenetekhez képest.`);
      }
      Object.values(tr.colors ?? {}).forEach((c) => c && checkColor(c, where(sc)));
    }

    const layerIds = new Set<string>();
    for (const l of sc.layers) {
      if (layerIds.has(l.id)) err.push(`${where(sc, l)} Ismétlődő réteg-azonosító.`);
      layerIds.add(l.id);
      checkBox(l.box, where(sc, l));
      if (l.appear && (l.appear.delay ?? 0) >= sc.length) {
        err.push(`${where(sc, l)} A réteg a jelenet vége után jelenne meg.`);
      }
      if (l.kind === "text") {
        if (!l.bind && !l.text) err.push(`${where(sc, l)} A szövegrétegnek adat (bind) vagy fix szöveg kell.`);
        checkColor(l.color, where(sc, l));
        if (!t.fonts.some((f) => f.family === l.font.family && f.weight === l.font.weight)) {
          err.push(`${where(sc, l)} A betűtípus nincs a sablon fontjai között: ${l.font.family} ${l.font.weight}`);
        }
        if (!(l.font.size > 0 && l.font.size < 0.3)) err.push(`${where(sc, l)} A betűméret 0 és 0.3 között legyen.`);
      }
      if (l.kind === "shape" && typeof l.fill === "string") checkColor(l.fill, where(sc, l));
      if (l.kind === "stack") {
        for (const it of l.items) {
          if (it.type === "rule") checkColor(it.color, where(sc, l));
          if (it.type === "text") {
            if (!it.bind && !it.text) err.push(`${where(sc, l)} Üres szöveg a blokkban.`);
            checkColor(it.color, where(sc, l));
            if (!t.fonts.some((f) => f.family === it.font.family && f.weight === it.font.weight)) {
              err.push(`${where(sc, l)} A betűtípus nincs a sablon fontjai között: ${it.font.family} ${it.font.weight}`);
            }
          }
        }
      }
      if (l.kind === "image" && l.border) checkColor(l.border.color, where(sc, l));
    }
  });

  const maxPhoto = Math.max(0, ...usedPhotos);
  if (maxPhoto > t.photos.max) err.push(`A jelenetek ${maxPhoto} fotót használnak, de a sablon legfeljebb ${t.photos.max}-et kér.`);
  if (t.photos.min > t.photos.max) err.push("A fotók minimuma nagyobb a maximumnál.");
  return err;
}
