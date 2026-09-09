// photo-grade — determinisztikus fotó-korrekció ingatlanfotókhoz.
//
// MIÉRT: a partnerek visszajelzése szerint a korábbi „Feljavítás" (generatív
// felskálázás) nem látszott. Egy telefonnal készült lakásfotó ugyanis ritkán
// ÉLETLEN — inkább rosszul VILÁGÍTOTT: sárga izzófény, sötét sarkok, kiégett
// ablak, fakó színek. Ezen nem a felskálázás segít, hanem a fotós korrekció.
//
// MIT NEM CSINÁL: nem generatív. Csak a pixelek világosságát és színét számolja
// át egy görbe (LUT) szerint — ezért MATEMATIKAILAG KÉPTELEN megváltoztatni a
// helyiséget: nem mozdít bútort, nem tesz hozzá és nem vesz el semmit.
//
// FELÉPÍTÉS: az elemzés és a tervezés TISZTA függvény (sharp nélkül, tesztelhető),
// a sharp csak a méretezést, a helyi kontrasztot és a kódolást végzi.

/** Luminancia-százalékosok és színinformáció a kicsinyített képből. */
export type PhotoStats = {
  /** Luminancia-százalékosok 0–255 skálán. */
  p01: number;
  p05: number;
  p50: number;
  p95: number;
  p99: number;
  /** Csatornánkénti átlag (fehéregyensúlyhoz). */
  meanR: number;
  meanG: number;
  meanB: number;
  /** Kiégett (≥250) és teljesen fekete (≤5) pixelek aránya. */
  clipHigh: number;
  clipLow: number;
  /** Átlagos színtelítettség 0–1 (túltelített képet nem élénkítünk tovább). */
  saturation: number;
};

/** A korrekciós terv — minden érték a LUT-hoz és a sharp-lépésekhez. */
export type GradePlan = {
  /** Csatorna-erősítés a fehéregyensúlyhoz. */
  wb: [number, number, number];
  /** Bemeneti fekete- és fehérpont (0–255). */
  black: number;
  white: number;
  /** Középtónus-gamma: >1 világosít (árnyékokat nyit). */
  gammaMid: number;
  /** Csúcsfény-lágyítás küszöbe 0–1 (efölött puhán fut ki). */
  knee: number;
  /** Színélénkítés szorzója. */
  saturation: number;
  /** Helyi kontraszt erőssége (sharp clahe maxSlope; 0 = kikapcsolva). */
  claheSlope: number;
  /** Élesítés sugara (0 = nincs). */
  sharpenSigma: number;
  /** Emberi nyelvű indoklás — az adminban és a naplóban hasznos. */
  notes: string[];
};

/** „Ingatlanos stílus": világos, tiszta, semleges — ahogy a portálokon a profi fotók. */
export type GradePreset = {
  /** Cél-median világosság (0–255). A hirdetési fotók szándékosan világosak. */
  targetMedian: number;
  /** Mennyire vigyük végig a semleges fehéregyensúlyt (0–1). */
  wbStrength: number;
  /** A csatorna-erősítés szélső értékei — ennél többet sosem torzítunk. */
  wbMinGain: number;
  wbMaxGain: number;
  /** A középtónus-gamma felső korlátja (a túlvilágítás ellen). */
  maxGamma: number;
  /** Színélénkítés felső korlátja. */
  maxSaturation: number;
  /** Helyi kontraszt alap-erőssége. */
  clahe: number;
};

export const PRESET_REAL_ESTATE: GradePreset = {
  targetMedian: 132,
  wbStrength: 0.85,
  // Egy erős izzófényes belső tér valósan ~1,4-es kék erősítést kíván; ennél
  // többet viszont nem engedünk, hogy a fa és a textil ne hűljön ki teljesen.
  wbMinGain: 0.74,
  wbMaxGain: 1.38,
  // Egy nagyon sötét felvételnél ennél kevesebb nem elég a cél eléréséhez; a
  // felerősödő zajt a lánc második lépése (fal.ai élesítés) szűri.
  maxGamma: 1.9,
  maxSaturation: 1.1,
  clahe: 3,
};

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

/** Rec. 709 luminancia. */
export const lum = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

// ---------------------------------------------------------------------------
// 1) ELEMZÉS — tiszta függvény a kicsinyített kép nyers RGB pixeleiből
// ---------------------------------------------------------------------------

