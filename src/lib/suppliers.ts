// Vendéglátás — Beszállító-kereső (alapanyag-termelők és nagykerek felkutatása).
// Perplexity végzi az élő webes keresést; MINDEN találathoz forrás tartozik, mert a
// cégadatok és elérhetőségek elavulhatnak — a partnernek ellenőriznie kell.
// Árat szándékosan NEM szűrünk: az a partner és a beszállító megállapodása.

// --- Megyék (a területi szűréshez) -----------------------------------------
export const COUNTIES = [
  "Budapest", "Pest", "Bács-Kiskun", "Baranya", "Békés", "Borsod-Abaúj-Zemplén",
  "Csongrád-Csanád", "Fejér", "Győr-Moson-Sopron", "Hajdú-Bihar", "Heves",
  "Jász-Nagykun-Szolnok", "Komárom-Esztergom", "Nógrád", "Somogy",
  "Szabolcs-Szatmár-Bereg", "Tolna", "Vas", "Veszprém", "Zala",
] as const;

// --- Körzet (a megadott településtől) --------------------------------------
export const RADIUS_OPTIONS = [
  { value: "25", label: "25 km-en belül" },
  { value: "50", label: "50 km-en belül" },
  { value: "100", label: "100 km-en belül" },
  { value: "150", label: "150 km-en belül" },
  { value: "orszagos", label: "Országosan" },
] as const;

// --- Beszállító-típusok (többet is lehet választani) -----------------------
export const SUPPLIER_TYPES = [
  { value: "ostermelo", label: "Őstermelő / kistermelő" },
  { value: "nagyker", label: "Nagykereskedő" },
  { value: "nagybani", label: "Nagybani piac" },
  { value: "bio", label: "Bio / tanúsított" },
  { value: "feldolgozo", label: "Feldolgozó / manufaktúra" },
] as const;

export function supplierTypeLabel(v: string): string {
  return SUPPLIER_TYPES.find((t) => t.value === v)?.label ?? v;
}

// --- Bővített, strukturált szűrők (a Perplexity-prompt élesítéséhez) --------
// Tanúsítvány (több is választható) + eredet (egy).
export const CERTIFICATIONS = [
  { value: "bio", label: "BIO (EU-tanúsított)" },
  { value: "demeter", label: "Demeter / biodinamikus" },
  { value: "haccp", label: "HACCP" },
  { value: "globalgap", label: "GLOBALG.A.P." },
  { value: "ifs_brc", label: "IFS / BRC" },
  { value: "nebih", label: "NÉBIH-nyilvántartott" },
] as const;
export const ORIGIN_OPTIONS = [
  { value: "", label: "Mindegy" },
  { value: "magyar", label: "Magyar termék" },
  { value: "helyi", label: "Helyi (rövid ellátási lánc)" },
  { value: "import_ok", label: "Import is jöhet" },
] as const;

// Szállítás (mód – több is) + minimum rendelés (egy).
export const DELIVERY_MODES = [
  { value: "hazhoz", label: "Házhoz szállít" },
  { value: "atvetel", label: "Átvételi pont" },
  { value: "helyben", label: "Helyben átvehető" },
] as const;
export const MIN_ORDER_OPTIONS = [
  { value: "", label: "Mindegy" },
  { value: "kis_tetel", label: "Kis tételt is vállal" },
  { value: "nincs_magas", label: "Nincs magas minimum" },
  { value: "nagy_tetel", label: "Csak nagy tétel" },
] as const;

// Feldolgozottság (több is) + szezon/elérhetőség (egy).
export const PROCESSING_OPTIONS = [
  { value: "nyers", label: "Nyers" },
  { value: "elokeszitett", label: "Előkészített (tisztított/szeletelt)" },
  { value: "fagyasztott", label: "Fagyasztott" },
] as const;
export const SEASON_OPTIONS = [
  { value: "", label: "Mindegy" },
  { value: "szezonalis", label: "Most szezonális, helyi" },
  { value: "egesz_ev", label: "Egész évben elérhető" },
] as const;

// Rangsorolási prioritás (a Perplexity-nek: mi szerint rendezze a listát).
export const RANKING_PRIORITIES = [
  { value: "megbizhatosag", label: "Megbízhatóság / folyamatosság" },
  { value: "kozelseg", label: "Közelség" },
  { value: "ar", label: "Ár-tájékozódás" },
  { value: "bio", label: "Bio-minőség" },
  { value: "helyi", label: "Helyi, történettel" },
] as const;

