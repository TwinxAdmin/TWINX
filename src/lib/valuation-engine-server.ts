// Szerver-oldali kötőréteg a comp-alapú értékbecslő motorhoz:
// - aktív config betöltése a DB-ből (fallback a beépített alapértékre),
// - a Perplexitytől kért JSON-only comps prompt,
// - a válasz JSON-comps kinyerése,
// - a ValuationInput → Subject leképezés,
// - a motor eredményéből szerkeszthető (a riport-parserrel kompatibilis) markdown.
import { createAdminClient } from "@/lib/supabase/admin";
import { type ValuationInput } from "@/lib/valuation";
import {
  DEFAULT_ENGINE_CONFIG, conditionKey, computeValuation, normalizeComps,
  type EngineConfig, type RawComp, type Subject, type EngineResult,
} from "@/lib/valuation-engine";

/** Beérkező (rész)config összefésülése a beépített alapértékkel — hiányzó kulcsok pótlása. */
export function mergeConfig(p: Partial<EngineConfig> | undefined | null): EngineConfig {
  const d = DEFAULT_ENGINE_CONFIG;
  const q = (p ?? {}) as Partial<EngineConfig>;
  return {
    engine: { mode: q.engine?.mode === "on" ? "on" : "off" },
    comp: { ...d.comp, ...q.comp },
    outlier: { ...d.outlier, ...q.outlier },
    central: { ...d.central, ...q.central },
    adjust: {
      condition: { ...d.adjust.condition, ...q.adjust?.condition },
      location_premium_pct: q.adjust?.location_premium_pct ?? d.adjust.location_premium_pct,
      floor_ground_pct: q.adjust?.floor_ground_pct ?? d.adjust.floor_ground_pct,
      floor_basement_pct: q.adjust?.floor_basement_pct ?? d.adjust.floor_basement_pct,
      floor_high_nolift_pct: q.adjust?.floor_high_nolift_pct ?? d.adjust.floor_high_nolift_pct,
      lift_pct: q.adjust?.lift_pct ?? d.adjust.lift_pct,
      balcony_pct: q.adjust?.balcony_pct ?? d.adjust.balcony_pct,
    },
    realism: { ...d.realism, ...q.realism },
    rounding: { ...d.rounding, ...q.rounding },
    cache: { ...d.cache, ...q.cache },
    fallback: { ...d.fallback, ...q.fallback },
  };
}

/** Aktív config a DB-ből; hiányzó csoportokat a beépített alapértékkel pótol. */
export async function loadActiveEngineConfig(): Promise<EngineConfig> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("valuation_engine_configs")
      .select("params")
      .eq("is_active", true)
      .maybeSingle();
    return mergeConfig(data?.params as Partial<EngineConfig> | undefined);
  } catch {
    return DEFAULT_ENGINE_CONFIG;
  }
}

export type ConfigVersion = { id: string; version: number; is_active: boolean; note: string | null; created_at: string; params: EngineConfig };

/** A verziók listája (legújabb elöl) + az aktív config. */
export async function listConfigVersions(): Promise<{ active: EngineConfig; versions: ConfigVersion[] }> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("valuation_engine_configs")
    .select("id, version, is_active, note, created_at, params")
    .order("version", { ascending: false });
  const versions = (data ?? []).map((r) => ({ ...r, params: mergeConfig(r.params as Partial<EngineConfig>) })) as ConfigVersion[];
  const active = versions.find((v) => v.is_active)?.params ?? DEFAULT_ENGINE_CONFIG;
  return { active, versions };
}