/**
 * `rgb`: 3 bájt/pixel (R,G,B), alfa nélkül. Elég egy ~100×100-ra kicsinyített
 * kép — a százalékosok és az átlagok ebből is stabilak, viszont gyors.
 */
export function analyzePixels(rgb: Uint8Array | number[]): PhotoStats {
  const n = Math.floor(rgb.length / 3);
  if (n <= 0) {
    return { p01: 0, p05: 0, p50: 128, p95: 255, p99: 255, meanR: 128, meanG: 128, meanB: 128, clipHigh: 0, clipLow: 0, saturation: 0 };
  }

  const hist = new Uint32Array(256);
  let sr = 0, sg = 0, sb = 0, ssat = 0;
  let clipHigh = 0, clipLow = 0;

  for (let i = 0; i < n; i++) {
    const r = rgb[i * 3], g = rgb[i * 3 + 1], b = rgb[i * 3 + 2];
    sr += r; sg += g; sb += b;
    const L = Math.round(lum(r, g, b));
    hist[clamp(L, 0, 255)]++;
    if (L >= 250) clipHigh++;
    if (L <= 5) clipLow++;
    // Telítettség: a max és min csatorna különbsége a maxhoz mérve (HSV S).
    const mx = r > g ? (r > b ? r : b) : g > b ? g : b;
    const mn = r < g ? (r < b ? r : b) : g < b ? g : b;
    if (mx > 0) ssat += (mx - mn) / mx;
  }

  // Százalékosok a hisztogramból.
  const pct = (q: number): number => {
    const target = q * n;
    let acc = 0;
    for (let v = 0; v < 256; v++) {
      acc += hist[v];
      if (acc >= target) return v;
    }
    return 255;
  };

  return {
    p01: pct(0.01),
    p05: pct(0.05),
    p50: pct(0.5),
    p95: pct(0.95),
    p99: pct(0.99),
    meanR: sr / n,
    meanG: sg / n,
    meanB: sb / n,
    clipHigh: clipHigh / n,
    clipLow: clipLow / n,
    saturation: ssat / n,
  };
}

// ---------------------------------------------------------------------------
// 2) TERVEZÉS — a statisztikából konkrét korrekciós értékek
// ---------------------------------------------------------------------------

/**
 * 1. menet: CSAK a fehéregyensúly. A szinteket (fekete/fehérpont, gamma) ebből
 * még nem lehet meghatározni, mert a csatorna-erősítés eltolja a hisztogramot.
 */
export function planWhiteBalance(
  s: PhotoStats,
  preset: GradePreset = PRESET_REAL_ESTATE
): { wb: [number, number, number]; notes: string[] } {
  const notes: string[] = [];

  // --- Fehéregyensúly (szürke-világ, csillapítva) ---
  // A belső téri telefonfotó jellemzően sárgás (izzó) vagy zöldes (neon). A
  // csatorna-átlagokat közelítjük egymáshoz, de CSAK részlegesen és korlátok
  // között — különben egy szándékosan meleg, hangulatos fotó is szürkévé válna.
  const avg = (s.meanR + s.meanG + s.meanB) / 3;
  const raw: [number, number, number] = [
    s.meanR > 1 ? avg / s.meanR : 1,
    s.meanG > 1 ? avg / s.meanG : 1,
    s.meanB > 1 ? avg / s.meanB : 1,
  ];
  const wb = raw.map((g) =>
    clamp(1 + (g - 1) * preset.wbStrength, preset.wbMinGain, preset.wbMaxGain)
  ) as [number, number, number];
  const castStrength = Math.max(Math.abs(wb[0] - 1), Math.abs(wb[2] - 1));
  if (castStrength > 0.04) {
    notes.push(wb[2] > wb[0] ? "Sárgás fény semlegesítve" : "Hideg/kékes fény semlegesítve");
  }
  return { wb, notes };
}

/**
 * 2. menet: a szintek és a többi paraméter — a MÁR fehéregyensúlyozott kép
 * statisztikájából (`s`). Így a feketepont levonása nem hozza vissza a színezetet.
 */