// Gyakori igények (a korábbi szabad „Egyedi igény" helyett, strukturáltan).
export const COMMON_NEEDS = [
  { value: "szamlakepes", label: "Számlaképes" },
  { value: "halasztott", label: "Halasztott fizetés (15–30 nap)" },
  { value: "utanvet", label: "Utánvét" },
  { value: "horeca", label: "Éttermeknek is szállít" },
  { value: "surgos", label: "Rugalmas / sürgős rendelés" },
  { value: "keretszerzodes", label: "Keretszerződés lehetséges" },
  { value: "minta", label: "Mintát ad" },
] as const;

// Egységes címke-kereső a fenti listákhoz.
type Opt = { value: string; label: string };
function labelOf(list: readonly Opt[], v: string): string {
  return list.find((o) => o.value === v)?.label ?? v;
}
export const certificationLabel = (v: string) => labelOf(CERTIFICATIONS, v);
export const originLabel = (v: string) => labelOf(ORIGIN_OPTIONS, v);
export const deliveryModeLabel = (v: string) => labelOf(DELIVERY_MODES, v);
export const minOrderLabel = (v: string) => labelOf(MIN_ORDER_OPTIONS, v);
export const processingLabel = (v: string) => labelOf(PROCESSING_OPTIONS, v);
export const seasonOptLabel = (v: string) => labelOf(SEASON_OPTIONS, v);
export const rankingLabel = (v: string) => labelOf(RANKING_PRIORITIES, v);
export const commonNeedLabel = (v: string) => labelOf(COMMON_NEEDS, v);

// --- PRO (mély kutatás) --------------------------------------------------
// A PRO mód a Perplexity legmélyebb keresőmodelljét használja, aszinkron módon
// (hosszabb futás, több forrás) — a kredit duplázódik.
export const SUPPLIER_DEEP_MODEL = "sonar-deep-research";
export function proMultiplier(pro: boolean): number {
  return pro ? 2 : 1;
}
export function creditsForCountPro(count: number, pro: boolean): number {
  return creditsForCount(count) * proMultiplier(pro);
}

// --- Mennyiség és gyakoriság (strukturáltan, hogy a prompt egyértelmű legyen) ---
export const QTY_UNITS = [
  { value: "kg", label: "kg" },
  { value: "l", label: "liter" },
  { value: "db", label: "darab" },
  { value: "lada", label: "láda" },
  { value: "raklap", label: "raklap" },
] as const;

export const FREQUENCIES = [
  { value: "napi", label: "naponta" },
  { value: "heti", label: "hetente" },
  { value: "ketheti", label: "kéthetente" },
  { value: "havi", label: "havonta" },
  { value: "alkalmi", label: "alkalmanként" },
] as const;

export function qtyUnitLabel(v: string): string {
  return QTY_UNITS.find((u) => u.value === v)?.label ?? v;
}
export function frequencyLabel(v: string): string {
  return FREQUENCIES.find((f) => f.value === v)?.label ?? v;
}

// A strukturált mezőkből egyértelmű, rövid mondat: „hetente 50 kg".
export function volumeLabel(q: { qty?: number; qtyUnit?: string; frequency?: string }): string {
  const amount = Number(q.qty) || 0;
  if (amount <= 0) return "";
  const unit = qtyUnitLabel(q.qtyUnit ?? "kg");
  const freq = q.frequency ? frequencyLabel(q.frequency) : "";
  return freq ? `${freq} ${amount} ${unit}` : `${amount} ${unit}`;
}

// --- Találatszám és kredit-ár ----------------------------------------------
// A partner dönti el, milyen mélyre megyünk: több találat = több kutatás = több kredit.
export const SUPPLIER_PLANS = [
  { count: 3, credits: 1, label: "3 találat" },
  { count: 6, credits: 2, label: "6 találat" },
  { count: 9, credits: 3, label: "9 találat" },
] as const;

export function creditsForCount(count: number): number {
  return SUPPLIER_PLANS.find((p) => p.count === count)?.credits ?? 1;
}
export function isValidCount(count: unknown): boolean {
  return SUPPLIER_PLANS.some((p) => p.count === Number(count));
}

