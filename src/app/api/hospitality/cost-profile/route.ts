// /api/hospitality/cost-profile — az étteremszintű havi fix költség-profil.
// GET: a saját profil (vagy üres). POST: mentés (upsert). Ingyenes (nincs kredit).
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { COST_FIELDS, normalizeCostProfile, costProfileTotal } from "@/lib/costing";

export const runtime = "nodejs";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

const SELECT = "rent, wages, utilities, insurance, accounting, marketing, depreciation, bank_fees, delivery_fees, other, extra_items, menu_price_2, menu_price_3, updated_at";

export async function GET() {
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });

  const { data, error } = await supabase
    .from("restaurant_cost_profile")
    .select(SELECT)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const profile = normalizeCostProfile((data ?? null) as Record<string, unknown> | null);
  return NextResponse.json({ profile, total: costProfileTotal(profile), updated_at: data?.updated_at ?? null });
}

export async function POST(request: Request) {
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Érvénytelen kérés." }, { status: 400 });
  }

  const profile = normalizeCostProfile(body);
  const row: Record<string, unknown> = {
    user_id: user.id,
    extra_items: profile.extra_items,
    // Menü-árak: beállítások, nem költségtételek (a fix költség összegébe nem számítanak).
    menu_price_2: profile.menu_price_2,
    menu_price_3: profile.menu_price_3,
    updated_at: new Date().toISOString(),
  };
  for (const f of COST_FIELDS) row[f.key] = profile[f.key];

  const { data, error } = await supabase
    .from("restaurant_cost_profile")
    .upsert(row, { onConflict: "user_id" })
    .select(SELECT)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const saved = normalizeCostProfile(data as Record<string, unknown>);
  return NextResponse.json({ ok: true, profile: saved, total: costProfileTotal(saved) });
}