export function planLevels(
  s: PhotoStats,
  wb: [number, number, number],
  wbNotes: string[],
  preset: GradePreset = PRESET_REAL_ESTATE
): GradePlan {
  const notes = [...wbNotes];

  // --- Fekete- és fehérpont ---
  // A feketepont a kép valós legsötétebb tartománya (p01). Egy fátyolos, lapos
  // felvételnél ez magasan van — ilyenkor a fekete visszaállítása adja a mélységet.
  // Biztonsági fék: a feketepont sosem kerülhet a median közelébe (max p50−18),
  // különben a kép fele feketébe fulladna. Fix felső korlát NINCS: egy erősen
  // fátyolos felvételnél a p01 magasan van, és épp azt kell visszahúzni.
  const black = clamp(Math.min(s.p01, s.p50 - 18), 0, 230);
  if (black > 40) notes.push("Fátyolos kép — a mély feketék visszaállítva");
  // Fehérpont — CSAK akkor nyújtunk, ha a képből tényleg hiányzik a csúcsfény.
  // Ha már van rendes világos tartománya (p99 ≥ 240), hozzá sem nyúlunk:
  // különben egy eleve jó fotón mi magunk égetnénk ki a világos részeket.
  const white =
    s.p99 >= 240
      ? 255
      : clamp(Math.max(s.p99 + 6, black + 60), black + 60, 255);
  if (white < 250) notes.push("Hiányzó csúcsfények visszaállítva");

  // --- Középtónus-gamma: a cél-median eléréséhez ---
  // A normalizált median hányadik hatványra emelve adja a célt.
  const midNorm = clamp((s.p50 - black) / Math.max(1, white - black), 0.02, 0.98);
  // ELLENFÉNYES JELENET (nagy kiégett ablak): a szoba és az ablak között akkora
  // a különbség, hogy a teljes cél-világosságot csak mosott, hiteltelen képpel
  // lehetne elérni. Ilyenkor mérsékeltebb célt tűzünk ki, cserébe engedünk
  // erősebb árnyéknyitást — így a szoba láthatóvá válik, de nem lesz szürke.
  const backlit = s.clipHigh > 0.04;
  const target = backlit ? preset.targetMedian - 18 : preset.targetMedian;
  const gammaCap = backlit ? preset.maxGamma + 0.7 : preset.maxGamma;
  const targetNorm = clamp(target / 255, 0.05, 0.95);
  // out = in^(1/gamma)  →  gamma = ln(in) / ln(out)
  let gammaMid = Math.log(midNorm) / Math.log(targetNorm);
  gammaMid = clamp(gammaMid, 0.7, gammaCap);
  // A szöveg az EREDETI kép hibáját nevezze meg (a gamma önmagában félrevezető:
  // a fehérpont-nyújtás után egy 1 alatti gamma is világosabb végeredményt ad).
  if (s.p50 < preset.targetMedian - 22) notes.push("Sötét felvétel — árnyékok megnyitva");
  else if (s.p50 > preset.targetMedian + 30) notes.push("Túl világos felvétel — visszafogva");
  if (s.p95 - s.p05 < 90) notes.push("Lapos kép — tónusok kiterjesztve");

  // --- Csúcsfény-lágyítás ---
  // Kiégett ablaknál korábban kezdjük a puha kifutást, hogy ne legyen éles a
  // fehér folt pereme; tiszta képnél alig avatkozunk be.
  const knee = s.clipHigh > 0.05 ? 0.72 : s.clipHigh > 0.01 ? 0.82 : 0.9;
  if (s.clipHigh > 0.01) notes.push(backlit ? "Ellenfényes felvétel — a beltér felhozva" : "Kiégett ablak lágyítva");

  // --- Színélénkítés ---
  // Fakó képnél emelünk, már telített képnél nem nyúlunk hozzá.
  const saturation = clamp(
    s.saturation < 0.18 ? preset.maxSaturation : s.saturation < 0.3 ? 1.05 : 1.0,
    1,
    preset.maxSaturation
  );
  if (saturation > 1.02) notes.push("Fakó színek felélénkítve");

  // --- Helyi kontraszt ---
  // Ha a kép eleve kontrasztos (nagy p95−p05 táv), visszább vesszük, hogy ne
  // legyen „agyon-HDR-es"; lapos képnél a teljes erősség jár.
  const spread = s.p95 - s.p05;
  const claheSlope = spread > 190 ? Math.max(1, preset.clahe - 2) : spread > 150 ? preset.clahe - 1 : preset.clahe;
  if (claheSlope >= preset.clahe) notes.push("Helyi kontraszt: textúrák kiemelve");

  return {
    wb,
    black,
    white,
    gammaMid,
    knee,
    saturation,
    claheSlope,
    sharpenSigma: 0.8,
    notes,
  };
}