/** Új verzió mentése + aktiválása (a régi aktív kikapcsolása). */
export async function saveNewConfigVersion(params: Partial<EngineConfig>, note?: string): Promise<{ version: number }> {
  const admin = createAdminClient();
  const merged = mergeConfig(params);
  const { data: maxRow } = await admin.from("valuation_engine_configs").select("version").order("version", { ascending: false }).limit(1).maybeSingle();
  const nextVersion = ((maxRow?.version as number) ?? 0) + 1;
  await admin.from("valuation_engine_configs").update({ is_active: false }).eq("is_active", true);
  await admin.from("valuation_engine_configs").insert({ version: nextVersion, is_active: true, params: merged, note: note ?? null });
  return { version: nextVersion };
}

/** Egy korábbi verzió újraaktiválása. */
export async function activateConfigVersion(id: string): Promise<void> {
  const admin = createAdminClient();
  await admin.from("valuation_engine_configs").update({ is_active: false }).eq("is_active", true);
  await admin.from("valuation_engine_configs").update({ is_active: true }).eq("id", id);
}

/** Vissza a beépített alapértékre (új verzióként). */
export async function resetConfigToDefault(): Promise<{ version: number }> {
  return saveNewConfigVersion(DEFAULT_ENGINE_CONFIG, "Visszaállítás az alapértékre");
}

/** Nem aktív verzió törlése (az aktívat nem lehet). */
export async function deleteConfigVersion(id: string): Promise<void> {
  const admin = createAdminClient();
  const { data } = await admin.from("valuation_engine_configs").select("is_active").eq("id", id).maybeSingle();
  if (!data) throw new Error("A verzió nem található.");
  if (data.is_active) throw new Error("Az aktív verzió nem törölhető — előbb aktíválj másikat.");
  await admin.from("valuation_engine_configs").delete().eq("id", id);
}

/** Verzió átnevezése (a megjegyzés/címke módosítása). */
export async function renameConfigVersion(id: string, note: string): Promise<void> {
  const admin = createAdminClient();
  await admin.from("valuation_engine_configs").update({ note: note.trim() || null }).eq("id", id);
}

function parseSize(meret: string): number {
  const m = String(meret ?? "").match(/\d+([.,]\d+)?/);
  return m ? Number(m[0].replace(",", ".")) : 0;
}

/** "Budapest XIII. kerület" / "13. kerület" → kerület-jelölés a comp-szűréshez. */
function districtOf(telepules: string): string {
  const t = String(telepules ?? "");
  const roman = t.match(/\b([IVXLC]{1,6})\.?\s*ker/i);
  if (roman) return roman[1].toUpperCase();
  const arab = t.match(/\b(\d{1,2})\.?\s*ker/i);
  if (arab) return arab[1];
  return "";
}

/** A lakás emelete stringből számot: Földszint/Magasföldszint/Szuterén→0, "N. emelet"→N, Tetőtér→magas (99), üres→null. */
function parseFloorNum(emelet: string): number | null {
  const s = String(emelet ?? "").trim().toLowerCase();
  if (!s) return null;
  if (/szuter[ée]n/.test(s)) return 0;
  if (/magasf[öo]ldszint/.test(s)) return 0;
  if (/f[öo]ldszint/.test(s)) return 0;
  if (/tet[őo]t[ée]r/.test(s)) return 99;
  const m = s.match(/(\d+)/);
  return m ? Number(m[1]) : null;
}

/** Szuterén / alagsor (a földszintnél lényegesen rosszabb fekvés). */
export function isBasementFloor(emelet: string): boolean {
  return /szuter[ée]n|alagsor|souterrain/i.test(String(emelet ?? ""));
}

export function buildSubject(input: ValuationInput, photoCorrectionPct = 0): Subject {
  return {
    sizeM2: parseSize(input.meret),
    conditionKey: conditionKey(input.allapot),
    locationPremiumPct: Number(String(input.lokacioSzazalek ?? "").replace(/[^\d.-]/g, "")) || 0,
    photoCorrectionPct,
    isBudapest: /budapest/i.test(input.telepules),
    district: districtOf(input.telepules),
    floorNum: parseFloorNum(input.emelet),
    isBasement: isBasementFloor(input.emelet),
    hasLift: input.lift === "igen",
    hasBalcony: input.erkely === "igen",
  };
}

