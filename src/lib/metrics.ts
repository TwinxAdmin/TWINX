// Admin metrikák aggregálása (bevétel vs. API-költség, profitmarzs).
// Service-role klienssel olvas (megkerüli az RLS-t) — a HÍVÓ ellenőrzi az admin jogot.
import { createAdminClient } from "@/lib/supabase/admin";
import { HUF_PER_USD } from "@/lib/costs";
import { featureLabel } from "@/lib/activity";

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

// --- Felhasználónkénti bontás -----------------------------------------
export type UserMetric = {
  userId: string;
  email: string;
  role: string;
  uses: number; // összes generálás (usage_history)
  costUsd: number; // becsült API-önköltség
  revenueHuf: number; // tőle származó bevétel
  creditsBought: number; // vásárolt kredit
  features: { label: string; count: number }[]; // funkciónkénti bontás
};

export async function getUserMetrics(): Promise<{ users: UserMetric[]; hufPerUsd: number }> {
  const admin = createAdminClient();

  // Regisztrált felhasználók (e-mail + id).
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const emailById = new Map<string, string>();
  for (const u of list?.users ?? []) emailById.set(u.id, u.email ?? "—");

  const { data: profiles } = await admin.from("profiles").select("id, role");
  const roleById = new Map<string, string>((profiles ?? []).map((p) => [p.id as string, (p.role as string) ?? "user"]));

  const [{ data: uh }, { data: costs }, { data: purch }] = await Promise.all([
    admin.from("usage_history").select("user_id, feature_used"),
    admin.from("api_cost_logs").select("user_id, estimated_cost_usd"),
    admin.from("credit_purchases").select("user_id, amount_huf, credits"),
  ]);

  const rows = new Map<string, UserMetric>();
  const featMap = new Map<string, Map<string, number>>();
  const ensure = (id: string): UserMetric => {
    let e = rows.get(id);
    if (!e) {
      e = {
        userId: id,
        email: emailById.get(id) ?? "—",
        role: roleById.get(id) ?? "user",
        uses: 0,
        costUsd: 0,
        revenueHuf: 0,
        creditsBought: 0,
        features: [],
      };
      rows.set(id, e);
    }
    return e;
  };

  // Minden regisztrált user szerepeljen (0 használattal is).
  for (const u of list?.users ?? []) ensure(u.id);

  for (const r of uh ?? []) {
    const id = r.user_id as string | null;
    if (!id) continue;
    ensure(id).uses += 1;
    const fm = featMap.get(id) ?? new Map<string, number>();
    fm.set(r.feature_used as string, (fm.get(r.feature_used as string) ?? 0) + 1);
    featMap.set(id, fm);
  }
  for (const c of costs ?? []) {
    const id = c.user_id as string | null;
    if (!id) continue;
    ensure(id).costUsd += Number(c.estimated_cost_usd) || 0;
  }
  for (const p of purch ?? []) {
    const id = p.user_id as string | null;
    if (!id) continue;
    const e = ensure(id);
    e.revenueHuf += Number(p.amount_huf) || 0;
    e.creditsBought += Number(p.credits) || 0;
  }
  for (const [id, fm] of featMap) {
    const e = rows.get(id);
    if (!e) continue;
    e.features = [...fm.entries()]
      .map(([f, c]) => ({ label: featureLabel(f), count: c }))
      .sort((a, b) => b.count - a.count);
  }

  const users = [...rows.values()].sort((a, b) => b.uses - a.uses || b.costUsd - a.costUsd);
  return { users, hufPerUsd: HUF_PER_USD };
}

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