// ---------------------------------------------------------------------------
// 3) LUT — a terv 3 × 256 bejegyzésű keresőtáblává alakítva
// ---------------------------------------------------------------------------

/** Puha kifutás a csúcsfényekben: a `knee` fölött fokozatosan lassul. */
function softKnee(t: number, knee: number): number {
  if (t <= knee) return t;
  const over = (t - knee) / Math.max(1e-6, 1 - knee);
  // Telítődő görbe: a küszöb fölött fokozatosan lassul, de a TISZTA FEHÉR
  // közel fehér marad (~0.97) — egy ablak ne szürküljön be a lágyítástól.
  return knee + (1 - knee) * (1 - Math.exp(-over * 3.5));
}

/** Csatornánkénti 256-elemű LUT a tervből. */
export function buildLut(plan: GradePlan): [Uint8Array, Uint8Array, Uint8Array] {
  const span = Math.max(1, plan.white - plan.black);
  const out: Uint8Array[] = [];
  for (let c = 0; c < 3; c++) {
    const lut = new Uint8Array(256);
    for (let v = 0; v < 256; v++) {
      // 1) fehéregyensúly
      let x = v * plan.wb[c];
      // 2) fekete/fehérpont → 0..1 (felül NEM vágunk: a lágyítás fut ki puhán)
      let t = Math.max(0, (x - plan.black) / span);
      // 3) középtónus-gamma (árnyéknyitás)
      t = Math.pow(t, 1 / plan.gammaMid);
      // 4) csúcsfény-lágyítás (a fehérpont fölötti értékeket is ez fogja be)
      t = softKnee(t, plan.knee);
      x = Math.round(clamp(t, 0, 1) * 255);
      lut[v] = clamp(x, 0, 255);
    }
    out.push(lut);
  }
  return out as [Uint8Array, Uint8Array, Uint8Array];
}

/** A LUT alkalmazása nyers RGB pixelekre (helyben, gyorsan). */
export function applyLut(rgb: Uint8Array, lut: [Uint8Array, Uint8Array, Uint8Array]): Uint8Array {
  for (let i = 0; i < rgb.length; i += 3) {
    rgb[i] = lut[0][rgb[i]];
    rgb[i + 1] = lut[1][rgb[i + 1]];
    rgb[i + 2] = lut[2][rgb[i + 2]];
  }
  return rgb;
}

// ---------------------------------------------------------------------------
// 4) TELJES TERV — kétmenetes, a kicsinyített minta pixeleiből
// ---------------------------------------------------------------------------

/** Csak a fehéregyensúly alkalmazása egy mintára (a 2. menet bemenetéhez). */
function applyWhiteBalance(rgb: Uint8Array, wb: [number, number, number]): Uint8Array {
  const out = new Uint8Array(rgb.length);
  for (let i = 0; i < rgb.length; i += 3) {
    out[i] = clamp(Math.round(rgb[i] * wb[0]), 0, 255);
    out[i + 1] = clamp(Math.round(rgb[i + 1] * wb[1]), 0, 255);
    out[i + 2] = clamp(Math.round(rgb[i + 2] * wb[2]), 0, 255);
  }
  return out;
}

/**
 * A teljes korrekciós terv egy ~100×100-as minta nyers RGB pixeleiből.
 *
 * KÉT MENET, mert a kettő nem független: a csatorna-erősítés eltolja a
 * hisztogramot, ezért a fekete-/fehérpontot és a gammát MÁR a színhelyes
 * képből kell számolni — különben a feketepont levonása visszahozná a színezetet.
 */
export function planGradeFromPixels(
  rgb: Uint8Array,
  preset: GradePreset = PRESET_REAL_ESTATE
): GradePlan {
  const first = analyzePixels(rgb);
  const { wb, notes } = planWhiteBalance(first, preset);
  const second = analyzePixels(applyWhiteBalance(rgb, wb));
  return planLevels(second, wb, notes, preset);
}

// ---------------------------------------------------------------------------
// 5) VÉGREHAJTÁS — sharp (csak szerveroldalon)
// ---------------------------------------------------------------------------

export type GradeResult = { buffer: Buffer; plan: GradePlan; width: number; height: number };

/** Az elemzéshez használt minta mérete — ennyiből már stabilak a százalékosok. */
const SAMPLE_PX = 120;