/** A Perplexitynek adott prompt: KIZÁRÓLAG comp-adatokat kérünk, JSON-ban. */
export function buildCompsPrompt(input: ValuationInput, cfg: EngineConfig): string {
  const size = parseSize(input.meret);
  const hely = [input.telepules, input.utca].filter(Boolean).join(", ");
  const want = Math.max(cfg.comp.min_count + 8, 15);
  return [
    "Te egy magyar ingatlanpiaci adatgyűjtő vagy. NE becsülj árat, NE írj elemzést, NE kommentálj.",
    `Gyűjts össze LEGALÁBB ${want} db, jelenleg ELADÓ vagy nemrég eladott, a megadotthoz HASONLÓ ingatlant erről a környékről: ${hely}.`,
    `A vizsgált ingatlan: ${input.tipus || "lakás"}, kb. ${size} m², ${input.szobak || "?"} szoba.`,
    "CSAK FRISS adatot használj: kizárólag az ELMÚLT 12 HÓNAP eladó/eladott hirdetéseit. Régebbi (pl. 1 évnél idősebb) forrást, cikket, archív adatot NE vegyél be.",
    "Hasonló = ugyanaz a kerület vagy közvetlen szomszédos utcák, hasonló méret (akár ±40% is jó, hogy legyen elég találat), azonos vagy hasonló típus.",
    "MINDEN comphoz KÖTELEZŐ a valós alapterület (size_m2) ÉS a teljes ár (price_huf) — e nélkül ne vedd bele. A price_per_m2-t számold ki, ha nincs megadva.",
    "A 'district' mezőbe a kerület SZÁMÁT írd (pl. \"13\" vagy \"XIII\"). A 'listing_date' formátuma YYYY-MM.",
    "Legalább 8-10 KONKRÉT, valós hirdetést/eladást adj vissza forrás-URL-lel. Inkább több comp, mint kevesebb.",
    "A válaszod KIZÁRÓLAG egyetlen JSON objektum legyen, más szöveg nélkül:",
    `{"comps":[{"address":"","district":"","size_m2":0,"price_huf":0,"price_per_m2":0,"rooms":"","condition":"","floor":"","listing_date":"YYYY-MM","url":"","distance_note":""}],"notes":""}`,
  ].join("\n");
}

// A partnernek szánt riportból (és így a PDF-ből) NE jelenjenek meg a belső,
// módszertani szakaszok: korlátozások, szűrési/lazítási elvek, kizárt comp-ok.
// (Az adatokat a folyamat továbbra is begyűjti és felhasználja — csak a kimenetből
// hagyjuk ki.) A szakaszokat "## " címsor alapján bontjuk és a nem kívántakat kivesszük.
const HIDE_SECTION = /korlátoz|szűrési elv|lazít|tágít|kizárt össze|súlyozás/i;
export function stripHiddenReportSections(md: string): string {
  const parts = String(md ?? "").split(/(?=^##\s)/m);
  return parts
    .filter((p) => {
      const m = p.match(/^##\s*(.+)/);
      return !m || !HIDE_SECTION.test(m[1]);
    })
    .join("")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Gyorsítótár-kulcs az ingatlanból (stabil, kisbetűs, ékezet/whitespace nélkül). */
export function compsCacheKey(input: ValuationInput): string {
  const raw = [input.telepules, input.utca, parseSize(input.meret), input.tipus].join("|").toLowerCase();
  return raw.normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9|]/g, "");
}

/** Friss comp-halmaz a gyorsítótárból (a megadott napon belül), különben null. */
export async function getCachedComps(key: string, days: number): Promise<RawComp[] | null> {
  if (days <= 0) return null;
  try {
    const admin = createAdminClient();
    const { data } = await admin.from("valuation_comps_cache").select("comps, created_at").eq("cache_key", key).maybeSingle();
    if (!data) return null;
    const ageMs = Date.now() - new Date(data.created_at as string).getTime();
    if (ageMs > days * 24 * 60 * 60 * 1000) return null;
    return (data.comps as RawComp[]) ?? null;
  } catch { return null; }
}

/** Comp-halmaz eltárolása a gyorsítótárba (best-effort). */
export async function setCachedComps(key: string, comps: RawComp[]): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.from("valuation_comps_cache").upsert({ cache_key: key, comps, created_at: new Date().toISOString() });
  } catch { /* best-effort */ }
}

