// Admin metrikák aggregálása (bevétel vs. API-költség, profitmarzs).
// Service-role klienssel olvas (megkerüli az RLS-t) — a HÍVÓ ellenőrzi az admin jogot.
import { createAdminClient } from "@/lib/supabase/admin";
import { HUF_PER_USD } from "@/lib/costs";

export type FeatureCost = {
  feature: string;
  serviceName: string;
  count: number;
  units: number;
  costUsd: number;
};

export type Metrics = {
  revenueHuf: number;
  costUsd: number;
  costHuf: number;
  profitHuf: number;
  marginPct: number | null;
  purchases: number;
  creditsSold: number;
  generations: number;
  hufPerUsd: number;
  byFeature: FeatureCost[];
};

export async function getMetrics(): Promise<Metrics> {
  const admin = createAdminClient();

  // Bevétel a vásárlásokból.
  const { data: purchases } = await admin
    .from("credit_purchases")
    .select("amount_huf, credits");
  const revenueHuf = (purchases ?? []).reduce(
    (s, p) => s + (Number(p.amount_huf) || 0),
    0
  );
  const creditsSold = (purchases ?? []).reduce(
    (s, p) => s + (Number(p.credits) || 0),
    0
  );

  // Költség a napló-táblából.
  const { data: costs } = await admin
    .from("api_cost_logs")
    .select("feature, service_name, units, estimated_cost_usd");
  const costUsd = (costs ?? []).reduce(
    (s, c) => s + (Number(c.estimated_cost_usd) || 0),
    0
  );

  // Csoportosítás funkció + külső API szerint.
  const map = new Map<string, FeatureCost>();
  for (const c of costs ?? []) {
    const key = `${c.feature}|${c.service_name}`;
    const e =
      map.get(key) ??
      { feature: c.feature, serviceName: c.service_name, count: 0, units: 0, costUsd: 0 };
    e.count += 1;
    e.units += Number(c.units) || 0;
    e.costUsd += Number(c.estimated_cost_usd) || 0;
    map.set(key, e);
  }
  const byFeature = [...map.values()].sort((a, b) => b.costUsd - a.costUsd);

  const costHuf = costUsd * HUF_PER_USD;
  const profitHuf = revenueHuf - costHuf;
  const marginPct = revenueHuf > 0 ? (profitHuf / revenueHuf) * 100 : null;

  return {
    revenueHuf,
    costUsd,
    costHuf,
    profitHuf,
    marginPct,
    purchases: (purchases ?? []).length,
    creditsSold,
    generations: (costs ?? []).length,
    hufPerUsd: HUF_PER_USD,
    byFeature,
  };
}