// --- Típusok ---------------------------------------------------------------
export type SupplierQuery = {
  what: string;          // mit keres (alapanyag vagy kategória)
  county: string;        // megye
  city: string;          // település (opcionális, a körzet ehhez képest értendő)
  radius: string;        // km vagy "orszagos"
  types: string[];       // beszállító-típusok
  qty: number;           // mennyiség (szám)
  qtyUnit: string;       // mértékegység (kg / l / db / láda / raklap)
  frequency: string;     // gyakoriság (napi / heti / kétheti / havi / alkalmi)
  // Bővített szűrők:
  certifications?: string[]; // elvárt tanúsítványok (BIO, HACCP…)
  origin?: string;           // eredet preferencia (magyar/helyi/import_ok)
  deliveryModes?: string[];  // szállítási mód (házhoz/átvételi pont/helyben)
  minOrder?: string;         // minimum rendelés preferencia
  processing?: string[];     // feldolgozottság (nyers/előkészített/fagyasztott)
  season?: string;           // szezon/elérhetőség
  ranking?: string;          // rangsorolási prioritás
  needs?: string[];          // strukturált gyakori igények (számlaképes, halasztott…)
  customCriteria?: string[]; // saját szempontok (szabad szöveg)
  notes?: string;            // régi szabad „egyedi igény" (visszafelé kompatibilitás)
  count: number;         // hány találatot kérünk
  exclude?: string[];    // már ismert beszállítók — ezeket NE adja vissza újra
};

export type Supplier = {
  name: string;
  location: string;      // település / megye
  distance?: string;     // pl. "kb. 30 km"
  offering: string;      // mit kínál
  phone?: string;
  email?: string;
  website?: string;
  why: string;           // miért illik a partnerhez
  source?: string;       // forrás URL
};

export type SupplierExtras = {
  season?: string;       // szezonalitási megjegyzés
  market?: string;       // piaci helyzet / hol nézhet árakat
  tips?: string[];       // tárgyalási tippek
  outreach?: string;     // kész megkereső üzenet sablon
};

export type SupplierResult = {
  suppliers: Supplier[];
  extras: SupplierExtras;
};

// --- AI prompt (admin által szerkeszthető szegmensek) ----------------------
export const SUPPLIER_DEFAULT_SEGMENTS = {
  intro: `Te egy magyar vendéglátóipari beszerzési szakértő vagy, aki alapanyag-beszállítókat kutat fel éttermeknek. Valós, ellenőrizhető forrásokból dolgozz: keress konkrét, LÉTEZŐ termelőket, nagykereskedőket vagy piacokat. SOHA ne találj ki céget, telefonszámot vagy e-mail címet — ha egy adatot nem találsz meg, hagyd üresen. Minden találathoz adj meg forrás-URL-t, ahonnan az információ származik.`,
  task: `Válaszolj KIZÁRÓLAG érvényes JSON-nal, magyarázó szöveg nélkül, ebben a szerkezetben:
{"suppliers":[{"name":"","location":"","distance":"","offering":"","phone":"","email":"","website":"","why":"","source":""}],"extras":{"season":"","market":"","tips":["",""],"outreach":""}}
A "why" egy mondatban indokolja, miért illik ez a beszállító a megadott igényhez. A "season" jelezze, ha a keresett alapanyag épp nem szezonális, és mikor a legjobb beszerezni. A "market" mondja meg, hol tájékozódhat a partner az aktuális piaci árakról (pl. Budapesti Nagybani Piac heti árjegyzése, AKI PÁIR). A "tips" 2-3 rövid, gyakorlatias tárgyalási tanács. Az "outreach" egy kész, udvarias magyar megkereső üzenet, amit a partner kimásolhat és elküldhet a beszállítónak — hivatkozzon a keresett alapanyagra és a mennyiségre.`,
};

export const SUPPLIER_DATA_BLOCK_PREVIEW = `Keresési feltételek:
{mit keres + terület + körzet + beszállító-típusok + mennyiség + egyedi igény + találatszám}`;

