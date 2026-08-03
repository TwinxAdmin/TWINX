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

  // Az első szakasz, ha összefoglaló, a bevezetőbe kerül (kiemelt tördeléssel).
  let intro = preamble.join("\n").trim();
  if (!intro && sections.length && /összefoglal|áttekint/i.test(sections[0].heading)) {
    intro = sections.shift()!.body.trim();
  }

  for (const s of sections) s.body = s.body.replace(/\n{3,}/g, "\n\n").trim();

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
    intro,
    sections,
    closing:
      "Ez a dokumentum tájékoztató jellegű piaci becslés, nem minősül hivatalos ingatlan-értékbecslésnek.",
  };
}

const STORE_MARKER = "twinxReport";

/** Mentés: a teljes dokumentum JSON-ként, veszteség nélkül. */
export function serializeReportDoc(doc: ReportDoc): string {
  return JSON.stringify({
    [STORE_MARKER]: 1,
    title: doc.title,
    subtitle: doc.subtitle,
    meta: doc.meta,
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
      intro: typeof o.intro === "string" ? o.intro : "",
      closing: typeof o.closing === "string" ? o.closing : "",
      sections,
    };
  } catch {
    return null;
  }
}

const HIGHLIGHT_RULES: { test: RegExp; label: string; accent?: boolean }[] = [
  // Új struktúra (2026-08): Becsült piaci érték + Értéksáv
  { test: /becsült\s*piaci\s*érték|piaci\s*érték/i, label: "Becsült piaci érték", accent: true },
  { test: /értéksáv/i, label: "Értéksáv" },
  // Visszamenőleges kompatibilitás a korábbi riportokkal
  { test: /piaci\s*ár/i, label: "Piaci ár", accent: true },
  { test: /négyzetméterár|nm-?ár/i, label: "Átlagos nm-ár" },
  { test: /gyors\s*eladási/i, label: "Gyors eladási ár" },
  { test: /eladási\s*idő/i, label: "Várható eladási idő" },
];

/** Az első értelmes érték a szakasz szövegéből (szám + mértékegység). */
function firstValue(body: string): string {
  const line = body
    .split("\n")
    .map((l) => l.replace(/^-\s*/, "").replace(/\*\*/g, "").trim())
    .find((l) => l.length > 0);
  if (!line) return "";
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
