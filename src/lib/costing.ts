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
  // Napi menük ára — NEM költség, csak beállítás (a fix költség összegébe nem számít bele).
  menu_price_2: number; // 2 fogásos napi menü ára
  menu_price_3: number; // 3 fogásos napi menü ára
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
  menu_price_2: 0, menu_price_3: 0,
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
  // A menü-árak külön kezelendők: beállítások, nem költségtételek.
  out.menu_price_2 = toAmount(r.menu_price_2);
  out.menu_price_3 = toAmount(r.menu_price_3);
  return out;
}

// --- Étel-szintű bemenet a kalkulációhoz ------------------------------------
// Egy étel két csatornán fogyhat:
//  - ÉTLAP: saját eladási ára van, kis szériás önköltséggel (cost_price/sale_price)
//  - MENÜ: nincs saját ára (a napi MENÜNEK van ára), csak előállítási költsége (menu_cost_price)
export type CostingDishInput = {
  dish_id: string;
  name: string;
  category?: string | null;
  cost_price: number | null;      // étlapos önköltség / adag
  sale_price: number | null;      // étlapos eladási ár / adag
  menu_cost_price: number | null; // menüben az előállítási költség / adag
  qty_etlap: number;              // étlapról eladott adag
  qty_menu: number;               // menübe felhasznált adag
};

// Az időszakban eladott napi menük (bevételi oldal).
export type MenuSalesInput = { qty2: number; qty3: number; price2: number; price3: number };

// Étlapos étel eredménye (saját árral → van darab-profit).
export type EtlapDishResult = {
  dish_id: string; name: string; category?: string | null;
  qty: number; sale_price: number; cost_price: number;
  revenue: number; ingredientCost: number;
  overheadShare: number; overheadPerUnit: number;
  fullUnitCost: number;   // alapanyag + rá jutó rezsi (adag)
  unitProfit: number;     // valós darab-profit
  unitMarginPct: number;
  periodProfit: number;   // időszaki profit erre az ételre
  breakevenQty: number;
};

// Menübe felhasznált étel (csak költségoldal — a bevétel a menü ára).
export type MenuDishResult = {
  dish_id: string; name: string; category?: string | null;
  qty: number; unitCost: number; totalCost: number;
};

export type CostingResult = {
  etlap: {
    dishes: EtlapDishResult[];
    revenue: number; ingredientCost: number; overhead: number; profit: number;
  };
  menu: {
    dishes: MenuDishResult[];
    qty2: number; qty3: number; count: number;
    revenue: number; ingredientCost: number; overhead: number; profit: number;
    perMenuRevenue: number;  // átlagos menü-ár
    perMenuCost: number;     // egy menü átlagos előállítási költsége
    perMenuOverhead: number; // egy menüre jutó rezsi
    perMenuProfit: number;   // ennyi marad egy menün
  };
  totals: {
    overhead: number; revenue: number; ingredientCost: number;
    oneTimeIncome: number; // egyszeri bevétel az időszakra (nem értékesítésből)
    netProfit: number;
  };
};