/**
 * A teljes fotó-korrekció egy JPEG/PNG bufferen.
 *
 * SORREND (ez fontos): fehéregyensúly + tónusgörbe (LUT, pixelenként) →
 * helyi kontraszt (CLAHE) → színélénkítés → élesítés → JPEG.
 * A LUT-ot mi számoljuk, mert így a görbe pontosan az, amit terveztünk és
 * teszteltünk — nem a könyvtár belső közelítése.
 */
export async function gradePhoto(
  input: Buffer,
  opts: { maxDim?: number; quality?: number; preset?: GradePreset } = {}
): Promise<GradeResult> {
  const sharp = (await import("sharp")).default;
  const maxDim = opts.maxDim ?? 2048;
  const preset = opts.preset ?? PRESET_REAL_ESTATE;

  // A telefonos EXIF-forgatást azonnal alkalmazzuk, különben fejre állna a kép.
  const base = sharp(input, { failOn: "none" }).rotate();

  // 1) Kis minta az elemzéshez.
  const sample = await base
    .clone()
    .resize(SAMPLE_PX, SAMPLE_PX, { fit: "inside" })
    .removeAlpha()
    .raw()
    .toBuffer();
  const plan = planGradeFromPixels(new Uint8Array(sample), preset);

  // 2) Teljes méretű nyers pixelek + a LUT alkalmazása.
  const full = await base
    .clone()
    .resize({ width: maxDim, height: maxDim, fit: "inside", withoutEnlargement: true })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const graded = applyLut(new Uint8Array(full.data), buildLut(plan));

  // 3) Helyi kontraszt, telítettség, élesítés — ezeket a sharp végzi.
  let pipe = sharp(Buffer.from(graded), {
    raw: { width: full.info.width, height: full.info.height, channels: 3 },
  });
  if (plan.claheSlope > 0) {
    // A régió a kép rövidebb oldalának ~1/8-a: ekkora foltokban dolgozik a
    // kiegyenlítés — elég nagy, hogy ne legyen „foltos", elég kicsi, hogy hasson.
    const region = Math.max(16, Math.round(Math.min(full.info.width, full.info.height) / 8));
    pipe = pipe.clahe({ width: region, height: region, maxSlope: plan.claheSlope });
  }
  if (plan.saturation !== 1) pipe = pipe.modulate({ saturation: plan.saturation });
  if (plan.sharpenSigma > 0) pipe = pipe.sharpen({ sigma: plan.sharpenSigma });

  const buffer = await pipe.jpeg({ quality: opts.quality ?? 88, mozjpeg: true }).toBuffer();
  return { buffer, plan, width: full.info.width, height: full.info.height };
}

/** Mennyit változott a kép? 0 = semmit. A „nem látok különbséget" ellenőrzéshez. */
export function gradeStrength(plan: GradePlan): number {
  const wbDev = Math.max(...plan.wb.map((g) => Math.abs(g - 1)));
  const gammaDev = Math.abs(plan.gammaMid - 1);
  const levelDev = Math.abs(plan.black) / 255 + (255 - plan.white) / 255;
  return wbDev * 2 + gammaDev + levelDev;
}

/**
 * Érdemes-e egyáltalán meghívni a (fizetős) felskálázót?
 *
 * Egy mai telefon 12 MP-es, éles fotóján a felskálázó alig tesz hozzá — a
 * korrekció önmagában is látványos. Kis felbontású vagy lágy rajzolatú képnél
 * viszont sokat segít. Ezzel a vizsgálattal csak ott költünk, ahol számít.
 */
export async function shouldUpscale(
  buffer: Buffer,
  opts: { minDim?: number; minSharpness?: number } = {}
): Promise<boolean> {
  const minDim = opts.minDim ?? 1400;
  const minSharpness = opts.minSharpness ?? 2.2;
  try {
    const sharp = (await import("sharp")).default;
    const img = sharp(buffer, { failOn: "none" });
    const meta = await img.metadata();
    const shortSide = Math.min(meta.width ?? 0, meta.height ?? 0);
    if (shortSide > 0 && shortSide < minDim) return true; // kicsi kép → kell
    const st = await img.stats();
    // A sharp `sharpness` a Laplace-szórásból becsül: kis érték = lágy kép.
    return typeof st.sharpness === "number" ? st.sharpness < minSharpness : true;
  } catch {
    return true; // bizonytalanság esetén inkább lefuttatjuk
  }
}
