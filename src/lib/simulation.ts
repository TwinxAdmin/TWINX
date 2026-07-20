// Vendéglátás — Profit-terv (előretekintő szimuláció).
// „Mit adjak el jövő héten, hogy meglegyen az 1 millió?" A partner összeállít egy mixet
// (étlapos ételek darabszáma + eladott napi menük), megadhat cél-profitot, és eldöntheti,
// hogy csak az ételeken elért profitot nézzük, vagy az étterem egyéb költségeit is.
//
// Ez TERVEZÉS, nem riport: feltételezett darabszámokkal dolgozik. A tényleges eladásokból
// az Önköltség & profit modul riportja számol.
import { formatHuf } from "@/lib/hospitality";

export type SimMode = "dish" | "full"; // csak ételprofit | minden költséggel

export type SimDishInput = {
  dish_id: string;
  name: string;
  category?: string | null;
  sale_price: number;
  cost_price: number;
  qty: number;
};

export type SimMenuInput = {
  qty2: number; qty3: number;   // tervezett eladott menük
  price2: number; price3: number; // menü-árak (beállításból)
  cost2: number; cost3: number;   // menünkénti előállítási költség (becsült, felülírható)
};

export type SimDishResult = {
  dish_id: string; name: string; qty: number;
  unitProfit: number; revenue: number; cost: number; profit: number;
};

export type SimResult = {
  mode: SimMode;
  dishes: SimDishResult[];
  etlap: { revenue: number; cost: number; profit: number };
  menu: { qty2: number; qty3: number; count: number; revenue: number; cost: number; profit: number };
  otherCosts: number;    // arányosított rezsi + egyszeri kiadás (csak "full" módban)
  oneTimeIncome: number; // egyszeri bevétel (csak "full" módban)
  revenue: number;
  cost: number;
  profit: number;        // a végső, választott mód szerinti profit
  target: number;        // cél-profit (0 = nincs megadva)
  gap: number;           // target − profit (pozitív = hiányzik)
  scaleFactor: number | null;  // ennyiszeresére kell a mix a célhoz
  bestLever: { name: string; unitProfit: number; extraQty: number } | null;
};

// Fő számítás. otherCosts/oneTimeIncome csak "full" módban számít bele.
export function computeSimulation(params: {
  mode: SimMode;
  dishes: SimDishInput[];
  menu: SimMenuInput;
  otherCosts: number;
  oneTimeIncome: number;
  target: number;
}): SimResult {
  const { mode, menu, target } = params;

  const dishes: SimDishResult[] = params.dishes
    .filter((d) => d.qty > 0)
    .map((d) => {
      const unitProfit = d.sale_price - d.cost_price;
      return {
        dish_id: d.dish_id, name: d.name, qty: d.qty, unitProfit,
        revenue: d.sale_price * d.qty,
        cost: d.cost_price * d.qty,
        profit: unitProfit * d.qty,
      };
    })
    .sort((a, b) => b.profit - a.profit);

  const etlap = {
    revenue: dishes.reduce((s, d) => s + d.revenue, 0),
    cost: dishes.reduce((s, d) => s + d.cost, 0),
    profit: dishes.reduce((s, d) => s + d.profit, 0),
  };

  const menuRevenue = menu.qty2 * menu.price2 + menu.qty3 * menu.price3;
  const menuCost = menu.qty2 * menu.cost2 + menu.qty3 * menu.cost3;
  const menuRes = {
    qty2: menu.qty2, qty3: menu.qty3, count: menu.qty2 + menu.qty3,
    revenue: menuRevenue, cost: menuCost, profit: menuRevenue - menuCost,
  };

  const otherCosts = mode === "full" ? params.otherCosts : 0;
  const oneTimeIncome = mode === "full" ? params.oneTimeIncome : 0;

  const revenue = etlap.revenue + menuRes.revenue;
  const cost = etlap.cost + menuRes.cost + otherCosts;
  const profit = revenue - cost + oneTimeIncome;

  const gap = target > 0 ? target - profit : 0;

  // Mennyivel kell megszorozni a jelenlegi mixet a cél eléréséhez?
  // Csak "dish" módban egyenes arányos; "full" módban a fix költséget is fedezni kell.
  let scaleFactor: number | null = null;
  const mixProfit = etlap.profit + menuRes.profit; // a mix hozadéka (fix költség nélkül)
  if (target > 0 && mixProfit > 0) {
    const needed = mode === "full" ? target + otherCosts - oneTimeIncome : target;
    scaleFactor = needed / mixProfit;
  }

  // A leghatékonyabb emelőkar: a legnagyobb darab-profitú étel.
  let bestLever: SimResult["bestLever"] = null;
  if (gap > 0) {
    const best = dishes.reduce<SimDishResult | null>(
      (b, d) => (d.unitProfit > (b?.unitProfit ?? 0) ? d : b), null
    );
    if (best && best.unitProfit > 0) {
      bestLever = { name: best.name, unitProfit: best.unitProfit, extraQty: Math.ceil(gap / best.unitProfit) };
    }
  }

  return {
    mode, dishes, etlap, menu: menuRes,
    otherCosts, oneTimeIncome, revenue, cost, profit,
    target, gap, scaleFactor, bestLever,
  };
}