// Fő számítás. A rezsit előbb a két csatorna közt osztjuk el árbevétel-arányosan,
// az étlapon belül pedig ételenként szintén árbevétel-arányosan.
export function computeCosting(
  dishes: CostingDishInput[],
  menuSales: MenuSalesInput,
  overhead: number,
  oneTimeIncome = 0
): CostingResult {
  // ÉTLAP oldal — csak az árazott, étlapról fogyott ételek.
  const etlapItems = dishes.filter((d) => d.qty_etlap > 0 && d.cost_price != null && d.sale_price != null);
  const etlapRevenue = etlapItems.reduce((s, d) => s + (d.sale_price as number) * d.qty_etlap, 0);
  const etlapIngredient = etlapItems.reduce((s, d) => s + (d.cost_price as number) * d.qty_etlap, 0);

  // MENÜ oldal — a menübe felhasznált adagok költsége, bevétel a menük árából.
  const menuItems = dishes.filter((d) => d.qty_menu > 0 && d.menu_cost_price != null);
  const menuIngredient = menuItems.reduce((s, d) => s + (d.menu_cost_price as number) * d.qty_menu, 0);
  const menuCount = menuSales.qty2 + menuSales.qty3;
  const menuRevenue = menuSales.qty2 * menuSales.price2 + menuSales.qty3 * menuSales.price3;

  // Rezsi szétosztása a két csatorna közt (árbevétel-arányosan).
  const totalRevenue = etlapRevenue + menuRevenue;
  const etlapOverhead = totalRevenue > 0 ? (overhead * etlapRevenue) / totalRevenue : 0;
  const menuOverhead = overhead - etlapOverhead;

  const etlapDishes: EtlapDishResult[] = etlapItems.map((d) => {
    const sale = d.sale_price as number;
    const cost = d.cost_price as number;
    const revenue = sale * d.qty_etlap;
    const ingredientCost = cost * d.qty_etlap;
    const overheadShare = etlapRevenue > 0 ? (etlapOverhead * revenue) / etlapRevenue : 0;
    const overheadPerUnit = d.qty_etlap > 0 ? overheadShare / d.qty_etlap : 0;
    const fullUnitCost = cost + overheadPerUnit;
    const unitProfit = sale - fullUnitCost;
    const contribution = sale - cost;
    return {
      dish_id: d.dish_id, name: d.name, category: d.category ?? null,
      qty: d.qty_etlap, sale_price: sale, cost_price: cost,
      revenue, ingredientCost, overheadShare, overheadPerUnit,
      fullUnitCost, unitProfit,
      unitMarginPct: sale > 0 ? (unitProfit / sale) * 100 : 0,
      periodProfit: unitProfit * d.qty_etlap,
      breakevenQty: contribution > 0 ? Math.ceil(overheadShare / contribution) : 0,
    };
  });

  const menuDishes: MenuDishResult[] = menuItems.map((d) => ({
    dish_id: d.dish_id, name: d.name, category: d.category ?? null,
    qty: d.qty_menu,
    unitCost: d.menu_cost_price as number,
    totalCost: (d.menu_cost_price as number) * d.qty_menu,
  }));

  const etlapProfit = etlapRevenue - etlapIngredient - etlapOverhead;
  const menuProfit = menuRevenue - menuIngredient - menuOverhead;
  const ingredientCost = etlapIngredient + menuIngredient;

  return {
    etlap: {
      dishes: etlapDishes.sort((a, b) => b.periodProfit - a.periodProfit),
      revenue: etlapRevenue, ingredientCost: etlapIngredient, overhead: etlapOverhead, profit: etlapProfit,
    },
    menu: {
      dishes: menuDishes.sort((a, b) => b.totalCost - a.totalCost),
      qty2: menuSales.qty2, qty3: menuSales.qty3, count: menuCount,
      revenue: menuRevenue, ingredientCost: menuIngredient, overhead: menuOverhead, profit: menuProfit,
      perMenuRevenue: menuCount > 0 ? menuRevenue / menuCount : 0,
      perMenuCost: menuCount > 0 ? menuIngredient / menuCount : 0,
      perMenuOverhead: menuCount > 0 ? menuOverhead / menuCount : 0,
      perMenuProfit: menuCount > 0 ? menuProfit / menuCount : 0,
    },
    totals: {
      overhead,
      revenue: totalRevenue,
      ingredientCost,
      oneTimeIncome,
      // Az egyszeri bevétel nem torzítja a rezsi-allokációt: a végén adódik hozzá.
      netProfit: totalRevenue - ingredientCost - overhead + oneTimeIncome,
    },
  };
}

// --- Egyszeri (nem havi) kiadások -------------------------------------------
// Egy egyszeri kiadás egy SAJÁT időszakra (period_start..period_end) vonatkozik, és
// arányosan (naponta egyenlően) oszlik el rajta. A riport csak az átfedő napok arányát számolja.
export type OneTimeKind = "expense" | "income";
export type OneTimeCost = {
  id: string; label: string; amount: number;
  period_start: string; period_end: string;
  kind: OneTimeKind; // kiadás vagy bevétel (pl. támogatás, eszköz eladása)
};

// Egy egyszeri kiadás [start,end] riport-időszakra jutó (arányos) része.
export function oneTimeShare(c: OneTimeCost, start: string, end: string): number {
  const total = periodDays(c.period_start, c.period_end);
  if (total <= 0) return 0;
  const oStart = c.period_start > start ? c.period_start : start;
  const oEnd = c.period_end < end ? c.period_end : end;
  const overlap = periodDays(oStart, oEnd); // 0, ha nincs átfedés
  return ((Number(c.amount) || 0) * overlap) / total;
}

