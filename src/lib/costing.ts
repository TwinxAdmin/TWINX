// Vendéglátás — Önköltség & profit modul: típusok + számítás.
// Két réteg: (A) étel-szintű alapanyagköltség (a partner ételeiből), (B) étteremszintű
// fix rezsi, amit ELOSZTUNK az ételekre a forgalmuk (árbevétel-részesedés) szerint.
// A számítás determinisztikus; az AI csak a szöveges javaslatot adja a route-ban.
import { formatHuf } from "@/lib/hospitality";

// --- Étteremszintű fix költség-profil (havi kiadások) -----------------------
export type ExtraItem = { label: string; amount: number };

export type CostProfile = {
  rent: number;
  wages: number;
  utilities: number;
  insurance: number;
  accounting: number;
  marketing: number;
  depreciation: number;
  bank_fees: number;
  delivery_fees: number;
  other: number;
  extra_items: ExtraItem[];
};

// A standard mezők megjelenítési sorrendben (UI + összegzés).
export const COST_FIELDS: { key: keyof Omit<CostProfile, "extra_items">; label: string; hint?: string }[] = [
  { key: "rent", label: "Bérleti díj", hint: "Helyiség havi bérlete" },
  { key: "wages", label: "Bérek + járulékok", hint: "Konyha és felszolgálás bruttó bér + közterhek" },
  { key: "utilities", label: "Rezsi", hint: "Áram, gáz, víz, fűtés" },
  { key: "insurance", label: "Biztosítás", hint: "Vagyon- és felelősségbiztosítás" },
  { key: "accounting", label: "Könyvelő / admin", hint: "Könyvelés, adminisztráció" },
  { key: "marketing", label: "Marketing", hint: "Hirdetés, közösségi média, nyomtatás" },
  { key: "depreciation", label: "Eszköz-amortizáció", hint: "Gépek, berendezés havi értékcsökkenése" },
  { key: "bank_fees", label: "Bankköltség / kártyadíj", hint: "Számla- és kártyaelfogadási díjak" },
  { key: "delivery_fees", label: "Kiszállítói jutalék (Wolt / Foodora)", hint: "A kiszállító cégek havi jutaléka / díja" },
  { key: "other", label: "Egyéb fix költség", hint: "Takarítás, előfizetések, engedélyek…" },
];

export const EMPTY_COST_PROFILE: CostProfile = {
  rent: 0, wages: 0, utilities: 0, insurance: 0, accounting: 0,
  marketing: 0, depreciation: 0, bank_fees: 0, delivery_fees: 0, other: 0, extra_items: [],
};

// Havi összes fix költség (standard mezők + egyedi tételek).
export function costProfileTotal(p: CostProfile): number {
  let sum = 0;
  for (const f of COST_FIELDS) sum += Number(p[f.key]) || 0;
  for (const e of p.extra_items ?? []) sum += Number(e.amount) || 0;
  return sum;
}

// Nyers érték -> nem-negatív szám (üres/hibás = 0).
export function toAmount(raw: unknown): number {
  const s = String(raw ?? "").trim().replace(/\s/g, "").replace(",", ".");
  if (!s) return 0;
  const n = Number(s);
  return isNaN(n) || n < 0 ? 0 : n;
}

// Beérkező (bármilyen) objektumból tiszta CostProfile.
export function normalizeCostProfile(raw: Record<string, unknown> | null | undefined): CostProfile {
  const r = raw ?? {};
  const extra = Array.isArray(r.extra_items)
    ? (r.extra_items as unknown[])
        .map((e) => {
          const o = (e ?? {}) as Record<string, unknown>;
          return { label: String(o.label ?? "").trim().slice(0, 60), amount: toAmount(o.amount) };
        })
        .filter((e) => e.label && e.amount > 0)
        .slice(0, 20)
    : [];
  const out = { ...EMPTY_COST_PROFILE, extra_items: extra } as CostProfile;
  for (const f of COST_FIELDS) out[f.key] = toAmount(r[f.key]);
  return out;
}

// --- Étel-szintű bemenet a kalkulációhoz ------------------------------------
export type CostingDishInput = {
  dish_id: string;
  name: string;
  category?: string | null;
  cost_price: number; // alapanyag/előkészítési önköltség (adag)
  sale_price: number; // eladási ár (adag)
  monthly_qty: number; // várható havi eladott darab
};