// Rövid összefoglaló az AI-értékeléshez.
export function simulationSummaryText(r: SimResult, periodLabel: string): string {
  const lines: string[] = [];
  lines.push(`Tervezett időszak: ${periodLabel}.`);
  lines.push(
    `Számítási mód: ${r.mode === "full" ? "az étterem egyéb költségeivel együtt" : "csak az ételeken elért profit (egyéb költségek nélkül)"}.`
  );
  lines.push(
    `Tervezett árbevétel: ${formatHuf(r.revenue)}. Közvetlen költség (alapanyag): ${formatHuf(r.etlap.cost + r.menu.cost)}.` +
      (r.mode === "full" ? ` Egyéb költség az időszakra: ${formatHuf(r.otherCosts)}.` : "") +
      (r.oneTimeIncome > 0 ? ` Egyszeri bevétel: ${formatHuf(r.oneTimeIncome)}.` : "") +
      ` Várható profit: ${formatHuf(r.profit)}.`
  );
  if (r.target > 0) {
    lines.push(
      r.gap > 0
        ? `A partner célja ${formatHuf(r.target)} profit — ebből ${formatHuf(r.gap)} hiányzik.`
        : `A partner célja ${formatHuf(r.target)} profit — a terv ezt ${formatHuf(-r.gap)}-tal meg is haladja.`
    );
    if (r.scaleFactor && r.gap > 0) {
      lines.push(`A jelenlegi mixet nagyjából ${Math.round(r.scaleFactor * 100)}%-ra kellene felskálázni a célhoz.`);
    }
    if (r.bestLever) {
      lines.push(
        `A legnagyobb darab-profitú tétel a(z) „${r.bestLever.name}" (${formatHuf(r.bestLever.unitProfit)}/adag); ` +
          `önmagában ebből ${r.bestLever.extraQty} adaggal többet eladva bejönne a hiány.`
      );
    }
  }
  lines.push(``, `Tervezett tételek (darabszám → darab-profit → összprofit):`);
  for (const d of r.dishes) {
    lines.push(`- ${d.name}: ${d.qty} adag × ${formatHuf(d.unitProfit)} = ${formatHuf(d.profit)}`);
  }
  if (r.menu.count > 0) {
    lines.push(
      `- Napi menük: ${r.menu.qty2} db 2 fogásos + ${r.menu.qty3} db 3 fogásos = ${formatHuf(r.menu.profit)} profit ` +
        `(${formatHuf(r.menu.revenue)} bevétel, ${formatHuf(r.menu.cost)} előállítás).`
    );
  }
  return lines.join("\n");
}

// A profit-terv lekérésének kredit-ára (a letölthető PDF-ért).
export const SIMULATION_CREDITS = Number(process.env.SIMULATION_CREDITS ?? 1);

// --- AI prompt (admin-szerkeszthető szegmensek) -----------------------------
export const SIMULATION_DEFAULT_SEGMENTS = {
  intro: `Te egy tapasztalt vendéglátóipari üzleti tanácsadó vagy. A partner egy JÖVŐBELI időszakra tervez: megadta, melyik ételből hány adagot szeretne eladni, és mekkora profitot céloz. A számokat készen megkapod — NE számolj újra, hanem értelmezd őket és adj gyakorlatias tanácsot.`,
  task: `Írj rövid, tagolt értékelést magyarul: (1) egy mondat arról, reális-e a terv és teljesül-e a cél; (2) mely tételekre támaszkodik leginkább a profit, és ez mennyire kockázatos (ha abból kevesebb fogy, mi történik); (3) konkrét javaslat a cél eléréséhez — miből érdemes többet eladni, vagy hol lehet árat emelni, számokkal; (4) 2-3 pontos teendőlista. Ne találj ki új ételeket, csak a megadottakkal dolgozz.`,
};

export const SIMULATION_DATA_BLOCK_PREVIEW = `Tervezett időszak, mix és cél:
{időszak + ételek darabszáma + menük + cél-profit + számított eredmény}`;

export function composeSimulationPrompt(
  summaryText: string,
  segments: { intro?: string; task?: string }
): string {
  const intro = (segments.intro ?? SIMULATION_DEFAULT_SEGMENTS.intro).trim();
  const task = (segments.task ?? SIMULATION_DEFAULT_SEGMENTS.task).trim();
  return `${intro}\n\nTervezett időszak, mix és cél:\n${summaryText}\n\n${task}`;
}