// Az adott [start,end] riport-időszakra jutó egyszeri tételek összege (arányosan).
// kind megadásával csak a kiadásokat vagy csak a bevételeket összegzi.
export function oneTimeInRange(
  costs: OneTimeCost[], start: string, end: string, kind?: OneTimeKind
): number {
  return costs
    .filter((c) => !kind || (c.kind ?? "expense") === kind)
    .reduce((s, c) => s + oneTimeShare(c, start, end), 0);
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
export function costingSummaryText(r: CostingResult, periodLabel?: string, oneTimeTotal?: number): string {
  const lines: string[] = [];
  if (periodLabel) lines.push(`Vizsgált időszak: ${periodLabel}.`);
  if (oneTimeTotal && oneTimeTotal > 0) {
    lines.push(`Ebből egyszeri (nem havi) kiadás az időszakban: ${formatHuf(oneTimeTotal)}.`);
  }
  if (r.totals.oneTimeIncome > 0) {
    lines.push(`Egyszeri (nem értékesítésből származó) bevétel az időszakban: ${formatHuf(r.totals.oneTimeIncome)}.`);
  }
  lines.push(
    `Időszakra jutó fix költség (rezsi + egyszeri kiadás): ${formatHuf(r.totals.overhead)}. ` +
      `Időszaki árbevétel: ${formatHuf(r.totals.revenue)}. ` +
      `Alapanyagköltség: ${formatHuf(r.totals.ingredientCost)}. ` +
      `Étterem időszaki valós profit (árbevétel − alapanyag − rezsi + egyszeri bevétel): ${formatHuf(r.totals.netProfit)}.`
  );
  lines.push(
    `A rezsit árbevétel-arányosan osztjuk el az étlap és a menü csatorna között, az étlapon belül ételenként szintén.`
  );

  // ÉTLAP
  lines.push(
    ``,
    `ÉTLAP csatorna — árbevétel ${formatHuf(r.etlap.revenue)}, alapanyag ${formatHuf(r.etlap.ingredientCost)}, ` +
      `rá jutó rezsi ${formatHuf(r.etlap.overhead)}, profit ${formatHuf(r.etlap.profit)}.`,
    `Ételenként:`
  );
  for (const d of r.etlap.dishes) {
    lines.push(
      `- ${d.name}: ${d.qty} db étlapról, eladási ár ${formatHuf(d.sale_price)}, ` +
        `alapanyag ${formatHuf(d.cost_price)}/adag, rá jutó rezsi ${formatHuf(d.overheadPerUnit)}/adag, ` +
        `teljes önköltség ${formatHuf(d.fullUnitCost)}/adag, valós darab-profit ${formatHuf(d.unitProfit)} ` +
        `(${Math.round(d.unitMarginPct)}% árrés), időszaki profit ${formatHuf(d.periodProfit)}, ` +
        `fedezeti darabszám ${d.breakevenQty} db.`
    );
  }
  if (!r.etlap.dishes.length) lines.push(`- (nincs étlapos eladás az időszakban)`);

  // MENÜ
  lines.push(
    ``,
    `MENÜ csatorna — ${r.menu.count} eladott napi menü (${r.menu.qty2} db 2 fogásos, ${r.menu.qty3} db 3 fogásos), ` +
      `bevétel ${formatHuf(r.menu.revenue)}, előállítási költség ${formatHuf(r.menu.ingredientCost)}, ` +
      `rá jutó rezsi ${formatHuf(r.menu.overhead)}, profit ${formatHuf(r.menu.profit)}.`
  );
  if (r.menu.count > 0) {
    lines.push(
      `EGY MENÜRE vetítve: átlagos ár ${formatHuf(r.menu.perMenuRevenue)}, előállítás ${formatHuf(r.menu.perMenuCost)}, ` +
        `rezsi ${formatHuf(r.menu.perMenuOverhead)}, marad ${formatHuf(r.menu.perMenuProfit)}.`
    );
    lines.push(`A menükbe felhasznált ételek költsége:`);
    for (const d of r.menu.dishes) {
      lines.push(`- ${d.name}: ${d.qty} adag × ${formatHuf(d.unitCost)} = ${formatHuf(d.totalCost)}`);
    }
  } else {
    lines.push(`- (nincs menü-eladás az időszakban)`);
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