// A zárolt adat-blokk összeállítása a tényleges keresési feltételekből.
export function composeSupplierPrompt(
  q: SupplierQuery,
  segments: { intro?: string; task?: string }
): string {
  const intro = (segments.intro ?? SUPPLIER_DEFAULT_SEGMENTS.intro).trim();
  const task = (segments.task ?? SUPPLIER_DEFAULT_SEGMENTS.task).trim();

  const area =
    q.radius === "orszagos"
      ? "Országosan keress, de a földrajzilag közelebbieket sorold előre."
      : `Elsősorban ${q.city ? `${q.city} (${q.county})` : q.county} környékén, kb. ${q.radius} km-es körzetben keress.`;

  const rankPref = q.ranking ? rankingLabel(q.ranking) : "";

  const lines = [
    `Keresett alapanyag / kategória: ${q.what}`,
    `Terület: ${q.county}${q.city ? `, ${q.city}` : ""}`,
    area,
    q.types.length
      ? `Milyen típusú beszállító érdekli: ${q.types.map(supplierTypeLabel).join(", ")}.`
      : `Bármilyen típusú beszállító érdekli (termelő, nagyker, piac).`,
    volumeLabel(q) ? `Tervezett beszerzési mennyiség: ${volumeLabel(q)}.` : "",
    // Bővített szűrők — minél konkrétabb, annál élesebb a találat.
    q.certifications?.length ? `Elvárt tanúsítvány(ok): ${q.certifications.map(certificationLabel).join(", ")}.` : "",
    q.origin ? `Eredet preferencia: ${originLabel(q.origin)}.` : "",
    q.deliveryModes?.length ? `Szállítási mód: ${q.deliveryModes.map(deliveryModeLabel).join(", ")}.` : "",
    q.minOrder ? `Minimum rendelés: ${minOrderLabel(q.minOrder)}.` : "",
    q.processing?.length ? `Feldolgozottság: ${q.processing.map(processingLabel).join(", ")}.` : "",
    q.season ? `Szezon / elérhetőség: ${seasonOptLabel(q.season)}.` : "",
    q.needs?.length ? `További elvárások: ${q.needs.map(commonNeedLabel).join(", ")}.` : "",
    q.customCriteria?.length ? `Egyedi szempontok: ${q.customCriteria.join("; ")}.` : "",
    q.notes ? `Megjegyzés: ${q.notes}` : "",
    `Ennyi találatot adj: PONTOSAN ${q.count} darab (ha kevesebb valódi találat van, inkább adj kevesebbet, mint kitaláltat).`,
    `A megrendelő egy étterem, tehát olyan beszállítókat keress, akik éttermeknek is szállítanak és számlaképesek.`,
    rankPref ? `A találatokat elsősorban a következő szempont szerint rangsorold: ${rankPref}.` : "",
    // A partner ne fizessen kétszer ugyanazokért a nevekért: a már ismerteket kizárjuk.
    q.exclude?.length
      ? `FONTOS: az alábbi beszállítókat a partner MÁR ISMERI egy korábbi keresésből, ezeket NE sorold fel újra — keress helyettük MÁSOKAT: ${q.exclude.join("; ")}.`
      : "",
    // Változatosság: ne mindig ugyanaz a néhány, jól indexelt nagyker jöjjön vissza.
    `Merítsd a találatokat többféle forrásból: cégkatalógusok mellett nézd a helyi termelői piacok kiállítói listáit, agrárkamarai és őstermelői nyilvántartásokat, gazdaboltokat, termelői közösségeket és szakmai beszerzési csoportokat is. Kerüld, hogy csak a legnagyobb, legismertebb nagykereskedők szerepeljenek.`,
  ].filter(Boolean);

  return `${intro}\n\nKeresési feltételek:\n${lines.join("\n")}\n\n${task}`;
}

// Az AI JSON-válaszának biztonságos feldolgozása (körbeírt szöveg esetén is).
export function parseSupplierResponse(raw: string, max: number): SupplierResult {
  const empty: SupplierResult = { suppliers: [], extras: {} };
  if (!raw) return empty;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return empty;
  try {
    const o = JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
    const list = Array.isArray(o.suppliers) ? (o.suppliers as Record<string, unknown>[]) : [];
    const str = (v: unknown) => String(v ?? "").trim();
    const suppliers: Supplier[] = list
      .map((s) => ({
        name: str(s.name),
        location: str(s.location),
        distance: str(s.distance) || undefined,
        offering: str(s.offering),
        phone: str(s.phone) || undefined,
        email: str(s.email) || undefined,
        website: str(s.website) || undefined,
        why: str(s.why),
        source: str(s.source) || undefined,
      }))
      .filter((s) => s.name)
      .slice(0, max);

    const e = (o.extras ?? {}) as Record<string, unknown>;
    const extras: SupplierExtras = {
      season: str(e.season) || undefined,
      market: str(e.market) || undefined,
      tips: Array.isArray(e.tips) ? (e.tips as unknown[]).map(str).filter(Boolean).slice(0, 5) : undefined,
      outreach: str(e.outreach) || undefined,
    };
    return { suppliers, extras };
  } catch {
    return empty;
  }
}
