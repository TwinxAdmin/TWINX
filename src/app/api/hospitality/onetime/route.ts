// /api/hospitality/onetime — egyszeri (nem havi) kiadások, dátummal. Ingyenes.
// GET: saját lista. POST: új tétel {label, amount, spent_on}. DELETE (?id=): törlés.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { toAmount } from "@/lib/costing";

export const runtime = "nodejs";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s).getTime());
const SELECT = "id, label, amount, spent_on";

export async function GET() {
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });

  const { data, error } = await supabase
    .from("restaurant_one_time_costs")
    .select(SELECT)
    .order("spent_on", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ costs: data ?? [] });
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

  const label = String(body.label ?? "").trim().slice(0, 120);
  const amount = toAmount(body.amount);
  const spent_on = String(body.spent_on ?? "").trim();
  if (!label) return NextResponse.json({ error: "Add meg a kiadás megnevezését." }, { status: 422 });
  if (amount <= 0) return NextResponse.json({ error: "Az összeg legyen pozitív." }, { status: 422 });
  if (!isDate(spent_on)) return NextResponse.json({ error: "Hibás dátum." }, { status: 422 });

  const { data, error } = await supabase
    .from("restaurant_one_time_costs")
    .insert({ user_id: user.id, label, amount, spent_on })
    .select(SELECT)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, cost: data });
}

export async function DELETE(request: Request) {
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Hiányzó azonosító." }, { status: 400 });

  const { error } = await supabase.from("restaurant_one_time_costs").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