// Egy étel számított eredménye.
export type DishCosting = {
  dish_id: string;
  name: string;
  category?: string | null;
  cost_price: number;
  sale_price: number;
  monthly_qty: number;
  revenue: number;            // havi árbevétel (qty × ár)
  ingredientCost: number;     // havi alapanyagköltség (qty × önköltség)
  overheadShare: number;      // rá jutó havi rezsi (allokáció)
  overheadPerUnit: number;    // rezsi / adag
  fullUnitCost: number;       // teljes önköltség / adag (alapanyag + rezsi)
  unitProfit: number;         // valós darab-profit (ár − teljes önköltség)
  unitMarginPct: number;      // valós árrés %
  monthlyProfit: number;      // havi valós profit erre az ételre
  breakevenQty: number;       // ennyi adag fedezi a rá jutó rezsit
};

export type AllocationMethod = "revenue" | "unit";

export type CostingResult = {
  dishes: DishCosting[];
  totals: {
    overhead: number;         // havi összes fix költség
    revenue: number;          // összes havi árbevétel
    ingredientCost: number;   // összes havi alapanyagköltség
    grossProfit: number;      // árbevétel − alapanyag (fedezet)
    netProfit: number;        // árbevétel − alapanyag − rezsi (étterem valós profit)
    totalQty: number;         // összes havi adag
    coveredOverhead: number;  // a bevitt ételekre allokált rezsi összege
  };
  method: AllocationMethod;
};

// Fő számítás: étel-szintű önköltség + étteremszintű rezsi-allokáció.
// overhead: havi összes fix költség. method: "revenue" (árbevétel-arányos) v. "unit" (darab-arányos).
export function computeCosting(
  dishes: CostingDishInput[],
  overhead: number,
  method: AllocationMethod = "revenue"
): CostingResult {
  const totalRevenue = dishes.reduce((s, d) => s + d.sale_price * d.monthly_qty, 0);
  const totalQty = dishes.reduce((s, d) => s + d.monthly_qty, 0);
  const totalIngredient = dishes.reduce((s, d) => s + d.cost_price * d.monthly_qty, 0);

  const out: DishCosting[] = dishes.map((d) => {
    const revenue = d.sale_price * d.monthly_qty;
    const ingredientCost = d.cost_price * d.monthly_qty;
    // Allokációs súly: árbevétel-részesedés vagy darab-részesedés.
    let weight = 0;
    if (method === "revenue") weight = totalRevenue > 0 ? revenue / totalRevenue : 0;
    else weight = totalQty > 0 ? d.monthly_qty / totalQty : 0;
    const overheadShare = overhead * weight;
    const overheadPerUnit = d.monthly_qty > 0 ? overheadShare / d.monthly_qty : 0;
    const fullUnitCost = d.cost_price + overheadPerUnit;
    const unitProfit = d.sale_price - fullUnitCost;
    const unitMarginPct = d.sale_price > 0 ? (unitProfit / d.sale_price) * 100 : 0;
    const monthlyProfit = unitProfit * d.monthly_qty;
    // Fedezeti darab: a rá jutó rezsit hány adag fedezi (ár − alapanyag = adag-fedezet).
    const unitContribution = d.sale_price - d.cost_price;
    const breakevenQty = unitContribution > 0 ? Math.ceil(overheadShare / unitContribution) : 0;
    return {
      dish_id: d.dish_id, name: d.name, category: d.category ?? null,
      cost_price: d.cost_price, sale_price: d.sale_price, monthly_qty: d.monthly_qty,
      revenue, ingredientCost, overheadShare, overheadPerUnit,
      fullUnitCost, unitProfit, unitMarginPct, monthlyProfit, breakevenQty,
    };
  });

  const coveredOverhead = out.reduce((s, d) => s + d.overheadShare, 0);
  return {
    dishes: out,
    totals: {
      overhead,
      revenue: totalRevenue,
      ingredientCost: totalIngredient,
      grossProfit: totalRevenue - totalIngredient,
      netProfit: totalRevenue - totalIngredient - overhead,
      totalQty,
      coveredOverhead,
    },
    method,
  };
}

// --- Időszak-kezelés --------------------------------------------------------
// Napok száma két dátum között (inclusive). Hibás/fordított tartomány = 0.
export function periodDays(startISO: string, endISO: string): number {
  const a = new Date(startISO).getTime();
  const b = new Date(endISO).getTime();
  if (isNaN(a) || isNaN(b) || b < a) return 0;
  return Math.round((b - a) / 86_400_000) + 1;
}