/** A Perplexity szövegéből kinyeri a comps tömböt (kódblokk / körítő szöveg tűrve). */
export function parseCompsJson(raw: string): RawComp[] {
  let t = String(raw ?? "").trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start >= 0 && end > start) t = t.slice(start, end + 1);
  try {
    const o = JSON.parse(t) as { comps?: RawComp[] };
    return Array.isArray(o.comps) ? o.comps : [];
  } catch {
    return [];
  }
}

const ft = (n: number) => `${Math.round(n).toLocaleString("hu-HU")} Ft`;

const has = (v: unknown): boolean => {
  const s = String(v ?? "").trim();
  return Boolean(s) && !/^nincs|n\/a|^-+$/i.test(s);
};

/** Determinisztikus SWOT az űrlap-adatokból (ugyanaz a bemenet → ugyanaz a SWOT). */
export function buildSwot(input: ValuationInput): { s: string[]; w: string[]; o: string[]; t: string[] } {
  const size = parseSize(input.meret);
  const cond = conditionKey(input.allapot);
  const year = (input.epitesEve ?? "").match(/\d{4}/)?.[0];
  const yearNum = year ? Number(year) : 0;
  const locPct = Number(String(input.lokacioSzazalek ?? "").replace(/[^\d.-]/g, "")) || 0;
  const s: string[] = [], w: string[] = [], o: string[] = [], t: string[] = [];

  if (size) s.push(`${size} m² alapterület`);
  if (has(input.szobak)) s.push(String(input.szobak).trim());
  if (cond === "jo" || cond === "ujszeru") s.push(`${input.allapot} állapot`.trim());
  if (has(input.telek) && !/nincs/i.test(input.telek)) s.push(`${input.telek} telek`);
  if (/kiváló|jó/i.test(input.lokacioKategoria ?? "") || locPct > 0) s.push(`Kedvező mikrolokáció${has(input.utca) ? ` (${input.utca})` : ""}`);
  if (/tégla/i.test(input.szerkezet ?? "")) s.push("Tégla szerkezet");
  if (input.lift === "igen") s.push("Lift az épületben");
  if (input.erkely === "igen") s.push("Erkély / terasz");
  if (has(input.egyeb)) s.push(String(input.egyeb).slice(0, 60).trim());
  if (!s.length) s.push("Keresett településrész");

  if (cond === "kozepes") w.push("Közepes állapot, korszerűsítési igény");
  if (cond === "felujitando") w.push("Felújítandó, jelentős ráfordítás igénye");
  if (yearNum && yearNum < 1990) w.push(`${year}-es építés (idősebb ingatlan)`);
  if (size && size < 45) w.push("Kisebb alapterület");
  if (isBasementFloor(input.emelet)) w.push("Szuterén / alagsori fekvés (szűkebb vevőkör, kedvezőtlenebb megvilágítás)");
  { const fl = parseFloorNum(input.emelet); if (fl !== null && fl >= 3 && input.lift !== "igen") w.push("Magas emelet lift nélkül"); }
  if (!w.length) w.push("A szegmens árérzékeny lehet");

  if (cond === "kozepes" || cond === "felujitando") o.push("Felújítás utáni árnövekedés");
  if ((size && size >= 75) || /[3-9]|több/i.test(input.szobak ?? "")) o.push("Vonzó a családos vevők számára");
  o.push("Bérbeadási / befektetési potenciál a lokáció alapján");

  if (cond === "kozepes" || cond === "felujitando") t.push("Azonnal lakható, jobb állapotú alternatívák versenye");
  if (/osztatlan|haszonélvez|\bper\b|teher/i.test(input.jogi ?? "")) t.push("A jogi helyzet szűkítheti a vevőkört");
  t.push("Piaci árváltozás és a kamatkörnyezet hatása");

  return { s, w, o, t };
}
const swotList = (xs: string[]) => xs.filter(Boolean).map((x) => `- ${x}`).join("\n");

