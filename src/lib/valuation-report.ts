// lib/valuation-report.ts — az AI nyers értékbecslés-szövegének szerkeszthető modellje.
// KLIENS-BIZTOS: nincs benne szerveroldali import, a böngészőben is fut.
//
// Az AI a promptban rögzített 1-9 pontos struktúrát adja vissza. Ezt bontjuk
// szakaszokra, hogy a partner szakaszonként szerkeszthesse, majd ugyanebből a
// modellből készül az előnézet és a PDF is (WYSIWYG).

export type ReportSection = {
  id: string;
  heading: string;
  body: string; // nyers szöveg: sorok, "- " listaelemek, **félkövér**
  hidden: boolean;
};

export type ReportMeta = { label: string; value: string };

export type ReportDoc = {
  title: string; // fő cím (cím/település)
  subtitle: string; // alcím (típus · méret · szobák)
  meta: ReportMeta[]; // fejléc-adatok
  headlinePrice: string; // a dokumentum tetején kiemelt JAVASOLT ÁR
  intro: string; // szerkeszthető bevezető (a "Rövid összefoglaló")
  sections: ReportSection[];
  closing: string; // záró megjegyzés / aláírás blokk
};

/** Kiemelt szám-kártya a fejléc alatt (piaci ár, nm-ár, gyors eladási ár, idő). */
export type ReportHighlight = { label: string; value: string; accent?: boolean };