// A havi fix költség adott hosszúságú időszakra vetítve (arányosan).
export function proratedOverhead(monthly: number, days: number): number {
  if (days <= 0) return 0;
  return (monthly * 12 * days) / 365;
}

// Rövid, ember által olvasható összefoglaló a promptba (AI-javaslathoz).
export function costingSummaryText(r: CostingResult, periodLabel?: string): string {
  const lines: string[] = [];
  if (periodLabel) lines.push(`Vizsgált időszak: ${periodLabel}.`);
  lines.push(
    `Időszakra jutó fix költség (rezsi): ${formatHuf(r.totals.overhead)}. ` +
      `Időszaki árbevétel: ${formatHuf(r.totals.revenue)}. ` +
      `Alapanyagköltség: ${formatHuf(r.totals.ingredientCost)}. ` +
      `Étterem időszaki valós profit (árbevétel − alapanyag − rezsi): ${formatHuf(r.totals.netProfit)}.`
  );
  lines.push(
    `Rezsi-allokáció módszere: ${r.method === "revenue" ? "árbevétel-arányos" : "darab-arányos"}.`
  );
  lines.push(``, `Ételenkénti bontás:`);
  for (const d of r.dishes) {
    lines.push(
      `- ${d.name}: ${d.monthly_qty} db az időszakban, eladási ár ${formatHuf(d.sale_price)}, ` +
        `alapanyag ${formatHuf(d.cost_price)}/adag, rá jutó rezsi ${formatHuf(d.overheadPerUnit)}/adag, ` +
        `teljes önköltség ${formatHuf(d.fullUnitCost)}/adag, valós darab-profit ${formatHuf(d.unitProfit)} ` +
        `(${Math.round(d.unitMarginPct)}% árrés), időszaki profit ${formatHuf(d.monthlyProfit)}, ` +
        `fedezeti darabszám ${d.breakevenQty} db.`
    );
  }
  return lines.join("\n");
}

// --- Kredit + kimenet -------------------------------------------------------
// A riport lekérése kerül kreditbe (a bevitel/mentés ingyen). Admin/sales megkerüli.
export const COSTING_CREDITS = Number(process.env.COSTING_CREDITS ?? 1);

// Legalább ennyi étel kell értelmes riporthoz.
export const COSTING_MIN_DISHES = 1;

// --- AI prompt (admin-szerkeszthető szegmensek) -----------------------------
export const COSTING_DEFAULT_SEGMENTS = {
  intro: `Te egy tapasztalt vendéglátóipari pénzügyi tanácsadó vagy. A feladatod, hogy a megadott étterem-adatokból (a fix költségek az adott időszakra vetítve, valamint az ételek önköltsége, ára és az időszakban eladott mennyisége) érthető, gyakorlatias elemzést és javaslatot adj a tulajdonosnak. A számokat készen megkapod — NE számolj újra, hanem értelmezd őket.`,
  task: `Írj tömör, tagolt elemzést magyarul: (1) egy mondatos összkép az étterem időszaki profitjáról; (2) mely ételek a legjövedelmezőbbek és melyek visznek veszteséget a rájuk jutó rezsivel együtt; (3) ételre lebontott, konkrét javaslat a megtérülés javítására (ár emelése, alapanyag-önköltség csökkentése, vagy forgalom növelése — számszerű célértékkel, ahol lehet); (4) egy záró, priorizált teendőlista 3-5 ponttal. Legyél konkrét és a megadott számokra hivatkozz.`,
};

export const COSTING_DATA_BLOCK_PREVIEW = `Étterem havi adatok és számított önköltségek:
{fix költségek + ételenkénti önköltség/profit összefoglaló}`;

// A zárolt adat-blokk + a finomítható szegmensek összefűzése.
export function composeCostingPrompt(
  summaryText: string,
  segments: { intro?: string; task?: string }
): string {
  const intro = (segments.intro ?? COSTING_DEFAULT_SEGMENTS.intro).trim();
  const task = (segments.task ?? COSTING_DEFAULT_SEGMENTS.task).trim();
  return `${intro}\n\nÉtterem havi adatok és számított önköltségek:\n${summaryText}\n\n${task}`;
}