/** A motor eredményéből a riport-parserrel kompatibilis, szerkeszthető markdown. */
export function composeEngineReport(res: EngineResult, input: ValuationInput, cfg: EngineConfig): string {
  const used = res.comps.filter((c) => c.kept);
  const size = parseSize(input.meret);
  const step = cfg.rounding.step_huf || 1000;
  const round = (v: number) => Math.round(v / step) * step;
  const estimate = res.estimateHuf;
  // Három ártier: kínálati (magasabb, hirdethető) → hirdetett/reális → gyors eladási.
  const asking = round(estimate / (1 + cfg.realism.asking_to_tx_pct / 100));
  const quick = round(estimate * 0.92);

  const lines: string[] = [];
  // FELÜL: a kiemelt árak.
  lines.push(`## Becsült piaci érték`, ft(estimate), "");
  lines.push(`## Kínálati ár`, ft(asking), "");
  lines.push(`## Hirdetett eladási ár`, ft(estimate), "");
  lines.push(`## Gyors eladási ár`, ft(quick), "");
  lines.push(`## Értéksáv`, `${ft(res.lowHuf)} – ${ft(res.highHuf)}`, "");
  lines.push(`## Átlagos nm-ár`, `${res.centralPricePerM2.toLocaleString("hu-HU")} Ft/m²`, "");
  lines.push(
    `## Rövid összefoglaló`,
    `A becslés ${used.length} hasonló, a környéken talált ingatlan négyzetméterárának mediánjából indul (${res.centralPricePerM2.toLocaleString("hu-HU")} Ft/m²), amelyet a lakás mérete (${size} m²), állapota és a piaci korrekciók módosítanak. A számítás determinisztikus és átlátható.`,
    "",
  );
  lines.push(`## Összehasonlító ingatlanok`);
  for (const c of used) {
    lines.push(`- ${c.address || "ismeretlen cím"} · ${c.sizeM2} m² · ${Math.round(c.pricePerM2).toLocaleString("hu-HU")} Ft/m²${c.condition ? ` · ${c.condition}` : ""}`);
  }
  lines.push("");
  lines.push(`## Számítás levezetése`);
  for (const s of res.steps) {
    const pctTxt = s.deltaPct ? ` (${s.deltaPct > 0 ? "+" : ""}${s.deltaPct}%)` : "";
    const hufTxt = s.deltaHuf === 0 ? "" : `: ${s.deltaHuf > 0 ? "+" : ""}${ft(s.deltaHuf)}`;
    lines.push(`- ${s.label}${pctTxt}${hufTxt}`);
  }
  const excluded = res.comps.filter((c) => !c.kept);
  if (excluded.length) {
    lines.push("", `## Kizárt összehasonlítók`);
    for (const c of excluded) lines.push(`- ${c.address || "ismeretlen"} — ${c.reason}`);
  }
  // LEGALUL: SWOT-analízis.
  const sw = buildSwot(input);
  lines.push(
    "", `## SWOT-analízis`,
    `**Erősség:**`, swotList(sw.s),
    `**Gyengeség:**`, swotList(sw.w),
    `**Lehetőség:**`, swotList(sw.o),
    `**Kockázat:**`, swotList(sw.t),
  );
  return lines.join("\n");
}