let idSeq = 0;
function nextId(): string {
  idSeq += 1;
  return `s${idSeq}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Perplexity hivatkozás-jelek ([1], [9][10]) és markdown-zaj eltakarítása. */
function cleanLine(raw: string): string {
  return raw
    .replace(/\[\d+\]/g, "")
    .replace(/^\s*[-*]\s+/, "- ")
    .replace(/\s+$/, "");
}

/** Címsor-e a sor? Visszaadja a címet és a sor végén maradt tartalmat. */
function matchHeading(line: string): { heading: string; rest: string } | null {
  let s = line.trim();
  if (!s) return null;

  // "## Cím" / "### Cím"
  const md = s.match(/^#{1,6}\s+(.*)$/);
  if (md) s = md[1].trim();

  // A **félkövér** jelöléseket a címsorban nem tartjuk meg.
  s = s.replace(/\*\*/g, "").trim();

  // "3. LOKÁCIÓS PRÉMIUM KORREKCIÓ: tartalom"
  const num = s.match(/^(\d{1,2})[.)]\s+(.+)$/);
  const candidate = num ? num[2] : md ? s : "";
  if (!candidate) return null;

  // A cím a kettőspontig tart (ha van), a maradék már tartalom.
  const colon = candidate.indexOf(":");
  const headingRaw = (colon >= 0 ? candidate.slice(0, colon) : candidate).trim();
  const rest = colon >= 0 ? candidate.slice(colon + 1).trim() : "";

  if (!headingRaw || headingRaw.length > 80) return null;

  // Számozott listánál (pl. "1. Kertes ház, 90 nm, 45 M Ft") NE csináljunk címsort:
  // címsornak csak a jellemzően nagybetűs, rövid feliratokat fogadjuk el.
  if (num && !md) {
    const letters = headingRaw.replace(/[^A-Za-zÁÉÍÓÖŐÚÜŰáéíóöőúüű]/g, "");
    const upper = headingRaw.replace(/[^A-ZÁÉÍÓÖŐÚÜŰ]/g, "");
    const mostlyUpper = letters.length > 0 && upper.length / letters.length >= 0.7;
    if (!mostlyUpper) return null;
  }

  return { heading: normalizeHeading(headingRaw), rest };
}

/** CSUPA NAGYBETŰS címből olvasható "Mondatkezdő" cím. */
function normalizeHeading(h: string): string {
  const letters = h.replace(/[^A-Za-zÁÉÍÓÖŐÚÜŰáéíóöőúüű]/g, "");
  const upper = h.replace(/[^A-ZÁÉÍÓÖŐÚÜŰ]/g, "");
  const allUpper = letters.length > 0 && upper.length === letters.length;
  if (!allUpper) return h;
  const lower = h.toLocaleLowerCase("hu-HU");
  return lower.charAt(0).toLocaleUpperCase("hu-HU") + lower.slice(1);
}

export type ValuationFacts = {
  telepules?: string;
  utca?: string;
  tipus?: string;
  meret?: string;
  szobak?: string;
  allapot?: string;
  epitesEve?: string;
  lokacioKategoria?: string;
};

function fact(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/** Az ingatlan beszédes címe a fejléchez. */
export function reportTitle(facts: ValuationFacts): string {
  const hely = [fact(facts.telepules), fact(facts.utca)].filter(Boolean).join(", ");
  return hely || "Ingatlan értékbecslés";
}

/**
 * Szerkeszthető dokumentum a tárolt szövegből.
 * Kétféle bemenetet kezel:
 *  - a MENTETT változat JSON (szerkesztés után) — pontosan visszaáll minden,
 *    a rejtett szakaszok és a kézzel írt címek is;
 *  - az AI FRISS válasza sima szöveg — ilyenkor szakaszokra bontjuk.
 * (A JSON-mentés azért kell, mert a "## cím" alapú visszaolvasás összeolvasztotta
 *  a szakaszokat, ha a partner kettőspontot vagy üres címet adott meg.)
 */
export function parseValuationReport(raw: string, facts: ValuationFacts = {}): ReportDoc {
  const stored = tryParseStored(raw, facts);
  if (stored) return stored;

  const lines = String(raw ?? "").split(/\r?\n/).map(cleanLine);

  const sections: ReportSection[] = [];
  let current: ReportSection | null = null;
  let preamble: string[] = [];

  for (const line of lines) {
    const h = matchHeading(line);
    if (h) {
      current = { id: nextId(), heading: h.heading, body: h.rest, hidden: false };
      sections.push(current);
      continue;
    }
    if (!line.trim()) {
      if (current) current.body += current.body.endsWith("\n") ? "" : "\n";
      continue;
    }
    if (current) current.body += (current.body ? "\n" : "") + line;
    else preamble.push(line);
  }

  // Ha az AI nem adott címsorokat, ne vesszen el semmi: egy szakaszba tesszük.
  if (!sections.length && preamble.length) {
    sections.push({
      id: nextId(),
      heading: "Értékbecslés",
      body: preamble.join("\n"),
      hidden: false,
    });
    preamble = [];
  }

  // A "Javasolt ár" szakaszt kiemeljük a fejlécbe, és kivesszük a szakaszok közül.
  let headlinePrice = "";
  const priceIdx = sections.findIndex((s) => /javasolt\s*ár/i.test(s.heading));
  if (priceIdx >= 0) {
    headlinePrice = toSinglePrice(firstLine(sections[priceIdx].body));
    sections.splice(priceIdx, 1);
  }

  // Az első szakasz, ha összefoglaló, a bevezetőbe kerül (kiemelt tördeléssel).
  let intro = preamble.join("\n").trim();
  if (!intro && sections.length && /összefoglal|áttekint/i.test(sections[0].heading)) {
    intro = sections.shift()!.body.trim();
  }

  for (const s of sections) s.body = s.body.replace(/\n{3,}/g, "\n\n").trim();

  // Ha az AI nem adott külön "Javasolt ár"-t, a Becsült piaci értékből (vagy a
  // régi riportoknál a "Piaci ár"-ból) vezetjük le a fejléc-árat.
  if (!headlinePrice) {
    const est = sections.find((s) =>
      /becsült\s*(piaci|forgalmi)\s*érték|piaci\s*érték|piaci\s*ár/i.test(s.heading)
    );
    if (est) headlinePrice = toSinglePrice(firstValue(est.body));
  }

  // A fejléc-ár a teljes forgalmi érték legyen (ne a nm-ár) — ha kell, korrigáljuk.
  headlinePrice = ensureTotalPrice(headlinePrice, sections, fact(facts.meret));

  // REKONCILIÁCIÓ: a fejléc-ár MINDIG a riport SAJÁT levezetésével egyezzen.
  // Az AI-tartalék ágon a modell néha a korrekciók ELŐTTI (comp-alapú, hirdetési)
  // árat teszi a fejlécbe, miközben a törzsben a korrigált, alacsonyabb értéket
  // vezeti le. Ilyenkor a fejléc-ár kilóg az értéksávból. Ezt itt determinisztikusan
  // felülírjuk a törzs „Becsült piaci/forgalmi érték"-ével (vagy a sáv középértékével),
  // hogy a partner mindig a reális, levezetéssel egyező árat lássa.
  headlinePrice = reconcileHeadline(headlinePrice, sections);

  // ZÁRÓ ÉP-ÉSZ ELLENŐRZÉS: bármelyik lépés hozhat be tévedésből NÉGYZETMÉTERÁRAT
  // (pl. „1 310 000 Ft" egy 50 m²-es lakásnál). Ezért legvégül újra megnézzük,
  // hogy a fejléc-ár a nm-ár × alapterület nagyságrendjében van-e; ha nem, javítjuk.
  headlinePrice = ensureTotalPrice(headlinePrice, sections, fact(facts.meret));

  const detail = [fact(facts.tipus), fact(facts.meret), fact(facts.szobak)]
    .filter(Boolean)
    .join(" · ");

  const meta: ReportMeta[] = [];
  if (fact(facts.allapot)) meta.push({ label: "Állapot", value: fact(facts.allapot) });
  if (fact(facts.epitesEve)) meta.push({ label: "Építés éve", value: fact(facts.epitesEve) });
  if (fact(facts.lokacioKategoria))
    meta.push({ label: "Lokáció", value: fact(facts.lokacioKategoria) });

  return {
    title: reportTitle(facts),
    subtitle: detail,
    meta,
    headlinePrice,
    intro,
    sections,
    closing:
      "Ez a dokumentum tájékoztató jellegű piaci becslés, nem minősül hivatalos ingatlan-értékbecslésnek.",
  };
}

/** Az első nem üres, formázástól megtisztított sor. */
function firstLine(body: string): string {
  return (
    body
      .split("\n")
      .map((l) => l.replace(/^[-•]\s*/, "").replace(/\*\*/g, "").trim())
      .find((l) => l.length > 0) ?? ""
  );
}

/**
 * A fejléc-ár MINDIG egyetlen vételár legyen. A modell néha sávot vagy zárójeles
 * kiegészítést ad — ezt egy számmá alakítjuk: a zárójeles részt levágjuk, sáv
 * esetén a középértéket vesszük, és egységes ezres-tagolással formázzuk.
 */
function toSinglePrice(raw: string): string {
  if (!raw) return "";
  // Zárójeles rész és kósza zárójelek el.
  const s = raw.replace(/\([^)]*\)?/g, " ").replace(/[()]/g, " ").trim();

  // Számok kигyűjtése (ezres-tagolás lehet szóköz, pont vagy nbsp).
  const nums = (s.match(/\d[\d.\s ]*\d|\d/g) ?? [])
    .map((n) => Number(n.replace(/[.\s ]/g, "")))
    .filter((n) => Number.isFinite(n) && n >= 100000); // csak reális árak

  if (nums.length >= 2) {
    // Sáv → középérték, ezresre kerekítve.
    const mid = Math.round((nums[0] + nums[1]) / 2 / 1000) * 1000;
    return `${mid.toLocaleString("hu-HU").replace(/ /g, " ")} Ft`;
  }
  if (nums.length === 1) {
    return `${nums[0].toLocaleString("hu-HU").replace(/ /g, " ")} Ft`;
  }
  // Nincs értelmezhető szám: a nyers szöveget adjuk vissza, kósza zárójel nélkül.
  return s.replace(/\s+/g, " ").trim();
}

/** Egy forint-összeg egységes formázása. */
function formatFt(n: number): string {
  return `${Math.round(n).toLocaleString("hu-HU").replace(/ /g, " ")} Ft`;
}

/** Az első, ezres-tagolt szám a szövegből (min. határértékkel). */
/**
 * A NÉGYZETMÉTERÁRAK kitakarása a szövegből. Enélkül egy „1 345 000 Ft/m²" simán
 * beleférne az ingatlan-ár nagyságrendbe (> 1 M Ft), és a fejlécbe kerülhetne
 * teljes árként — ezért minden „… Ft/m²" alakú számot eltávolítunk a keresésből.
 */
function stripUnitPrices(text: string): string {
  return String(text ?? "").replace(
    /\d[\d.\s ]*\d\s*(?:e\s?)?(?:Ft|forint)?\s*\/\s*(?:nm|m²|m2|négyzetméter|négyzet)/gi,
    " "
  );
}

function firstBigNumber(text: string, min = 100000): number | null {
  const matches = stripUnitPrices(text).match(/\d[\d.\s ]*\d|\d/g) ?? [];
  for (const m of matches) {
    const n = Number(m.replace(/[.\s ]/g, ""));
    if (Number.isFinite(n) && n >= min) return n;
  }
  return null;
}

/** A lakás alapterülete a form „méret" mezőjéből (pl. „60 nm" → 60). */
function parseSizeSqm(meret: string): number | null {
  const m = String(meret ?? "").match(/\d+([.,]\d+)?/);
  if (!m) return null;
  const n = Number(m[0].replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** A négyzetméterár a riport szövegéből (első „… Ft/nm" vagy „… Ft/m²"). */
function findUnitPrice(sections: ReportSection[]): number | null {
  for (const s of sections) {
    const m = s.body.match(/([\d][\d.\s ]*\d)\s*(?:e?\s?Ft|forint)?\s*\/\s*(?:nm|m²|m2|négyzet)/i);
    if (m) {
      const n = Number(m[1].replace(/[.\s ]/g, ""));
      if (Number.isFinite(n) && n >= 100000) return n;
    }
  }
  return null;
}

/**
 * A fejléc-ár a TELJES forgalmi érték legyen, ne a négyzetméterár. A modell néha
 * a nm-árat teszi a „Javasolt ár" mezőbe — ezt úgy szűrjük ki, hogy a nm-ár ×
 * alapterület alapján kiszámoljuk a várható teljes árat, és ha a megadott szám
 * ennek töredéke (nm-ár méretű), a számított teljes árat használjuk.
 */
function ensureTotalPrice(
  headline: string,
  sections: ReportSection[],
  meret: string
): string {
  const size = parseSizeSqm(meret);
  const unit = findUnitPrice(sections);
  if (!size || !unit) return headline; // nincs mivel korrigálni

  const expectedTotal = Math.round((unit * size) / 1000) * 1000;
  const current = firstBigNumber(headline);
  if (!current) return formatFt(expectedTotal);

  // A fejléc-ár akkor hihető, ha a nm-ár × alapterület nagyságrendjében van.
  // Ennél lényegesen kisebb szám szinte biztosan NÉGYZETMÉTERÁR (ez okozta a
  // „1 310 000 Ft" típusú hibát egy ~65 M Ft-os lakásnál), a jóval nagyobb pedig
  // elszámolás — mindkét esetben a számított teljes árat használjuk.
  const tooSmall = current < expectedTotal * 0.6;
  const tooLarge = current > expectedTotal * 2.5;
  if (tooSmall || tooLarge) return formatFt(expectedTotal);
  return headline;
}

/** A minimális, ingatlan-ár nagyságrendű szám (a nm-árat kiszűri). */
const PRICE_MIN = 1_000_000;

/** Egy szakasz törzséből az első ingatlan-ár nagyságrendű szám. */
function bodyBigNumber(sections: ReportSection[], test: RegExp): number | null {
  for (const s of sections) {
    if (test.test(s.heading)) {
      const n = firstBigNumber(s.body, PRICE_MIN);
      if (n) return n;
    }
  }
  // Ha nincs önálló szakasz (pl. „Végső összegzés" alá írta a modell), a
  // törzs-sorok között keressük a megnevezett értéket.
  for (const s of sections) {
    for (const line of s.body.split("\n")) {
      if (test.test(line)) {
        const n = firstBigNumber(line, PRICE_MIN);
        if (n) return n;
      }
    }
  }
  return null;
}

/** Az értéksáv [alsó, felső] a riportból, ha értelmezhető. */
function parseValueRange(sections: ReportSection[]): [number, number] | null {
  const collect = (text: string): number[] =>
    (stripUnitPrices(text).match(/\d[\d.\s ]*\d|\d/g) ?? [])
      .map((m) => Number(m.replace(/[.\s ]/g, "")))
      .filter((n) => Number.isFinite(n) && n >= PRICE_MIN);

  // 1) Önálló „Értéksáv" szakasz.
  const rangeSection = sections.find((s) => /értéksáv/i.test(s.heading));
  if (rangeSection) {
    const nums = collect(rangeSection.body);
    if (nums.length >= 2) return [Math.min(nums[0], nums[1]), Math.max(nums[0], nums[1])];
  }
  // 2) „Értéksáv:" sor bárhol a törzsben.
  for (const s of sections) {
    for (const line of s.body.split("\n")) {
      if (/értéksáv/i.test(line)) {
        const nums = collect(line);
        if (nums.length >= 2) return [Math.min(nums[0], nums[1]), Math.max(nums[0], nums[1])];
      }
    }
  }
  return null;
}

/**
 * A fejléc-árat a riport SAJÁT levezetésével egyeztetjük. Az AI-tartalék ágon a
 * modell néha a korrekciók ELŐTTI (magasabb, comp-alapú) árat teszi a fejlécbe,
 * miközben a törzsben a korrigált, alacsonyabb értéket vezeti le — így a fejléc
 * kilóg az értéksávból. Ilyenkor felülírjuk:
 *   • ha van „Becsült piaci/forgalmi érték", azt tesszük a fejlécbe (ez a levezetés vége),
 *   • egyébként ha van értéksáv és a fejléc kívül esik rajta, a sáv középértékét.
 * Kis (≤2%) eltérésnél nem nyúlunk hozzá, hogy a kerekítési zaj ne írja felül.
 */
function reconcileHeadline(headline: string, sections: ReportSection[]): string {
  const estimate = bodyBigNumber(sections, /becsült\s*(piaci|forgalmi)\s*érték/i);
  const range = parseValueRange(sections);
  const current = firstBigNumber(headline, PRICE_MIN);

  // Az irányadó érték: elsősorban a becsült érték, különben a sáv középértéke.
  const authoritative =
    estimate ?? (range ? Math.round((range[0] + range[1]) / 2 / 1000) * 1000 : null);
  if (!authoritative) return headline; // nincs mihez igazítani

  // Nincs fejléc-szám → az irányadót írjuk be.
  if (!current) return formatFt(authoritative);

  // A fejléc kilóg a sávból? (2% tűrés a kerekítés miatt.)
  const outOfRange = range ? current < range[0] * 0.98 || current > range[1] * 1.02 : false;
  // Vagy érdemben eltér a becsült értéktől? (2% fölött.)
  const offEstimate = estimate ? Math.abs(current - estimate) / estimate > 0.02 : false;

  if (outOfRange || offEstimate) return formatFt(authoritative);
  return headline;
}

const STORE_MARKER = "twinxReport";

/** Mentés: a teljes dokumentum JSON-ként, veszteség nélkül. */
export function serializeReportDoc(doc: ReportDoc): string {
  return JSON.stringify({
    [STORE_MARKER]: 1,
    title: doc.title,
    subtitle: doc.subtitle,
    meta: doc.meta,
    headlinePrice: doc.headlinePrice,
    intro: doc.intro,
    closing: doc.closing,
    sections: doc.sections.map((s) => ({
      heading: s.heading,
      body: s.body,
      hidden: s.hidden,
    })),
  });
}

/** A mentett JSON visszaolvasása. Nem-JSON bemenetnél null (akkor szövegként bontjuk). */
function tryParseStored(raw: string, facts: ValuationFacts): ReportDoc | null {
  const s = String(raw ?? "").trim();
  if (!s.startsWith("{") || !s.includes(STORE_MARKER)) return null;
  try {
    const o = JSON.parse(s) as Record<string, unknown>;
    if (!o[STORE_MARKER] || !Array.isArray(o.sections)) return null;
    const sections = (o.sections as Record<string, unknown>[]).map((x) => ({
      id: nextId(),
      heading: typeof x.heading === "string" ? x.heading : "",
      body: typeof x.body === "string" ? x.body : "",
      hidden: x.hidden === true,
    }));
    return {
      title: typeof o.title === "string" && o.title ? o.title : reportTitle(facts),
      subtitle: typeof o.subtitle === "string" ? o.subtitle : "",
      meta: Array.isArray(o.meta) ? (o.meta as ReportMeta[]) : [],
      headlinePrice: typeof o.headlinePrice === "string" ? o.headlinePrice : "",
      intro: typeof o.intro === "string" ? o.intro : "",
      closing: typeof o.closing === "string" ? o.closing : "",
      sections,
    };
  } catch {
    return null;
  }
}

const HIGHLIGHT_RULES: { test: RegExp; label: string; accent?: boolean }[] = [
  // Új struktúra (2026-08): Becsült piaci érték + a három ártier felül
  { test: /becsült\s*piaci\s*érték|piaci\s*érték/i, label: "Becsült piaci érték", accent: true },
  { test: /kínálati\s*ár/i, label: "Kínálati ár" },
  { test: /hirdetett\s*eladási/i, label: "Hirdetett eladási ár" },
  { test: /gyors\s*eladási/i, label: "Gyors eladási ár" },
  { test: /értéksáv/i, label: "Értéksáv" },
  { test: /négyzetméterár|nm-?ár/i, label: "Átlagos nm-ár" },
  // Visszamenőleges kompatibilitás a korábbi riportokkal
  { test: /piaci\s*ár/i, label: "Piaci ár", accent: true },
  { test: /eladási\s*idő/i, label: "Várható eladási idő" },
];

/** Az első értelmes érték a szakasz szövegéből (lehetőleg szám + mértékegység). */
function firstValue(body: string): string {
  const lines = body
    .split("\n")
    .map((l) => l.replace(/^-\s*/, "").replace(/\*\*/g, "").trim())
    .filter((l) => l.length > 0);
  if (!lines.length) return "";

  // Elsőként egy olyan sort keresünk, amiben tényleg szerepel összeg/szám —
  // így nem a leíró mondatot (pl. "Az az ár, amin...") emeljük ki.
  const numeric = lines.find((l) => /\d/.test(l));
  let line = numeric ?? lines[0];

  // "Piaci ár: 62 000 000 Ft" -> a kettőspont utáni érték a lényeg.
  const afterColon = line.split(":").slice(1).join(":").trim();
  if (afterColon && /\d/.test(afterColon)) line = afterColon;

  // "kb. 62 000 000 Ft (62 M Ft)" -> az első zárójel előtti rész elég.
  const short = line.split(/[(（]/)[0].trim();
  const value = short.length > 42 ? `${short.slice(0, 42).trim()}…` : short;
  return value.replace(/[.;]$/, "");
}

/** A fejléc alatti szám-kártyák a fontos szakaszokból. */
export function reportHighlights(doc: ReportDoc): ReportHighlight[] {
  const out: ReportHighlight[] = [];
  for (const rule of HIGHLIGHT_RULES) {
    const sec = doc.sections.find((s) => !s.hidden && rule.test.test(s.heading));
    if (!sec) continue;
    const value = firstValue(sec.body);
    if (value) out.push({ label: rule.label, value, accent: rule.accent });
  }
  return out;
}

/** A lokációs korrekció szakasza (kiemelt dobozként jelenik meg). */
export function locationSection(doc: ReportDoc): ReportSection | undefined {
  return doc.sections.find((s) => !s.hidden && /lokáci/i.test(s.heading));
}

// ---------------------------------------------------------------------------
// Szerkesztő-műveletek (tiszta függvények, hogy a UI állapotkezelése egyszerű legyen)
// ---------------------------------------------------------------------------

export function updateSection(
  doc: ReportDoc,
  id: string,
  patch: Partial<Omit<ReportSection, "id">>
): ReportDoc {
  return { ...doc, sections: doc.sections.map((s) => (s.id === id ? { ...s, ...patch } : s)) };
}

export function moveSection(doc: ReportDoc, id: string, dir: -1 | 1): ReportDoc {
  const idx = doc.sections.findIndex((s) => s.id === id);
  const target = idx + dir;
  if (idx < 0 || target < 0 || target >= doc.sections.length) return doc;
  const sections = [...doc.sections];
  [sections[idx], sections[target]] = [sections[target], sections[idx]];
  return { ...doc, sections };
}

export function removeSection(doc: ReportDoc, id: string): ReportDoc {
  return { ...doc, sections: doc.sections.filter((s) => s.id !== id) };
}

export function addSection(doc: ReportDoc, afterId?: string): ReportDoc {
  const fresh: ReportSection = {
    id: nextId(),
    heading: "Új szakasz",
    body: "",
    hidden: false,
  };
  if (!afterId) return { ...doc, sections: [...doc.sections, fresh] };
  const idx = doc.sections.findIndex((s) => s.id === afterId);
  const sections = [...doc.sections];
  sections.splice(idx + 1, 0, fresh);
  return { ...doc, sections };
}
